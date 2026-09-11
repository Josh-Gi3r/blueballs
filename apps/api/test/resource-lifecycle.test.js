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

test("deleted customers cannot be mutated or receive new products/onboarding records", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const principal = await api.signup("lifecycle-deleted@example.test");
  const deleted = await customer(api, principal.key, "Deleted Customer");

  const removal = await api.request("DELETE", `/v2/customers/${deleted.id}`, {
    key: principal.key,
  });
  assert.equal(removal.status, 200);

  const attempts = [
    ["PATCH", `/v2/customers/${deleted.id}`, { name: "Zombie Customer" }],
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

test("customers with linked financial products cannot be soft deleted", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const principal = await api.signup("lifecycle-linked@example.test");
  const c = await customer(api, principal.key, "Linked Customer");
  const wallet = await api.request("POST", "/v2/wallets", {
    key: principal.key,
    body: { customer: c.id, currency: "EUR" },
  });
  assert.equal(wallet.status, 201);

  const removal = await api.request("DELETE", `/v2/customers/${c.id}`, {
    key: principal.key,
  });
  assert.equal(removal.status, 409);
  assert.match(removal.body.detail, /wallet/i);
});

test("closed accounts cannot be mutated or back new transfers, cards, details, vaults or credit", async (t) => {
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
    ["PATCH", `/v2/accounts/${a.id}`, { label: "Zombie Account" }],
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

test("production transfers require an explicit recipient and destination before reserving money", async (t) => {
  const key = "bb_lifecycle_production_bootstrap_1234567890abcdef";
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: key,
      BANK_BOOTSTRAP_EMAIL: "lifecycle-production@example.test",
    },
  });
  t.after(() => api.close());

  const c = await customer(api, key, "Production Destination Customer");
  const a = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: c.id, currency: "SGD" },
  });
  assert.equal(a.status, 201);

  const missingDestination = await api.request("POST", "/v2/transfers", {
    key,
    body: { from: a.body.id, amount: "1.00", rail: "paynow" },
  });
  assert.equal(missingDestination.status, 400);
  assert.match(missingDestination.body.detail, /recipient and destination/i);
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
