/** Blueballs API — reference implementation of spec/conventions.md.
 *  Node stdlib only. `node src/server.js` and you have a working bank API. */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import {
  ksuid, toMinor, fromMinor, ApiError, db, hashKey, emit, post, balanceOf,
} from "./lib.js";
import { ibanGenerate, abaGenerate } from "../../../packages/validation/src/index.js";

const PORT = Number(process.env.PORT || 5281);
const VERSION = "2026-08-06";

/* ---------------- rails registry (real data, queryable) ---------------- */
const RAILS = {
  sepa_instant: { id: "sepa_instant", currency: "EUR", speed: "seconds", cutoff: null, weekend: true, min: "0.01", max: "100000.00" },
  sepa: { id: "sepa", currency: "EUR", speed: "next business day", cutoff: "15:00 CET", weekend: false, min: "0.01", max: "999999.00" },
  faster_payments: { id: "faster_payments", currency: "GBP", speed: "seconds", cutoff: null, weekend: true, min: "0.01", max: "1000000.00" },
  ach: { id: "ach", currency: "USD", speed: "1-2 business days", cutoff: "17:00 ET", weekend: false, min: "0.01", max: "25000.00" },
  wire: { id: "wire", currency: "USD", speed: "same day", cutoff: "16:00 ET", weekend: false, min: "100.00", max: "1000000.00" },
  paynow: { id: "paynow", currency: "SGD", speed: "seconds", cutoff: null, weekend: true, min: "0.01", max: "200000.00" },
};
const RATES = { USD: 1, EUR: 1.083, GBP: 1.271, SGD: 0.742, USDC: 1, MYR: 0.213 };
const THIN = new Set(["MYR"]);

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

function need(body, fields) {
  const errors = fields.filter((f) => body[f] === undefined || body[f] === "")
    .map((f) => ({ field: f, message: "is required", code: "missing" }));
  if (errors.length) throw new ApiError("validation-error", 400, "Some required fields are missing", errors);
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

const paginate = (rows, url) => {
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  const after = url.searchParams.get("starting_after");
  let start = 0;
  if (after) {
    const i = rows.findIndex((r) => r.id === after);
    if (i === -1) throw new ApiError("invalid-identifier", 400, `Unknown cursor ${after}`);
    start = i + 1;
  }
  const page = rows.slice(start, start + limit);
  return { object: "list", data: page, has_more: start + limit < rows.length, next_cursor: page.at(-1)?.id ?? null };
};

/* ---------------- routes ---------------- */
const routes = [];
const route = (method, pattern, handler, opts = {}) =>
  routes.push({ method, parts: pattern.split("/").filter(Boolean), handler, public: !!opts.public });

const match = (parts, method, path) => {
  const seg = path.split("/").filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== seg.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(seg[i]);
      else if (p !== seg[i]) { ok = false; break; }
    }
    if (ok) return { r, params };
  }
  return null;
};

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

/* ---------------- catalogued-but-not-yet-built: deliberate 501s ----------------
 * Every endpoint below exists in src/endpoints.ts (the 144-endpoint catalogue)
 * but has no real handler yet. Registering an explicit 501 (RFC 9457) here means
 * a caller can tell "not built" apart from "wrong URL" (which stays a 404).
 * Stubs are reachable without an API key even where the catalogue marks the eventual
 * route auth:"KEY" — there is no real logic behind auth yet to protect, the full
 * catalogue (incl. which routes need a key) is already public on the docs site, and
 * gating this would just turn 401 into a second, misleading "not built" signal.
 * Real implementations enforce the documented auth as normal — see M2.
 * This block is generated from the catalogue — do not hand-edit; regenerate it
 * as families in M2 get real implementations (and delete their lines below). */
const notImplemented = (verb, path) => () => {
  throw new ApiError("not-implemented", 501, `${verb} ${path} is in the catalogue but not implemented yet.`);
};

/* ---- Auth & API keys (4) ---- */
route("POST", "/v2/keys", notImplemented("POST", "/v2/keys"), { public: true }); // Issue a new API key
route("GET", "/v2/keys/:id", notImplemented("GET", "/v2/keys/:id"), { public: true }); // Key detail and scope
route("DELETE", "/v2/keys/:id", notImplemented("DELETE", "/v2/keys/:id"), { public: true }); // Revoke one key
route("DELETE", "/v2/keys", notImplemented("DELETE", "/v2/keys"), { public: true }); // Revoke every key — incident response

