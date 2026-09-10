import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApiFixture } from "./helpers/api-process.js";

function readAudit(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    return database
      .prepare('SELECT data FROM "auditRecords" ORDER BY rowid')
      .all()
      .map((row) => JSON.parse(row.data));
  } finally {
    database.close();
  }
}

function correlatedRows(databasePath, commandId) {
  const database = new DatabaseSync(databasePath);
  try {
    return {
      ledger: database
        .prepare("SELECT txn, account, currency, amount, command_id FROM ledger WHERE command_id = ? ORDER BY seq")
        .all(commandId),
      events: database
        .prepare("SELECT id, type, tenant_id, command_id FROM events WHERE command_id = ? ORDER BY seq")
        .all(commandId),
    };
  } finally {
    database.close();
  }
}

test("money, events and actor audit share one command id", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const principal = await api.signup("audit@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: principal.key,
    body: { type: "individual", name: "Audit Customer" },
  });
  assert.equal(customer.status, 201);

  const account = await api.request("POST", "/v2/accounts", {
    key: principal.key,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  assert.equal(account.status, 201);

  const credit = await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key: principal.key,
    body: { amount: "100.00" },
  });
  assert.equal(credit.status, 200);

  const audits = readAudit(api.databasePath);
  const record = [...audits]
    .reverse()
    .find((row) => row.operation === "POST /v2/accounts/:id/credit");
  assert.ok(record, "credit must create an audit record");
  assert.equal(record.outcome, "succeeded");
  assert.equal(record.tenant_id, principal.tenant_id);
  assert.equal(record.actor_id, principal.id);
  assert.equal(record.actor_scope, "sandbox");
  assert.match(record.command_id, /^cmd_/);
  assert.ok(record.ledger_transactions.length >= 1);
  assert.ok(record.event_ids.length >= 1);
  assert.ok(
    record.resources.some(
      (row) => row.collection === "accounts" && row.id === account.body.id,
    ) === false,
    "credit derives account balance from ledger and should not pretend the account row changed",
  );

  const correlated = correlatedRows(api.databasePath, record.command_id);
  assert.equal(correlated.ledger.length, 2);
  assert.ok(correlated.ledger.every((row) => row.command_id === record.command_id));
  assert.ok(
    correlated.events.some((event) => event.type === "account.credited"),
    "the domain event must carry the same command id",
  );
  assert.ok(correlated.events.every((row) => row.command_id === record.command_id));
});

test("a rejected financial command leaves failure audit evidence but no money movement", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const principal = await api.signup("audit-failure@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: principal.key,
    body: { type: "individual", name: "Failure Audit Customer" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: principal.key,
    body: { customer: customer.body.id, currency: "EUR" },
  });

  const failed = await api.request("POST", "/v2/transfers", {
    key: principal.key,
    body: {
      from: account.body.id,
      amount: "25.00",
      rail: "sepa",
    },
  });
  assert.equal(failed.status, 400);

  const record = [...readAudit(api.databasePath)]
    .reverse()
    .find((row) => row.operation === "POST /v2/transfers" && row.outcome === "failed");
  assert.ok(record, "failed transfer must create audit evidence");
  assert.equal(record.error_type, "insufficient-balance");
  assert.equal(record.error_status, 400);
  assert.equal(record.tenant_id, principal.tenant_id);

  const correlated = correlatedRows(api.databasePath, record.command_id);
  assert.equal(correlated.ledger.length, 0);
  assert.equal(correlated.events.length, 0);
});
