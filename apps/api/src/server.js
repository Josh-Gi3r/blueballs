/** Blueballs API — reference implementation of spec/conventions.md.
 *  Node stdlib only. `node src/server.js` and you have a working bank API. */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { hashKey } from "./lib.js";
import {
  ksuid, toMinor, fromMinor, ApiError, db, emit, post, balanceOf,
  RAILS, RATES, THIN, routes, route, isRegistered, match, need, paginate,
  must, ownedBy, visibleTo, positiveMinor,
  principalId,
} from "./kernel.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ibanGenerate, abaGenerate } from "../../../packages/validation/src/index.js";
import { convertMinor, rateString } from "./exact-rates.js";

export const API_PORT = Number(process.env.PORT || 5281);
const VERSION = "2026-08-06";


/* ---------------- helpers ---------------- */
const json = (res, status, body, extra = {}) => {
  const payload = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  res.writeHead(status, {
    "content-type": status >= 400 && body.type ? "application/problem+json" : "application/json",
    "x-api-version": VERSION,
    "x-ratelimit-limit": String(RATE_LIMIT),
    "access-control-allow-headers": "content-type,x-api-key,x-idempotency-key",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    ...extra,
  });
  res.end(payload);
};

/** Fixed-window rate limit, counted per key (per source address before a key is
 *  presented). The headers used to be constants — a limit of 60 with 59 always
 *  remaining, and no counter behind either number — so an unlimited signup
 *  endpoint advertised a ceiling that did not exist. */
export const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const SOURCE_RATE_LIMIT = Number(process.env.SOURCE_RATE_LIMIT_PER_MIN || RATE_LIMIT);
const TENANT_RATE_LIMIT = Number(process.env.TENANT_RATE_LIMIT_PER_MIN || RATE_LIMIT);
const BODY_LIMIT_BYTES = Number(process.env.BODY_LIMIT_BYTES || 1_048_576);
if (!Number.isSafeInteger(BODY_LIMIT_BYTES) || BODY_LIMIT_BYTES < 1) {
  throw new Error("BODY_LIMIT_BYTES must be a positive safe integer");
}
const WINDOW_MS = 60_000;
const buckets = new Map();

function rateLimit(id, limit) {
  const nowMs = Date.now();
  let bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= nowMs) {
    bucket = { count: 0, resetAt: nowMs + WINDOW_MS };
    buckets.set(id, bucket);
  }
  bucket.count += 1;
  // keep the map from growing without bound on a long-lived process
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= nowMs) buckets.delete(k);
  }
  return {
    remaining: Math.max(0, limit - bucket.count),
    reset: Math.floor(bucket.resetAt / 1000),
    exceeded: bucket.count > limit,
  };
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    let bytes = 0;
    let settled = false;
    req.on("data", (c) => {
      if (settled) return;
      bytes += Buffer.byteLength(c);
      if (bytes > BODY_LIMIT_BYTES) {
        settled = true;
        req.pause();
        setImmediate(() => req.resume());
        reject(new ApiError("payload-too-large", 413, `Body over ${BODY_LIMIT_BYTES} bytes`));
        return;
      }
      raw += c;
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new ApiError("validation-error", 400, "Body is not valid JSON")); }
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

const CORS_ORIGINS = new Set(String(process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean));
function corsHeaders(req) {
  const origin = req.headers.origin;
  return origin && CORS_ORIGINS.has(origin)
    ? { "access-control-allow-origin": origin, vary: "origin" }
    : {};
}

function sourceAddress(req) {
  if (process.env.TRUST_PROXY === "true" && req.headers["cf-connecting-ip"]) {
    return String(req.headers["cf-connecting-ip"]);
  }
  return req.socket.remoteAddress || "unknown";
}

