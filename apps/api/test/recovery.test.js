import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CURRENT_BANKING_SCHEMA_VERSION,
  backupBankingDatabase,
  restoreBankingDatabase,
  validateBankingDatabase,
} from "../../../scripts/lib/banking-recovery.mjs";
import { createApiFixture } from "./helpers/api-process.js";

function accountBalance(path, account, currency) {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    let balance = 0n;
    for (const row of database
      .prepare("SELECT amount FROM ledger WHERE account = ? AND currency = ? ORDER BY seq")
      .all(account, currency)) {
      balance += BigInt(row.amount);
    }
    return balance;
  } finally {
    database.close();
  }
}

test("live banking database can be snapshotted, integrity-checked and restored without losing exact money", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const recoveryDir = await mkdtemp(join(tmpdir(), "blueballs-recovery-test-"));
  t.after(() => rm(recoveryDir, { recursive: true, force: true }));

  const tenant = await api.signup("recovery@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "business", name: "Recovery Test Ltd" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "321.09" },
  });

  const backup = join(recoveryDir, "backup.sqlite");
  const restored = join(recoveryDir, "restored.sqlite");
  const result = await backupBankingDatabase({
    source: api.databasePath,
    destination: backup,
  });
  assert.equal(result.integrity, "ok");
  assert.equal(result.schema_version, CURRENT_BANKING_SCHEMA_VERSION);

  const verification = validateBankingDatabase(backup);
  assert.equal(verification.integrity, "ok");
  assert.equal(verification.schema_version, CURRENT_BANKING_SCHEMA_VERSION);

  await restoreBankingDatabase({ backup, destination: restored });
  assert.equal(
    accountBalance(restored, account.body.id, "EUR"),
    32109n,
    "restore must preserve exact minor-unit ledger state",
  );

  const restoredDatabase = new DatabaseSync(restored, { readOnly: true });
  try {
    const row = restoredDatabase
      .prepare('SELECT data FROM "accounts" WHERE id = ?')
      .get(account.body.id);
    assert.ok(row);
    assert.equal(JSON.parse(row.data).currency, "EUR");
  } finally {
    restoredDatabase.close();
  }

  await assert.rejects(
    () => restoreBankingDatabase({ backup, destination: restored }),
    /already exists/,
  );
});

test("recovery validation rejects a non-Blueballs or corrupt snapshot", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "blueballs-bad-backup-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bad = join(dir, "bad.sqlite");
  await writeFile(bad, "not a sqlite database");
  assert.throws(() => validateBankingDatabase(bad));
});