/* ---- Customers (2) ---- */
route("PATCH", "/v2/customers/:id", notImplemented("PATCH", "/v2/customers/:id"), { public: true }); // Update a customer
route("DELETE", "/v2/customers/:id", notImplemented("DELETE", "/v2/customers/:id"), { public: true }); // Soft delete — blocked while accounts exist

/* ---- Onboarding applications (14) ---- */
route("POST", "/v2/applications", notImplemented("POST", "/v2/applications"), { public: true }); // Start an application
route("GET", "/v2/applications/:id", notImplemented("GET", "/v2/applications/:id"), { public: true }); // Application with status and decision
route("GET", "/v2/applications", notImplemented("GET", "/v2/applications"), { public: true }); // List applications
route("PATCH", "/v2/applications/:id/business", notImplemented("PATCH", "/v2/applications/:id/business"), { public: true }); // Update business details
route("PATCH", "/v2/applications/:id/individual", notImplemented("PATCH", "/v2/applications/:id/individual"), { public: true }); // Update individual details
route("POST", "/v2/applications/:id/individuals", notImplemented("POST", "/v2/applications/:id/individuals"), { public: true }); // Add an associated individual
route("PATCH", "/v2/applications/:id/individuals/:iid", notImplemented("PATCH", "/v2/applications/:id/individuals/:iid"), { public: true }); // Update an individual
route("DELETE", "/v2/applications/:id/individuals/:iid", notImplemented("DELETE", "/v2/applications/:id/individuals/:iid"), { public: true }); // Remove an individual
route("POST", "/v2/applications/:id/documents", notImplemented("POST", "/v2/applications/:id/documents"), { public: true }); // Upload a document
route("GET", "/v2/applications/:id/documents/:did", notImplemented("GET", "/v2/applications/:id/documents/:did"), { public: true }); // Download a document
route("DELETE", "/v2/applications/:id/documents/:did", notImplemented("DELETE", "/v2/applications/:id/documents/:did"), { public: true }); // Delete a document
route("POST", "/v2/applications/:id/submit", notImplemented("POST", "/v2/applications/:id/submit"), { public: true }); // Submit for verification
route("POST", "/v2/applications/:id/attestation", notImplemented("POST", "/v2/applications/:id/attestation"), { public: true }); // Submit an attestation
route("POST", "/v2/applications/:id/edd", notImplemented("POST", "/v2/applications/:id/edd"), { public: true }); // Create or update enhanced due diligence

/* ---- Accounts (2) ---- */
route("PATCH", "/v2/accounts/:id", notImplemented("PATCH", "/v2/accounts/:id"), { public: true }); // Update an account
route("DELETE", "/v2/accounts/:id", notImplemented("DELETE", "/v2/accounts/:id"), { public: true }); // Close an account

/* ---- Receiving details (3) ---- */
route("POST", "/v2/accounts/:id/details", notImplemented("POST", "/v2/accounts/:id/details"), { public: true }); // Issue receiving details for a rail
route("GET", "/v2/accounts/:id/details", notImplemented("GET", "/v2/accounts/:id/details"), { public: true }); // List receiving details
route("GET", "/v2/details/:id", notImplemented("GET", "/v2/details/:id"), { public: true }); // Retrieve one instrument

/* ---- Wallets (6) ---- */
route("POST", "/v2/wallets", notImplemented("POST", "/v2/wallets"), { public: true }); // Create a wallet
route("GET", "/v2/wallets/:id", notImplemented("GET", "/v2/wallets/:id"), { public: true }); // Retrieve a wallet
route("GET", "/v2/wallets", notImplemented("GET", "/v2/wallets"), { public: true }); // List wallets
route("GET", "/v2/wallets/:id/balances", notImplemented("GET", "/v2/wallets/:id/balances"), { public: true }); // Balances across networks
route("POST", "/v2/wallets/:id/send", notImplemented("POST", "/v2/wallets/:id/send"), { public: true }); // Send from a wallet
route("GET", "/v2/wallets/:id/policies", notImplemented("GET", "/v2/wallets/:id/policies"), { public: true }); // Policies attached to a wallet

/* ---- Recipients (3) ---- */
route("GET", "/v2/recipients/:id", notImplemented("GET", "/v2/recipients/:id"), { public: true }); // Retrieve a recipient
route("PATCH", "/v2/recipients/:id", notImplemented("PATCH", "/v2/recipients/:id"), { public: true }); // Update a recipient
route("DELETE", "/v2/recipients/:id", notImplemented("DELETE", "/v2/recipients/:id"), { public: true }); // Delete a recipient

