/** Shared primitives implementing spec/conventions.md.
 *  Zero dependencies — the whole point is that self-hosting is trivial. */

import { randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ---------------- identifiers: type-prefixed KSUID-style ---------------- */
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const EPOCH = 1400000000;

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

/* ---------------- storage ---------------- */
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.CLOUDFLARE_WORKER === "true"
    ? ":memory:"
    : join(dirname(fileURLToPath(import.meta.url)), "..", "blueballs.sqlite"));
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");

const RAW = Symbol("blueballs.raw");
const MISSING = Symbol("blueballs.missing");

/** Per-request unit of work. All local durable financial state is staged until
 * the handler succeeds, then committed together. */
const requestScope = new AsyncLocalStorage();
const proxies = new WeakMap();

/** The single-database reference runtime serializes complete request units of
 * work. This prevents overlapping debits from validating against the same
 * pre-commit balance. */
let requestSerial = Promise.resolve();
function serializeRequest(run) {
  const current = requestSerial.then(run, run);
  requestSerial = current.catch(() => {});
  return current;
}

function createRequestStore() {
  return {
    snapshots: new Map(),
    ledger: [],
    events: [],
    eventTrims: new Map(),
  };
}

function unwrap(value) {
  return value !== null && typeof value === "object" && value[RAW] !== undefined
    ? value[RAW]
    : value;
}

function snapshotOnce(store, map, id, root = MISSING) {
  let rows = store.snapshots.get(map);
  if (!rows) {
    rows = new Map();
    store.snapshots.set(map, rows);
  }
  if (!rows.has(id)) {
    rows.set(id, root === MISSING ? MISSING : structuredClone(root));
  }
}

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

const eventBeforeCommitSubscribers = new Set();
const eventSubscribers = new Set();

/** Register local event work that must be staged before the financial database
 * commit. Subscribers must perform local deterministic writes only; they must
 * never make network calls. A failure aborts the entire request unit of work. */
export function subscribeToEventsBeforeCommit(subscriber) {
  eventBeforeCommitSubscribers.add(subscriber);
  return () => eventBeforeCommitSubscribers.delete(subscriber);
}

/** Register post-commit side effects. Failures here cannot roll back committed
 * money; durable work should already have been captured by a before-commit
 * subscriber (for example the webhook outbox). */
export function subscribeToEvents(subscriber) {
  eventSubscribers.add(subscriber);
  return () => eventSubscribers.delete(subscriber);
}

/** Run one API request as a serializable financial unit of work. */
export async function inRequestScope(run) {
  return serializeRequest(() => {
    const store = createRequestStore();
    return requestScope.run(store, async () => {
      try {
        const result = await run();

        // Local outbox/audit enrichers run before the database transaction so
        // their staged rows are committed atomically with money and domain state.
        for (const evt of store.events) {
          for (const subscriber of eventBeforeCommitSubscribers) subscriber(evt);
        }

        sqlite.transactionSync(() => {
          for (const [map, rows] of store.snapshots)
            for (const id of rows.keys()) map._persist(id);
          for (const row of store.ledger) db.ledger._persist(row);
          for (const evt of store.events) db.events._persist(evt);
          for (const [tenantId, maximum] of store.eventTrims)
            db.events._trimTenant(tenantId, maximum);
        });

        for (const evt of store.events) {
          for (const subscriber of eventSubscribers) {
            try {
              subscriber(evt);
            } catch (error) {
              console.error("event subscriber failed after commit", error);
            }
          }
        }
        return result;
      } catch (error) {
        for (const [map, rows] of store.snapshots)
          for (const [id, snapshot] of rows) map._restore(id, snapshot);
        throw error;
      } finally {
        store.snapshots.clear();
        store.ledger.length = 0;
        store.events.length = 0;
        store.eventTrims.clear();
      }
    });
  });
}

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
    const store = requestScope.getStore();
    if (store) {
      snapshotOnce(
        store,
        this,
        id,
        this._cache.has(id) ? this._cache.get(id) : MISSING,
      );
      this._cache.set(id, row);
      return this;
    }
    this._cache.set(id, row);
    this._upsert.run(id, JSON.stringify(row));
    return this;
  }
  delete(id) {
    const store = requestScope.getStore();
    if (store) {
      if (!this._cache.has(id)) return false;
      snapshotOnce(store, this, id, this._cache.get(id));
      this._cache.delete(id);
      return true;
    }
    const existed = this._cache.delete(id);
    this._del.run(id);
    return existed;
  }
  _persist(id) {
    const row = this._cache.get(id);
    if (row === undefined) this._del.run(id);
    else this._upsert.run(id, JSON.stringify(row));
  }
  _restore(id, snapshot) {
    const current = this._cache.get(id);
    if (current && typeof current === "object") proxies.delete(current);
    if (snapshot === MISSING) this._cache.delete(id);
    else this._cache.set(id, snapshot);
  }
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
  balance(account, currency) {
    let n = 0n;
    for (const r of this._selectAccount.all(account, currency))
      n += BigInt(r.amount);
    const store = requestScope.getStore();
    if (store) {
      for (const r of store.ledger) {
        if (r.account === account && r.currency === currency) n += r.amount;
      }
    }
    return n;
  }
  push(row) {
    const store = requestScope.getStore();
    if (store) {
      store.ledger.push(row);
      return;
    }
    this._persist(row);
  }
  _persist(row) {
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
    const rows = this._selectAll.all().map((r) => ({
      txn: r.txn,
      at: r.at,
      account: r.account,
      currency: r.currency,
      amount: BigInt(r.amount),
      memo: r.memo,
    }));
    const store = requestScope.getStore();
    return store ? rows.concat(store.ledger) : rows;
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
    const committed = sqlite.prepare(`SELECT COUNT(*) c FROM ledger`).get().c;
    return committed + (requestScope.getStore()?.ledger.length ?? 0);
  }
  [Symbol.iterator]() {
    return this._all()[Symbol.iterator]();
  }
}

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
    const store = requestScope.getStore();
    if (store) {
      store.events.push(evt);
      return;
    }
    this._persist(evt);
  }
  _persist(evt) {
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
    const store = requestScope.getStore();
    if (store) {
      store.eventTrims.set(tenantId, maximum);
      return;
    }
    this._trimTenant(tenantId, maximum);
  }
  _trimTenant(tenantId, maximum) {
    while (this._countTenant.get(tenantId).c > maximum)
      this._shiftTenant.run(tenantId);
  }
  get length() {
    const committed = sqlite.prepare(`SELECT COUNT(*) c FROM events`).get().c;
    return committed + (requestScope.getStore()?.events.length ?? 0);
  }
  _all() {
    const rows = this._selectAll.all().map((r) => ({
      id: r.id,
      type: r.type,
      created_at: r.created_at,
      data: JSON.parse(r.data),
      tenant_id: r.tenant_id,
    }));
    const store = requestScope.getStore();
    return store ? rows.concat(store.events) : rows;
  }
  [Symbol.iterator]() {
    return this._all()[Symbol.iterator]();
  }
}

