import { DurableObject } from "cloudflare:workers";
import {
  DatabaseSync,
  setWorkerSql,
} from "../../packages/sqlite-compat/src/index.js";
export { BuilderBudget } from "../site/builder-budget.js";

export class TransactionProbe extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    setWorkerSql(ctx.storage);
    this.db = new DatabaseSync(":memory:");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS values_table (value TEXT NOT NULL)",
    );
  }

  write(value, { rollback = false } = {}) {
    setWorkerSql(this.ctx.storage);
    try {
      return this.db.transactionSync(() => {
        this.db
          .prepare("INSERT INTO values_table (value) VALUES (?)")
          .run(value);
        if (rollback) throw new Error("forced rollback");
        return value;
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  values() {
    setWorkerSql(this.ctx.storage);
    return this.db
      .prepare("SELECT value FROM values_table ORDER BY rowid")
      .all()
      .map((row) => row.value);
  }

  transactionSqlIsRejected() {
    setWorkerSql(this.ctx.storage);
    try {
      this.db.exec("BEGIN IMMEDIATE");
      return false;
    } catch {
      return true;
    }
  }
}

export default {
  async fetch() {
    return new Response("test-only worker");
  },
};