/* ---- Destinations (5) ---- */
route("POST", "/v2/recipients/:id/destinations", notImplemented("POST", "/v2/recipients/:id/destinations"), { public: true }); // Add a destination
route("GET", "/v2/destinations/:id", notImplemented("GET", "/v2/destinations/:id"), { public: true }); // Retrieve a destination
route("PATCH", "/v2/destinations/:id", notImplemented("PATCH", "/v2/destinations/:id"), { public: true }); // Update a destination
route("DELETE", "/v2/destinations/:id", notImplemented("DELETE", "/v2/destinations/:id"), { public: true }); // Remove a destination
route("POST", "/v2/destinations/:id/verify", notImplemented("POST", "/v2/destinations/:id/verify"), { public: true }); // Confirmation of Payee name check

/* ---- Quotes & exchange (3) ---- */
route("POST", "/v2/quotes/:id/execute", notImplemented("POST", "/v2/quotes/:id/execute"), { public: true }); // Execute a held quote
route("GET", "/v2/rates", notImplemented("GET", "/v2/rates"), { public: true }); // Indicative rate, not lockable
route("GET", "/v2/pairs", notImplemented("GET", "/v2/pairs"), { public: true }); // Supported pairs and depth

/* ---- Transfers (2) ---- */
route("POST", "/v2/transfers/:id/cancel", notImplemented("POST", "/v2/transfers/:id/cancel"), { public: true }); // Cancel before funding
route("GET", "/v2/transfers/:id/legs", notImplemented("GET", "/v2/transfers/:id/legs"), { public: true }); // Legs with their own rail and status

/* ---- Cards (10) ---- */
route("POST", "/v2/cards", notImplemented("POST", "/v2/cards"), { public: true }); // Issue a virtual or physical card
route("GET", "/v2/cards/:id", notImplemented("GET", "/v2/cards/:id"), { public: true }); // Card with status and reason
route("GET", "/v2/cards", notImplemented("GET", "/v2/cards"), { public: true }); // List cards
route("POST", "/v2/cards/:id/freeze", notImplemented("POST", "/v2/cards/:id/freeze"), { public: true }); // Freeze a card
route("POST", "/v2/cards/:id/unfreeze", notImplemented("POST", "/v2/cards/:id/unfreeze"), { public: true }); // Unfreeze a card
route("POST", "/v2/cards/:id/pin", notImplemented("POST", "/v2/cards/:id/pin"), { public: true }); // Get a secure PIN update link
route("POST", "/v2/cards/:id/reveal", notImplemented("POST", "/v2/cards/:id/reveal"), { public: true }); // Ephemeral key for PCI-safe reveal
route("PATCH", "/v2/cards/:id/controls", notImplemented("PATCH", "/v2/cards/:id/controls"), { public: true }); // Limits and merchant categories
route("GET", "/v2/cards/:id/transactions", notImplemented("GET", "/v2/cards/:id/transactions"), { public: true }); // Card transactions
route("GET", "/v2/cards/:id/statements", notImplemented("GET", "/v2/cards/:id/statements"), { public: true }); // Card statements

/* ---- Authorisations (4) ---- */
route("GET", "/v2/authorisations/:id", notImplemented("GET", "/v2/authorisations/:id"), { public: true }); // Retrieve an authorisation
route("GET", "/v2/authorisations", notImplemented("GET", "/v2/authorisations"), { public: true }); // List pending and cleared
route("POST", "/v2/authorisations/:id/approve", notImplemented("POST", "/v2/authorisations/:id/approve"), { public: true }); // Approve in real time
route("POST", "/v2/authorisations/:id/decline", notImplemented("POST", "/v2/authorisations/:id/decline"), { public: true }); // Decline in real time

/* ---- Disputes (4) ---- */
route("POST", "/v2/disputes", notImplemented("POST", "/v2/disputes"), { public: true }); // Raise a dispute
route("GET", "/v2/disputes/:id", notImplemented("GET", "/v2/disputes/:id"), { public: true }); // Dispute with reason code and deadline
route("GET", "/v2/disputes", notImplemented("GET", "/v2/disputes"), { public: true }); // List disputes
route("POST", "/v2/disputes/:id/evidence", notImplemented("POST", "/v2/disputes/:id/evidence"), { public: true }); // Submit evidence

/* ---- Savings vaults (6) ---- */
route("POST", "/v2/vaults", notImplemented("POST", "/v2/vaults"), { public: true }); // Create a vault
route("GET", "/v2/vaults/:id", notImplemented("GET", "/v2/vaults/:id"), { public: true }); // Vault and accrued interest
route("GET", "/v2/vaults", notImplemented("GET", "/v2/vaults"), { public: true }); // List vaults
route("POST", "/v2/vaults/:id/deposit", notImplemented("POST", "/v2/vaults/:id/deposit"), { public: true }); // Deposit into a vault
route("POST", "/v2/vaults/:id/withdraw", notImplemented("POST", "/v2/vaults/:id/withdraw"), { public: true }); // Withdraw on demand
route("DELETE", "/v2/vaults/:id", notImplemented("DELETE", "/v2/vaults/:id"), { public: true }); // Close a vault

