/**
 * Small compatibility layer for the synchronous SQLite subset used by Blueballs.
 *
 * Local Node processes keep using node:sqlite. A Cloudflare Durable Object calls
 * setWorkerSql() before loading the API runtime, which swaps in its durable,
 * synchronous SQLite storage without changing the banking/FX domain code.
 */
import { DatabaseSync as NodeDatabaseSync } from "node:sqlite";

let workerSql = null;

export function setWorkerSql(sql) {
  workerSql = sql;
}

class WorkerStatement {
  constructor(sql) {
    this.sql = sql;
  }

  all(...bindings) {
    return workerSql.exec(this.sql, ...bindings).toArray();
  }

  get(...bindings) {
    return workerSql.exec(this.sql, ...bindings).toArray()[0];
  }

  iterate(...bindings) {
    return workerSql.exec(this.sql, ...bindings);
  }

  run(...bindings) {
    const cursor = workerSql.exec(this.sql, ...bindings);
    cursor.toArray();
    return { changes: cursor.rowsWritten ?? 0, lastInsertRowid: 0 };
  }
}

export class DatabaseSync {
  constructor(path, options) {
    if (workerSql) {
      this.worker = true;
      this.native = null;
      return;
    }
    this.worker = null;
    this.native = new NodeDatabaseSync(path, options);
  }

  exec(sql) {
    if (this.native) return this.native.exec(sql);
    const normalized = String(sql).trim().replace(/;$/, "").toUpperCase();
    if (
      normalized.startsWith("PRAGMA JOURNAL_MODE") ||
      normalized.startsWith("PRAGMA BUSY_TIMEOUT") ||
      normalized === "BEGIN" ||
      normalized === "BEGIN IMMEDIATE" ||
      normalized === "COMMIT" ||
      normalized === "ROLLBACK"
    ) {
      return undefined;
    }
    return workerSql.exec(sql);
  }

  prepare(sql) {
    return this.native ? this.native.prepare(sql) : new WorkerStatement(sql);
  }

  close() {
    this.native?.close();
  }
}
