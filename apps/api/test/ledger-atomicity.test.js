import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dir = mkdtempSync(join(tmpdir(), "blueballs-ledger-atomicity-"));
process.env.DB_PATH = join(dir, "ledger.sqlite");
const { db, post } = await import("../src/lib.js");

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("a failed second ledger leg rolls back the first leg", () => {
  assert.throws(() =>
    post(
      [
        { account: "alice", currency: "EUR", amount: -100n },
        { account: "bob", currency: null, amount: 100n },
      ],
      "forced second-leg failure",
    ),
  );

  assert.equal(db.ledger.length, 0);
});
