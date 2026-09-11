import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { BANKING_SCHEMA_MIGRATIONS } from "../src/schema.js";
import { validateBankingDatabase } from "../../../scripts/lib/banking-recovery.mjs";

function databaseWithHistory(t, rows) {
  const dir = mkdtempSync(join(tmpdir(), "blueballs-recovery-history-"));
  const path = join(dir, "banking.sqlite");
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE blueballs_schema_migrations (
    component TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (component, version)
  )`);
  const insert = db.prepare(
    "INSERT INTO blueballs_schema_migrations(component, version, name, applied_at) VALUES ('banking', ?, ?, ?)",
  );
  for (const row of rows) {
    insert.run(row.version, row.name, "2026-01-01T00:00:00.000Z");
  }
  db.close();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return path;
}

test("recovery validation accepts the complete immutable banking migration chain", (t) => {
  const path = databaseWithHistory(t, BANKING_SCHEMA_MIGRATIONS);
  const result = validateBankingDatabase(path);
  assert.equal(result.integrity, "ok");
  assert.equal(
    result.schema_version,
    BANKING_SCHEMA_MIGRATIONS.at(-1).version,
  );
  assert.equal(result.schema_name, BANKING_SCHEMA_MIGRATIONS.at(-1).name);
});

test("recovery validation rejects a migration-history hole even when latest version is current", (t) => {
  const rows = BANKING_SCHEMA_MIGRATIONS.filter((migration) => migration.version !== 3);
  const path = databaseWithHistory(t, rows);
  assert.throws(
    () => validateBankingDatabase(path),
    /migration history is not contiguous/,
  );
});

test("recovery validation rejects renamed historical migrations", (t) => {
  const rows = BANKING_SCHEMA_MIGRATIONS.map((migration) =>
    migration.version === 2
      ? { ...migration, name: "renamed-durable-webhook-outbox" }
      : migration,
  );
  const path = databaseWithHistory(t, rows);
  assert.throws(
    () => validateBankingDatabase(path),
    /was applied as .* checkout declares/,
  );
});
