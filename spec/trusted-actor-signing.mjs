/** Side-effect-free signing contract for trusted human-actor assertions.
 *
 * Deployment IAM/session gateways can import/copy this canonicalization without
 * loading the banking database. The signature binds a named human subject to the
 * authenticated machine credential and the exact request intent (method, path,
 * query and JSON body) for a short time window.
 */
import { createHash, createHmac } from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function trustedActorRequestHash({ body = {}, url }) {
  const parsed =
    url instanceof URL
      ? url
      : url
        ? new URL(String(url), "https://blueballs.invalid")
        : null;
  const query = parsed
    ? [...parsed.searchParams.entries()].sort(([ak, av], [bk, bv]) =>
        ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk),
      )
    : [];
  return createHash("sha256")
    .update(JSON.stringify(canonical({ body, query })))
    .digest("hex");
}

export function trustedActorMessage({
  timestamp,
  credentialId,
  method,
  path,
  actorId,
  assurance,
  requestHash,
}) {
  return [
    "v1",
    String(timestamp),
    String(credentialId),
    String(method).toUpperCase(),
    String(path),
    String(actorId),
    String(assurance),
    String(requestHash),
  ].join("\n");
}

/** Deterministic gateway/test helper. The runtime never receives this secret. */
export function signTrustedActorHeaders({
  secret,
  credentialId,
  method,
  path,
  actorId,
  assurance = "normal",
  body = {},
  url,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("trusted actor signing secret must contain at least 32 characters");
  }
  const stamp = String(timestamp);
  const requestHash = trustedActorRequestHash({ body, url: url ?? path });
  const signature = createHmac("sha256", secret)
    .update(
      trustedActorMessage({
        timestamp: stamp,
        credentialId,
        method,
        path,
        actorId,
        assurance,
        requestHash,
      }),
    )
    .digest("hex");
  return {
    "x-blueballs-actor-id": actorId,
    "x-blueballs-actor-timestamp": stamp,
    "x-blueballs-actor-assurance": assurance,
    "x-blueballs-actor-signature": `v1=${signature}`,
  };
}
