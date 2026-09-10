import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { BANKING_COLLECTION_TABLES } from "../src/schema.js";
import { createApiFixture } from "./helpers/api-process.js";

function inspect(path) {
  const database = new DatabaseSync(path);
  try {
    const migrations = database
      .prepare(
        "SELECT component, version, name FROM blueballs_schema_migrations WHERE component = ? ORDER BY version",
      )
      .all("banking");
    const tables = new Set(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );
    const indexes = new Set(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all()
        .map((row) => row.name),
    );
    const columns = (table) =>
      new Set(
        database
          .prepare(`PRAGMA table_info("${table}")`)
          .all()
          .map((row) => row.name),
      );
    return {
      migrations,
      tables,
      indexes,
      ledgerColumns: columns("ledger"),
      eventColumns: columns("events"),
    };
  } finally {
    database.close();
  }
}

test("banking startup applies the complete versioned schema and restart is idempotent", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const first = inspect(api.databasePath);
  assert.deepEqual(first.migrations, [
    { component: "banking", version: 1, name: "initial-banking-schema" },
    { component: "banking", version: 2, name: "durable-webhook-outbox" },
    { component: "banking", version: 3, name: "command-audit-correlation" },
  ]);

  for (const name of BANKING_COLLECTION_TABLES) {
    assert.ok(first.tables.has(name), `missing versioned collection table ${name}`);
  }
  for (const name of ["ledger", "events", "blueballs_schema_migrations"]) {
    assert.ok(first.tables.has(name), `missing versioned banking table ${name}`);
  }
  for (const name of [
    "idx_ledger_account_currency_seq",
    "idx_ledger_txn",
    "idx_events_tenant_seq",
    "idx_ledger_command",
    "idx_events_command",
  ]) {
    assert.ok(first.indexes.has(name), `missing production index ${name}`);
  }
  assert.ok(first.ledgerColumns.has("command_id"));
  assert.ok(first.eventColumns.has("command_id"));

  await api.restart();
  const second = inspect(api.databasePath);
  assert.deepEqual(
    second.migrations,
    first.migrations,
    "restart must not duplicate or mutate an applied migration",
  );
});