function auth(req) {
  const key = req.headers["x-api-key"];
  if (!key) throw new ApiError("authentication-error", 401, "Send your key in the x-api-key header");
  const rec = db.keys.get(hashKey(key));
  if (!rec) throw new ApiError("authentication-error", 401, "That key is not valid");
  if (!rec.tenant_id || !db.tenants.has(rec.tenant_id)) {
    throw new ApiError("authentication-error", 401, "That key belongs to an unsupported pre-release schema");
  }
  return rec;
}

function operatorAuth(req) {
  const supplied = req.headers["x-api-key"];
  if (!supplied) throw new ApiError("authentication-error", 401, "Send the operator key in the x-api-key header");
  const expectedHash = process.env.OPERATOR_API_KEY_HASH;
  if (!expectedHash) throw new ApiError("service-unavailable", 503, "Operator API access is not configured");
  if (hashKey(String(supplied)) !== expectedHash) {
    throw new ApiError("forbidden", 403, "A self-serve sandbox key cannot access operator state");
  }
  return { id: "operator", tenant_id: "operator", scope: "operator" };
}


const IDEMPOTENCY_TTL_MS = Number(process.env.IDEMPOTENCY_TTL_MS || 24 * 60 * 60 * 1000);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

/** Cache authenticated mutations by stable tenant, operation and caller key. */
async function idempotent({ req, body, url, route: matchedRoute, key: principal }, fn) {
  const headerKey = req.headers["x-idempotency-key"];
  if (!headerKey || !principal) return fn();
  const operation = `${req.method} ${matchedRoute.pattern}`;
  const storageKey = createHash("sha256")
    .update(`${principalId(principal)}\0${operation}\0${headerKey}`)
    .digest("hex");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(canonical({ body, query: [...url.searchParams.entries()].sort() })))
    .digest("hex");
  const seen = db.idempotency.get(storageKey);
  if (seen) {
    if (Date.parse(seen.expires_at) <= Date.now()) {
      db.idempotency.delete(storageKey);
    } else {
      if (seen.fingerprint !== fingerprint) {
        throw new ApiError("conflict", 409, "This idempotency key was used with different parameters");
      }
      return { ...seen.result, replayed: true };
    }
  }
  const result = await fn();
  db.idempotency.set(storageKey, {
    tenant_id: principalId(principal), operation, fingerprint, result,
    expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
  });
  return result;
}



/* ---- discovery ---- */
route("GET", "/v2", () => ({
  name: "Blueballs API",
  version: VERSION,
  docs: `${process.env.PUBLIC_SITE_URL || "http://localhost:5280"}/developers`,
  signup: "POST /v2/auth/signup — issues a sandbox key instantly, no approval",
}), { public: true });

/* ---- auth: SELF-SERVE, no human in the loop ---- */
route("POST", "/v2/auth/signup", async ({ body }) => {
  need(body, ["email"]);
  const tenant = {
    id: ksuid("ten"),
    email: body.email,
    created_at: new Date().toISOString(),
  };
  const secret = "bb_sandbox_" + randomBytes(18).toString("base64url");
  const rec = {
    id: ksuid("key"), tenant_id: tenant.id, email: body.email, scope: "sandbox",
    created_at: new Date().toISOString(), expires: null,
  };
  db.tenants.set(tenant.id, tenant);
  db.keys.set(hashKey(secret), rec);
  emit("key.issued", { id: rec.id, scope: rec.scope }, { tenantId: rec.tenant_id });
  return {
    ...rec,
    key: secret,
    note: "Sandbox keys are unmetered and never expire. This is the only time the key is shown.",
  };
}, { public: true, created: true });

route("GET", "/v2/keys", ({ key }) => ({
  object: "list",
  data: [...db.keys.values()].filter((k) => k.tenant_id === key.tenant_id).map(({ ...k }) => k),
}));

