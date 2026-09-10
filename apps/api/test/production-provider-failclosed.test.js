import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_production_no_provider_test_key_123456789";

function collectionCount(path, table) {
  const database = new DatabaseSync(path);
  try {
    return database.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  } finally {
    database.close();
  }
}

test("provider-dependent production commands fail closed and leave no partial local state", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "ops-no-provider@example.test",
    },
  });
  t.after(() => api.close());

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "No Provider Customer" },
  });
  assert.equal(customer.status, 201);
  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "SGD" },
  });
  assert.equal(account.status, 201);

  const card = await api.request("POST", "/v2/cards", {
    key: BOOTSTRAP_KEY,
    body: {
      customer: customer.body.id,
      account: account.body.id,
      type: "virtual",
    },
  });
  assert.equal(card.status, 503);
  assert.equal(card.body.type, "service-unavailable");
  const cards = await api.request("GET", "/v2/cards", { key: BOOTSTRAP_KEY });
  assert.equal(cards.status, 200);
  assert.equal(cards.body.data.length, 0, "failed issuance must roll back card creation");

  const detail = await api.request(
    "POST",
    `/v2/accounts/${account.body.id}/details`,
    { key: BOOTSTRAP_KEY, body: { rail: "paynow" } },
  );
  assert.equal(detail.status, 503);
  const details = await api.request(
    "GET",
    `/v2/accounts/${account.body.id}/details`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(details.status, 200);
  assert.equal(
    details.body.data.length,
    0,
    "failed provider setup must not leave fictional receiving details",
  );

  const application = await api.request("POST", "/v2/applications", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", customer: customer.body.id },
  });
  assert.equal(application.status, 201);
  const submit = await api.request(
    "POST",
    `/v2/applications/${application.body.id}/submit`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(submit.status, 503);
  const afterSubmit = await api.request(
    "GET",
    `/v2/applications/${application.body.id}`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(afterSubmit.status, 200);
  assert.equal(
    afterSubmit.body.status,
    "pending",
    "failed provider queue must roll back the submitted KYC state",
  );

  const credit = await api.request("POST", "/v2/credit", {
    key: BOOTSTRAP_KEY,
    body: { account: account.body.id, limit: "500.00" },
  });
  assert.equal(credit.status, 201);
  const draw = await api.request("POST", `/v2/credit/${credit.body.id}/draw`, {
    key: BOOTSTRAP_KEY,
    body: { amount: "200.00" },
  });
  assert.equal(draw.status, 200);
  const beforeTransfer = await api.request(
    "GET",
    `/v2/accounts/${account.body.id}`,
    { key: BOOTSTRAP_KEY },
  );

  const transfer = await api.request("POST", "/v2/transfers", {
    key: BOOTSTRAP_KEY,
    body: { from: account.body.id, amount: "50.00", rail: "paynow" },
  });
  assert.equal(transfer.status, 503);
  const afterTransfer = await api.request(
    "GET",
    `/v2/accounts/${account.body.id}`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(
    afterTransfer.body.balance.amount,
    beforeTransfer.body.balance.amount,
    "provider queue failure must roll back the transfer debit",
  );
  const transfers = await api.request("GET", "/v2/transfers", {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(transfers.body.data.length, 0);

  assert.equal(
    collectionCount(api.databasePath, "providerOutbox"),
    0,
    "no provider job may survive a command that returned 503",
  );
});
