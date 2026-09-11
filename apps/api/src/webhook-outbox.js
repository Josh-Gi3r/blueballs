/** Durable webhook delivery engine.
 *
 * Delivery semantics are at-least-once. The stable delivery ID remains the same
 * across retries so receivers can deduplicate. A process can die after an HTTP
 * request reached the receiver but before Blueballs recorded the response; that
 * ambiguity is never represented as exactly-once delivery.
 *
 * Production webhook signing secrets are sealed before both the webhook target
 * row and durable outbox job are persisted. Plaintext exists only in memory at
 * target creation/delivery time.
 */
import { createHmac, randomBytes } from "node:crypto";
import {
  collection,
  ksuid,
  now,
  inRequestScope,
  subscribeToEvents,
  subscribeToEventsBeforeCommit,
} from "./kernel.js";
import { WEBHOOK_DELIVERY_MODE, fetchWebhook } from "./webhook-egress.js";
import {
  openProviderPayload,
  sealProviderPayload,
} from "./provider-payload-crypto.js";

const API_VERSION = "2026-08-06";
const DEFAULT_RETRY_DELAYS_MS = [0, 1_000, 10_000, 60_000, 300_000, 1_800_000];
const LEASE_MS = Number(process.env.WEBHOOK_LEASE_MS || 30_000);
const PUMP_MS = Number(process.env.WEBHOOK_PUMP_MS || 1_000);
const IS_CLOUDFLARE = process.env.CLOUDFLARE_WORKER === "true";

