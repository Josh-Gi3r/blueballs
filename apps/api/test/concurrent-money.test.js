import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function createFundedUsdAccount(api, key, amount) {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Concurrency customer" },
  });
  assert.equal(customer.status, 201);

  const verified = await api.request(
    "POST",
    `/v2/customers/${customer.body.id}/verify`,
    { key, body: { decision: "approved" } },
  );
  assert.equal(verified.status, 200);

  const account = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customer.body.id, currency: "USD" },
  });
  assert.equal(account.status, 201);

  const funded = await api.request(
    "POST",
    `/v2/accounts/${account.body.id}/credit`,
    { key, body: { amount } },
  );
  assert.equal(funded.status, 200);
  return account.body;
}

test("two overlapping debits cannot both spend the same available balance", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const tenant = await api.signup("concurrent-money@example.test");
  const account = await createFundedUsdAccount(api, tenant.key, "100.00");

  const requests = [
    api.request("POST", "/v2/transfers", {
      key: tenant.key,
      body: { from: account.id, amount: "80.00", rail: "ach" },
    }),
    api.request("POST", "/v2/transfers", {
      key: tenant.key,
      body: { from: account.id, amount: "80.00", rail: "ach" },
    }),
  ];

  const results = await Promise.all(requests);
  const statuses = results.map((result) => result.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [201, 400]);

  const rejected = results.find((result) => result.status === 400);
  assert.equal(rejected.body?.type, "insufficient-balance");

  const current = await api.request("GET", `/v2/accounts/${account.id}`, {
    key: tenant.key,
  });
  assert.equal(current.status, 200);
  assert.equal(current.body.balance.amount, "20.00");

  const ledger = await api.request(
    "GET",
    `/v2/ledger?account=${encodeURIComponent(account.id)}&limit=100`,
    { key: tenant.key },
  );
  assert.equal(ledger.status, 200);
  assert.deepEqual(
    ledger.body.data.map((row) => row.amount),
    ["100.00", "-80.00"],
  );
});
