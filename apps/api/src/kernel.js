/** Shared kernel for the Blueballs API.
 *
 * Each resource family registers routes here. Cross-cutting request validation,
 * authorization, production-mode boundaries, provider orchestration, auditing
 * and public serialization are deliberately centralized.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  ksuid,
  toMinor,
  fromMinor,
  ApiError,
  db,
  emit,
  post,
  balanceOf,
  collection as persistentCollection,
  inRequestScope,
  currentCommandId,
  setCommandContext,
  subscribeToEvents,
  subscribeToEventsBeforeCommit,
  hashKey,
} from "./lib.js";
import { BANKING_COLLECTION_TABLE_SET } from "./schema.js";
import {
  publicResponse,
  validateSuccessfulResponse,
} from "./response-validation.js";
import { normalizePublicOperationResponse } from "./response-normalization.js";
import { validateRequestBody } from "./request-validation.js";
import { validateQueryParameters } from "./query-validation.js";
import {
  assertKeyPermission,
  childPermissions,
  hasPermission,
  publicKeyPermissions,
} from "./key-permissions.js";
import {
  bankingApiMode,
  isSandboxOnlyOperation,
} from "../../../spec/banking/operation-modes.mjs";
import { ensureProductionBootstrap } from "./production-bootstrap.js";
import { queueProviderOperation } from "./provider-outbox.js";
import { prepareProductionProviderIntent } from "./production-provider-intents.js";
import { applyProviderInboundEvent } from "./provider-inbound.js";
import { trustedActorFromRequest } from "./trusted-actor.js";
import {
  bankingFlag,
  bankingRuntimeEnvironment,
} from "./runtime-env.js";
import "./production-provider-outcomes.js";

const RUNTIME_ENV = bankingRuntimeEnvironment();
export const BANK_API_MODE = bankingApiMode(RUNTIME_ENV);
ensureProductionBootstrap({
  db,
  hashKey,
  ksuid,
  mode: BANK_API_MODE,
  env: RUNTIME_ENV,
});

/** One table must have one in-memory storage view. Creating two PersistentMap
 * instances for the same table would allow stale caches to overwrite each other
 * even though SQLite itself is transactional. Route families therefore attach
 * their first collection instance to the shared db object and every later caller
 * receives that exact instance. */
export function collection(name) {
  if (!BANKING_COLLECTION_TABLE_SET.has(name)) {
    throw new Error(
      `Durable collection ${name} is not registered in the banking schema`,
    );
  }
  if (name === "auditRecords") {
    throw new Error(
      "auditRecords is append-only and may only be written by the banking command boundary",
    );
  }
  if (db[name]) return db[name];
  const map = persistentCollection(name);
  db[name] = map;
  return map;
}

export {
  ksuid,
  toMinor,
  fromMinor,
  ApiError,
  db,
  emit,
  post,
  balanceOf,
  inRequestScope,
  currentCommandId,
  setCommandContext,
  subscribeToEvents,
  subscribeToEventsBeforeCommit,
  randomBytes,
};

/* ---------------- reference tables ---------------- */
export const RAILS = {
  sepa_instant: {
    id: "sepa_instant",
    currency: "EUR",
    speed: "seconds",
    cutoff: null,
    weekend: true,
    min: "0.01",
    max: "100000.00",
  },
  sepa: {
    id: "sepa",
    currency: "EUR",
    speed: "next business day",
    cutoff: "15:00 CET",
    weekend: false,
    min: "0.01",
    max: "999999.00",
  },
  faster_payments: {
    id: "faster_payments",
    currency: "GBP",
    speed: "seconds",
    cutoff: null,
    weekend: true,
    min: "0.01",
    max: "1000000.00",
  },
  ach: {
    id: "ach",
    currency: "USD",
    speed: "1-2 business days",
    cutoff: "17:00 ET",
    weekend: false,
    min: "0.01",
    max: "25000.00",
  },
  wire: {
    id: "wire",
    currency: "USD",
    speed: "same day",
    cutoff: "16:00 ET",
    weekend: false,
    min: "100.00",
    max: "1000000.00",
  },
  paynow: {
    id: "paynow",
    currency: "SGD",
    speed: "seconds",
    cutoff: null,
    weekend: true,
    min: "0.01",
    max: "200000.00",
  },
};

export const RATES = {
  USD: 1,
  EUR: 1.083,
  GBP: 1.271,
  SGD: 0.742,
  MYR: 0.213,
  USDC: 1,
  EURC: 1.083,
};
export const THIN = new Set(["MYR"]);

/* ---------------- route registry ---------------- */
export const routes = [];
const RESPONSE_CONTRACT_VALIDATION = bankingFlag(
  "RESPONSE_CONTRACT_VALIDATION",
  false,
);

function auditSourceHash(req) {
  const source =
    req?.headers?.["cf-connecting-ip"] ?? req?.socket?.remoteAddress ?? null;
  return source
    ? createHash("sha256").update(String(source)).digest("hex")
    : null;
}

