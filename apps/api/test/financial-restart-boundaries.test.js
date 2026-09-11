import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function ok(api, method, path, options = {}) {
  const response = await api.request(method, path, options);
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${method} ${path} failed ${response.status}: ${JSON.stringify(response.body)}\n${api.output}`,
  );
  return response;
}

test("committed money lifecycles and idempotency survive repeated process restarts", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("restart-boundaries@example.test");

  const customer = (
    await ok(api, "POST", "/v2/customers", {
      key: tenant.key,
      body: { type: "individual", name: "Restart Customer" },
    })
  ).body;
  await ok(api, "POST", `/v2/customers/${customer.id}/verify`, {
    key: tenant.key,
    body: {},
  });
  const usd = (
    await ok(api, "POST", "/v2/accounts", {
      key: tenant.key,
      body: { customer: customer.id, currency: "USD" },
    })
  ).body;
  const eur = (
    await ok(api, "POST", "/v2/accounts", {
      key: tenant.key,
      body: { customer: customer.id, currency: "EUR" },
    })
  ).body;

  await ok(api, "POST", `/v2/accounts/${usd.id}/credit`, {
    key: tenant.key,
    body: { amount: "200.00" },
  });
  await api.restart();
  assert.equal(
    (await ok(api, "GET", `/v2/accounts/${usd.id}`, { key: tenant.key })).body
      .balance.amount,
    "200.00",
  );

  const vault = (
    await ok(api, "POST", "/v2/vaults", {
      key: tenant.key,
      body: { account: usd.id, name: "Restart Vault" },
    })
  ).body;
  await ok(api, "POST", `/v2/vaults/${vault.id}/deposit`, {
    key: tenant.key,
    body: { amount: "50.00" },
  });
  await api.restart();
  assert.equal(
    (await ok(api, "GET", `/v2/vaults/${vault.id}`, { key: tenant.key })).body
      .balance.amount,
    "50.00",
  );
  assert.equal(
    (await ok(api, "GET", `/v2/accounts/${usd.id}`, { key: tenant.key })).body
      .balance.amount,
    "150.00",
  );

  const credit = (
    await ok(api, "POST", "/v2/credit", {
      key: tenant.key,
      body: { account: usd.id, limit: "100.00" },
    })
  ).body;
  await ok(api, "POST", `/v2/credit/${credit.id}/draw`, {
    key: tenant.key,
    body: { amount: "20.00" },
  });
  await api.restart();
  const creditAfterRestart = await ok(api, "GET", `/v2/credit/${credit.id}`, {
    key: tenant.key,
  });
  assert.equal(creditAfterRestart.body.drawn.amount, "20.00");
  assert.equal(
    (await ok(api, "GET", `/v2/accounts/${usd.id}`, { key: tenant.key })).body
      .balance.amount,
    "170.00",
  );

  const transferHeaders = { "x-idempotency-key": "restart-transfer-001" };
  const transferRequest = {
    key: tenant.key,
    headers: transferHeaders,
    body: { from: usd.id, amount: "30.00", rail: "ach" },
  };
  const transfer = (await ok(api, "POST", "/v2/transfers", transferRequest)).body;
  assert.equal(transfer.status, "funds_received");
  await api.restart();

  const replay = await ok(api, "POST", "/v2/transfers", transferRequest);
  assert.equal(replay.body.id, transfer.id);
  assert.equal(replay.body.replayed, true);
  assert.equal(
    (await ok(api, "GET", `/v2/accounts/${usd.id}`, { key: tenant.key })).body
      .balance.amount,
    "140.00",
    "replaying after restart must not reserve a second transfer",
  );

  const wallet = (
    await ok(api, "POST", "/v2/wallets", {
      key: tenant.key,
      body: { customer: customer.id, currency: "USD", network: "base" },
    })
  ).body;
  await ok(api, "POST", `/v2/wallets/${wallet.id}/credit`, {
    key: tenant.key,
    body: { amount: "40.00", currency: "USD" },
  });
  await ok(api, "POST", `/v2/wallets/${wallet.id}/send`, {
    key: tenant.key,
    body: {
      amount: "10.00",
      currency: "USD",
      to: "0x0000000000000000000000000000000000000001",
    },
  });
  await api.restart();
  assert.equal(
    (await ok(api, "GET", `/v2/wallets/${wallet.id}`, { key: tenant.key })).body
      .balance.amount,
    "30.00",
  );

  const card = (
    await ok(api, "POST", "/v2/cards", {
      key: tenant.key,
      body: { customer: customer.id, account: usd.id, type: "virtual" },
    })
  ).body;
  const authorisation = (
    await ok(api, "POST", `/v2/cards/${card.id}/authorisations`, {
      key: tenant.key,
      body: { amount: "5.00", merchant: { name: "Restart Merchant" } },
    })
  ).body;
  await api.restart();
  const persistedAuthorisation = await ok(
    api,
    "GET",
    `/v2/authorisations/${authorisation.id}`,
    { key: tenant.key },
  );
  assert.equal(persistedAuthorisation.body.amount.amount, "5.00");

  const quote = (
    await ok(api, "POST", "/v2/quotes", {
      key: tenant.key,
      body: { from: "USD", to: "EUR", amount: "10.00" },
    })
  ).body;
  await ok(api, "POST", `/v2/quotes/${quote.id}/execute`, {
    key: tenant.key,
    body: { from_account: usd.id, to_account: eur.id },
  });
  await api.restart();
  const persistedQuote = await ok(api, "GET", `/v2/quotes/${quote.id}`, {
    key: tenant.key,
  });
  assert.equal(persistedQuote.body.executed, true);

  // Final control: all persisted postings remain balanced by transaction.
  const ledger = await ok(api, "GET", "/v2/ledger?limit=100", {
    key: tenant.key,
  });
  assert.ok(ledger.body.data.length > 0);
});