function retryDelays() {
  const raw = process.env.WEBHOOK_RETRY_DELAYS_MS;
  if (!raw) return DEFAULT_RETRY_DELAYS_MS;
  const parsed = raw.split(",").map((value) => Number(value.trim()));
  if (
    !parsed.length ||
    parsed.some((value) => !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error(
      "WEBHOOK_RETRY_DELAYS_MS must be a comma-separated list of non-negative integer milliseconds",
    );
  }
  return parsed;
}
const RETRY_DELAYS_MS = retryDelays();
if (!Number.isSafeInteger(LEASE_MS) || LEASE_MS < 1) {
  throw new Error("WEBHOOK_LEASE_MS must be a positive integer");
}
if (!Number.isSafeInteger(PUMP_MS) || PUMP_MS < 10) {
  throw new Error("WEBHOOK_PUMP_MS must be an integer of at least 10ms");
}

const webhookStore = collection("webhooks");
export const deliveries = collection("deliveries");
const outbox = collection("webhookOutbox");

/** PersistentMap returns mutation-tracking Proxy objects inside a request scope.
 * structuredClone() rejects Proxy values. Webhook rows are JSON-only, so a JSON
 * round trip gives us an untracked copy without leaking the storage proxy into
 * crypto/network code. */
function jsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sealSecret(secret) {
  if (typeof secret !== "string" || !secret) {
    throw new Error("Webhook signing secret is missing");
  }
  return sealProviderPayload({ secret });
}

function openSecret(envelope) {
  const value = openProviderPayload(envelope);
  if (typeof value?.secret !== "string" || !value.secret) {
    throw new Error("Webhook signing-secret envelope is malformed");
  }
  return value.secret;
}

function storedWebhook(value) {
  const row = jsonClone(value);
  if (row.secret) {
    row.secret_envelope = sealSecret(row.secret);
    delete row.secret;
  }
  return row;
}

function runtimeWebhook(value) {
  if (!value) return value;
  const row = jsonClone(value);
  if (row.secret_envelope) row.secret = openSecret(row.secret_envelope);
  return row;
}

/** Storage facade: target secrets are sealed before persistence while route/outbox
 * code receives a transient plaintext value only when it actually needs to sign. */
export const webhooks = {
  get(id) {
    return runtimeWebhook(webhookStore.get(id));
  },
  has(id) {
    return webhookStore.has(id);
  },
  set(id, value) {
    webhookStore.set(id, storedWebhook(value));
    return this;
  },
  delete(id) {
    return webhookStore.delete(id);
  },
  *values() {
    for (const value of webhookStore.values()) yield runtimeWebhook(value);
  },
  *entries() {
    for (const [id, value] of webhookStore.entries()) {
      yield [id, runtimeWebhook(value)];
    }
  },
  get size() {
    return webhookStore.size;
  },
  [Symbol.iterator]() {
    return this.entries();
  },
};

export function withoutSecret(wh) {
  const {
    secret: _secret,
    secret_envelope: _secretEnvelope,
    ...publicTarget
  } = wh;
  return publicTarget;
}

function newDelivery(wh, evt, opts = {}) {
  const deliveryId = ksuid("whd");
  const createdAt = now();
  const eventCreatedAt = evt.created_at ?? createdAt;
  const record = {
    id: deliveryId,
    object: "webhook_delivery",
    webhook: wh.id,
    event_id: evt.id,
    event_type: evt.type,
    event_created_at: eventCreatedAt,
    data: evt.data,
    url: wh.url,
    replay: !!opts.replay,
    replayed_from: opts.replayedFrom ?? null,
    owner: wh.owner,
    status: "pending",
    attempt_count: 0,
    response_code: null,
    error: null,
    attempted_at: null,
    next_attempt_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
  };
  const job = {
    id: ksuid("whq"),
    delivery_id: deliveryId,
    webhook: wh.id,
    event_id: evt.id,
    event_type: evt.type,
    event_created_at: eventCreatedAt,
    data: evt.data,
    url: wh.url,
    secret_envelope: wh.secret_envelope ?? sealSecret(wh.secret),
    owner: wh.owner,
    replay: !!opts.replay,
    replayed_from: opts.replayedFrom ?? null,
    status: "pending",
    attempt_count: 0,
    next_attempt_at: createdAt,
    lease_token: null,
    lease_expires_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
  deliveries.set(record.id, record);
  outbox.set(job.id, job);
  return record;
}

export function queueWebhookDelivery(wh, evt, opts = {}) {
  return newDelivery(wh, evt, opts);
}

function enqueueEvent(evt) {
  if (WEBHOOK_DELIVERY_MODE !== "allowlist") return;
  for (const wh of webhooks.values()) {
    if (wh.owner !== evt.tenant_id) continue;
    if (wh.status !== "enabled") continue;
    if (!(wh.events.includes("*") || wh.events.includes(evt.type))) continue;
    newDelivery(wh, evt);
  }
}

function due(job, at = Date.now()) {
  if (["succeeded", "failed"].includes(job.status)) return false;
  if (job.status === "in_flight") {
    return !job.lease_expires_at || Date.parse(job.lease_expires_at) <= at;
  }
  return !job.next_attempt_at || Date.parse(job.next_attempt_at) <= at;
}

async function claim(jobId) {
  return inRequestScope(() => {
    const job = outbox.get(jobId);
    if (!job || !due(job)) return null;
    if (job.attempt_count >= RETRY_DELAYS_MS.length) {
      job.status = "failed";
      job.updated_at = now();
      const record = deliveries.get(job.delivery_id);
      if (record) {
        record.status = "failed";
        record.error = record.error || "retry limit exhausted";
        record.updated_at = job.updated_at;
      }
      return null;
    }
    const token = randomBytes(16).toString("hex");
    const claimedAt = now();
    job.status = "in_flight";
    job.lease_token = token;
    job.lease_expires_at = new Date(Date.now() + LEASE_MS).toISOString();
    job.attempt_count += 1;
    job.updated_at = claimedAt;
    const record = deliveries.get(job.delivery_id);
    if (record) {
      record.status = "attempting";
      record.attempt_count = job.attempt_count;
      record.attempted_at = claimedAt;
      record.updated_at = claimedAt;
    }
    return {
      job_id: job.id,
      delivery_id: job.delivery_id,
      token,
      webhook: job.webhook,
      event_id: job.event_id,
      event_type: job.event_type,
      event_created_at: job.event_created_at,
      data: jsonClone(job.data),
      url: job.url,
      secret: job.secret_envelope
        ? openSecret(jsonClone(job.secret_envelope))
        : job.secret,
      replay: job.replay,
      attempt_count: job.attempt_count,
    };
  });
}

function signedRequest(claimed) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = {
    id: claimed.event_id,
    type: claimed.event_type,
    created: claimed.event_created_at,
    api_version: API_VERSION,
    delivery_id: claimed.delivery_id,
    data: claimed.data,
  };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", claimed.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const headers = {
    "content-type": "application/json",
    "x-webhook-id": claimed.webhook,
    "x-webhook-event": claimed.event_type,
    "x-webhook-signature": `t=${timestamp},v1=${signature}`,
    "x-webhook-delivery-id": claimed.delivery_id,
    "x-webhook-attempt": String(claimed.attempt_count),
  };
  if (claimed.replay) headers["x-webhook-replay"] = "true";
  return { body, headers };
}

