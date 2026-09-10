import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function fxCustomer(api, key, name, type = "individual") {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type, name },
  });
  assert.equal(customer.status, 201);
  const verified = await api.request(
    "POST",
    `/v2/customers/${customer.body.id}/verify`,
    { key, body: { decision: "approved" } },
  );
  assert.equal(verified.status, 200);

  const account = async (currency) => {
    const response = await api.request("POST", "/v2/accounts", {
      key,
      body: { customer: customer.body.id, currency },
    });
    assert.equal(response.status, 201);
    return response.body;
  };
  return {
    customer: customer.body,
    usdc: await account("USDC"),
    eurc: await account("EURC"),
  };
}

async function credit(api, key, account, amount) {
  const response = await api.request(
    "POST",
    `/v2/accounts/${account.id}/credit`,
    { key, body: { amount } },
  );
  assert.equal(response.status, 200);
  return response.body;
}

async function balance(api, key, account) {
  return (
    await api.request("GET", `/v2/accounts/${account.id}`, { key })
  ).body.balance.amount;
}

test("firm FX quote debits source currency and credits explicit receive account", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("rfq-accounts@example.test");
  const trader = await fxCustomer(api, tenant.key, "Integrator", "business");
  await credit(api, tenant.key, trader.usdc, "1000.00");

  const quoted = await api.request("POST", "/v2/fx/rfq", {
    key: tenant.key,
    body: {
      account: trader.usdc.id,
      receive_account: trader.eurc.id,
      from: "USDC",
      to: "EURC",
      amount: "100.00",
    },
  });
  assert.equal(quoted.status, 201);
  assert.equal(quoted.body.account, trader.usdc.id);
  assert.equal(quoted.body.receive_account, trader.eurc.id);

  const accepted = await api.request(
    "POST",
    `/v2/fx/rfq/${quoted.body.id}/accept`,
    { key: tenant.key, body: {} },
  );
  assert.equal(accepted.status, 200);
  assert.equal(await balance(api, tenant.key, trader.usdc), "900.00");
  assert.notEqual(await balance(api, tenant.key, trader.eurc), "0.00");
});

test("P2P FX pays each side into its target-currency account", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const takerTenant = await api.signup("p2p-taker@example.test");
  const makerTenant = await api.signup("p2p-maker@example.test");
  const taker = await fxCustomer(api, takerTenant.key, "Taker");
  const maker = await fxCustomer(api, makerTenant.key, "Maker");

  await credit(api, takerTenant.key, taker.usdc, "500.00");
  await credit(api, makerTenant.key, maker.eurc, "500.00");

  const makerIntent = await api.request("POST", "/v2/fx/intents", {
    key: makerTenant.key,
    body: {
      account: maker.eurc.id,
      receive_account: maker.usdc.id,
      from: "EURC",
      to: "USDC",
      amount: "500.00",
      min_receive: "1.00",
      mode: "maker",
    },
  });
  assert.equal(makerIntent.status, 201);
  assert.equal(makerIntent.body.resting, true);

  const fill = await api.request("POST", "/v2/fx/intents", {
    key: takerTenant.key,
    body: {
      account: taker.usdc.id,
      receive_account: taker.eurc.id,
      from: "USDC",
      to: "EURC",
      amount: "100.00",
      min_receive: "1.00",
      mode: "taker",
    },
  });
  assert.equal(fill.status, 201);
  assert.equal(fill.body.filled, true);
  assert.equal(fill.body.fill_legs[0].source, "p2p");

  assert.equal(await balance(api, takerTenant.key, taker.usdc), "400.00");
  assert.notEqual(await balance(api, takerTenant.key, taker.eurc), "0.00");
  assert.notEqual(await balance(api, makerTenant.key, maker.usdc), "0.00");
  assert.ok(Number(await balance(api, makerTenant.key, maker.eurc)) < 500);
});
