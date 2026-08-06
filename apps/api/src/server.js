/** Blueballs API — reference implementation of spec/conventions.md.
 *  Node stdlib only. `node src/server.js` and you have a working bank API. */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { hashKey } from "./lib.js";
import {
  ksuid, toMinor, fromMinor, ApiError, db, emit, post, balanceOf,
  RAILS, RATES, THIN, routes, route, isRegistered, match, need, paginate,
} from "./kernel.js";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { ibanGenerate, abaGenerate } from "../../../packages/validation/src/index.js";

const PORT = Number(process.env.PORT || 5281);
const VERSION = "2026-08-06";


/* ---------------- helpers ---------------- */
const json = (res, status, body, extra = {}) => {
  const payload = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  res.writeHead(status, {
    "content-type": status >= 400 && body.type ? "application/problem+json" : "application/json",
    "x-api-version": VERSION,
    "x-ratelimit-limit": "60",
    "x-ratelimit-remaining": "59",
    "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-api-key,x-idempotency-key",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    ...extra,
  });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new ApiError("payload-too-large", 413, "Body over 1MB"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new ApiError("validation-error", 400, "Body is not valid JSON")); }
    });
  });

function auth(req) {
  const key = req.headers["x-api-key"];
  if (!key) throw new ApiError("authentication-error", 401, "Send your key in the x-api-key header");
  const rec = db.keys.get(hashKey(key));
  if (!rec) throw new ApiError("authentication-error", 401, "That key is not valid");
  return rec;
}


/** Idempotency: same key + same body → cached response; same key + different body → 409. */
async function idempotent(req, body, fn) {
  const key = req.headers["x-idempotency-key"];
  if (!key) return fn();
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const seen = db.idempotency.get(key);
  if (seen) {
    if (seen.fingerprint !== fingerprint) {
      throw new ApiError("conflict", 409, "This idempotency key was used with different parameters");
    }
    return { ...seen.result, replayed: true };
  }
  const result = await fn();
  db.idempotency.set(key, { fingerprint, result });
  return result;
}



/* ---- discovery ---- */
route("GET", "/v2", () => ({
  name: "Blueballs API",
  version: VERSION,
  docs: "http://localhost:5280/developers",
  signup: "POST /v2/auth/signup — issues a sandbox key instantly, no approval",
}), { public: true });

/* ---- auth: SELF-SERVE, no human in the loop ---- */
route("POST", "/v2/auth/signup", async ({ body }) => {
  need(body, ["email"]);
  const secret = "bb_sandbox_" + randomBytes(18).toString("base64url");
  const rec = {
    id: ksuid("key"), email: body.email, scope: "sandbox",
    created_at: new Date().toISOString(), expires: null,
  };
  db.keys.set(hashKey(secret), rec);
  emit("key.issued", { id: rec.id, scope: rec.scope });
  return {
    ...rec,
    key: secret,
    note: "Sandbox keys are unmetered and never expire. This is the only time the key is shown.",
  };
}, { public: true });

route("GET", "/v2/keys", ({ key }) => ({
  object: "list",
  data: [...db.keys.values()].filter((k) => k.email === key.email).map(({ ...k }) => k),
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
    created_at: new Date().toISOString(), owner: key.id,
  };
  db.customers.set(c.id, c);
  emit("customer.created", c);
  return c;
});

route("GET", "/v2/customers", ({ url, key }) =>
  paginate([...db.customers.values()].filter((c) => c.owner === key.id), url));

route("GET", "/v2/customers/:id", ({ params }) => {
  const c = db.customers.get(params.id);
  if (!c) throw new ApiError("not-found", 404, `No customer ${params.id}`);
  return c;
});