/* ---- customers ---- */
route("POST", "/v2/customers", async ({ body, key }) => {
  need(body, ["type", "name"]);
  if (!["individual", "business"].includes(body.type)) {
    throw new ApiError("validation-error", 400, "type must be individual or business");
  }
  const c = {
    id: ksuid("cus"), type: body.type, name: body.name, email: body.email ?? null,
    status: "pending", decision: null, tier: 1,
    client_reference_id: body.client_reference_id ?? null,
    created_at: new Date().toISOString(), owner: principalId(key),
  };
  db.customers.set(c.id, c);
  emit("customer.created", c, { tenantId: c.owner });
  return c;
}, { created: true });

route("GET", "/v2/customers", ({ url, key }) =>
  paginate(visibleTo([...db.customers.values()], key), url));

route("GET", "/v2/customers/:id", ({ params, key }) => must(db.customers, params.id, "customer", key));

/** Capabilities: which rails this customer can use, and what's outstanding. */
route("GET", "/v2/customers/:id/capabilities", ({ params, key }) => {
  const c = must(db.customers, params.id, "customer", key);
  const verified = c.status === "completed" && c.decision === "approved";
  return {
    object: "list",
    data: Object.values(RAILS).map((r) => ({
      rail: r.id,
      status: verified ? "active" : "inactive",
      requirements: verified ? [] : ["identity_verification"],
      limit: verified ? r.max : "1000.00",
    })),
  };
});

/** Sandbox shortcut so a developer isn't blocked waiting on KYC. */
route("POST", "/v2/customers/:id/verify", ({ params, body, key }) => {
  const c = must(db.customers, params.id, "customer", key);
  c.status = "completed";
  c.decision = body.decision ?? "approved";
  c.tier = c.decision === "approved" ? 3 : 1;
  emit("customer.status_changed", { id: c.id, status: c.status, decision: c.decision }, { tenantId: c.owner });
  return c;
});

/* ---- accounts ---- */
route("POST", "/v2/accounts", async ({ body, key }) => {
  need(body, ["customer", "currency"]);
  const c = must(db.customers, body.customer, "customer", key);
  const cur = String(body.currency).toUpperCase();
  if (!RATES[cur]) throw new ApiError("validation-error", 400, `${cur} is not a supported currency`);

  const a = {
    id: ksuid("acc"), customer: c.id, currency: cur, type: body.type ?? "holding",
    status: "open", created_at: new Date().toISOString(),
    details: detailsFor(cur),
    owner: principalId(key),
  };
  db.accounts.set(a.id, a);
  emit("account.opened", a, { tenantId: a.owner });
  return { ...a, balance: { amount: "0.00", currency: cur } };
}, { created: true });

// Fictional Blueballs Bank institution codes — fixed per rail (a real bank has
// exactly one bank code / routing number), the ACCOUNT part is what must be
// unique and checksum-valid per customer.
const EUR_BANK_CODE = "50000888";
const USD_ROUTING_PREFIX = "05000088"; // 8 digits; abaGenerate appends the valid 9th checksum digit

const randomDigits = (n) => {
  let out = "";
  while (out.length < n) out += randomBytes(4).readUInt32BE(0).toString().padStart(10, "0");
  return out.slice(0, n);
};

function detailsFor(cur) {
  if (cur === "EUR") {
    const bban = EUR_BANK_CODE + randomDigits(10); // 8-digit bank code + 10-digit account = 18-char DE BBAN
    return { type: "iban", iban: ibanGenerate("DE", bban), bic: "BLBLDEB2" };
  }
  if (cur === "GBP") {
    const sortCode = `${randomDigits(2)}-${randomDigits(2)}-${randomDigits(2)}`;
    return { type: "sort_code", account_number: randomDigits(8), sort_code: sortCode };
  }
  if (cur === "USD") {
    return { type: "aba", account_number: randomDigits(10), routing_number: abaGenerate(USD_ROUTING_PREFIX) };
  }
  if (cur === "SGD") return { type: "paynow", proxy: "+65" + randomDigits(8) };
  return { type: "onchain", address: "0x" + randomBytes(20).toString("hex"), network: "base" };
}