function persistedKeyById(id, tenantId) {
  return [...db.keys.values()].find(
    (candidate) =>
      candidate.id === id && (!tenantId || candidate.tenant_id === tenantId),
  );
}

function assertRuntimeMode(method, pattern, body) {
  if (BANK_API_MODE !== "production") return;
  if (isSandboxOnlyOperation(method, pattern)) {
    throw new ApiError(
      "forbidden",
      403,
      `${method} ${pattern} is a sandbox-only operation and is disabled in production mode`,
    );
  }
  if (
    method === "POST" &&
    pattern === "/v2/applications/:id/edd" &&
    body?.decision !== undefined
  ) {
    throw new ApiError(
      "forbidden",
      403,
      "Sandbox shortcut decisions on EDD are disabled in production mode; record provider/compliance outcomes through the production integration path",
    );
  }
}

function assertRouteAuthority(method, pattern, ctx) {
  if (method !== "POST" || pattern !== "/v2/cards/:id/unfreeze") return;
  const card = db.cards?.get(ctx.params.id);
  const initiatorKey = card?.freeze?.by_key;
  if (
    initiatorKey &&
    initiatorKey !== ctx.key?.id &&
    !hasPermission(ctx.key, "cards:*")
  ) {
    throw new ApiError(
      "forbidden",
      403,
      "Only the credential that froze this card or an unrestricted card administrator may unfreeze it",
    );
  }
}

/** Register one route. The wrapped handler is the single transport/security
 * boundary for every catalogue operation. */
export const route = (method, pattern, handler, opts = {}) => {
  const key = `${method} ${pattern}`;
  if (routes.some((candidate) => `${candidate.method} ${candidate.pattern}` === key)) {
    throw new Error(
      `Duplicate route ${key} — two families are claiming the same path`,
    );
  }
  const access = opts.access ?? (opts.public ? "PUBLIC" : "TENANT");
  if (!["PUBLIC", "TENANT", "OPERATOR", "GLOBAL_READ"].includes(access)) {
    throw new Error(`Invalid access class ${access} for ${key}`);
  }
  const successStatus = opts.created ? 201 : 200;

  const publicHandler = async (ctx) => {
    const path = ctx.url?.pathname ?? pattern;
    const actor =
      ctx.key && access !== "PUBLIC"
        ? trustedActorFromRequest({
            req: ctx.req,
            key: ctx.key,
            method,
            path,
          })
        : null;
    ctx.actor = actor;

    if (currentCommandId()) {
      setCommandContext({
        operation: key,
        method,
        path,
        access,
        tenant_id: ctx.key?.tenant_id ?? null,
        actor_id: actor?.subject ?? ctx.key?.id ?? null,
        // Preserve the machine credential identity in the audit scope when a
        // deployment IAM gateway asserts a named human actor.
        actor_scope: actor
          ? `human:${actor.assurance};credential:${ctx.key.id}`
          : (ctx.key?.scope ?? (access === "PUBLIC" ? "public" : null)),
        source_hash: auditSourceHash(ctx.req),
        audit: access !== "PUBLIC" || method !== "GET",
      });
    }

    assertRuntimeMode(method, pattern, ctx.body ?? {});

    if (ctx.key && access !== "PUBLIC" && access !== "OPERATOR") {
      assertKeyPermission(ctx.key, method, pattern);
      assertRouteAuthority(method, pattern, ctx);
    }

    validateQueryParameters(method, pattern, ctx.url);
    validateRequestBody(method, pattern, ctx.body ?? {});

    const requestedChildPermissions =
      method === "POST" && pattern === "/v2/keys" && ctx.key
        ? childPermissions(ctx.key, ctx.body?.permissions)
        : null;

    let result = await handler(ctx);

    result = prepareProductionProviderIntent({
      mode: BANK_API_MODE,
      method,
      pattern,
      ctx,
      result,
      db,
      commandId: currentCommandId(),
      queue: queueProviderOperation,
    });

    result = normalizePublicOperationResponse(method, pattern, result);

    if (method === "POST" && pattern === "/v2/auth/signup" && result?.id) {
      const stored = persistedKeyById(result.id, result.tenant_id);
      if (stored) stored.permissions = ["*"];
      result = { ...result, permissions: ["*"] };
    }

    if (
      method === "POST" &&
      pattern === "/v2/keys" &&
      result?.id &&
      requestedChildPermissions
    ) {
      const stored = persistedKeyById(result.id, ctx.key?.tenant_id);
      if (stored) stored.permissions = requestedChildPermissions;
      result = { ...result, permissions: requestedChildPermissions };
    }

    if (method === "GET" && pattern === "/v2/keys" && ctx.key) {
      result = {
        ...result,
        current: {
          key_id: ctx.key.id,
          tenant_id: ctx.key.tenant_id,
          scope: ctx.key.scope,
          permissions: publicKeyPermissions(ctx.key),
        },
        data: Array.isArray(result?.data)
          ? result.data.map((candidate) => ({
              ...candidate,
              permissions: publicKeyPermissions(candidate),
            }))
          : [],
      };
    }

    if (method === "GET" && pattern === "/v2/keys/:id" && result?.id) {
      result = { ...result, permissions: publicKeyPermissions(result) };
    }

    if (
      currentCommandId() &&
      access === "PUBLIC" &&
      method !== "GET" &&
      result?.tenant_id
    ) {
      setCommandContext({
        tenant_id: result.tenant_id,
        actor_id: result.id ?? null,
        actor_scope: result.scope ?? "public",
      });
    }

    return RESPONSE_CONTRACT_VALIDATION
      ? validateSuccessfulResponse(method, pattern, result)
      : publicResponse(result);
  };

  routes.push({
    method,
    pattern,
    parts: pattern.split("/").filter(Boolean),
    handler: publicHandler,
    access,
    successStatus,
  });
};

