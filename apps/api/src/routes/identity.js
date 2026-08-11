/** IDENTITY family — apps/api/src/routes/identity.js
 *
 *  Owns: Auth & API keys, Customers (update/delete), Onboarding applications,
 *  Accounts (update/close), Receiving details.
 *
 *  Storage note: `db` (from kernel.js) only ships collections for the resources
 *  server.js already needed (keys, customers, accounts, ...). kernel.js does not
 *  re-export the PersistentMap class itself, and this family must not edit
 *  kernel.js/lib.js. The two genuinely new resource types this file introduces
 *  (applications, receiving-details records) still need to survive a server
 *  restart like everything else, so this file replicates lib.js's PersistentMap
 *  pattern locally — same SQLite file, its own table per collection — and
 *  attaches the result onto the shared `db` object. Everything that already has
 *  a persisted home (keys, customers, accounts) is read/written straight
 *  through the existing db.* collections instead.
 */

import { DatabaseSync } from "../../../../packages/sqlite-compat/src/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  route, db, ksuid, need, must, paginate, now, ApiError,
  emit, randomBytes, balanceOf, fromMinor, RAILS,
} from "../kernel.js";
import { hashKey } from "../lib.js";
import { ibanGenerate, abaGenerate } from "../../../../packages/validation/src/index.js";

// Same DB file lib.js opens (apps/api/blueballs.sqlite), same WAL mode — a
// second connection from this process is safe and keeps both collections
// durable across restarts, matching every other resource in the API.
const DB_PATH = process.env.DB_PATH || (process.env.CLOUDFLARE_WORKER === "true"
  ? ":memory:"
  : join(dirname(fileURLToPath(import.meta.url)), "..", "..", "blueballs.sqlite"));
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");

