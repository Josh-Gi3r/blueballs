import { createHmac } from "node:crypto";

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

/** Canonical provider evidence excludes authentication so a legitimate replay
 * can carry a fresh timestamp/signature while retaining the same financial
 * fingerprint. JSON request bodies cannot contain undefined/function values. */
export function canonicalProviderInboundBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TypeError("Provider event body must be a JSON object");
  }
  const { authentication: _authentication, ...payload } = body;
  return stable(payload);
}

/** Pure deterministic helper used by provider gateways and tests. */
export function signProviderInboundBody(
  body,
  { secret, timestamp = Math.floor(Date.now() / 1000) },
) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError(
      "provider inbound signing secret must contain at least 32 characters",
    );
  }
  const payload = { ...body };
  delete payload.authentication;
  const stamp = String(timestamp);
  if (!/^\d{10}$/.test(stamp)) {
    throw new TypeError("provider inbound signing timestamp must be unix seconds");
  }
  const signature = createHmac("sha256", secret)
    .update(`${stamp}.${canonicalProviderInboundBody(payload)}`)
    .digest("hex");
  return {
    ...payload,
    authentication: {
      timestamp: stamp,
      signature: `v1=${signature}`,
    },
  };
}