/** Capabilities: which rails this customer can use, and what's outstanding. */
route("GET", "/v2/customers/:id/capabilities", ({ params }) => {
  const c = db.customers.get(params.id);
  if (!c) throw new ApiError("not-found", 404, `No customer ${params.id}`);
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
route("POST", "/v2/customers/:id/verify", ({ params, body }) => {
  const c = db.customers.get(params.id);
  if (!c) throw new ApiError("not-found", 404, `No customer ${params.id}`);
  c.status = "completed";
  c.decision = body.decision ?? "approved";
  c.tier = c.decision === "approved" ? 3 : 1;
  emit("customer.status_changed", { id: c.id, status: c.status, decision: c.decision });
  return c;
});

/* ---- accounts ---- */
route("POST", "/v2/accounts", async ({ body }) => {
  need(body, ["customer", "currency"]);
  const c = db.customers.get(body.customer);
  if (!c) throw new ApiError("not-found", 404, `No customer ${body.customer}`);
  const cur = String(body.currency).toUpperCase();
  if (!RATES[cur]) throw new ApiError("validation-error", 400, `${cur} is not a supported currency`);

  const a = {
    id: ksuid("acc"), customer: c.id, currency: cur, type: body.type ?? "holding",
    status: "open", created_at: new Date().toISOString(),
    details: detailsFor(cur),
  };
  db.accounts.set(a.id, a);
  emit("account.opened", a);
  return { ...a, balance: { amount: "0.00", currency: cur } };
});

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

route("GET", "/v2/accounts", ({ url }) => paginate([...db.accounts.values()], url));

route("GET", "/v2/accounts/:id", ({ params }) => {
  const a = db.accounts.get(params.id);
  if (!a) throw new ApiError("not-found", 404, `No account ${params.id}`);
  return { ...a, balance: { amount: fromMinor(balanceOf(a.id, a.currency)), currency: a.currency } };
});

/** Sandbox funding so transfers can be exercised. */
route("POST", "/v2/accounts/:id/credit", ({ params, body }) => {
  const a = db.accounts.get(params.id);
  if (!a) throw new ApiError("not-found", 404, `No account ${params.id}`);
  need(body, ["amount"]);
  const minor = toMinor(body.amount);
  post([
    { account: a.id, currency: a.currency, amount: minor },
    { account: "external:funding", currency: a.currency, amount: -minor },
  ], "sandbox funding");
  emit("account.credited", { account: a.id, amount: body.amount, currency: a.currency });
  return { ...a, balance: { amount: fromMinor(balanceOf(a.id, a.currency)), currency: a.currency } };
});

/* ---- recipients ---- */
route("POST", "/v2/recipients", ({ body }) => {
  need(body, ["name"]);
  const r = {
    id: ksuid("rcp"), name: body.name, destinations: [],
    created_at: new Date().toISOString(),
  };
  if (body.destination) {
    r.destinations.push({ id: ksuid("dst"), ...body.destination, name_check: "unchecked" });
  }
  db.recipients.set(r.id, r);
  return r;
});
route("GET", "/v2/recipients", ({ url }) => paginate([...db.recipients.values()], url));

/* ---- quotes: an object with an id and an expiry ---- */
route("POST", "/v2/quotes", ({ body }) => {
  need(body, ["from", "to", "amount"]);
  const from = body.from.toUpperCase(), to = body.to.toUpperCase();
  if (!RATES[from] || !RATES[to]) throw new ApiError("validation-error", 400, "Unsupported currency pair");
  const thin = THIN.has(from) || THIN.has(to);
  const bps = thin ? 85 : 4;
  const minor = toMinor(body.amount);
  const gross = (Number(minor) / 100) * (RATES[from] / RATES[to]);
  const out = gross * (1 - bps / 10000);

  const q = {
    id: ksuid("quo"),
    from, to,
    amount: { amount: body.amount, currency: from },
    receives: { amount: out.toFixed(2), currency: to },
    rate: (RATES[from] / RATES[to]).toFixed(6),
    spread_bps: bps,
    lockable: true,
    settlement: thin ? "when_matched" : "instant",
    liquidity: thin ? "thin" : "deep",
    expires_at: new Date(Date.now() + 30000).toISOString(),
    created_at: new Date().toISOString(),
  };
  db.quotes.set(q.id, q);
  return q;
});

route("GET", "/v2/quotes/:id", ({ params }) => {
  const q = db.quotes.get(params.id);
  if (!q) throw new ApiError("not-found", 404, `No quote ${params.id}`);
  return { ...q, expired: Date.parse(q.expires_at) < Date.now() };
});

/* ---- transfers: legs + derived status ---- */
route("POST", "/v2/transfers", async ({ body }) => {
  need(body, ["from", "amount", "rail"]);
  const acc = db.accounts.get(body.from);
  if (!acc) throw new ApiError("not-found", 404, `No account ${body.from}`);
  const rail = RAILS[body.rail];
  if (!rail) throw new ApiError("validation-error", 400, `Unknown rail ${body.rail}`, [
    { field: "rail", message: `try one of: ${Object.keys(RAILS).join(", ")}`, code: "unknown_rail" },
  ]);
  if (rail.currency !== acc.currency) {
    throw new ApiError("validation-error", 400, `${rail.id} settles in ${rail.currency}, not ${acc.currency}`);
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
    from: acc.id, recipient: body.recipient ?? null,
    amount: { amount: body.amount, currency: acc.currency },
    rail: rail.id,
    legs: [{ id: ksuid("leg"), rail: rail.id, status: "created", amount: body.amount, currency: acc.currency }],
    client_reference_id: body.client_reference_id ?? null,
    created_at: now,
  };

  post([
    { account: acc.id, currency: acc.currency, amount: -minor },
    { account: "clearing:" + rail.id, currency: acc.currency, amount: minor },
  ], `transfer ${t.id}`);

  db.transfers.set(t.id, t);
  emit("transfer.created", t);
  advance(t, "funds_received");
  // instant rails settle in-band; slower rails stay confirming until swept
  setTimeout(() => advance(t, "submitted"), 20);
  setTimeout(() => advance(t, rail.speed === "seconds" ? "settled" : "confirming"), 60);
  return t;
});

function advance(t, status) {
  const stored = db.transfers.get(t.id);
  if (!stored) return;
  const previous = stored.status;
  stored.status = status;
  stored.legs[0].status = status;
  emit("transfer.status_changed", { id: stored.id, previous_status: previous, current_status: status });
}

route("GET", "/v2/transfers", ({ url }) => paginate([...db.transfers.values()], url));
route("GET", "/v2/transfers/:id", ({ params }) => {
  const t = db.transfers.get(params.id);
  if (!t) throw new ApiError("not-found", 404, `No transfer ${params.id}`);
  return t;
});

/* ---- ledger ---- */
route("GET", "/v2/ledger", ({ url }) => {
  const acct = url.searchParams.get("account");
  const rows = db.ledger
    .filter((r) => !acct || r.account === acct)
    .map((r, i) => ({ id: `led_${i}`, ...r, amount: fromMinor(r.amount) }));
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
route("GET", "/v2/events", ({ url }) => paginate([...db.events].reverse(), url));

/* ---- reference data ---- */
route("GET", "/v2/currencies", () => ({
  object: "list",
  data: Object.keys(RATES).map((c) => ({ code: c, thin_liquidity: THIN.has(c) })),
}), { public: true });


/* ---------------- M2 fan-out: auto-load family route modules ----------------
 * Every file in ./routes/ is imported at boot. A family owns exactly one file
 * and never edits this one, so parallel work cannot collide. */
const HERE = dirname(fileURLToPath(import.meta.url));
try {
  const files = (await readdir(join(HERE, "routes"))).filter((f) => f.endsWith(".js")).sort();
  for (const f of files) await import(pathToFileURL(join(HERE, "routes", f)).href);
  if (files.length) console.log(`  loaded ${files.length} family module(s): ${files.join(", ")}`);
} catch (e) {
  if (e.code !== "ENOENT") throw e; // no routes/ dir yet is fine
}

/* ---------------- deliberate 501s, derived from the catalogue ----------------
 * Anything in src/endpoints.ts without a real handler answers 501, not 404, so a
 * caller can tell "not built yet" from "wrong URL". Implement a route and its stub
 * disappears automatically — nothing to hand-maintain. */
const CATALOGUE = join(HERE, "..", "..", "..", "src", "endpoints.ts");
let stubbed = 0;
try {
  const src = await (await import("node:fs/promises")).readFile(CATALOGUE, "utf8");
  for (const [, verb, path] of src.matchAll(/verb:\s*"(\w+)",\s*path:\s*"([^"]+)"/g)) {
    if (isRegistered(verb, path)) continue;
    route(verb, path, () => {
      throw new ApiError("not-implemented", 501, `${verb} ${path} is in the catalogue but not implemented yet.`);
    }, { public: true });
    stubbed++;
  }
} catch (e) {
  console.warn("  could not read the endpoint catalogue:", e.message);
}

/* ---------------- request pipeline ---------------- */
const server = createServer(async (req, res) => {
  const requestId = ksuid("req");
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return json(res, 204, {});

  try {
    const hit = match(req.method, url.pathname);
    if (!hit) throw new ApiError("not-found", 404, `No route for ${req.method} ${url.pathname}`);

    const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req) : {};
    const key = hit.r.public ? null : auth(req);
    const ctx = { params: hit.params, body, url, key, req };

    const result = ["POST", "PATCH"].includes(req.method)
      ? await idempotent(req, body, () => hit.r.handler(ctx))
      : await hit.r.handler(ctx);

    json(res, req.method === "POST" ? 201 : 200, result, { "x-request-id": requestId });
  } catch (err) {
    const e = err instanceof ApiError ? err : new ApiError("internal-error", 500, err.message);
    if (!(err instanceof ApiError)) console.error(err);
    json(res, e.status, e.toProblem(url.pathname, requestId), { "x-request-id": requestId });
  }
});

server.listen(PORT, () => {
  console.log(`  ${routes.length - stubbed} implemented · ${stubbed} deliberate 501s · ${routes.length} catalogued`);
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Blueballs API                                         ║
╠════════════════════════════════════════════════════════╣
║  http://localhost:${PORT}/v2                              ║
║  Get a key:  POST /v2/auth/signup {"email":"you@x.io"} ║
║  Docs:       http://localhost:5280/developers          ║
╚════════════════════════════════════════════════════════╝`);
});