route("GET", "/v2/accounts", ({ url, key }) => paginate(visibleTo([...db.accounts.values()], key), url));

route("GET", "/v2/accounts/:id", ({ params, key }) => {
  const a = must(db.accounts, params.id, "account", key);
  return { ...a, balance: { amount: fromMinor(balanceOf(a.id, a.currency)), currency: a.currency } };
});

/** Sandbox funding so transfers can be exercised. */
route("POST", "/v2/accounts/:id/credit", ({ params, body, key }) => {
  const a = must(db.accounts, params.id, "account", key);
  need(body, ["amount"]);
  const minor = positiveMinor(body.amount);
  post([
    { account: a.id, currency: a.currency, amount: minor },
    { account: "external:funding", currency: a.currency, amount: -minor },
  ], "sandbox funding");
  emit("account.credited", { account: a.id, amount: body.amount, currency: a.currency }, { tenantId: a.owner });
  return { ...a, balance: { amount: fromMinor(balanceOf(a.id, a.currency)), currency: a.currency } };
});

/* ---- recipients ---- */
route("POST", "/v2/recipients", ({ body, key }) => {
  need(body, ["name"]);
  const r = {
    id: ksuid("rcp"), name: body.name, destinations: [],
    created_at: new Date().toISOString(), owner: principalId(key),
  };
  if (body.destination) {
    r.destinations.push({ id: ksuid("dst"), ...body.destination, name_check: "unchecked" });
  }
  db.recipients.set(r.id, r);
  return r;
}, { created: true });
route("GET", "/v2/recipients", ({ url, key }) => paginate(visibleTo([...db.recipients.values()], key), url));

/* ---- quotes: an object with an id and an expiry ---- */
route("POST", "/v2/quotes", ({ body, key }) => {
  need(body, ["from", "to", "amount"]);
  const from = body.from.toUpperCase(), to = body.to.toUpperCase();
  if (!RATES[from] || !RATES[to]) throw new ApiError("validation-error", 400, "Unsupported currency pair");
  const thin = THIN.has(from) || THIN.has(to);
  const bps = thin ? 85 : 4;
  const minor = positiveMinor(body.amount);
  const outMinor = convertMinor(minor, from, to, bps);

  const q = {
    id: ksuid("quo"),
    owner: principalId(key),
    from, to,
    amount: { amount: body.amount, currency: from },
    receives: { amount: fromMinor(outMinor), currency: to },
    rate: rateString(from, to),
    spread_bps: bps,
    lockable: true,
    settlement: thin ? "when_matched" : "instant",
    liquidity: thin ? "thin" : "deep",
    expires_at: new Date(Date.now() + 30000).toISOString(),
    created_at: new Date().toISOString(),
  };
  db.quotes.set(q.id, q);
  return q;
}, { created: true });

route("GET", "/v2/quotes/:id", ({ params, key }) => {
  const q = must(db.quotes, params.id, "quote", key);
  return { ...q, expired: Date.parse(q.expires_at) < Date.now() };
});

