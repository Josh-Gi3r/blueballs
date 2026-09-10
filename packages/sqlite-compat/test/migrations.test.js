import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "../src/index.js";
import { appliedMigrations, migrate } from "../src/migrations.js";

function withDatabase(t) {
  const dir = mkdtempSync(join(tmpdir(), "blueballs-migrations-"));
  const database = new DatabaseSync(join(dir, "schema.sqlite"));
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return database;
}

test("migrations apply once, in order, and are durably recorded", (t) => {
  const database = withDatabase(t);
  const migrations = [
    {
      version: 1,
      name: "create_probe",
      up(db) {
        db.exec("CREATE TABLE migration_probe (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
      },
    },
    {
      version: 2,
      name: "seed_probe",
      up(db) {
        db.prepare("INSERT INTO migration_probe (id, value) VALUES (?, ?)").run("one", "ready");
      },
    },
  ];

  const first = migrate(database, "banking-test", migrations);
  assert.deepEqual(first.map((row) => [Number(row.version), row.name]), [
    [1, "create_probe"],
    [2, "seed_probe"],
  ]);
  assert.equal(database.prepare("SELECT value FROM migration_probe WHERE id = ?").get("one").value, "ready");

  const second = migrate(database, "banking-test", migrations);
  assert.equal(second.length, 2);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM migration_probe").get().count, 1);
});

test("a failed migration rolls back its schema/data change and version marker", (t) => {
  const database = withDatabase(t);
  assert.throws(
    () =>
      migrate(database, "banking-test", [
        {
          version: 1,
          name: "fail_atomically",
          up(db) {
            db.exec("CREATE TABLE should_rollback (id TEXT PRIMARY KEY)");
            throw new Error("forced migration failure");
          },
        },
      ]),
    /forced migration failure/,
  );

  assert.equal(appliedMigrations(database, "banking-test").length, 0);
  const table = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("should_rollback");
  assert.equal(table, undefined);
});

test("older code fails closed against a newer applied schema", (t) => {
  const database = withDatabase(t);
  const v1 = {
    version: 1,
    name: "baseline",
    up() {},
  };
  const v2 = {
    version: 2,
    name: "next",
    up() {},
  };
  migrate(database, "banking-test", [v1, v2]);

  assert.throws(
    () => migrate(database, "banking-test", [v1]),
    /schema is version 2, but this binary only knows version 1/,
  );
});

test("applied migration names are immutable", (t) => {
  const database = withDatabase(t);
  migrate(database, "banking-test", [
    { version: 1, name: "original_name", up() {} },
  ]);

  assert.throws(
    () =>
      migrate(database, "banking-test", [
        { version: 1, name: "renamed_after_release", up() {} },
      ]),
    /applied migrations are immutable/,
  );
});
