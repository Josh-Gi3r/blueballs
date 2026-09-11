import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { signProviderInboundBody } from "../../../spec/provider-inbound-signing.mjs";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_production_no_provider_test_key_123456789";
const OPERATOR_KEY = "bb_production_no_provider_operator_123456789";
const INBOUND_SECRET =
  "production-no-provider-inbound-secret-0123456789abcdef0123456789abcdef";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function collectionCount(path, table) {
  const database = new DatabaseSync(path);
  try {
    return database.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  } finally {
    database.close();
  }
}

async function fundAccount(api, tenantId, accountId) {
  const body = signProviderInboundBody(
    {
      event_id: "no-provider-funding-000001",
      tenant_id: tenantId,
      type: "payments.account_credit_settled",
      resource_id: accountId,
      amount: { amount: "200.00", currency: "SGD" },
      rail: "paynow",
      provider_reference: "inbound-no-provider-1",
      provider_state: "settled",
    },
    { secret: INBOUND_SECRET },
  );
  const response = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

test("provider-dependent production commands fail closed and leave no partial local state", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "ops-no-provider@example.test",
      OPERATOR_API_KEY_HASH: sha256(OPERATOR_KEY),
      BANK_PROVIDER_INBOUND_SECRET: INBOUND_SECRET,
    },
  });
  t.after(() => api.close());

  const keys = await api.request("GET", "/v2/keys", { key: BOOTSTRAP_KEY });
  assert.equal(keys.status, 200);
  const tenantId = keys.body.current.tenant_id;

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

  // Funding is a signed settled provider fact. The absence under test is the
  // outbound provider adapter, not customer-money provenance.
  await fundAccount(api, tenantId, account.body.id);
  const beforeTransfer = await api.request(
    "GET",
    `/v2/accounts/${account.body.id}`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(beforeTransfer.body.balance.amount, "200.00");

  const recipient = await api.request("POST", "/v2/recipients", {
    key: BOOTSTRAP_KEY,
    body: { name: "No Provider Supplier" },
  });
  assert.equal(recipient.status, 201);
  const destination = await api.request(
    "POST",
    `/v2/recipients/${recipient.body.id}/destinations`,
    {
      key: BOOTSTRAP_KEY,
      body: {
        rail: "paynow",
        name: "No Provider Supplier",
        currency: "SGD",
        proxy: "+6594445555",
      },
    },
  );
  assert.equal(destination.status, 201);

  const transfer = await api.request("POST", "/v2/transfers", {
    key: BOOTSTRAP_KEY,
    body: {
      from: account.body.id,
      recipient: recipient.body.id,
      destination: destination.body.id,
      amount: "50.00",
      rail: "paynow",
    },
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