/* ---- transfers: legs + derived status ---- */
route("POST", "/v2/transfers", async ({ body, key }) => {
  need(body, ["from", "amount", "rail"]);
  // the debit is scoped to the caller's own account: without this a key could
  // name any account id and move money out of it
  const acc = must(db.accounts, body.from, "account", key);
  const rail = RAILS[body.rail];
  if (!rail) throw new ApiError("validation-error", 400, `Unknown rail ${body.rail}`, [
    { field: "rail", message: `try one of: ${Object.keys(RAILS).join(", ")}`, code: "unknown_rail" },
  ]);
  if (rail.currency !== acc.currency) {
    throw new ApiError("validation-error", 400, `${rail.id} settles in ${rail.currency}, not ${acc.currency}`);
  }

  const recipient = body.recipient ? must(db.recipients, body.recipient, "recipient", key) : null;
  let destination = null;
  if (body.destination) {
    const ownedRecipients = visibleTo([...db.recipients.values()], key);
    for (const candidate of ownedRecipients) {
      const found = candidate.destinations.find((item) => item.id === body.destination);
      if (found) {
        destination = found;
        if (recipient && candidate.id !== recipient.id) {
          throw new ApiError("validation-error", 400, `Destination ${found.id} does not belong to recipient ${recipient.id}`);
        }
        break;
      }
    }
    if (!destination) throw new ApiError("not-found", 404, `No destination ${body.destination}`);
    if (destination.rail && destination.rail !== rail.id) {
      throw new ApiError("validation-error", 400, `Destination ${destination.id} uses ${destination.rail}, not ${rail.id}`);
    }
    if (destination.currency && destination.currency !== acc.currency) {
      throw new ApiError("validation-error", 400, `Destination ${destination.id} settles in ${destination.currency}, not ${acc.currency}`);
    }
  }

  const minor = toMinor(body.amount);
  if (minor < toMinor(rail.min)) throw new ApiError("below-minimum", 400, `${rail.id} minimum is ${rail.min} ${rail.currency}`);
  if (minor > toMinor(rail.max)) throw new ApiError("limit-exceeded", 400, `${rail.id} maximum is ${rail.max} ${rail.currency}`);
  if (balanceOf(acc.id, acc.currency) < minor) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(acc.id, acc.currency))} ${acc.currency}`);
  }
  // Rail closed → a real state, not a generic failure.
  if (!rail.weekend && [0, 6].includes(new Date().getUTCDay())) {
    throw new ApiError("rail-unavailable", 422, `${rail.id} does not run at weekends. Next window is Monday.`);
  }

  const now = new Date().toISOString();
  const t = {
    id: ksuid("trf"), status: "created",
    from: acc.id, recipient: recipient?.id ?? null, destination: destination?.id ?? null,
    amount: { amount: body.amount, currency: acc.currency },
    rail: rail.id,
    legs: [{ id: ksuid("leg"), rail: rail.id, status: "created", amount: body.amount, currency: acc.currency }],
    client_reference_id: body.client_reference_id ?? null,
    created_at: now,
    owner: principalId(key),
  };

  post([
    { account: acc.id, currency: acc.currency, amount: -minor },
    { account: "clearing:" + rail.id, currency: acc.currency, amount: minor },
  ], `transfer ${t.id}`);

  db.transfers.set(t.id, t);
  emit("transfer.created", t, { tenantId: t.owner });
  advance(t, "funds_received");
  // instant rails settle in-band; slower rails stay confirming until swept
  if (process.env.CLOUDFLARE_WORKER === "true") {
    advance(t, "submitted");
    advance(t, rail.speed === "seconds" ? "settled" : "confirming");
  } else {
    setTimeout(() => advance(t, "submitted"), 20);
    setTimeout(() => advance(t, rail.speed === "seconds" ? "settled" : "confirming"), 60);
  }
  return t;
}, { created: true });

function advance(t, status) {
  const stored = db.transfers.get(t.id);
  if (!stored) return;
  const previous = stored.status;
  stored.status = status;
  stored.legs[0].status = status;
  db.transfers.set(stored.id, stored);
  emit("transfer.status_changed", { id: stored.id, previous_status: previous, current_status: status }, { tenantId: stored.owner });
}

route("GET", "/v2/transfers", ({ url, key }) => paginate(visibleTo([...db.transfers.values()], key), url));
route("GET", "/v2/transfers/:id", ({ params, key }) => must(db.transfers, params.id, "transfer", key));

/* ---- ledger ---- */
route("GET", "/v2/ledger", ({ url, key }) => {
  const acct = url.searchParams.get("account");
  // postings are not owned rows; they are scoped by the accounts this key holds.
  // Internal legs (clearing:, external:, lp:, spread:) belong to no tenant and
  // are never listed — they would otherwise expose every other tenant's flow.
  const mine = new Set(visibleTo([...db.accounts.values()], key).map((a) => a.id));
  const rows = db.ledger
    .map((r, i) => ({ id: `led_${i}`, ...r, amount: fromMinor(r.amount) }))
    .filter((r) => mine.has(r.account))
    .filter((r) => !acct || r.account === acct);
  return paginate(rows, url);
});

/* ---- rails registry ---- */
route("GET", "/v2/rails", () => ({ object: "list", data: Object.values(RAILS) }), { public: true });
route("GET", "/v2/rails/:id", ({ params }) => {
  const r = RAILS[params.id];
  if (!r) throw new ApiError("not-found", 404, `No rail ${params.id}`);
  return r;
}, { public: true });

/* ---- events ---- */
route("GET", "/v2/events", ({ url, key }) => paginate(
  [...db.events]
    .filter((event) => event.tenant_id === principalId(key))
    .reverse()
    .map(({ tenant_id: _tenantId, ...event }) => event),
  url
));

/* ---- reference data ---- */
route("GET", "/v2/currencies", () => ({
  object: "list",
  data: Object.keys(RATES).map((c) => ({ code: c, thin_liquidity: THIN.has(c) })),
}), { public: true });


/* ---------------- M2 fan-out: auto-load family route modules ----------------
 * Every file in ./routes/ is imported at boot. A family owns exactly one file
 * and never edits this one, so parallel work cannot collide. */
const HERE = process.env.CLOUDFLARE_WORKER === "true"
  ? "."
  : dirname(fileURLToPath(import.meta.url));
const FAMILY_MODULES = [
  ["builder.js", () => import("./routes/builder.js")],
  ["business.js", () => import("./routes/business.js")],
  ["cards.js", () => import("./routes/cards.js")],
  ["fx-lp.js", () => import("./routes/fx-lp.js")],
  ["fx-swap.js", () => import("./routes/fx-swap.js")],
  ["fx.js", () => import("./routes/fx.js")],
  ["identity.js", () => import("./routes/identity.js")],
  ["payments.js", () => import("./routes/payments.js")],
  ["platform.js", () => import("./routes/platform.js")],
  ["products.js", () => import("./routes/products.js")],
];
for (const [, load] of FAMILY_MODULES) await load();
console.log(`  loaded ${FAMILY_MODULES.length} family module(s): ${FAMILY_MODULES.map(([file]) => file).join(", ")}`);

/* ---------------- deliberate 501s, derived from the catalogue ----------------
 * Anything in src/endpoints.ts without a real handler answers 501, not 404, so a
 * caller can tell "not built yet" from "wrong URL". Implement a route and its stub
 * disappears automatically — nothing to hand-maintain. */
const CATALOGUE = join(HERE, "..", "..", "..", "src", "endpoints.ts");
let stubbed = 0;
let cataloguedCount = 0;
export function registerCatalogue(endpoints) {
  let added = 0;
  for (const { verb, path, access } of endpoints) {
    const existing = routes.find((candidate) => candidate.method === verb && candidate.pattern === path);
    if (existing) {
      if (existing.access !== access) {
        throw new Error(`Access mismatch for ${verb} ${path}: router=${existing.access}, catalogue=${access}`);
      }
      continue;
    }
    route(verb, path, () => {
      throw new ApiError("not-implemented", 501, `${verb} ${path} is in the catalogue but not implemented yet.`);
    }, { access });
    added++;
  }
  cataloguedCount = endpoints.length;
  stubbed += added;
}
try {
  const src = await (await import("node:fs/promises")).readFile(CATALOGUE, "utf8");
  registerCatalogue([...src.matchAll(/verb:\s*"(\w+)",\s*path:\s*"([^"]+)"[^\n]+access:\s*"(\w+)"/g)]
    .map(([, verb, path, access]) => ({ verb, path, access })));
} catch (e) {
  console.warn("  could not read the endpoint catalogue:", e.message);
}

/* ---------------- site stats: real counts for the marketing site ----------------
 * Not part of the banking catalogue — this exists so the front end can show
 * genuine numbers (accounts open, endpoints live, etc.) instead of invented ones.
 * Public: these are aggregate counts, not any single customer's data. */
route("GET", "/v2/site/stats", () => ({
  accounts: db.accounts.size,
  customers: db.customers.size,
  transfers: db.transfers.size,
  currencies: Object.keys(RATES).length,
  rails: Object.keys(RAILS).length,
  endpoints_implemented: cataloguedCount - stubbed,
  endpoints_catalogued: cataloguedCount,
}), { public: true });

/* ---------------- request pipeline ---------------- */
const server = createServer(async (req, res) => {
  const requestId = ksuid("req");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return json(res, 204, {}, cors);

  const sourceQuota = rateLimit(`source:${sourceAddress(req)}`, SOURCE_RATE_LIMIT);
  let quotaHeaders = {
    "x-ratelimit-remaining": String(sourceQuota.remaining),
    "x-ratelimit-reset": String(sourceQuota.reset),
    ...cors,
  };
  if (sourceQuota.exceeded) {
    const err = new ApiError("rate-limited", 429, `Over ${SOURCE_RATE_LIMIT} requests per minute from this source. Try again shortly.`);
    return json(res, 429, err.toProblem(url.pathname, requestId), {
      ...quotaHeaders,
      "retry-after": String(Math.max(1, sourceQuota.reset - Math.floor(Date.now() / 1000))),
      "x-request-id": requestId,
    });
  }

  try {
    const hit = match(req.method, url.pathname);
    if (!hit) throw new ApiError("not-found", 404, `No route for ${req.method} ${url.pathname}`);

    const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req) : {};
    const key = hit.r.access === "PUBLIC"
      ? null
      : hit.r.access === "OPERATOR"
        ? operatorAuth(req)
        : auth(req);
    if (key && hit.r.access !== "OPERATOR") {
      const tenantQuota = rateLimit(`tenant:${principalId(key)}`, TENANT_RATE_LIMIT);
      quotaHeaders = {
        ...quotaHeaders,
        "x-ratelimit-remaining": String(Math.min(sourceQuota.remaining, tenantQuota.remaining)),
        "x-ratelimit-reset": String(Math.min(sourceQuota.reset, tenantQuota.reset)),
      };
      if (tenantQuota.exceeded) {
        throw new ApiError("rate-limited", 429, `Over ${TENANT_RATE_LIMIT} requests per minute for this tenant. Try again shortly.`);
      }
    }
    const ctx = { params: hit.params, body, url, key, req };

    const result = ["POST", "PATCH"].includes(req.method)
      ? await idempotent({ req, body, url, route: hit.r, key }, () => hit.r.handler(ctx))
      : await hit.r.handler(ctx);

    json(res, hit.r.successStatus, result, { ...quotaHeaders, "x-request-id": requestId });
  } catch (err) {
    const e = err instanceof ApiError ? err : new ApiError("internal-error", 500, err.message);
    if (!(err instanceof ApiError)) console.error(err);
    json(res, e.status, e.toProblem(url.pathname, requestId), { ...quotaHeaders, "x-request-id": requestId });
  }
});

server.listen(API_PORT, () => {
  console.log(`  ${cataloguedCount - stubbed} implemented · ${stubbed} deliberate 501s · ${cataloguedCount} catalogued`);
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Blueballs API                                         ║
╠════════════════════════════════════════════════════════╣
║  http://localhost:${API_PORT}/v2                              ║
║  Get a key:  POST /v2/auth/signup {"email":"you@x.io"} ║
║  Docs:       http://localhost:5280/developers          ║
╚════════════════════════════════════════════════════════╝`);
});
