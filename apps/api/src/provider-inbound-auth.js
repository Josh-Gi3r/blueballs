/** Dedicated authentication for provider-originated settlement facts.
 *
 * Provider inbound events can create customer money. They therefore do not use
 * the generic operator API key. A deployment configures a separate HMAC secret
 * and the provider gateway signs a canonical JSON representation with a bounded
 * timestamp. Durable event_id replay protection is enforced by provider-inbound.js.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./lib.js";
import { bankingEnv } from "./runtime-env.js";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalProviderInboundBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("validation-error", 400, "Provider event body must be a JSON object");
  }
  return stable(body);
}

function configuredSecret() {
  const secret = String(bankingEnv("BANK_PROVIDER_INBOUND_SECRET", ""));
  if (secret.length < 32) {
    throw new ApiError(
      "service-unavailable",
      503,
      "Provider inbound authentication is not configured",
    );
  }
  return secret;
}

function maxSkewSeconds() {
  const raw = Number(bankingEnv("BANK_PROVIDER_INBOUND_MAX_SKEW_SECONDS", 300));
  if (!Number.isSafeInteger(raw) || raw < 30 || raw > 3600) {
    throw new Error(
      "BANK_PROVIDER_INBOUND_MAX_SKEW_SECONDS must be an integer between 30 and 3600",
    );
  }
  return raw;
}

function header(req, name) {
  const value = req?.headers?.[name];
  return Array.isArray(value) ? null : value ? String(value) : null;
}

function equalHex(actual, expected) {
  if (!/^[0-9a-f]{64}$/i.test(actual ?? "") || !/^[0-9a-f]{64}$/i.test(expected ?? "")) {
    return false;
  }
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Authenticate one provider-originated event. Signature format:
 *   x-blueballs-provider-timestamp: <unix seconds>
 *   x-blueballs-provider-signature: v1=<hex hmac sha256>
 * where the signed message is `${timestamp}.${canonical-json-body}`.
 */
export function providerInboundAuth(req, body, nowMs = Date.now()) {
  const timestampRaw = header(req, "x-blueballs-provider-timestamp");
  const signatureRaw = header(req, "x-blueballs-provider-signature");
  if (!timestampRaw || !signatureRaw) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider events require timestamp and signature headers",
    );
  }
  if (!/^\d{10}$/.test(timestampRaw)) {
    throw new ApiError("authentication-error", 401, "Provider event timestamp is invalid");
  }
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp)) {
    throw new ApiError("authentication-error", 401, "Provider event timestamp is invalid");
  }
  const skew = Math.abs(Math.floor(nowMs / 1000) - timestamp);
  if (skew > maxSkewSeconds()) {
    throw new ApiError("authentication-error", 401, "Provider event timestamp is outside the allowed clock skew");
  }
  const match = /^v1=([0-9a-f]{64})$/i.exec(signatureRaw.trim());
  if (!match) {
    throw new ApiError("authentication-error", 401, "Provider event signature is invalid");
  }
  const expected = createHmac("sha256", configuredSecret())
    .update(`${timestampRaw}.${canonicalProviderInboundBody(body)}`)
    .digest("hex");
  if (!equalHex(match[1], expected)) {
    throw new ApiError("authentication-error", 401, "Provider event signature is invalid");
  }
  return {
    id: "provider-gateway",
    tenant_id: null,
    scope: "provider",
  };
}

/** Helper used by deterministic adapters/tests. */
export function signProviderInboundBody(body, { secret, timestamp = Math.floor(Date.now() / 1000) }) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("provider inbound signing secret must contain at least 32 characters");
  }
  const stamp = String(timestamp);
  const signature = createHmac("sha256", secret)
    .update(`${stamp}.${canonicalProviderInboundBody(body)}`)
    .digest("hex");
  return {
    "x-blueballs-provider-timestamp": stamp,
    "x-blueballs-provider-signature": `v1=${signature}`,
  };
}
