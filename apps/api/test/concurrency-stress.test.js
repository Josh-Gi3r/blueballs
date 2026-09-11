import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("concurrent transfer storm cannot overspend or lose exact cents", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("concurrency-stress@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Concurrency Stress" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "USD" },
  });
  await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "100.00" },
  });

  const attempts = 50;
  const responses = await Promise.all(
    Array.from({ length: attempts }, (_, index) =>
      api.request("POST", "/v2/transfers", {
        key: tenant.key,
        headers: { "x-idempotency-key": `stress-transfer-${index}` },
        body: { from: account.body.id, amount: "3.00", rail: "ach" },
      }),
    ),
  );

  const succeeded = responses.filter((response) => response.status === 201);
  const rejected = responses.filter((response) => response.status === 400);
  assert.equal(succeeded.length, 33, "100.00 can reserve exactly thirty-three 3.00 transfers");
  assert.equal(rejected.length, 17);
  for (const response of rejected) {
    assert.equal(response.body.type, "insufficient-balance");
  }

  const balance = await api.request("GET", `/v2/accounts/${account.body.id}`, {
    key: tenant.key,
  });
  assert.equal(balance.status, 200);
  assert.equal(balance.body.balance.amount, "1.00");

  await api.restart();
  const afterRestart = await api.request("GET", `/v2/accounts/${account.body.id}`, {
    key: tenant.key,
  });
  assert.equal(afterRestart.body.balance.amount, "1.00");

  const transfers = await api.request("GET", "/v2/transfers?limit=100", {
    key: tenant.key,
  });
  assert.equal(transfers.body.data.length, 33);
});