/* ---- Credit lines (6) ---- */
route("POST", "/v2/credit", notImplemented("POST", "/v2/credit"), { public: true }); // Open a credit line
route("GET", "/v2/credit/:id", notImplemented("GET", "/v2/credit/:id"), { public: true }); // Limit, drawn balance and LTV
route("GET", "/v2/credit", notImplemented("GET", "/v2/credit"), { public: true }); // List credit lines
route("POST", "/v2/credit/:id/draw", notImplemented("POST", "/v2/credit/:id/draw"), { public: true }); // Draw down
route("POST", "/v2/credit/:id/repay", notImplemented("POST", "/v2/credit/:id/repay"), { public: true }); // Repay
route("PATCH", "/v2/credit/:id/collateral", notImplemented("PATCH", "/v2/credit/:id/collateral"), { public: true }); // Adjust collateral

/* ---- Policies (9) ---- */
route("POST", "/v2/policies", notImplemented("POST", "/v2/policies"), { public: true }); // Create a policy
route("GET", "/v2/policies/:id", notImplemented("GET", "/v2/policies/:id"), { public: true }); // Retrieve a policy
route("GET", "/v2/policies", notImplemented("GET", "/v2/policies"), { public: true }); // List policies
route("DELETE", "/v2/policies/:id", notImplemented("DELETE", "/v2/policies/:id"), { public: true }); // Delete a policy
route("POST", "/v2/policies/:id/rules", notImplemented("POST", "/v2/policies/:id/rules"), { public: true }); // Add a rule
route("PATCH", "/v2/policies/:id/rules/:rid", notImplemented("PATCH", "/v2/policies/:id/rules/:rid"), { public: true }); // Update a rule
route("DELETE", "/v2/policies/:id/rules/:rid", notImplemented("DELETE", "/v2/policies/:id/rules/:rid"), { public: true }); // Remove a rule
route("POST", "/v2/policies/:id/attach", notImplemented("POST", "/v2/policies/:id/attach"), { public: true }); // Attach to a resource
route("POST", "/v2/policies/:id/detach", notImplemented("POST", "/v2/policies/:id/detach"), { public: true }); // Detach from a resource

/* ---- Approval chains (5) ---- */
route("POST", "/v2/approval-chains", notImplemented("POST", "/v2/approval-chains"), { public: true }); // Create a chain
route("GET", "/v2/approval-chains/:id", notImplemented("GET", "/v2/approval-chains/:id"), { public: true }); // Retrieve a chain
route("GET", "/v2/approvals", notImplemented("GET", "/v2/approvals"), { public: true }); // Pending approvals inbox
route("POST", "/v2/approvals/:id/approve", notImplemented("POST", "/v2/approvals/:id/approve"), { public: true }); // Approve a step
route("POST", "/v2/approvals/:id/reject", notImplemented("POST", "/v2/approvals/:id/reject"), { public: true }); // Reject a step

/* ---- Organisations (6) ---- */
route("POST", "/v2/orgs", notImplemented("POST", "/v2/orgs"), { public: true }); // Create an organisation
route("GET", "/v2/orgs/:id", notImplemented("GET", "/v2/orgs/:id"), { public: true }); // Retrieve an organisation
route("PATCH", "/v2/orgs/:id", notImplemented("PATCH", "/v2/orgs/:id"), { public: true }); // Update an organisation
route("POST", "/v2/orgs/:id/members", notImplemented("POST", "/v2/orgs/:id/members"), { public: true }); // Invite a member with a role
route("GET", "/v2/orgs/:id/members", notImplemented("GET", "/v2/orgs/:id/members"), { public: true }); // List members and roles
route("DELETE", "/v2/orgs/:id/members/:mid", notImplemented("DELETE", "/v2/orgs/:id/members/:mid"), { public: true }); // Remove a member

/* ---- Ledger & statements (3) ---- */
route("GET", "/v2/ledger/balances", notImplemented("GET", "/v2/ledger/balances"), { public: true }); // Balances at a point in time
route("POST", "/v2/statements", notImplemented("POST", "/v2/statements"), { public: true }); // Generate a statement
route("GET", "/v2/statements/:id", notImplemented("GET", "/v2/statements/:id"), { public: true }); // CSV, PDF or signed JSON

