/** Durable provider-operation outbox and reconciliation engine.
 *
 * Local financial state commits first with a durable provider intent. Network
 * submission happens only after commit. Every retry uses the same provider job
 * ID as its idempotency key. A timeout/crash after claim is treated as
 * ambiguous and moves to reconciliation instead of blindly resubmitting money.
 */
import { randomBytes } from "node:crypto";
import {
  ApiError,
  collection,
  currentCommandId,
  emit,
  inRequestScope,
  ksuid,
  now,
  setCommandContext,
  subscribeToEvents,
} from "./kernel.js";
import { publicShape } from "./public-shape.js";
import {
  providerTransportAvailable,
  sendProviderOperation,
} from "./provider-transport.js";

const DEFAULT_RETRY_DELAYS_MS = [
  0,
  1_000,
  10_000,
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
];
const IS_CLOUDFLARE = process.env.CLOUDFLARE_WORKER === "true";
const LEASE_MS = numberEnv("BANK_PROVIDER_LEASE_MS", 30_000, 1_000, 300_000);
const PUMP_MS = numberEnv("BANK_PROVIDER_PUMP_MS", 1_000, 100, 60_000);
const RETRY_DELAYS_MS = retryDelays();
const TERMINAL = new Set(["succeeded", "failed", "manual_review"]);

function numberEnv(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function retryDelays() {
  const raw = process.env.BANK_PROVIDER_RETRY_DELAYS_MS;
  if (!raw) return DEFAULT_RETRY_DELAYS_MS;
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.some(
      (value) =>
        !Number.isSafeInteger(value) || value < 0 || value > 86_400_000,
    )
  ) {
    throw new Error(
      "BANK_PROVIDER_RETRY_DELAYS_MS must be comma-separated integer milliseconds between 0 and 86400000",
    );
  }
  return values;
}

export const providerOutbox = collection("providerOutbox");
export const providerAttempts = collection("providerAttempts");
export const reconciliationCases = collection("reconciliationCases");

const outcomeHandlers = new Map();

function handlerKey(capability, action) {
  return `${capability}:${action}`;
}

export function registerProviderOutcomeHandler(capability, action, handler) {
  if (!capability || !action || typeof handler !== "function") {
    throw new TypeError(
      "registerProviderOutcomeHandler requires capability, action and handler",
    );
  }
  const key = handlerKey(capability, action);
  if (outcomeHandlers.has(key)) {
    throw new Error(`Duplicate provider outcome handler ${key}`);
  }
  outcomeHandlers.set(key, handler);
  return () => outcomeHandlers.delete(key);
}

function safeClone(value) {
  return structuredClone(publicShape(value ?? {}));
}

function existingCase(jobId) {
  return [...reconciliationCases.values()].find(
    (candidate) => candidate.job_id === jobId && candidate.status === "open",
  );
}

function openCase(job, reason, details = {}) {
  const existing = existingCase(job.id);
  if (existing) {
    existing.reason = reason;
    existing.provider_reference =
      details.provider_reference ?? existing.provider_reference ?? null;
    existing.provider_state =
      details.provider_state ?? existing.provider_state ?? null;
    existing.updated_at = now();
    return existing;
  }
  const record = {
    id: ksuid("rec"),
    object: "reconciliation_case",
    job_id: job.id,
    capability: job.capability,
    action: job.action,
    resource_type: job.resource_type,
    resource_id: job.resource_id,
    command_id: job.command_id,
    provider_reference: details.provider_reference ?? null,
    provider_state: details.provider_state ?? null,
    reason,
    status: "open",
    owner: job.owner,
    opened_at: now(),
    updated_at: now(),
  };
  reconciliationCases.set(record.id, record);
  return record;
}

function resolveCases(job, resolution) {
  for (const record of reconciliationCases.values()) {
    if (record.job_id !== job.id || record.status !== "open") continue;
    record.status = "resolved";
    record.resolution = resolution;
    record.resolved_at = now();
    record.updated_at = record.resolved_at;
  }
}

