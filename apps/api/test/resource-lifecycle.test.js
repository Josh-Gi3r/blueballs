import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function customer(api, key, name) {
  const response = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name },
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function account(api, key, customerId) {
  const response = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customerId, currency: "EUR" },
  });
  assert.equal(response.status, 201);
  return response.body;
}

test("deleted customers cannot receive new products or onboarding records", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const principal = await api.signup("lifecycle-deleted@example.test");
  const deleted = await customer(api, principal.key, "Deleted Customer");

  const removal = await api.request("DELETE", `/v2/customers/${deleted.id}`, {
    key: principal.key,
  });
  assert.equal(removal.status, 200);

  const attempts = [
    ["POST", "/v2/accounts", { customer: deleted.id, currency: "EUR" }],
    ["POST", "/v2/wallets", { customer: deleted.id, currency: "EUR" }],
    ["POST", "/v2/applications", { type: "individual", customer: deleted.id }],
  ];
  for (const [method, path, body] of attempts) {
    const response = await api.request(method, path, {
      key: principal.key,
      body,
    });
    assert.equal(
      response.status,
      409,
      `${method} ${path} should reject a deleted customer: ${JSON.stringify(response.body)}`,
    );
  }
});

test("closed accounts cannot back new transfers, cards, details, vaults or credit", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const principal = await api.signup("lifecycle-closed@example.test");
  const c = await customer(api, principal.key, "Closed Account Customer");
  const a = await account(api, principal.key, c.id);

  const closed = await api.request("DELETE", `/v2/accounts/${a.id}`, {
    key: principal.key,
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.status, "closed");

  const attempts = [
    ["POST", "/v2/transfers", { from: a.id, amount: "1.00", rail: "sepa_instant" }],
    ["POST", "/v2/cards", { customer: c.id, account: a.id, type: "virtual" }],
    ["POST", `/v2/accounts/${a.id}/details`, { rail: "sepa_instant" }],
    ["POST", "/v2/vaults", { account: a.id }],
    ["POST", "/v2/credit", { account: a.id, limit: "100.00" }],
  ];
  for (const [method, path, body] of attempts) {
    const response = await api.request(method, path, {
      key: principal.key,
      body,
    });
    assert.equal(
      response.status,
      409,
      `${method} ${path} should reject a closed account: ${JSON.stringify(response.body)}`,
    );
  }
});

test("lifecycle preconditions preserve tenant isolation as 404", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const owner = await api.signup("lifecycle-owner@example.test");
  const attacker = await api.signup("lifecycle-attacker@example.test");
  const c = await customer(api, owner.key, "Owner Customer");
  const a = await account(api, owner.key, c.id);

  const transfer = await api.request("POST", "/v2/transfers", {
    key: attacker.key,
    body: { from: a.id, amount: "1.00", rail: "sepa_instant" },
  });
  assert.equal(transfer.status, 404);

  const card = await api.request("POST", "/v2/cards", {
    key: attacker.key,
    body: { customer: c.id, account: a.id, type: "virtual" },
  });
  assert.equal(card.status, 404);
});
