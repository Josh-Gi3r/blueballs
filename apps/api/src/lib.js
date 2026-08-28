/** Shared primitives implementing spec/conventions.md.
 *  Zero dependencies — the whole point is that self-hosting is trivial. */

import { randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ---------------- identifiers: type-prefixed KSUID-style ---------------- */
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const EPOCH = 1400000000; // KSUID epoch

/** 27-char base62, time-sortable, opaque. */
export function ksuid(prefix) {
  const ts = Math.floor(Date.now() / 1000) - EPOCH;
  const buf = Buffer.alloc(20);
  buf.writeUInt32BE(ts, 0);
  randomBytes(16).copy(buf, 4);
  let n = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (n > 0n) {
    out = B62[Number(n % 62n)] + out;
    n /= 62n;
  }
  return `${prefix}_${out.padStart(27, "0")}`;
}

/* ---------------- money: decimal strings, never floats ---------------- */
/** Parse "2400.00" → 240000n minor units. Rejects floats and junk. */
export function toMinor(amount, dp = 2) {
  if (typeof amount !== "string" || !/^-?\d+(\.\d+)?$/.test(amount)) {
    throw new ApiError(
      "validation-error",
      400,
      "Amount must be a decimal string",
      [
        {
          field: "amount",
          message: 'expected a decimal string such as "2400.00"',
          code: "invalid_format",
        },
      ],
    );
  }
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > dp) {
    throw new ApiError(
      "validation-error",
      400,
      `Amount has more than ${dp} decimal places`,
    );
  }
  return BigInt(whole + frac.padEnd(dp, "0"));
}
export function fromMinor(minor, dp = 2) {
  const neg = minor < 0n;
  const s = (neg ? -minor : minor).toString().padStart(dp + 1, "0");
  const out = `${s.slice(0, -dp)}.${s.slice(-dp)}`;
  return neg ? `-${out}` : out;
}

/* ---------------- RFC 9457 problem details ---------------- */
const STATUS_FOR = {
  "validation-error": 400,
  "invalid-request": 400,
  "invalid-identifier": 400,
  "insufficient-balance": 400,
  "limit-exceeded": 400,
  "below-minimum": 400,
  "authentication-error": 401,
  forbidden: 403,
  "tier-insufficient": 403,
  "not-found": 404,
  conflict: 409,
  "quote-expired": 409,
  "payload-too-large": 413,
  "compliance-blocked": 422,
  "rail-unavailable": 422,
  "rate-limited": 429,
  "internal-error": 500,
  "not-implemented": 501,
  "provider-error": 502,
  "service-unavailable": 503,
};
const TITLES = {
  "validation-error": "The request failed validation",
  "insufficient-balance": "Not enough available balance",
  "limit-exceeded": "Limit exceeded",
  "below-minimum": "Below the minimum for this route",
  "authentication-error": "Missing or invalid API key",
  "tier-insufficient": "Your verification tier does not allow this",
  "not-found": "Not found",
  conflict: "Conflicting request",
  "quote-expired": "That quote has expired",
  "compliance-blocked": "Blocked by screening",
  "rail-unavailable": "That rail is unavailable right now",
  "rate-limited": "Too many requests",
  "internal-error": "Something went wrong on our side",
  "not-implemented": "Not implemented yet",
};

export class ApiError extends Error {
  constructor(type, status, detail, errors) {
    super(detail || type);
    this.type = type;
    this.status = status || STATUS_FOR[type] || 500;
    this.detail = detail;
    this.errors = errors;
  }
  toProblem(instance, requestId) {
    const body = {
      type: this.type,
      title: TITLES[this.type] || this.type,
      status: this.status,
      instance,
      request_id: requestId,
    };
    if (this.detail) body.detail = this.detail;
    if (this.errors) body.errors = this.errors;
    return body;
  }
}

/* ---------------- storage (SQLite, node:sqlite stdlib — zero deps) ----------------
 * Same exported interface as the old in-memory version (db.keys.get/.set/.values(),
 * db.ledger.push/.filter, db.events.push/.shift/.length, emit(), post(), balanceOf())
 * so server.js does not need to change how it talks to storage. */

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.CLOUDFLARE_WORKER === "true"
    ? ":memory:"
    : join(dirname(fileURLToPath(import.meta.url)), "..", "blueballs.sqlite"));
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");