/** Queue provider work inside the current financial unit of work. If no provider
 * transport is configured the route fails before local money/resource state can
 * commit, rather than accepting an operation that can never leave the system. */
export function queueProviderOperation({
  capability,
  action,
  resource_type,
  resource_id,
  owner,
  payload,
}) {
  const commandId = currentCommandId();
  if (!commandId) {
    throw new Error("queueProviderOperation requires an active banking command");
  }
  if (!providerTransportAvailable()) {
    throw new ApiError(
      "service-unavailable",
      503,
      `No production provider adapter is configured for ${capability}.${action}`,
    );
  }
  if (!capability || !action || !resource_type || !resource_id || !owner) {
    throw new Error("Provider operation requires capability/action/resource/owner");
  }
  const createdAt = now();
  const job = {
    id: ksuid("prv"),
    object: "provider_operation",
    capability,
    action,
    resource_type,
    resource_id,
    owner,
    command_id: commandId,
    payload: safeClone(payload),
    phase: "submit",
    status: "pending",
    attempt_count: 0,
    current_attempt_id: null,
    provider_reference: null,
    provider_state: null,
    funds_state: null,
    last_error_code: null,
    next_attempt_at: createdAt,
    lease_token: null,
    lease_expires_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
  providerOutbox.set(job.id, job);
  emit(
    "provider.operation_queued",
    {
      id: job.id,
      capability,
      action,
      resource_type,
      resource_id,
      command_id: commandId,
    },
    { tenantId: owner },
  );
  return job;
}

function due(job, at = Date.now()) {
  if (TERMINAL.has(job.status)) return false;
  if (job.status === "in_flight") {
    return !job.lease_expires_at || Date.parse(job.lease_expires_at) <= at;
  }
  return !job.next_attempt_at || Date.parse(job.next_attempt_at) <= at;
}

function scheduleFrom(job, delayMs) {
  job.next_attempt_at = new Date(Date.now() + Math.max(0, delayMs)).toISOString();
}

function retryDelay(attemptCount, requested = null) {
  const index = Math.min(attemptCount, RETRY_DELAYS_MS.length - 1);
  const configured = RETRY_DELAYS_MS[index];
  return Math.max(configured, requested ?? 0);
}

async function claim(jobId) {
  return inRequestScope(async () => {
    const job = providerOutbox.get(jobId);
    if (!job || !due(job)) return null;

    setCommandContext({
      operation: `PROVIDER ${job.capability}.${job.action}.${job.phase}`,
      method: "PROVIDER",
      path: job.resource_id,
      access: "SYSTEM",
      tenant_id: job.owner,
      actor_id: "provider-gateway",
      actor_scope: "system",
      audit: true,
    });

    // An expired in-flight lease is ambiguous by definition: the previous
    // process may have sent the request and died before recording the response.
    if (job.status === "in_flight") {
      const previous = job.current_attempt_id
        ? providerAttempts.get(job.current_attempt_id)
        : null;
      if (previous && previous.status === "in_flight") {
        previous.status = "ambiguous";
        previous.outcome = "lease_expired";
        previous.finished_at = now();
      }
      job.phase = "reconcile";
      job.status = "ambiguous";
      job.last_error_code = "attempt_lease_expired";
      openCase(job, "provider_attempt_lease_expired", {
        provider_reference: job.provider_reference,
        provider_state: job.provider_state,
      });
    }

    if (job.attempt_count >= RETRY_DELAYS_MS.length) {
      job.status = "manual_review";
      job.next_attempt_at = null;
      job.lease_token = null;
      job.lease_expires_at = null;
      job.updated_at = now();
      openCase(job, "provider_retry_budget_exhausted", {
        provider_reference: job.provider_reference,
        provider_state: job.provider_state,
      });
      emit(
        "provider.operation_manual_review",
        { id: job.id, resource_type: job.resource_type, resource_id: job.resource_id },
        { tenantId: job.owner },
      );
      return null;
    }

    const token = randomBytes(16).toString("hex");
    const attemptId = ksuid("pat");
    const startedAt = now();
    job.status = "in_flight";
    job.lease_token = token;
    job.lease_expires_at = new Date(Date.now() + LEASE_MS).toISOString();
    job.attempt_count += 1;
    job.current_attempt_id = attemptId;
    job.updated_at = startedAt;

    providerAttempts.set(attemptId, {
      id: attemptId,
      object: "provider_attempt",
      job_id: job.id,
      capability: job.capability,
      action: job.action,
      phase: job.phase,
      resource_type: job.resource_type,
      resource_id: job.resource_id,
      original_command_id: job.command_id,
      attempt_command_id: currentCommandId(),
      attempt_number: job.attempt_count,
      status: "in_flight",
      outcome: null,
      status_code: null,
      provider_reference: job.provider_reference,
      provider_state: job.provider_state,
      error_code: null,
      owner: job.owner,
      started_at: startedAt,
      finished_at: null,
    });

    return {
      job_id: job.id,
      attempt_id: attemptId,
      token,
      capability: job.capability,
      action: job.action,
      phase: job.phase,
      resource_type: job.resource_type,
      resource_id: job.resource_id,
      tenant_id: job.owner,
      command_id: job.command_id,
      provider_reference: job.provider_reference,
      attempt: job.attempt_count,
      payload: safeClone(job.payload),
    };
  });
}

async function invokeHandler(job, result) {
  const handler = outcomeHandlers.get(handlerKey(job.capability, job.action));
  if (!handler) return;
  await handler({ job, result });
}

async function finish(claimed, result) {
  return inRequestScope(async () => {
    const job = providerOutbox.get(claimed.job_id);
    if (!job || job.lease_token !== claimed.token) return null;

    setCommandContext({
      operation: `PROVIDER ${job.capability}.${job.action}.${claimed.phase}`,
      method: "PROVIDER",
      path: job.resource_id,
      access: "SYSTEM",
      tenant_id: job.owner,
      actor_id: "provider-gateway",
      actor_scope: "system",
      audit: true,
    });

    const stamp = now();
    const attempt = providerAttempts.get(claimed.attempt_id);
    if (attempt) {
      attempt.status = result.outcome === "retry" ? "retrying" : result.outcome;
      attempt.outcome = result.outcome;
      attempt.status_code = result.status_code ?? null;
      attempt.provider_reference = result.provider_reference ?? job.provider_reference ?? null;
      attempt.provider_state = result.provider_state ?? null;
      attempt.error_code = result.error_code ?? null;
      attempt.finished_at = stamp;
    }

    if (result.provider_reference) job.provider_reference = result.provider_reference;
    if (result.provider_state) job.provider_state = result.provider_state;
    if (result.funds_state) job.funds_state = result.funds_state;
    job.last_error_code = result.error_code ?? null;
    job.lease_token = null;
    job.lease_expires_at = null;
    job.updated_at = stamp;

    if (result.outcome === "succeeded") {
      job.status = "succeeded";
      job.next_attempt_at = null;
      await invokeHandler(job, result);
      resolveCases(job, "provider_succeeded");
      emit(
        "provider.operation_succeeded",
        {
          id: job.id,
          resource_type: job.resource_type,
          resource_id: job.resource_id,
          provider_reference: job.provider_reference,
        },
        { tenantId: job.owner },
      );
      return job;
    }

    if (result.outcome === "pending") {
      job.status = "pending_provider";
      job.phase = "reconcile";
      scheduleFrom(job, retryDelay(job.attempt_count, result.retry_after_ms));
      await invokeHandler(job, result);
      emit(
        "provider.operation_pending",
        { id: job.id, resource_type: job.resource_type, resource_id: job.resource_id },
        { tenantId: job.owner },
      );
      return job;
    }

    if (result.outcome === "retry") {
      job.status = "retrying";
      scheduleFrom(job, retryDelay(job.attempt_count, result.retry_after_ms));
      emit(
        "provider.operation_retrying",
        { id: job.id, resource_type: job.resource_type, resource_id: job.resource_id },
        { tenantId: job.owner },
      );
      return job;
    }

    if (result.outcome === "ambiguous") {
      job.status = "ambiguous";
      job.phase = "reconcile";
      scheduleFrom(job, retryDelay(job.attempt_count, result.retry_after_ms));
      openCase(job, "provider_outcome_ambiguous", result);
      await invokeHandler(job, result);
      emit(
        "provider.operation_ambiguous",
        {
          id: job.id,
          resource_type: job.resource_type,
          resource_id: job.resource_id,
          provider_reference: job.provider_reference,
        },
        { tenantId: job.owner },
      );
      return job;
    }

    if (result.outcome === "failed") {
      job.status = "failed";
      job.next_attempt_at = null;
      if (!result.funds_state && job.capability.startsWith("payments.")) {
        openCase(job, "provider_failure_funds_state_unknown", result);
      }
      await invokeHandler(job, result);
      emit(
        "provider.operation_failed",
        {
          id: job.id,
          resource_type: job.resource_type,
          resource_id: job.resource_id,
          error_code: result.error_code ?? null,
        },
        { tenantId: job.owner },
      );
      return job;
    }

    throw new Error(`Unsupported provider outcome ${result.outcome}`);
  });
}

async function attempt(jobId) {
  const claimed = await claim(jobId);
  if (!claimed) return null;
  const result = await sendProviderOperation({
    job_id: claimed.job_id,
    capability: claimed.capability,
    action: claimed.action,
    phase: claimed.phase,
    resource: {
      type: claimed.resource_type,
      id: claimed.resource_id,
    },
    tenant_id: claimed.tenant_id,
    command_id: claimed.command_id,
    provider_reference: claimed.provider_reference,
    attempt: claimed.attempt,
    payload: claimed.payload,
  });
  return finish(claimed, result);
}

let draining = null;
export function drainProviderOutbox({ limit = 25 } = {}) {
  if (!providerTransportAvailable()) return Promise.resolve([]);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return Promise.reject(new RangeError("provider outbox limit must be 1..100"));
  }
  if (draining) return draining;
  draining = (async () => {
    const ids = [...providerOutbox.values()]
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

export function nextProviderOutboxAt() {
  let next = null;
  for (const job of providerOutbox.values()) {
    if (TERMINAL.has(job.status)) continue;
    const candidate =
      job.status === "in_flight"
        ? job.lease_expires_at
        : job.next_attempt_at ?? job.created_at;
    const timestamp = Date.parse(candidate);
    if (!Number.isFinite(timestamp)) continue;
    next = next === null ? timestamp : Math.min(next, timestamp);
  }
  return next;
}

export function providerOutboxStatus() {
  const jobs = [...providerOutbox.values()];
  return {
    pending: jobs.filter((job) => ["pending", "retrying"].includes(job.status)).length,
    pending_provider: jobs.filter((job) => job.status === "pending_provider").length,
    ambiguous: jobs.filter((job) => job.status === "ambiguous").length,
    in_flight: jobs.filter((job) => job.status === "in_flight").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    manual_review: jobs.filter((job) => job.status === "manual_review").length,
    succeeded: jobs.filter((job) => job.status === "succeeded").length,
    reconciliation_open: [...reconciliationCases.values()].filter(
      (record) => record.status === "open",
    ).length,
    next_attempt_at: nextProviderOutboxAt(),
  };
}

// Node owns a small pump. Cloudflare uses Durable Object alarms so provider work
// survives Worker eviction and is never an untracked HTTP-request promise.
if (!IS_CLOUDFLARE) {
  subscribeToEvents((event) => {
    if (event.type === "provider.operation_queued" && providerTransportAvailable()) {
      void drainProviderOutbox();
    }
  });
  if (providerTransportAvailable()) {
    const timer = setInterval(() => void drainProviderOutbox(), PUMP_MS);
    timer.unref?.();
    queueMicrotask(() => void drainProviderOutbox());
  }
}
