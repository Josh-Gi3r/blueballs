/** Shared primitives implementing spec/conventions.md.
 *  Zero dependencies — the whole point is that self-hosting is trivial. */

import { randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
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
  while (n > 0n) { out = B62[Number(n % 62n)] + out; n /= 62n; }
  return `${prefix}_${out.padStart(27, "0")}`;
}

/* ---------------- money: decimal strings, never floats ---------------- */
/** Parse "2400.00" → 240000n minor units. Rejects floats and junk. */
export function toMinor(amount, dp = 2) {
  if (typeof amount !== "string" || !/^-?\d+(\.\d+)?$/.test(amount)) {
    throw new ApiError("validation-error", 400, "Amount must be a decimal string", [
      { field: "amount", message: "expected a decimal string such as \"2400.00\"", code: "invalid_format" },
    ]);
  }
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > dp) {
    throw new ApiError("validation-error", 400, `Amount has more than ${dp} decimal places`);
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
  "validation-error": 400, "invalid-request": 400, "invalid-identifier": 400,
  "insufficient-balance": 400, "limit-exceeded": 400, "below-minimum": 400,
  "authentication-error": 401, "forbidden": 403, "tier-insufficient": 403,
  "not-found": 404, "conflict": 409, "quote-expired": 409, "payload-too-large": 413,
  "compliance-blocked": 422, "rail-unavailable": 422, "rate-limited": 429,
  "internal-error": 500, "not-implemented": 501, "provider-error": 502, "service-unavailable": 503,
};
const TITLES = {
  "validation-error": "The request failed validation",
  "insufficient-balance": "Not enough available balance",
  "limit-exceeded": "Limit exceeded",
  "below-minimum": "Below the minimum for this route",
  "authentication-error": "Missing or invalid API key",
  "tier-insufficient": "Your verification tier does not allow this",
  "not-found": "Not found",
  "conflict": "Conflicting request",
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

const DB_PATH = process.env.DB_PATH || join(dirname(fileURLToPath(import.meta.url)), "..", "blueballs.sqlite");
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");

/** Map-like collection (get/set/has/delete/values/keys/entries/size) backed by a
 *  SQLite table, JSON-serialised, fully cached in memory after load for Map-speed reads. */
class PersistentMap {
  constructor(table) {
    this.table = table;
    sqlite.exec(`CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    this._cache = new Map();
    for (const row of sqlite.prepare(`SELECT id, data FROM "${table}"`).all()) {
      this._cache.set(row.id, JSON.parse(row.data));
    }
    this._upsert = sqlite.prepare(
      `INSERT INTO "${table}" (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    );
    this._del = sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`);
  }
  get(id) { return this._cache.get(id); }
  has(id) { return this._cache.has(id); }
  set(id, value) {
    this._cache.set(id, value);
    this._upsert.run(id, JSON.stringify(value));
    return this;
  }
  delete(id) {
    const existed = this._cache.delete(id);
    this._del.run(id);
    return existed;
  }
  values() { return this._cache.values(); }
  keys() { return this._cache.keys(); }
  entries() { return this._cache.entries(); }
  get size() { return this._cache.size; }
  [Symbol.iterator]() { return this._cache[Symbol.iterator](); }
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
      `INSERT INTO ledger (txn, at, account, currency, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`
    );
    this._selectAll = sqlite.prepare(`SELECT * FROM ledger ORDER BY seq`);
  }
  push(row) {
    this._insert.run(row.txn, row.at, row.account, row.currency, row.amount.toString(), row.memo ?? null);
  }
  _all() {
    return this._selectAll.all().map((r) => ({
      txn: r.txn, at: r.at, account: r.account, currency: r.currency,
      amount: BigInt(r.amount), memo: r.memo,
    }));
  }
  filter(fn) { return this._all().filter(fn); }
  map(fn) { return this._all().map(fn); }
  reduce(fn, init) { return this._all().reduce(fn, init); }
  get length() { return sqlite.prepare(`SELECT COUNT(*) c FROM ledger`).get().c; }
  [Symbol.iterator]() { return this._all()[Symbol.iterator](); }
}

/** Bounded event log — push/shift like the old array, but durable. */
class PersistentEvents {
  constructor() {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL, type TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL
    )`);
    this._insert = sqlite.prepare(`INSERT INTO events (id, type, created_at, data) VALUES (?, ?, ?, ?)`);
    this._shiftOldest = sqlite.prepare(`DELETE FROM events WHERE seq = (SELECT MIN(seq) FROM events)`);
    this._selectAll = sqlite.prepare(`SELECT * FROM events ORDER BY seq`);
  }
  push(evt) {
    this._insert.run(evt.id, evt.type, evt.created_at, JSON.stringify(evt.data));
  }
  shift() { this._shiftOldest.run(); }
  get length() { return sqlite.prepare(`SELECT COUNT(*) c FROM events`).get().c; }
  _all() {
    return this._selectAll.all().map((r) => ({
      id: r.id, type: r.type, created_at: r.created_at, data: JSON.parse(r.data),
    }));
  }
  [Symbol.iterator]() { return this._all()[Symbol.iterator](); }
}

export const db = {
  keys: new PersistentMap("keys"),               // hashedKey -> { id, customer, scope, created_at }
  customers: new PersistentMap("customers"),
  accounts: new PersistentMap("accounts"),
  recipients: new PersistentMap("recipients"),
  quotes: new PersistentMap("quotes"),
  transfers: new PersistentMap("transfers"),
  ledger: new PersistentLedger(),
  events: new PersistentEvents(),
  idempotency: new PersistentMap("idempotency"), // key -> { fingerprint, result }
};

export const hashKey = (k) => createHash("sha256").update(k).digest("hex");

export function emit(type, data) {
  const evt = { id: ksuid("evt"), type, created_at: new Date().toISOString(), data };
  db.events.push(evt);
  if (db.events.length > 1000) db.events.shift();
  return evt;
}

/** Double-entry: every movement writes two rows that must sum to zero. */
export function post(entries, memo) {
  const sum = entries.reduce((n, e) => n + e.amount, 0n);
  if (sum !== 0n) throw new ApiError("internal-error", 500, "Ledger entries do not balance");
  const txn = ksuid("led");
  const at = new Date().toISOString();
  for (const e of entries) {
    db.ledger.push({ txn, at, account: e.account, currency: e.currency, amount: e.amount, memo });
  }
  return txn;
}

export function balanceOf(accountId, currency) {
  return db.ledger
    .filter((r) => r.account === accountId && r.currency === currency)
    .reduce((n, r) => n + r.amount, 0n);
}
