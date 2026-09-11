/**
 * Small compatibility layer for the synchronous SQLite subset used by Blueballs.
 *
 * Local Node processes keep using node:sqlite. A Cloudflare Durable Object calls
 * setWorkerSql() before loading the API runtime, which swaps in its durable,
 * synchronous SQLite storage without changing the banking/FX domain code.
 */
import { DatabaseSync as NodeDatabaseSync } from "node:sqlite";

let workerStorage = null;

export function setWorkerSql(storage) {
  if (
    !storage ||
    typeof storage !== "object" ||
    typeof storage.sql?.exec !== "function" ||
    typeof storage.transactionSync !== "function"
  ) {
    throw new TypeError(
      "setWorkerSql requires Durable Object storage with sql.exec and transactionSync",
    );
  }
  workerStorage = storage;
}

function assertSynchronous(result) {
  if (result && typeof result.then === "function") {
    throw new TypeError("transactionSync callback must be synchronous");
  }
  return result;
}

class WorkerStatement {
  constructor(sql, storage) {
    this.sql = sql;
    this.storage = storage;
  }

  all(...bindings) {
    return this.storage.sql.exec(this.sql, ...bindings).toArray();
  }

  get(...bindings) {
    return this.storage.sql.exec(this.sql, ...bindings).toArray()[0];
  }

  iterate(...bindings) {
    return this.storage.sql.exec(this.sql, ...bindings);
  }

  run(...bindings) {
    const cursor = this.storage.sql.exec(this.sql, ...bindings);
    cursor.toArray();
    return { changes: cursor.rowsWritten ?? 0, lastInsertRowid: 0 };
  }
}

export class DatabaseSync {
  constructor(path, options) {
    if (workerStorage) {
      this.worker = true;
      this.storage = workerStorage;
      this.native = null;
      return;
    }
    this.worker = null;
    this.storage = null;
    // node:sqlite on Node 22 rejects an explicit `undefined` options argument
    // ("The \"options\" argument must be an object"), while Node 24 tolerates it.
    // Callers that pass no options must therefore reach the native constructor
    // with no second argument at all, not with an undefined one.
    this.native =
      options === undefined
        ? new NodeDatabaseSync(path)
        : new NodeDatabaseSync(path, options);
  }

  exec(sql) {
    if (this.native) return this.native.exec(sql);
    const normalized = String(sql).trim().replace(/;$/, "").toUpperCase();
    if (
      normalized.startsWith("PRAGMA JOURNAL_MODE") ||
      normalized.startsWith("PRAGMA BUSY_TIMEOUT")
    ) {
      return undefined;
    }
    if (
      ["BEGIN", "BEGIN IMMEDIATE", "COMMIT", "ROLLBACK"].includes(normalized)
    ) {
      throw new Error(
        "Durable Object transaction-control SQL is unsupported; use transactionSync(callback)",
      );
    }
    return this.storage.sql.exec(sql);
  }

  prepare(sql) {
    return this.native
      ? this.native.prepare(sql)
      : new WorkerStatement(sql, this.storage);
  }

  transactionSync(callback) {
    if (typeof callback !== "function")
      throw new TypeError("transactionSync requires a callback");
    if (this.native) {
      this.native.exec("BEGIN IMMEDIATE");
      try {
        const result = assertSynchronous(callback());
        this.native.exec("COMMIT");
        return result;
      } catch (error) {
        this.native.exec("ROLLBACK");
        throw error;
      }
    }
    return this.storage.transactionSync(() => assertSynchronous(callback()));
  }

  close() {
    this.native?.close();
  }
}