/* ---- Fees (2) ---- */
route("GET", "/v2/fees/config", notImplemented("GET", "/v2/fees/config"), { public: true }); // Current fee configuration
route("PUT", "/v2/fees/config", notImplemented("PUT", "/v2/fees/config"), { public: true }); // Set the fee payout destination

/* ---- Rails registry (1) ---- */
route("GET", "/v2/rails/:id/calendar", notImplemented("GET", "/v2/rails/:id/calendar"), { public: true }); // Business days and holidays

/* ---- QR & payment links (4) ---- */
route("POST", "/v2/qr/decode", notImplemented("POST", "/v2/qr/decode"), { public: true }); // Decode a merchant or consumer QR
route("POST", "/v2/qr/generate", notImplemented("POST", "/v2/qr/generate"), { public: true }); // Generate an EMVCo QR payload
route("POST", "/v2/links", notImplemented("POST", "/v2/links"), { public: true }); // Create a payment link
route("GET", "/v2/links/:id", notImplemented("GET", "/v2/links/:id"), { public: true }); // Link status and payments

/* ---- Bills & subscriptions (4) ---- */
route("POST", "/v2/mandates", notImplemented("POST", "/v2/mandates"), { public: true }); // Create a direct debit mandate
route("GET", "/v2/mandates/:id", notImplemented("GET", "/v2/mandates/:id"), { public: true }); // Mandate status
route("POST", "/v2/subscriptions", notImplemented("POST", "/v2/subscriptions"), { public: true }); // Create a recurring payment
route("GET", "/v2/subscriptions", notImplemented("GET", "/v2/subscriptions"), { public: true }); // List subscriptions

/* ---- Webhooks (7) ---- */
route("POST", "/v2/webhooks", notImplemented("POST", "/v2/webhooks"), { public: true }); // Create a target
route("GET", "/v2/webhooks/:id", notImplemented("GET", "/v2/webhooks/:id"), { public: true }); // Retrieve a target
route("GET", "/v2/webhooks", notImplemented("GET", "/v2/webhooks"), { public: true }); // List targets
route("PATCH", "/v2/webhooks/:id", notImplemented("PATCH", "/v2/webhooks/:id"), { public: true }); // Update a target
route("DELETE", "/v2/webhooks/:id", notImplemented("DELETE", "/v2/webhooks/:id"), { public: true }); // Delete a target
route("GET", "/v2/webhooks/:id/deliveries", notImplemented("GET", "/v2/webhooks/:id/deliveries"), { public: true }); // Delivery history
route("POST", "/v2/webhooks/deliveries/:did/replay", notImplemented("POST", "/v2/webhooks/deliveries/:did/replay"), { public: true }); // Replay a delivery

/* ---- Events (1) ---- */
route("GET", "/v2/events/:id", notImplemented("GET", "/v2/events/:id"), { public: true }); // Retrieve one event

/* ---- Sandbox (5) ---- */
route("GET", "/v2/sandbox/scenarios", notImplemented("GET", "/v2/sandbox/scenarios"), { public: true }); // Scenario catalogue
route("POST", "/v2/sandbox/payments", notImplemented("POST", "/v2/sandbox/payments"), { public: true }); // Simulate an inbound payment
route("POST", "/v2/sandbox/onboarding", notImplemented("POST", "/v2/sandbox/onboarding"), { public: true }); // Simulate an onboarding transition
route("POST", "/v2/sandbox/:id/advance", notImplemented("POST", "/v2/sandbox/:id/advance"), { public: true }); // Advance a paused simulation
route("GET", "/v2/sandbox/:id", notImplemented("GET", "/v2/sandbox/:id"), { public: true }); // Simulation and callback history

/* ---- Reference data (2) ---- */
route("GET", "/v2/countries", notImplemented("GET", "/v2/countries"), { public: true }); // Supported countries
route("GET", "/v2/networks", notImplemented("GET", "/v2/networks"), { public: true }); // Supported blockchain networks

/* ---------------- request pipeline ---------------- */
const server = createServer(async (req, res) => {
  const requestId = ksuid("req");
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return json(res, 204, {});

  try {
    const hit = match(url.pathname, req.method, url.pathname);
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
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Blueballs API                                         ║
╠════════════════════════════════════════════════════════╣
║  http://localhost:${PORT}/v2                              ║
║  Get a key:  POST /v2/auth/signup {"email":"you@x.io"} ║
║  Docs:       http://localhost:5280/developers          ║
╚════════════════════════════════════════════════════════╝`);
});
