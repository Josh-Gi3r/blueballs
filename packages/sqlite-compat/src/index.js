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
  workerStorage = storage;
}

class WorkerStatement {
  constructor(sql) {
    this.sql = sql;
  }

  all(...bindings) {
    return workerStorage.sql.exec(this.sql, ...bindings).toArray();
  }

  get(...bindings) {
    return workerStorage.sql.exec(this.sql, ...bindings).toArray()[0];
  }

  iterate(...bindings) {
    return workerStorage.sql.exec(this.sql, ...bindings);
  }

  run(...bindings) {
    const cursor = workerStorage.sql.exec(this.sql, ...bindings);
    cursor.toArray();
    return { changes: cursor.rowsWritten ?? 0, lastInsertRowid: 0 };
  }
}

export class DatabaseSync {
  constructor(path, options) {
    if (workerStorage) {
      this.worker = true;
      this.native = null;
      return;
    }
    this.worker = null;
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
    return workerStorage.sql.exec(sql);
  }

  prepare(sql) {
    return this.native ? this.native.prepare(sql) : new WorkerStatement(sql);
  }

  transactionSync(callback) {
    if (typeof callback !== "function")
      throw new TypeError("transactionSync requires a callback");
    if (this.native) {
      this.native.exec("BEGIN IMMEDIATE");
      try {
        const result = callback();
        this.native.exec("COMMIT");
        return result;
      } catch (error) {
        this.native.exec("ROLLBACK");
        throw error;
      }
    }
    return workerStorage.transactionSync(callback);
  }

  close() {
    this.native?.close();
  }
}