// Private provider callback surface. It is intentionally outside /v2 and the
// public OpenAPI catalogue. Deployments expose it only to their trusted provider
// gateway/service network and authenticate it with the operator credential plus
// the provider-specific HMAC evidence verified by provider-inbound.js.
const providerInboundEvents = collection("providerInboundEvents");
route(
  "POST",
  "/internal/provider/events",
  ({ body }) =>
    applyProviderInboundEvent({
      body,
      db,
      inboundEvents: providerInboundEvents,
      mode: BANK_API_MODE,
    }),
  { access: "OPERATOR" },
);

export const isRegistered = (method, pattern) =>
  routes.some(
    (routeRecord) =>
      routeRecord.method === method && routeRecord.pattern === pattern,
  );

export const match = (method, path) => {
  const segments = path.split("/").filter(Boolean);
  for (const routeRecord of routes) {
    if (
      routeRecord.method !== method ||
      routeRecord.parts.length !== segments.length
    )
      continue;
    const params = {};
    let ok = true;
    for (let index = 0; index < routeRecord.parts.length; index++) {
      const part = routeRecord.parts[index];
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(segments[index]);
      } else if (part !== segments[index]) {
        ok = false;
        break;
      }
    }
    if (ok) return { r: routeRecord, params };
  }
  return null;
};

/* ---------------- handler helpers ---------------- */
export function need(body, fields) {
  const errors = fields
    .filter((field) => body[field] === undefined || body[field] === "")
    .map((field) => ({
      field,
      message: "is required",
      code: "missing",
    }));
  if (errors.length) {
    throw new ApiError(
      "validation-error",
      400,
      "Some required fields are missing",
      errors,
    );
  }
}

export function positiveMinor(value, field = "amount") {
  const minor = toMinor(value);
  if (minor <= 0n) {
    throw new ApiError(
      "validation-error",
      400,
      `${field} must be greater than zero`,
      [{ field, message: "must be greater than zero", code: "not_positive" }],
    );
  }
  return minor;
}

export function principalId(keyRecord) {
  if (!keyRecord?.tenant_id) {
    throw new ApiError(
      "internal-error",
      500,
      "Authenticated key has no tenant principal",
    );
  }
  return keyRecord.tenant_id;
}

export function ownedBy(row, keyRecord, noun, id) {
  if (keyRecord && row.owner !== principalId(keyRecord)) {
    throw new ApiError("not-found", 404, `No ${noun} ${id ?? row.id}`);
  }
  return row;
}

export const visibleTo = (rows, keyRecord) =>
  rows.filter((row) => !keyRecord || row.owner === principalId(keyRecord));

export function must(resourceCollection, id, noun, keyRecord) {
  const row = resourceCollection.get(id);
  if (!row) throw new ApiError("not-found", 404, `No ${noun} ${id}`);
  return ownedBy(row, keyRecord, noun, id);
}

export const paginate = (rows, url) => {
  const requestedLimit = Number(url.searchParams.get("limit") || 25);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new ApiError(
      "validation-error",
      400,
      "limit must be a positive integer",
    );
  }
  if (requestedLimit > 100) {
    throw new ApiError(
      "validation-error",
      400,
      "limit must be no greater than 100",
    );
  }
  const limit = requestedLimit;
  const after = url.searchParams.get("starting_after");
  const before = url.searchParams.get("ending_before");
  if (after && before) {
    throw new ApiError(
      "validation-error",
      400,
      "Use starting_after or ending_before, not both",
    );
  }
  if (before) {
    const end = rows.findIndex((row) => row.id === before);
    if (end === -1) {
      throw new ApiError("invalid-identifier", 400, `Unknown cursor ${before}`);
    }
    const start = Math.max(0, end - limit);
    const page = rows.slice(start, end);
    return {
      object: "list",
      data: page,
      has_more: start > 0,
      next_cursor: page.at(0)?.id ?? null,
    };
  }
  let start = 0;
  if (after) {
    const index = rows.findIndex((row) => row.id === after);
    if (index === -1) {
      throw new ApiError("invalid-identifier", 400, `Unknown cursor ${after}`);
    }
    start = index + 1;
  }
  const page = rows.slice(start, start + limit);
  return {
    object: "list",
    data: page,
    has_more: start + limit < rows.length,
    next_cursor: page.at(-1)?.id ?? null,
  };
};

export const now = () => new Date().toISOString();
