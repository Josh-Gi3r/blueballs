/** Dedicated authentication for provider-originated settlement facts.
 *
 * Provider inbound events can create customer money. They therefore require a
 * dedicated HMAC secret in addition to the private operator-authenticated route.
 * The signed message is `${timestamp}.${canonical-json-payload}` where payload
 * excludes the `authentication` object itself. Durable event_id replay protection
 * remains enforced by provider-inbound.js.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalProviderInboundBody } from "../../../spec/provider-inbound-signing.mjs";
import { ApiError } from "./lib.js";
import { bankingEnv } from "./runtime-env.js";

export { canonicalProviderInboundBody };

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

function equalHex(actual, expected) {
  if (
    !/^[0-9a-f]{64}$/i.test(actual ?? "") ||
    !/^[0-9a-f]{64}$/i.test(expected ?? "")
  ) {
    return false;
  }
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyProviderInboundBody(body, nowMs = Date.now()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(
      "validation-error",
      400,
      "Provider event body must be a JSON object",
    );
  }
  const auth = body.authentication;
  const timestampRaw = auth?.timestamp == null ? null : String(auth.timestamp);
  const signatureRaw = auth?.signature == null ? null : String(auth.signature);
  if (!timestampRaw || !signatureRaw) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider events require a signed authentication envelope",
    );
  }
  if (!/^\d{10}$/.test(timestampRaw)) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider event timestamp is invalid",
    );
  }
  const timestamp = Number(timestampRaw);
  const skew = Math.abs(Math.floor(nowMs / 1000) - timestamp);
  if (!Number.isSafeInteger(timestamp) || skew > maxSkewSeconds()) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider event timestamp is outside the allowed clock skew",
    );
  }
  const match = /^v1=([0-9a-f]{64})$/i.exec(signatureRaw.trim());
  if (!match) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider event signature is invalid",
    );
  }
  const expected = createHmac("sha256", configuredSecret())
    .update(`${timestampRaw}.${canonicalProviderInboundBody(body)}`)
    .digest("hex");
  if (!equalHex(match[1], expected)) {
    throw new ApiError(
      "authentication-error",
      401,
      "Provider event signature is invalid",
    );
  }
  return true;
}