/* =========================================================================
 * REQUEST-SCOPED PERSISTENCE
 *
 * `get()` used to hand back the live cached object, and `set()` was the only
 * thing that wrote SQLite. So a handler that did
 *
 *     const q = must(db.quotes, id, "quote");
 *     post([...]);            // durable
 *     q.executed = true;      // RAM only
 *
 * moved money durably and left the guard that stops the second run in memory.
 * A restart replayed the money. Twenty-six handlers had that shape and four of
 * them moved money.
 *
 * Adding the missing `.set()` twenty-six times fixes today and does nothing
 * about the twenty-seventh handler someone writes after forking this. So the
 * storage layer tracks it instead: `get()` returns a proxy that records the row
 * as dirty the moment anything on it is written, at any depth, and the request
 * boundary persists every dirty row once the handler has returned successfully.
 *
 * A handler that throws rolls the rows back to the snapshot taken before its
 * first write, so a half-applied mutation cannot survive its own failure —
 * which the explicit `.set()` calls never protected against either.
 * ====================================================================== */

const RAW = Symbol("blueballs.raw");

/** Per-request, not per-process. Five handlers are async — `POST /v2/transfers`
 *  among them — so two requests can interleave at an await, and a shared dirty
 *  set would let one request's commit persist another's half-finished work, or
 *  one request's failure roll back a row a different request had already
 *  changed. AsyncLocalStorage keeps each request's rows to itself. */
const requestScope = new AsyncLocalStorage();
const proxies = new WeakMap();

function unwrap(value) {
  return value !== null && typeof value === "object" && value[RAW] !== undefined
    ? value[RAW]
    : value;
}

/** Record the row's pre-mutation state once per request, before its first write. */
function snapshotOnce(store, map, id, root) {
  let rows = store.get(map);
  if (!rows) {
    rows = new Map();
    store.set(map, rows);
  }
  if (!rows.has(id)) rows.set(id, structuredClone(root));
}

/** Recursive so `approval.decisions.push(...)` and `recipient.destinations[0].x = 1`
 *  count as writes. Dates are left alone — they are values here, and proxying one
 *  breaks the internal slots its methods rely on. */
function track(value, map, id, root) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const existing = proxies.get(value);
  if (existing) return existing;
  const proxy = new Proxy(value, {
    get(target, prop, receiver) {
      if (prop === RAW) return target;
      return track(Reflect.get(target, prop, receiver), map, id, root);
    },
    set(target, prop, next, receiver) {
      const store = requestScope.getStore();
      if (store) snapshotOnce(store, map, id, root);
      const ok = Reflect.set(target, prop, unwrap(next), receiver);
      // Boot-time seeding and scripts run outside a request. There is no commit
      // coming for them, so write through immediately rather than silently
      // leaving the change in memory — the exact failure this whole mechanism
      // exists to remove.
      if (!store) map._persist(id);
      return ok;
    },
    deleteProperty(target, prop) {
      const store = requestScope.getStore();
      if (store) snapshotOnce(store, map, id, root);
      const ok = Reflect.deleteProperty(target, prop);
      if (!store) map._persist(id);
      return ok;
    },
  });
  proxies.set(value, proxy);
  return proxy;
}

/** Run a request handler so every row it mutates is persisted when it returns,
 *  and restored if it throws. */
export async function inRequestScope(run) {
  const store = new Map();
  return requestScope.run(store, async () => {
    try {
      const result = await run();
      for (const [map, rows] of store)
        for (const id of rows.keys()) map._persist(id);
      return result;
    } catch (error) {
      for (const [map, rows] of store)
        for (const [id, snapshot] of rows) map._restore(id, snapshot);
      throw error;
    } finally {
      store.clear();
    }
  });
}

/** Map-like collection (get/set/has/delete/values/keys/entries/size) backed by a
 *  SQLite table, JSON-serialised, fully cached in memory after load for Map-speed reads. */