export function collection(name) {
  return new PersistentMap(name);
}

export const db = {
  tenants: new PersistentMap("tenants"),
  keys: new PersistentMap("keys"),
  customers: new PersistentMap("customers"),
  accounts: new PersistentMap("accounts"),
  recipients: new PersistentMap("recipients"),
  quotes: new PersistentMap("quotes"),
  transfers: new PersistentMap("transfers"),
  ledger: new PersistentLedger(),
  events: new PersistentEvents(),
  idempotency: new PersistentMap("idempotency"),
};

export const hashKey = (k) => createHash("sha256").update(k).digest("hex");

export function emit(type, data, { tenantId } = {}) {
  if (!tenantId) throw new Error(`Event ${type} requires an explicit tenantId`);
  const retention = Number(process.env.EVENT_RETENTION_PER_TENANT || 1000);
  if (!Number.isSafeInteger(retention) || retention < 1) {
    throw new Error("EVENT_RETENTION_PER_TENANT must be a positive integer");
  }
  const evt = {
    id: ksuid("evt"),
    type,
    created_at: new Date().toISOString(),
    data,
    tenant_id: tenantId,
  };

  const store = requestScope.getStore();
  if (store) {
    db.events.push(evt);
    db.events.trimTenant(tenantId, retention);
    return evt;
  }

  // Standalone emitters still get event + durable before-commit side work in one
  // SQLite transaction. Post-commit side effects run only after it succeeds.
  sqlite.transactionSync(() => {
    for (const subscriber of eventBeforeCommitSubscribers) subscriber(evt);
    db.events.push(evt);
    db.events.trimTenant(tenantId, retention);
  });
  for (const subscriber of eventSubscribers) {
    try {
      subscriber(evt);
    } catch (error) {
      console.error("event subscriber failed after commit", error);
    }
  }
  return evt;
}

const isSystemAccount = (account) => account.includes(":");

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

export function post(entries, memo) {
  const sum = entries.reduce((n, e) => n + e.amount, 0n);
  if (sum !== 0n)
    throw new ApiError("internal-error", 500, "Ledger entries do not balance");
  assertNoOverdraft(entries);
  const txn = ksuid("led");
  const at = new Date().toISOString();
  const rows = entries.map((e) => ({
    txn,
    at,
    account: e.account,
    currency: e.currency,
    amount: e.amount,
    memo,
  }));

  if (requestScope.getStore()) {
    for (const row of rows) db.ledger.push(row);
    return txn;
  }

  return sqlite.transactionSync(() => {
    for (const row of rows) db.ledger._persist(row);
    return txn;
  });
}

export function balanceOf(accountId, currency) {
  return db.ledger.balance(accountId, currency);
}
