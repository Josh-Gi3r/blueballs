import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

/** Money moves through post(), which has always been durable. The guard that
 *  stops a second run — q.executed, aut.status, card.status — lived on a row
 *  fetched from the cache, and until the storage layer tracked those writes it
 *  never reached SQLite. Same process: the guard held. After a restart: the
 *  guard was gone and the money moved again.
 *
 *  These tests all restart the process between the two calls. That is the whole
 *  point: none of them can fail while the first run is still in memory. */

async function verifiedCustomer(api, key, currency = "USD") {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Restart customer" },
  });
  await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key,
    body: { decision: "approved" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customer.body.id, currency },
  });
  return { customer: customer.body, account: account.body };
}

const balanceOf = async (api, key, id) =>
  (await api.request("GET", `/v2/accounts/${id}`, { key })).body.balance.amount;

test("an executed quote stays executed across a restart", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("restart-quote@example.test");
  const usd = await verifiedCustomer(api, tenant.key, "USD");
  const eur = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: usd.customer.id, currency: "EUR" },
  });
  await api.request("POST", `/v2/accounts/${usd.account.id}/credit`, {
    key: tenant.key,
    body: { amount: "1000.00" },
  });

  const quote = await api.request("POST", "/v2/quotes", {
    key: tenant.key,
    body: { from: "USD", to: "EUR", amount: "100.00" },
  });
  assert.equal(quote.status, 201);

  const first = await api.request(
    "POST",
    `/v2/quotes/${quote.body.id}/execute`,
    {
      key: tenant.key,
      body: { from_account: usd.account.id, to_account: eur.body.id },
    },
  );
  assert.equal(first.status, 200);
  const afterFirst = await balanceOf(api, tenant.key, usd.account.id);
  assert.equal(afterFirst, "900.00");

  await api.restart();

  const reread = await api.request("GET", `/v2/quotes/${quote.body.id}`, {
    key: tenant.key,
  });
  assert.equal(
    reread.body.executed,
    true,
    "the executed flag must survive the restart",
  );

  const replay = await api.request(
    "POST",
    `/v2/quotes/${quote.body.id}/execute`,
    {
      key: tenant.key,
      body: { from_account: usd.account.id, to_account: eur.body.id },
    },
  );
  assert.equal(
    replay.status,
    409,
    "a restart must not make an executed quote executable again",
  );
  assert.equal(
    await balanceOf(api, tenant.key, usd.account.id),
    "900.00",
    "the customer must not be debited twice for one quote",
  );
});

test("a settled card authorisation stays settled across a restart", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("restart-auth@example.test");
  const { customer, account } = await verifiedCustomer(api, tenant.key);
  await api.request("POST", `/v2/accounts/${account.id}/credit`, {
    key: tenant.key,
    body: { amount: "500.00" },
  });
  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: { customer: customer.id, account: account.id, type: "virtual" },
  });
  assert.equal(card.status, 201);
  const auth = await api.request(
    "POST",
    `/v2/cards/${card.body.id}/authorisations`,
    {
      key: tenant.key,
      body: { amount: "100.00", currency: "USD", merchant: "Example Store" },
    },
  );
  assert.equal(auth.status, 201);

  assert.equal(
    (
      await api.request("POST", `/v2/authorisations/${auth.body.id}/approve`, {
        key: tenant.key,
      })
    ).status,
    200,
  );
  assert.equal(await balanceOf(api, tenant.key, account.id), "400.00");

  await api.restart();

  const reread = await api.request(
    "GET",
    `/v2/authorisations/${auth.body.id}`,
    { key: tenant.key },
  );
  assert.equal(
    reread.body.status,
    "settled",
    "settlement must survive the restart",
  );

  const replay = await api.request(
    "POST",
    `/v2/authorisations/${auth.body.id}/approve`,
    { key: tenant.key },
  );
  assert.equal(replay.status, 409);
  assert.equal(
    await balanceOf(api, tenant.key, account.id),
    "400.00",
    "the cardholder must not be debited twice for one authorisation",
  );
});

test("a frozen card is still frozen after a restart, and still declines", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("restart-freeze@example.test");
  const { customer, account } = await verifiedCustomer(api, tenant.key);
  await api.request("POST", `/v2/accounts/${account.id}/credit`, {
    key: tenant.key,
    body: { amount: "500.00" },
  });
  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: { customer: customer.id, account: account.id, type: "virtual" },
  });
  const frozen = await api.request("POST", `/v2/cards/${card.body.id}/freeze`, {
    key: tenant.key,
    body: { reason: "frozen_by_customer" },
  });
  assert.equal(frozen.status, 200);
  assert.equal(frozen.body.status, "frozen");

  await api.restart();

  const reread = await api.request("GET", `/v2/cards/${card.body.id}`, {
    key: tenant.key,
  });
  assert.equal(
    reread.body.status,
    "frozen",
    "a customer who freezes a lost card must still find it frozen",
  );

  const attempt = await api.request(
    "POST",
    `/v2/cards/${card.body.id}/authorisations`,
    {
      key: tenant.key,
      body: { amount: "10.00", currency: "USD", merchant: "Example Store" },
    },
  );
  assert.equal(
    attempt.body.status,
    "declined",
    "a frozen card must decline a spend after a restart",
  );
  assert.equal(attempt.body.decline_reason, "card_frozen");
});

test("a wallet keeps its approval chain across a restart", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("restart-approval@example.test");
  const { customer } = await verifiedCustomer(api, tenant.key);

  const wallet = await api.request("POST", "/v2/wallets", {
    key: tenant.key,
    body: { customer: customer.id, currency: "USDC", network: "base" },
  });
  assert.equal(wallet.status, 201);
  assert.equal(wallet.body.approval_chain, null);

  // business.js attaches the chain by assigning w.approval_chain and never
  // calling wallets.set — one of the twenty-six in-place mutations.
  const chain = await api.request("POST", "/v2/approval-chains", {
    key: tenant.key,
    body: {
      name: "Treasury",
      steps: 1,
      threshold: { amount: "100.00", currency: "USDC" },
      resource: { type: "wallet", id: wallet.body.id },
    },
  });
  assert.equal(chain.status, 201);
  assert.equal(
    (
      await api.request("GET", `/v2/wallets/${wallet.body.id}`, {
        key: tenant.key,
      })
    ).body.approval_chain,
    chain.body.id,
  );

  await api.restart();

  assert.equal(
    (
      await api.request("GET", `/v2/wallets/${wallet.body.id}`, {
        key: tenant.key,
      })
    ).body.approval_chain,
    chain.body.id,
    "a wallet that lost its approval chain on restart would send over the threshold with no approval",
  );
});
