import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "../src/index.js";

test("transactionSync commits and returns the callback value", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE values_table (value TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO values_table (value) VALUES (?)");

  const result = db.transactionSync(() => {
    insert.run("committed");
    return { ok: true };
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.prepare("SELECT value FROM values_table").all().map((row) => row.value), ["committed"]);
  db.close();
});

test("transactionSync rolls back and propagates the original exception", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE values_table (value TEXT NOT NULL)");
  const expected = new Error("force rollback");

  assert.throws(() => db.transactionSync(() => {
    db.prepare("INSERT INTO values_table (value) VALUES (?)").run("must disappear");
    throw expected;
  }), (error) => error === expected);

  assert.deepEqual(db.prepare("SELECT value FROM values_table").all(), []);
  db.close();
});