class PersistentMap {
  constructor(table) {
    this.table = table;
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
    );
    this._cache = new Map();
    for (const row of sqlite.prepare(`SELECT id, data FROM "${table}"`).all()) {
      this._cache.set(row.id, JSON.parse(row.data));
    }
    this._upsert = sqlite.prepare(
      `INSERT INTO "${table}" (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    );
    this._del = sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`);
  }
  get(id) {
    const row = this._cache.get(id);
    return row === undefined ? row : track(row, this, id, row);
  }
  has(id) {
    return this._cache.has(id);
  }
  set(id, value) {
    const row = unwrap(value);
    this._cache.set(id, row);
    this._upsert.run(id, JSON.stringify(row));
    requestScope.getStore()?.get(this)?.delete(id); // written through; nothing left to flush
    return this;
  }
  delete(id) {
    const existed = this._cache.delete(id);
    this._del.run(id);
    requestScope.getStore()?.get(this)?.delete(id);
    return existed;
  }
  /** Write a row the request mutated in place. */
  _persist(id) {
    const row = this._cache.get(id);
    if (row === undefined) this._del.run(id);
    else this._upsert.run(id, JSON.stringify(row));
  }
  /** Put a row back the way it was before the request touched it. */
  _restore(id, snapshot) {
    proxies.delete(this._cache.get(id));
    this._cache.set(id, snapshot);
  }
  // Iteration is tracked too: a handler that mutates a row it reached through
  // values() has changed the same cached object get() would have handed it.
  *values() {
    for (const [id, row] of this._cache) yield track(row, this, id, row);
  }
  keys() {
    return this._cache.keys();
  }
  *entries() {
    for (const [id, row] of this._cache) yield [id, track(row, this, id, row)];
  }
  get size() {
    return this._cache.size;
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

/** Append-only ledger rows. Amounts are stored as TEXT (stringified minor-unit
 *  BigInt) — never REAL — and rehydrated back into BigInt on read. */
class PersistentLedger {
  constructor() {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS ledger (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      txn TEXT NOT NULL, at TEXT NOT NULL, account TEXT NOT NULL,
      currency TEXT NOT NULL, amount TEXT NOT NULL, memo TEXT
    )`);
    this._insert = sqlite.prepare(
      `INSERT INTO ledger (txn, at, account, currency, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    this._selectAll = sqlite.prepare(`SELECT * FROM ledger ORDER BY seq`);
    this._selectAccount = sqlite.prepare(
      `SELECT amount FROM ledger WHERE account = ? AND currency = ?`,
    );
  }
  /** Sum one account's rows in SQL rather than walking the whole ledger. Amounts
   *  are TEXT, so they are summed as BigInt here and never by SQL's REAL SUM(). */
  balance(account, currency) {
    let n = 0n;
    for (const r of this._selectAccount.all(account, currency))
      n += BigInt(r.amount);
    return n;
  }
  push(row) {
    this._insert.run(
      row.txn,
      row.at,
      row.account,
      row.currency,
      row.amount.toString(),
      row.memo ?? null,
    );
  }
  _all() {
    return this._selectAll.all().map((r) => ({
      txn: r.txn,
      at: r.at,
      account: r.account,
      currency: r.currency,
      amount: BigInt(r.amount),
      memo: r.memo,
    }));
  }
  filter(fn) {
    return this._all().filter(fn);
  }
  map(fn) {
    return this._all().map(fn);
  }
  reduce(fn, init) {
    return this._all().reduce(fn, init);
  }
  get length() {
    return sqlite.prepare(`SELECT COUNT(*) c FROM ledger`).get().c;
  }
  [Symbol.iterator]() {
    return this._all()[Symbol.iterator]();
  }
}

/** Bounded event log — push/shift like the old array, but durable. */
class PersistentEvents {
  constructor() {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL, type TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL,
      tenant_id TEXT
    )`);
    const columns = sqlite.prepare(`PRAGMA table_info(events)`).all();
    if (!columns.some((column) => column.name === "tenant_id")) {
      sqlite.exec(`ALTER TABLE events ADD COLUMN tenant_id TEXT`);
    }
    this._insert = sqlite.prepare(
      `INSERT INTO events (id, type, created_at, data, tenant_id) VALUES (?, ?, ?, ?, ?)`,
    );
    this._shiftOldest = sqlite.prepare(
      `DELETE FROM events WHERE seq = (SELECT MIN(seq) FROM events)`,
    );
    this._countTenant = sqlite.prepare(
      `SELECT COUNT(*) c FROM events WHERE tenant_id = ?`,
    );
    this._shiftTenant = sqlite.prepare(
      `DELETE FROM events WHERE seq = (SELECT MIN(seq) FROM events WHERE tenant_id = ?)`,
    );
    this._selectAll = sqlite.prepare(`SELECT * FROM events ORDER BY seq`);
  }
  push(evt) {
    this._insert.run(
      evt.id,
      evt.type,
      evt.created_at,
      JSON.stringify(evt.data),
      evt.tenant_id ?? null,
    );
  }
  shift() {
    this._shiftOldest.run();
  }
  trimTenant(tenantId, maximum) {
    while (this._countTenant.get(tenantId).c > maximum)
      this._shiftTenant.run(tenantId);
  }
  get length() {
    return sqlite.prepare(`SELECT COUNT(*) c FROM events`).get().c;
  }
  _all() {
    return this._selectAll.all().map((r) => ({
      id: r.id,
      type: r.type,
      created_at: r.created_at,
      data: JSON.parse(r.data),
      tenant_id: r.tenant_id,
    }));
  }
  [Symbol.iterator]() {
    return this._all()[Symbol.iterator]();
  }
}

/** Create a durable, Map-shaped collection. Route modules use this instead of
 *  `new Map()` so new resource types survive a restart like everything else.
 *  Usage:  const cards = collection("cards");  // then .get/.set/.values() as normal */
export function collection(name) {
  return new PersistentMap(name);
}

export const db = {
  tenants: new PersistentMap("tenants"), // tenant_id -> tenant metadata
  keys: new PersistentMap("keys"), // hashedKey -> { id, tenant_id, email, scope, created_at }
  customers: new PersistentMap("customers"),
  accounts: new PersistentMap("accounts"),
  recipients: new PersistentMap("recipients"),
  quotes: new PersistentMap("quotes"),
  transfers: new PersistentMap("transfers"),
  ledger: new PersistentLedger(),
  events: new PersistentEvents(),
  idempotency: new PersistentMap("idempotency"), // hash(tenant + operation + caller key) -> cached result
};

export const hashKey = (k) => createHash("sha256").update(k).digest("hex");

const eventSubscribers = new Set();

export function subscribeToEvents(subscriber) {
  eventSubscribers.add(subscriber);
  return () => eventSubscribers.delete(subscriber);
}

export function emit(type, data, { tenantId } = {}) {
  if (!tenantId) throw new Error(`Event ${type} requires an explicit tenantId`);
  const evt = {
    id: ksuid("evt"),
    type,
    created_at: new Date().toISOString(),
    data,
    tenant_id: tenantId,
  };
  db.events.push(evt);
  const retention = Number(process.env.EVENT_RETENTION_PER_TENANT || 1000);
  if (!Number.isSafeInteger(retention) || retention < 1) {
    throw new Error("EVENT_RETENTION_PER_TENANT must be a positive integer");
  }
  db.events.trimTenant(tenantId, retention);
  for (const subscriber of eventSubscribers) subscriber(evt);
  return evt;
}

/** Accounts that are *meant* to run negative are namespaced with a colon —
 *  "clearing:paynow", "external:funding", "lp:USDC/EURC:USDC", "principal:EURC",
 *  "issuance:…", "reserve:…", "spread:…", "fx:clearing", "sandbox:…". They are the
 *  system's side of a movement: the money has left the customer and is somewhere
 *  in the machine. A customer-facing account is a bare type-prefixed KSUID
 *  (acc_…, vlt_…, wal_…, crd_…) and never contains a colon. */
const isSystemAccount = (account) => account.includes(":");

/** No customer account may be driven below zero, whatever a handler forgets.
 *  Only the accounts this posting takes money *out* of are checked, and only the
 *  net movement counts, so an entry that debits and credits the same account in
 *  one transaction is judged on its result rather than its steps. */
function assertNoOverdraft(entries) {
  const deltas = new Map();
  for (const e of entries) {
    if (isSystemAccount(e.account)) continue;
    const k = `${e.account}\u0000${e.currency}`;
    deltas.set(k, (deltas.get(k) ?? 0n) + e.amount);
  }
  for (const [k, delta] of deltas) {
    if (delta >= 0n) continue;
    const [account, currency] = k.split("\u0000");
    const balance = db.ledger.balance(account, currency);
    if (balance + delta < 0n) {
      throw new ApiError(
        "insufficient-balance",
        400,
        `Account ${account} holds ${fromMinor(balance)} ${currency} and this movement needs ${fromMinor(-delta)} ${currency}`,
      );
    }
  }
}

/** Double-entry: every movement writes two rows that must sum to zero, and no
 *  customer account ends it overdrawn. */
export function post(entries, memo) {
  const sum = entries.reduce((n, e) => n + e.amount, 0n);
  if (sum !== 0n)
    throw new ApiError("internal-error", 500, "Ledger entries do not balance");
  assertNoOverdraft(entries);
  const txn = ksuid("led");
  const at = new Date().toISOString();
  return sqlite.transactionSync(() => {
    for (const e of entries) {
      db.ledger.push({
        txn,
        at,
        account: e.account,
        currency: e.currency,
        amount: e.amount,
        memo,
      });
    }
    return txn;
  });
}

export function balanceOf(accountId, currency) {
  return db.ledger.balance(accountId, currency);
}
