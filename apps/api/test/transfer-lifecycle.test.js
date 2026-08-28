import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

/** POST /v2/transfers/:id/cancel was in the published catalogue and could never
 *  succeed. It needs the transfer to be created or awaiting_funds; the create
 *  request walked every rail to submitted and beyond before it returned, and
 *  awaiting_funds is assigned nowhere in the tree. Every call was a 409.
 *
 *  A rail that settles in seconds genuinely has no cancellable moment, and
 *  saying so is right. A batch rail does: sepa, ach and wire hand off in a
 *  scheduled window, and until that window runs the money is sitting in the
 *  rail's clearing account with nothing irreversible done to it. */

async function fundedAccount(api, key, currency, amount) {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Transfer customer" },
  });
  await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key,
    body: { decision: "approved" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customer.body.id, currency },
  });
  await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key,
    body: { amount },
  });
  return account.body;
}

async function destinationFor(api, key, rail, currency, details) {
  const recipient = await api.request("POST", "/v2/recipients", {
    key,
    body: { name: "Lifecycle supplier" },
  });
  const destination = await api.request(
    "POST",
    `/v2/recipients/${recipient.body.id}/destinations`,
    {
      key,
      body: { rail, name: "Lifecycle supplier", currency, ...details },
    },
  );
  return { recipient: recipient.body, destination: destination.body };
}

const balance = async (api, key, id) =>
  (await api.request("GET", `/v2/accounts/${id}`, { key })).body.balance.amount;

test("a batch-rail transfer can be cancelled, and the money comes back", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("transfer-cancel@example.test");
  const account = await fundedAccount(api, tenant.key, "USD", "1000.00");
  const { recipient, destination } = await destinationFor(
    api,
    tenant.key,
    "wire",
    "USD",
    {
      account_number: "000123456789",
    },
  );

  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: account.id,
      recipient: recipient.id,
      destination: destination.id,
      rail: "wire",
      amount: "400.00",
    },
  });
  assert.equal(transfer.status, 201);
  assert.equal(
    transfer.body.status,
    "funds_received",
    "a batch rail has a window to wait for, and waiting is what makes cancel reachable",
  );
  assert.equal(await balance(api, tenant.key, account.id), "600.00");

  const cancelled = await api.request(
    "POST",
    `/v2/transfers/${transfer.body.id}/cancel`,
    { key: tenant.key },
  );
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, "canceled");
  assert.equal(cancelled.body.legs[0].status, "canceled");
  assert.equal(
    await balance(api, tenant.key, account.id),
    "1000.00",
    "a cancelled transfer refunds the clearing account back to the customer",
  );

  // Terminal means terminal: no second refund out of the clearing account.
  const again = await api.request(
    "POST",
    `/v2/transfers/${transfer.body.id}/cancel`,
    { key: tenant.key },
  );
  assert.equal(again.status, 409);
  assert.equal(await balance(api, tenant.key, account.id), "1000.00");
});

test("an instant transfer is already done, and says so", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("transfer-instant@example.test");
  const account = await fundedAccount(api, tenant.key, "SGD", "1000.00");
  const { recipient, destination } = await destinationFor(
    api,
    tenant.key,
    "paynow",
    "SGD",
    {
      proxy: "+6591234567",
    },
  );

  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: account.id,
      recipient: recipient.id,
      destination: destination.id,
      rail: "paynow",
      amount: "250.00",
    },
  });
  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.status, "settled");
  assert.equal(transfer.body.legs[0].status, "settled");

  const cancelled = await api.request(
    "POST",
    `/v2/transfers/${transfer.body.id}/cancel`,
    { key: tenant.key },
  );
  assert.equal(
    cancelled.status,
    409,
    "money that has already reached the beneficiary cannot be recalled",
  );
  assert.equal(await balance(api, tenant.key, account.id), "750.00");
});

test("running a batch rail's window walks the whole state machine", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("transfer-window@example.test");
  const account = await fundedAccount(api, tenant.key, "USD", "1000.00");
  const { recipient, destination } = await destinationFor(
    api,
    tenant.key,
    "wire",
    "USD",
    {
      account_number: "000123456789",
    },
  );

  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: account.id,
      recipient: recipient.id,
      destination: destination.id,
      rail: "wire",
      amount: "300.00",
    },
  });
  assert.equal(transfer.body.status, "funds_received");

  const calendar = await api.request("GET", "/v2/rails/wire/calendar?days=1");
  const openToday = calendar.body.data[0].business_day;
  const settled = await api.request(
    "POST",
    `/v2/transfers/${transfer.body.id}/settle`,
    { key: tenant.key },
  );

  if (!openToday) {
    // The instruction was accepted; the window is what is shut.
    assert.equal(settled.status, 422);
    assert.equal(settled.body.type, "rail-unavailable");
    assert.equal(
      (
        await api.request("GET", `/v2/transfers/${transfer.body.id}`, {
          key: tenant.key,
        })
      ).body.status,
      "funds_received",
      "a refused window leaves the transfer waiting for the next one",
    );
    assert.equal(
      (
        await api.request("POST", `/v2/transfers/${transfer.body.id}/cancel`, {
          key: tenant.key,
        })
      ).status,
      200,
      "and it is still cancellable, which is the whole point of the wait",
    );
    return;
  }

  assert.equal(settled.status, 200);
  assert.equal(settled.body.status, "settled");

  // submitted and confirming are states the spine claims exist. Walking rather
  // than jumping is what makes them observable instead of documentation.
  const events = await api.request("GET", "/v2/events?limit=100", {
    key: tenant.key,
  });
  const spine = events.body.data
    .filter(
      (e) =>
        e.type === "transfer.status_changed" && e.data.id === transfer.body.id,
    )
    .map((e) => e.data.current_status)
    .reverse(); // /v2/events is newest first
  assert.deepEqual(spine.slice(-4), [
    "funds_received",
    "submitted",
    "confirming",
    "settled",
  ]);

  assert.equal(
    (
      await api.request("POST", `/v2/transfers/${transfer.body.id}/cancel`, {
        key: tenant.key,
      })
    ).status,
    409,
  );
});