class PersistentMap {
  constructor(table) {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    this._cache = new Map();
    for (const row of sqlite.prepare(`SELECT id, data FROM "${table}"`).all()) {
      this._cache.set(row.id, JSON.parse(row.data));
    }
    this._upsert = sqlite.prepare(`INSERT INTO "${table}" (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`);
    this._del = sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`);
  }
  get(id) { return this._cache.get(id); }
  has(id) { return this._cache.has(id); }
  set(id, value) { this._cache.set(id, value); this._upsert.run(id, JSON.stringify(value)); return this; }
  delete(id) { const existed = this._cache.delete(id); this._del.run(id); return existed; }
  values() { return this._cache.values(); }
  keys() { return this._cache.keys(); }
  entries() { return this._cache.entries(); }
  get size() { return this._cache.size; }
  [Symbol.iterator]() { return this._cache[Symbol.iterator](); }
}

// New collections this family owns, attached onto the shared `db` object.
db.applications ??= new PersistentMap("applications"); // app_ -> application
db.details ??= new PersistentMap("details");            // adt_ -> receiving-details record

/* =========================================================================
 * Auth & API keys
 * ========================================================================= */

/** Issue a new key on the same account (email) as the caller's current key. */
route("POST", "/v2/keys", ({ body, key }) => {
  const secret = "bb_sandbox_" + randomBytes(18).toString("base64url");
  const rec = {
    id: ksuid("key"), email: key.email, scope: body.scope ?? key.scope ?? "sandbox",
    created_at: now(), expires: null,
  };
  db.keys.set(hashKey(secret), rec);
  emit("key.issued", { id: rec.id, scope: rec.scope });
  return { ...rec, key: secret, note: "Sandbox keys are unmetered. This is the only time the key is shown." };
});

route("GET", "/v2/keys/:id", ({ params, key }) => {
  const rec = [...db.keys.values()].find((k) => k.id === params.id && k.email === key.email);
  if (!rec) throw new ApiError("not-found", 404, `No key ${params.id}`);
  return rec;
});

route("DELETE", "/v2/keys/:id", ({ params, key }) => {
  const entry = [...db.keys.entries()].find(([, v]) => v.id === params.id && v.email === key.email);
  if (!entry) throw new ApiError("not-found", 404, `No key ${params.id}`);
  db.keys.delete(entry[0]);
  emit("key.revoked", { id: params.id });
  return { id: params.id, object: "key", revoked: true };
});

/** Incident response: revoke every key on the caller's account, including the one in use. */
route("DELETE", "/v2/keys", ({ key }) => {
  const hashes = [...db.keys.entries()].filter(([, v]) => v.email === key.email).map(([h]) => h);
  for (const h of hashes) db.keys.delete(h);
  emit("key.revoked_all", { email: key.email, count: hashes.length });
  return { object: "list", data: [], revoked: hashes.length };
});

/* =========================================================================
 * Customers — update / soft delete
 * ========================================================================= */

route("PATCH", "/v2/customers/:id", ({ params, body }) => {
  const c = must(db.customers, params.id, "customer");
  if (body.name !== undefined) c.name = body.name;
  if (body.email !== undefined) c.email = body.email;
  if (body.client_reference_id !== undefined) c.client_reference_id = body.client_reference_id;
  c.updated_at = now();
  db.customers.set(c.id, c);
  emit("customer.updated", c);
  return c;
});

/** Soft delete — blocked while the customer still has any account record. */
route("DELETE", "/v2/customers/:id", ({ params }) => {
  const c = must(db.customers, params.id, "customer");
  const hasAccounts = [...db.accounts.values()].some((a) => a.customer === c.id);
  if (hasAccounts) {
    throw new ApiError("conflict", 409, `Customer ${c.id} still has accounts; close them before deleting the customer`);
  }
  c.deleted = true;
  c.deleted_at = now();
  db.customers.set(c.id, c);
  emit("customer.deleted", { id: c.id });
  return { id: c.id, object: "customer", deleted: true, deleted_at: c.deleted_at };
});

/* =========================================================================
 * Onboarding applications
 * ========================================================================= */

/** Once an application is completed, its content is frozen. */
function guardMutable(app) {
  if (app.status === "completed") {
    throw new ApiError("conflict", 409, `Application ${app.id} is already completed and can no longer be edited`);
  }
}

route("POST", "/v2/applications", ({ body, key }) => {
  need(body, ["type"]);
  if (!["individual", "business"].includes(body.type)) {
    throw new ApiError("validation-error", 400, "type must be individual or business", [
      { field: "type", message: "must be individual or business", code: "invalid_value" },
    ]);
  }
  const app = {
    id: ksuid("app"), type: body.type,
    customer: body.customer ?? null,
    status: "pending", decision: null,
    business: body.type === "business" ? {} : null,
    individual: body.type === "individual" ? {} : null,
    individuals: [], documents: [], attestations: [], edd: null,
    client_reference_id: body.client_reference_id ?? null,
    owner: key.id,
    created_at: now(), updated_at: now(), submitted_at: null,
  };
  db.applications.set(app.id, app);
  emit("application.created", app);
  return app;
});

route("GET", "/v2/applications", ({ url, key }) =>
  paginate([...db.applications.values()].filter((a) => a.owner === key.id), url));

route("GET", "/v2/applications/:id", ({ params }) => must(db.applications, params.id, "application"));

route("PATCH", "/v2/applications/:id/business", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  app.business = { ...(app.business ?? {}), ...body };
  app.updated_at = now();
  return app;
});

route("PATCH", "/v2/applications/:id/individual", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  app.individual = { ...(app.individual ?? {}), ...body };
  app.updated_at = now();
  return app;
});

/** Associated individuals — beneficial owners, directors, signers. */
route("POST", "/v2/applications/:id/individuals", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  need(body, ["name"]);
  const ind = { id: ksuid("ind"), ...body, created_at: now() };
  app.individuals.push(ind);
  app.updated_at = now();
  emit("application.individual_added", { id: app.id, individual: ind.id });
  return ind;
});

route("PATCH", "/v2/applications/:id/individuals/:iid", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  const ind = app.individuals.find((i) => i.id === params.iid);
  if (!ind) throw new ApiError("not-found", 404, `No individual ${params.iid} on application ${app.id}`);
  Object.assign(ind, body, { id: ind.id, updated_at: now() });
  app.updated_at = now();
  return ind;
});

route("DELETE", "/v2/applications/:id/individuals/:iid", ({ params }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  const idx = app.individuals.findIndex((i) => i.id === params.iid);
  if (idx === -1) throw new ApiError("not-found", 404, `No individual ${params.iid} on application ${app.id}`);
  app.individuals.splice(idx, 1);
  app.updated_at = now();
  return { id: params.iid, object: "individual", deleted: true };
});

/** Documents — content travels as a base64 string; this is a sandbox, not blob storage. */
route("POST", "/v2/applications/:id/documents", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  need(body, ["type", "content"]);
  const doc = {
    id: ksuid("doc"), type: body.type, filename: body.filename ?? null,
    content_type: body.content_type ?? "application/octet-stream",
    content: body.content,
    created_at: now(),
  };
  app.documents.push(doc);
  app.updated_at = now();
  emit("application.document_uploaded", { id: app.id, document: doc.id });
  return doc;
});

route("GET", "/v2/applications/:id/documents/:did", ({ params }) => {
  const app = must(db.applications, params.id, "application");
  const doc = app.documents.find((d) => d.id === params.did);
  if (!doc) throw new ApiError("not-found", 404, `No document ${params.did} on application ${app.id}`);
  return doc;
});

route("DELETE", "/v2/applications/:id/documents/:did", ({ params }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  const idx = app.documents.findIndex((d) => d.id === params.did);
  if (idx === -1) throw new ApiError("not-found", 404, `No document ${params.did} on application ${app.id}`);
  app.documents.splice(idx, 1);
  app.updated_at = now();
  return { id: params.did, object: "document", deleted: true };
});

/** Submit for verification — lifecycle status only, decision is untouched. */
route("POST", "/v2/applications/:id/submit", ({ params }) => {
  const app = must(db.applications, params.id, "application");
  if (app.status !== "pending") {
    throw new ApiError("conflict", 409, `Application ${app.id} is already ${app.status}`);
  }
  app.status = "submitted";
  app.submitted_at = now();
  app.updated_at = now();
  emit("application.status_changed", { id: app.id, previous_status: "pending", current_status: "submitted" });
  return app;
});

route("POST", "/v2/applications/:id/attestation", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  need(body, ["statement", "agreed"]);
  if (body.agreed !== true) {
    throw new ApiError("validation-error", 400, "Attestation must be agreed to", [
      { field: "agreed", message: "must be true", code: "not_agreed" },
    ]);
  }
  const att = { id: ksuid("att"), statement: body.statement, agreed: true, agreed_at: now() };
  app.attestations.push(att);
  app.updated_at = now();
  emit("application.attestation_submitted", { id: app.id, attestation: att.id });
  return att;
});

/** Enhanced due diligence. A sandbox shortcut: passing `decision` resolves the
 *  application straight to `completed`, same spirit as customers'
 *  POST /v2/customers/:id/verify — otherwise EDD just moves a submitted
 *  application into compliance_review while it records the extra fields. */
route("POST", "/v2/applications/:id/edd", ({ params, body }) => {
  const app = must(db.applications, params.id, "application");
  guardMutable(app);
  const { decision, ...eddFields } = body;
  app.edd = { ...(app.edd ?? {}), ...eddFields, updated_at: now() };
  const previous = app.status;
  if (decision !== undefined) {
    if (!["approved", "declined", "withdrawn"].includes(decision)) {
      throw new ApiError("validation-error", 400, "decision must be approved, declined or withdrawn", [
        { field: "decision", message: "must be approved, declined or withdrawn", code: "invalid_value" },
      ]);
    }
    app.decision = decision;
    app.status = "completed";
  } else if (app.status === "submitted") {
    app.status = "compliance_review";
  }
  app.updated_at = now();
  if (app.status !== previous) {
    emit("application.status_changed", { id: app.id, previous_status: previous, current_status: app.status });
  }
  return app;
});

/* =========================================================================
 * Accounts — update / close
 * ========================================================================= */

route("PATCH", "/v2/accounts/:id", ({ params, body }) => {
  const a = must(db.accounts, params.id, "account");
  if (body.client_reference_id !== undefined) a.client_reference_id = body.client_reference_id;
  if (body.label !== undefined) a.label = body.label;
  a.updated_at = now();
  db.accounts.set(a.id, a);
  emit("account.updated", a);
  return { ...a, balance: { amount: fromMinor(balanceOf(a.id, a.currency)), currency: a.currency } };
});

/** Close — refuses a non-zero balance. */
route("DELETE", "/v2/accounts/:id", ({ params }) => {
  const a = must(db.accounts, params.id, "account");
  if (a.status === "closed") throw new ApiError("conflict", 409, `Account ${a.id} is already closed`);
  const bal = balanceOf(a.id, a.currency);
  if (bal !== 0n) {
    throw new ApiError("conflict", 409,
      `Account ${a.id} holds a non-zero balance of ${fromMinor(bal)} ${a.currency}; sweep it before closing`);
  }
  a.status = "closed";
  a.closed_at = now();
  db.accounts.set(a.id, a);
  emit("account.closed", { id: a.id });
  return { ...a, balance: { amount: "0.00", currency: a.currency } };
});

/* =========================================================================
 * Receiving details
 * ========================================================================= */

const randomDigits = (n) => {
  let out = "";
  while (out.length < n) out += randomBytes(4).readUInt32BE(0).toString().padStart(10, "0");
  return out.slice(0, n);
};

// Same fictional Blueballs Bank institution codes used by account opening in
// server.js — fixed per rail, only the account part is generated per instrument.
const EUR_BANK_CODE = "50000888";
const USD_ROUTING_PREFIX = "05000088";

function instrumentFor(railId) {
  const rail = RAILS[railId];
  const cur = rail.currency;
  if (cur === "EUR") {
    const bban = EUR_BANK_CODE + randomDigits(10);
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

route("POST", "/v2/accounts/:id/details", ({ params, body }) => {
  const a = must(db.accounts, params.id, "account");
  need(body, ["rail"]);
  const rail = RAILS[body.rail];
  if (!rail) {
    throw new ApiError("validation-error", 400, `Unknown rail ${body.rail}`, [
      { field: "rail", message: `try one of: ${Object.keys(RAILS).join(", ")}`, code: "unknown_rail" },
    ]);
  }
  if (rail.currency !== a.currency) {
    throw new ApiError("validation-error", 400, `${rail.id} settles in ${rail.currency}, not ${a.currency}`);
  }
  const rec = {
    id: ksuid("adt"), account: a.id, rail: rail.id, currency: rail.currency, status: "active",
    ...instrumentFor(rail.id),
    created_at: now(),
  };
  db.details.set(rec.id, rec);
  emit("account_details.issued", rec);
  return rec;
});

route("GET", "/v2/accounts/:id/details", ({ params, url }) => {
  must(db.accounts, params.id, "account");
  return paginate([...db.details.values()].filter((d) => d.account === params.id), url);
});

route("GET", "/v2/details/:id", ({ params }) => must(db.details, params.id, "account details"));
