import { ApiError } from "./lib.js";
import {
  KEY_PERMISSION_DOMAINS,
  KEY_PERMISSIONS,
  permissionForRoute,
} from "../../../spec/banking/key-permission-catalog.mjs";

export { KEY_PERMISSION_DOMAINS, KEY_PERMISSIONS };

function keyPermissions(key) {
  return Array.isArray(key?.permissions) && key.permissions.length
    ? key.permissions
    : ["*"];
}

export function permissionFor(method, pattern) {
  return permissionForRoute(method, pattern);
}

function permissionSetGrants(permissions, required) {
  if (permissions.includes("*")) return true;
  if (permissions.includes(required)) return true;
  const [domain, action] = required.split(":");
  if (permissions.includes(`${domain}:*`)) return true;
  return action === "read" && permissions.includes(`${domain}:write`);
}

export function hasPermission(key, required) {
  return !required || permissionSetGrants(keyPermissions(key), required);
}

export function assertKeyPermission(key, method, pattern) {
  const required = permissionFor(method, pattern);
  if (!required) {
    throw new ApiError(
      "internal-error",
      500,
      `Authenticated route ${method} ${pattern} has no permission classification`,
    );
  }
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
    if (permission === "*" && !parent.includes("*")) {
      throw new ApiError(
        "forbidden",
        403,
        "A restricted API key cannot mint an unrestricted key",
      );
    }
    if (!permissionSetGrants(parent, permission)) {
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
