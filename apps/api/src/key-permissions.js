import { ApiError } from "./lib.js";

export const KEY_PERMISSION_DOMAINS = Object.freeze([
  "keys",
  "identity",
  "accounts",
  "wallets",
  "payments",
  "fx",
  "cards",
  "lending",
  "controls",
  "ledger",
  "webhooks",
  "sandbox",
]);

export const KEY_PERMISSIONS = Object.freeze(
  KEY_PERMISSION_DOMAINS.flatMap((domain) => [
    `${domain}:read`,
    `${domain}:write`,
    `${domain}:*`,
  ]),
);

const DOMAIN_RULES = [
  [/^\/v2\/keys(?:\/|$)/, "keys"],
  [/^\/v2\/(?:customers|applications)(?:\/|$)/, "identity"],
  [/^\/v2\/(?:accounts|details)(?:\/|$)/, "accounts"],
  [/^\/v2\/wallets(?:\/|$)/, "wallets"],
  [/^\/v2\/(?:recipients|destinations|transfers|qr|links|mandates|subscriptions)(?:\/|$)/, "payments"],
  [/^\/v2\/(?:fx|ramps)(?:\/|$)/, "fx"],
  [/^\/v2\/(?:cards|authorisations|disputes)(?:\/|$)/, "cards"],
  [/^\/v2\/(?:vaults|credit)(?:\/|$)/, "lending"],
  [/^\/v2\/(?:policies|approval-chains|approvals|orgs)(?:\/|$)/, "controls"],
  [/^\/v2\/(?:ledger|statements|fees)(?:\/|$)/, "ledger"],
  [/^\/v2\/(?:webhooks|events)(?:\/|$)/, "webhooks"],
  [/^\/v2\/(?:builder|sandbox)(?:\/|$)/, "sandbox"],
];

function keyPermissions(key) {
  return Array.isArray(key?.permissions) && key.permissions.length
    ? key.permissions
    : ["*"];
}

export function permissionFor(method, pattern) {
  const domain = DOMAIN_RULES.find(([rule]) => rule.test(pattern))?.[1] ?? null;
  if (!domain) return null;
  return `${domain}:${method === "GET" ? "read" : "write"}`;
}

export function hasPermission(key, required) {
  if (!required) return true;
  const permissions = keyPermissions(key);
  if (permissions.includes("*")) return true;
  if (permissions.includes(required)) return true;
  const [domain] = required.split(":");
  return permissions.includes(`${domain}:*`);
}

export function assertKeyPermission(key, method, pattern) {
  const required = permissionFor(method, pattern);
  if (!hasPermission(key, required)) {
    throw new ApiError(
      "forbidden",
      403,
      `API key ${key.id} requires ${required} for ${method} ${pattern}`,
    );
  }
  return required;
}

function validPermission(permission) {
  return permission === "*" || KEY_PERMISSIONS.includes(permission);
}

/** Resolve a child key's permissions. Omitted permissions inherit the parent so
 * existing integrations remain compatible; production callers should request
 * the narrowest explicit set they need. */
export function childPermissions(parentKey, requested) {
  const parent = keyPermissions(parentKey);
  if (requested === undefined) return [...parent];
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new ApiError(
      "validation-error",
      400,
      "permissions must be a non-empty array when provided",
    );
  }
  const normalized = [...new Set(requested.map((value) => String(value).trim()))].sort();
  if (normalized.some((permission) => !permission || !validPermission(permission))) {
    throw new ApiError(
      "validation-error",
      400,
      `permissions must use known domain permissions: ${KEY_PERMISSIONS.join(", ")}`,
    );
  }

  for (const permission of normalized) {
    if (parent.includes("*")) continue;
    if (permission === "*") {
      throw new ApiError("forbidden", 403, "A restricted API key cannot mint an unrestricted key");
    }
    const [domain] = permission.split(":");
    if (
      !parent.includes(permission) &&
      !parent.includes(`${domain}:*`)
    ) {
      throw new ApiError(
        "forbidden",
        403,
        `Parent key cannot grant permission ${permission}`,
      );
    }
  }
  return normalized;
}

export function publicKeyPermissions(key) {
  return [...keyPermissions(key)];
}
