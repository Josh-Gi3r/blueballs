import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function ok(api, method, path, options = {}) {
  const response = await api.request(method, path, options);
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${method} ${path} expected 2xx, got ${response.status}: ${JSON.stringify(response.body)}\n${api.output}`,
  );
  return response.body;
}

async function verifiedBusiness(api, email, name) {
  const tenant = await api.signup(email);
  const customer = await ok(api, "POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "business", name, email },
  });
  await ok(api, "POST", `/v2/customers/${customer.id}/verify`, {
    key: tenant.key,
    body: { decision: "approved" },
  });
  return { tenant, customer };
}

async function account(api, key, customerId, currency, amount) {
  const created = await ok(api, "POST", "/v2/accounts", {
    key,
    body: { customer: customerId, currency },
  });
  if (amount) {
    await ok(api, "POST", `/v2/accounts/${created.id}/credit`, {
      key,
      body: { amount },
    });
  }
  return created;
}

test("resting maker min_receive is a hard pro-rata crossing constraint", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const makerParty = await verifiedBusiness(
    api,
    "maker-limit@example.test",
    "Maker Limit Institution",
  );
  const takerParty = await verifiedBusiness(
    api,
    "taker-limit@example.test",
    "Taker Limit Institution",
  );

  const makerEurc = await account(
    api,
    makerParty.tenant.key,
    makerParty.customer.id,
    "EURC",
    "1000.00",
  );
  const makerUsdc = await account(
    api,
    makerParty.tenant.key,
    makerParty.customer.id,
    "USDC",
    "0.01",
  );
  const takerUsdc = await account(
    api,
    takerParty.tenant.key,
    takerParty.customer.id,
    "USDC",
    "1000.00",
  );
  const takerEurc = await account(
    api,
    takerParty.tenant.key,
    takerParty.customer.id,
    "EURC",
    "0.01",
  );

  const maker = await ok(api, "POST", "/v2/fx/intents", {
    key: makerParty.tenant.key,
    body: {
      account: makerEurc.id,
      receive_account: makerUsdc.id,
      from: "EURC",
      to: "USDC",
      amount: "100.00",
      min_receive: "1000.00",
      mode: "maker",
      ttl_seconds: 300,
    },
  });
  assert.equal(maker.status, "open");
  assert.equal(maker.remaining, "10000");

  const taker = await ok(api, "POST", "/v2/fx/intents", {
    key: takerParty.tenant.key,
    body: {
      account: takerUsdc.id,
      receive_account: takerEurc.id,
      from: "USDC",
      to: "EURC",
      amount: "100.00",
      min_receive: "1.00",
      mode: "taker",
    },
  });

  assert.equal(taker.filled, true);
  assert.equal(
    taker.fill_legs.some((leg) => leg.source === "p2p" && !leg.declined),
    false,
    "taker crossed a maker below the maker's minimum economics",
  );

  const makerIntents = await ok(api, "GET", "/v2/fx/intents?limit=10", {
    key: makerParty.tenant.key,
  });
  const stillResting = makerIntents.data.find((intent) => intent.id === maker.id);
  assert.ok(stillResting);
  assert.equal(stillResting.status, "open");
  assert.equal(stillResting.remaining, "10000");
});
