import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_inbound_bootstrap_1234567890abcdef123456";
const OPERATOR_KEY = "bb_inbound_operator_1234567890abcdef123456";
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("settled provider account credits are exact, tenant-bound and replay-safe", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "inbound-ops@example.test",
      OPERATOR_API_KEY_HASH: hash(OPERATOR_KEY),
    },
  });
  t.after(() => api.close());

  const principal = await api.request("GET", "/v2/keys", { key: BOOTSTRAP_KEY });
  assert.equal(principal.status, 200);
  const tenantId = principal.body.current.tenant_id;

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "business", name: "Inbound Payments Ltd" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  assert.equal(account.status, 201);
  assert.equal(account.body.balance.amount, "0.00");

  const event = {
    event_id: "account-credit-000001",
    tenant_id: tenantId,
    type: "payments.account_credit_settled",
    resource_id: account.body.id,
    amount: { amount: "125.37", currency: "EUR" },
    rail: "sepa_instant",
    provider_reference: "bank-credit-000001",
    provider_state: "settled",
  };

  const accepted = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: event,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.type, event.type);

  const replayed = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: event,
  });
  assert.equal(replayed.status, 200);
  assert.equal(replayed.body.replayed, true);

  const balance = await api.request("GET", `/v2/accounts/${account.body.id}`, {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(balance.body.balance.amount, "125.37");

  const wrongCurrency = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: {
      ...event,
      event_id: "account-credit-000002",
      amount: { amount: "1.00", currency: "USD" },
    },
  });
  assert.equal(wrongCurrency.status, 400);

  const unknownTenant = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: {
      ...event,
      event_id: "account-credit-000003",
      tenant_id: "ten_not_this_institution",
    },
  });
  assert.equal(unknownTenant.status, 404);

  const afterFailures = await api.request(
    "GET",
    `/v2/accounts/${account.body.id}`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(afterFailures.body.balance.amount, "125.37");
});
