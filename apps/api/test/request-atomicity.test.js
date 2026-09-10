import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dir = mkdtempSync(join(tmpdir(), "blueballs-request-atomicity-"));
process.env.DB_PATH = join(dir, "request-atomicity.sqlite");

const { collection, db, emit, inRequestScope, post } = await import("../src/lib.js");
const commands = collection("request_atomicity_commands");

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("a failed financial request leaves no resource, ledger or event trace", async () => {
  const beforeLedger = db.ledger.length;
  const beforeEvents = db.events.length;

  await assert.rejects(
    inRequestScope(async () => {
      commands.set("cmd_failed", { id: "cmd_failed", status: "started" });
      post(
        [
          { account: "external:atomicity-source", currency: "EUR", amount: -100n },
          { account: "external:atomicity-destination", currency: "EUR", amount: 100n },
        ],
        "request atomicity rollback probe",
      );
      emit(
        "atomicity.probe",
        { command: "cmd_failed" },
        { tenantId: "ten_atomicity" },
      );
      throw new Error("forced failure after money and event staging");
    }),
    /forced failure/,
  );

  assert.equal(commands.has("cmd_failed"), false);
  assert.equal(db.ledger.length, beforeLedger);
  assert.equal(db.events.length, beforeEvents);
});

test("a successful financial request commits resource, ledger and event together", async () => {
  const beforeLedger = db.ledger.length;
  const beforeEvents = db.events.length;

  await inRequestScope(async () => {
    commands.set("cmd_ok", { id: "cmd_ok", status: "started" });
    post(
      [
        { account: "external:atomicity-source", currency: "EUR", amount: -250n },
        { account: "external:atomicity-destination", currency: "EUR", amount: 250n },
      ],
      "request atomicity commit probe",
    );
    emit(
      "atomicity.probe",
      { command: "cmd_ok" },
      { tenantId: "ten_atomicity" },
    );
    commands.get("cmd_ok").status = "completed";
  });

  assert.equal(commands.get("cmd_ok").status, "completed");
  assert.equal(db.ledger.length, beforeLedger + 2);
  assert.equal(db.events.length, beforeEvents + 1);
});