function retryableHttp(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMs(response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  if (/^\d+$/.test(raw.trim())) return Number(raw.trim()) * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

async function finish(claimed, outcome) {
  return inRequestScope(() => {
    const job = outbox.get(claimed.job_id);
    if (!job || job.lease_token !== claimed.token) return null;
    const record = deliveries.get(job.delivery_id);
    const stamp = now();

    if (outcome.ok) {
      job.status = "succeeded";
      job.next_attempt_at = null;
      job.lease_token = null;
      job.lease_expires_at = null;
      job.updated_at = stamp;
      if (record) {
        record.status = "succeeded";
        record.response_code = outcome.status;
        record.error = null;
        record.next_attempt_at = null;
        record.updated_at = stamp;
      }
      return record;
    }

    const exhausted = job.attempt_count >= RETRY_DELAYS_MS.length;
    const retryable = outcome.retryable !== false && !exhausted;
    const configuredDelay =
      RETRY_DELAYS_MS[Math.min(job.attempt_count, RETRY_DELAYS_MS.length - 1)];
    const delay = Math.max(configuredDelay, outcome.retry_after_ms ?? 0);
    job.status = retryable ? "retrying" : "failed";
    job.next_attempt_at = retryable
      ? new Date(Date.now() + delay).toISOString()
      : null;
    job.lease_token = null;
    job.lease_expires_at = null;
    job.updated_at = stamp;
    if (record) {
      record.status = retryable ? "retrying" : "failed";
      record.response_code = outcome.status ?? null;
      record.error = outcome.error ?? `HTTP ${outcome.status}`;
      record.next_attempt_at = job.next_attempt_at;
      record.updated_at = stamp;
    }
    return record;
  });
}

async function attempt(jobId) {
  const claimed = await claim(jobId);
  if (!claimed) return null;
  const { body, headers } = signedRequest(claimed);
  try {
    const response = await fetchWebhook(claimed.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    return finish(claimed, {
      ok: response.ok,
      status: response.status,
      retryable: !response.ok && retryableHttp(response.status),
      retry_after_ms: response.status === 429 ? retryAfterMs(response) : null,
      error: response.ok ? null : `HTTP ${response.status}`,
    });
  } catch (error) {
    return finish(claimed, {
      ok: false,
      status: null,
      retryable: true,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

let draining = null;
export function drainWebhookOutbox({ limit = 25 } = {}) {
  if (WEBHOOK_DELIVERY_MODE !== "allowlist") return Promise.resolve([]);
  if (draining) return draining;
  draining = (async () => {
    const ids = [...outbox.values()]
      .filter((job) => due(job))
      .sort((a, b) =>
        String(a.next_attempt_at ?? a.created_at).localeCompare(
          String(b.next_attempt_at ?? b.created_at),
        ),
      )
      .slice(0, limit)
      .map((job) => job.id);
    const results = [];
    for (const id of ids) results.push(await attempt(id));
    return results.filter(Boolean);
  })().finally(() => {
    draining = null;
  });
  return draining;
}

export function nextWebhookOutboxAt() {
  let next = null;
  for (const job of outbox.values()) {
    if (["succeeded", "failed"].includes(job.status)) continue;
    const candidate =
      job.status === "in_flight"
        ? job.lease_expires_at
        : job.next_attempt_at ?? job.created_at;
    const time = Date.parse(candidate);
    if (!Number.isFinite(time)) continue;
    next = next === null ? time : Math.min(next, time);
  }
  return next;
}

export function webhookOutboxStatus() {
  const jobs = [...outbox.values()];
  return {
    pending: jobs.filter((job) => ["pending", "retrying"].includes(job.status))
      .length,
    in_flight: jobs.filter((job) => job.status === "in_flight").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    succeeded: jobs.filter((job) => job.status === "succeeded").length,
    next_attempt_at: nextWebhookOutboxAt(),
  };
}

subscribeToEventsBeforeCommit(enqueueEvent);

// Node owns its own lightweight pump. Cloudflare intentionally does not launch
// an un-awaited background Promise from an HTTP request; the Durable Object
// schedules and owns retry work through alarms.
if (!IS_CLOUDFLARE) {
  subscribeToEvents(() => {
    void drainWebhookOutbox();
  });
}

if (WEBHOOK_DELIVERY_MODE === "allowlist" && !IS_CLOUDFLARE) {
  const timer = setInterval(() => {
    void drainWebhookOutbox();
  }, PUMP_MS);
  timer.unref?.();
  queueMicrotask(() => void drainWebhookOutbox());
}
