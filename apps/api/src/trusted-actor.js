/** Trusted human-actor attribution from a deployment IAM/session gateway.
 *
 * Blueballs does not embed passwords or become an identity provider. A deployment
 * may authenticate humans with OIDC/SAML/passkeys and attach this short-lived
 * HMAC assertion to an already-authenticated API request. The machine credential
 * remains the API credential; the assertion supplies the named human actor for
 * audit/dual-control decisions.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./lib.js";
import { bankingEnv } from "./runtime-env.js";

const ACTOR_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const ASSURANCE = new Set(["normal", "step_up"]);

function header(req, name) {
  const value = req?.headers?.[name];
  return Array.isArray(value) ? null : value == null ? null : String(value);
}

function configuredSecret() {
  const secret = String(bankingEnv("BANK_TRUSTED_ACTOR_SECRET", ""));
  if (secret.length < 32) {
    throw new ApiError(
      "service-unavailable",
      503,
      "Trusted human-actor assertions are not configured",
    );
  }
  return secret;
}

function maxSkewSeconds() {
  const raw = Number(bankingEnv("BANK_TRUSTED_ACTOR_MAX_SKEW_SECONDS", 300));
  if (!Number.isSafeInteger(raw) || raw < 30 || raw > 3600) {
    throw new Error(
      "BANK_TRUSTED_ACTOR_MAX_SKEW_SECONDS must be an integer between 30 and 3600",
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

export function trustedActorMessage({ timestamp, credentialId, method, path, actorId, assurance }) {
  return ["v1", timestamp, credentialId, method, path, actorId, assurance].join("\n");
}

/** Return null when no human assertion is present. Partial/invalid assertions
 * fail closed rather than silently attributing the command to the machine key. */
export function trustedActorFromRequest({ req, key, method, path, nowMs = Date.now() }) {
  const actorId = header(req, "x-blueballs-actor-id");
  const timestamp = header(req, "x-blueballs-actor-timestamp");
  const assurance = header(req, "x-blueballs-actor-assurance");
  const signature = header(req, "x-blueballs-actor-signature");
  const present = [actorId, timestamp, assurance, signature].some((value) => value !== null);
  if (!present) return null;
  if (!actorId || !timestamp || !assurance || !signature) {
    throw new ApiError(
      "authentication-error",
      401,
      "Trusted actor assertion headers must be supplied together",
    );
  }
  if (!key?.id) {
    throw new ApiError(
      "authentication-error",
      401,
      "Trusted actor assertion requires an authenticated credential",
    );
  }
  if (!ACTOR_ID.test(actorId)) {
    throw new ApiError("authentication-error", 401, "Trusted actor id is invalid");
  }
  if (!ASSURANCE.has(assurance)) {
    throw new ApiError(
      "authentication-error",
      401,
      "Trusted actor assurance must be normal or step_up",
    );
  }
  if (!/^\d{10}$/.test(timestamp)) {
    throw new ApiError("authentication-error", 401, "Trusted actor timestamp is invalid");
  }
  const seconds = Number(timestamp);
  if (
    !Number.isSafeInteger(seconds) ||
    Math.abs(Math.floor(nowMs / 1000) - seconds) > maxSkewSeconds()
  ) {
    throw new ApiError(
      "authentication-error",
      401,
      "Trusted actor assertion is outside the allowed clock skew",
    );
  }
  const match = /^v1=([0-9a-f]{64})$/i.exec(signature.trim());
  if (!match) {
    throw new ApiError("authentication-error", 401, "Trusted actor signature is invalid");
  }
  const expected = createHmac("sha256", configuredSecret())
    .update(
      trustedActorMessage({
        timestamp,
        credentialId: key.id,
        method,
        path,
        actorId,
        assurance,
      }),
    )
    .digest("hex");
  if (!equalHex(match[1], expected)) {
    throw new ApiError("authentication-error", 401, "Trusted actor signature is invalid");
  }
  return Object.freeze({
    subject: actorId,
    assurance,
    asserted_at: new Date(seconds * 1000).toISOString(),
  });
}
