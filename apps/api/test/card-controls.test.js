import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function cardFixture(api) {
  const tenant = await api.signup("card-controls@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Control Tester" },
  });
  await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key: tenant.key,
    body: {},
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "USD" },
  });
  await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "1000.00", reference: "card controls" },
  });
  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: {
      customer: customer.body.id,
      account: account.body.id,
      type: "virtual",
      spend_limits: {
        per_authorization: { amount: "100.00", currency: "USD" },
        daily: { amount: "200.00", currency: "USD" },
        monthly: { amount: "150.00", currency: "USD" },
      },
    },
  });
  assert.equal(card.status, 201);
  return { tenant, card: card.body };
}

test("monthly card limits reserve pending authorisations", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const { tenant, card } = await cardFixture(api);
  const authorise = (amount) =>
    api.request("POST", `/v2/cards/${card.id}/authorisations`, {
      key: tenant.key,
      body: { amount, merchant: { name: "Reference Shop" } },
    });

  assert.equal((await authorise("100.00")).status, 201);
  const overMonthly = await authorise("51.00");
  assert.equal(overMonthly.status, 400);
  assert.match(overMonthly.body.detail, /monthly limit/);
  assert.equal((await authorise("50.00")).status, 201);
});

test("card policies enforce max_amount and unsupported account attachments fail", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const { tenant, card } = await cardFixture(api);
  const policy = await api.request("POST", "/v2/policies", {
    key: tenant.key,
    body: {
      name: "Card ceiling",
      rules: [{ type: "max_amount", amount: "25.00", currency: "USD" }],
    },
  });
  assert.equal(policy.status, 201);
  assert.equal(
    (
      await api.request("POST", `/v2/policies/${policy.body.id}/attach`, {
        key: tenant.key,
        body: { type: "card", id: card.id },
      })
    ).status,
    200,
  );

  const blocked = await api.request(
    "POST",
    `/v2/cards/${card.id}/authorisations`,
    {
      key: tenant.key,
      body: { amount: "25.01", merchant: { name: "Reference Shop" } },
    },
  );
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.detail, /Policy/);

  const unsupported = await api.request(
    "POST",
    `/v2/policies/${policy.body.id}/attach`,
    {
      key: tenant.key,
      body: { type: "account", id: "acc_example" },
    },
  );
  assert.equal(unsupported.status, 400);
});

test("card security adapter seams fail closed without dead URLs or tokens", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const { tenant, card } = await cardFixture(api);
  for (const action of ["pin", "reveal"]) {
    const response = await api.request(
      "POST",
      `/v2/cards/${card.id}/${action}`,
      { key: tenant.key, body: {} },
    );
    assert.equal(response.status, 503);
    assert.match(response.body.detail, /adapter/);
  }
});
