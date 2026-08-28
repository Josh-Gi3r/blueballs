import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

/** post() enforced one invariant — that the legs of a transaction sum to zero.
 *  Nothing stopped an account going below it. Every "do they have the money?"
 *  check lived in a route, voluntarily, and a route that checks at request time
 *  is checking the wrong moment when the movement happens later.
 *
 *  Wallet send is the case where that gap is reachable through the public API:
 *  the balance is checked when the send is queued, the money moves when the
 *  approval clears, and two sends can be queued against one balance. */

async function fundedWalletWithApprovals(api, key, { balance, threshold }) {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Overdraft customer" },
  });
  await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key,
    body: { decision: "approved" },
  });
  const wallet = await api.request("POST", "/v2/wallets", {
    key,
    body: { customer: customer.body.id, currency: "USDC", network: "base" },
  });
  await api.request("POST", "/v2/approval-chains", {
    key,
    body: {
      name: "Treasury",
      steps: 1,
      threshold: { amount: threshold, currency: "USDC" },
      resource: { type: "wallet", id: wallet.body.id },
    },
  });
  const credited = await api.request(
    "POST",
    `/v2/wallets/${wallet.body.id}/credit`,
    {
      key,
      body: { amount: balance },
    },
  );
  assert.equal(credited.body.balance.amount, balance);
  return wallet.body;
}

const walletBalance = async (api, key, id) =>
  (await api.request("GET", `/v2/wallets/${id}`, { key })).body.balance.amount;

test("two approvals over one balance cannot both pay out", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("overdraft-wallet@example.test");
  const wallet = await fundedWalletWithApprovals(api, tenant.key, {
    balance: "150.00",
    threshold: "100.00",
  });

  // Both sends are queued while the wallet still holds 150.00, so both pass the
  // route's balance check. Neither has moved any money yet.
  const first = await api.request("POST", `/v2/wallets/${wallet.id}/send`, {
    key: tenant.key,
    body: { amount: "100.00", currency: "USDC", to: "0xaaa" },
  });
  const second = await api.request("POST", `/v2/wallets/${wallet.id}/send`, {
    key: tenant.key,
    body: { amount: "100.00", currency: "USDC", to: "0xbbb" },
  });
  assert.equal(first.body.status, "pending_approval");
  assert.equal(second.body.status, "pending_approval");
  assert.equal(await walletBalance(api, tenant.key, wallet.id), "150.00");

  const approvedFirst = await api.request(
    "POST",
    `/v2/approvals/${first.body.approval}/approve`,
    {
      key: tenant.key,
      body: {},
    },
  );
  assert.equal(approvedFirst.status, 200);
  assert.equal(approvedFirst.body.status, "executed");
  assert.equal(await walletBalance(api, tenant.key, wallet.id), "50.00");

  // 100.00 out of 50.00. The route checked the balance two requests ago.
  const approvedSecond = await api.request(
    "POST",
    `/v2/approvals/${second.body.approval}/approve`,
    {
      key: tenant.key,
      body: {},
    },
  );
  assert.equal(
    approvedSecond.status,
    400,
    "the second payout must not overdraw the wallet",
  );
  assert.equal(approvedSecond.body.type, "insufficient-balance");

  assert.equal(
    await walletBalance(api, tenant.key, wallet.id),
    "50.00",
    "a refused payout must leave the balance exactly where the first one left it",
  );

  // The decision was recorded before the payout was attempted, so the refusal
  // has to take it back with it: the approval is still pending and still needs
  // one approver, not executed-with-no-money or approved-but-not-paid.
  const queue = await api.request("GET", "/v2/approvals?status=all", {
    key: tenant.key,
  });
  const stillPending = queue.body.data.find(
    (a) => a.id === second.body.approval,
  );
  assert.equal(stillPending.status, "pending");
  assert.deepEqual(stillPending.decisions, []);
});

test("the accounts that are meant to run negative still can", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("overdraft-system@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Funded customer" },
  });
  await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key: tenant.key,
    body: { decision: "approved" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "SGD" },
  });

  // Funding an account debits "external:funding", which has never held anything.
  // The floor applies to customer accounts — bare KSUIDs — not to the namespaced
  // system side of a movement, and a floor that stopped this would stop the
  // sandbox funding every other test depends on.
  const credited = await api.request(
    "POST",
    `/v2/accounts/${account.body.id}/credit`,
    {
      key: tenant.key,
      body: { amount: "500.00" },
    },
  );
  assert.equal(credited.status, 200);
  assert.equal(credited.body.balance.amount, "500.00");

  // And a transfer parks the money in "clearing:<rail>" on the way out.
  const recipient = await api.request("POST", "/v2/recipients", {
    key: tenant.key,
    body: { name: "Example Payee" },
  });
  const destination = await api.request(
    "POST",
    `/v2/recipients/${recipient.body.id}/destinations`,
    {
      key: tenant.key,
      body: {
        rail: "paynow",
        name: "Example Payee",
        currency: "SGD",
        proxy: "+6591234567",
      },
    },
  );
  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: account.body.id,
      recipient: recipient.body.id,
      destination: destination.body.id,
      rail: "paynow",
      amount: "200.00",
      currency: "SGD",
    },
  });
  assert.equal(transfer.status, 201);
  assert.equal(
    (
      await api.request("GET", `/v2/accounts/${account.body.id}`, {
        key: tenant.key,
      })
    ).body.balance.amount,
    "300.00",
  );
});
