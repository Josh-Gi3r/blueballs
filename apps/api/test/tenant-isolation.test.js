import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function createSecondaryKey(api, primary) {
  const response = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { scope: "sandbox" },
  });
  assert.equal(response.status, 201);
  return response.body;
}

test("stable tenant ownership survives key rotation and excludes another tenant", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const primary = await api.signup("tenant-a@example.test");
  const secondary = await createSecondaryKey(api, primary);
  const attacker = await api.signup("tenant-b@example.test");

  const customerResponse = await api.request("POST", "/v2/customers", {
    key: primary.key,
    body: { type: "individual", name: "Tenant A customer" },
  });
  assert.equal(customerResponse.status, 201);
  const customer = customerResponse.body;

  const ownerRead = await api.request("GET", `/v2/customers/${customer.id}`, { key: secondary.key });
  const attackerRead = await api.request("GET", `/v2/customers/${customer.id}`, { key: attacker.key });
  const attackerList = await api.request("GET", "/v2/customers", { key: attacker.key });
  assert.equal(ownerRead.status, 200);
  assert.equal(attackerRead.status, 404);
  assert.deepEqual(attackerList.body.data, []);

  const accountResponse = await api.request("POST", "/v2/accounts", {
    key: secondary.key,
    body: { customer: customer.id, currency: "EUR" },
  });
  assert.equal(accountResponse.status, 201);
  const account = accountResponse.body;
  assert.equal((await api.request("GET", `/v2/accounts/${account.id}`, { key: primary.key })).status, 200);
  assert.equal((await api.request("GET", `/v2/accounts/${account.id}`, { key: attacker.key })).status, 404);

  await api.restart();
  assert.equal((await api.request("GET", `/v2/customers/${customer.id}`, { key: secondary.key })).status, 200);
  assert.equal((await api.request("GET", `/v2/accounts/${account.id}`, { key: primary.key })).status, 200);
});

test("recipients, destinations and quotes are tenant-scoped", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const owner = await api.signup("owner@example.test");
  const ownerSecondKey = await createSecondaryKey(api, owner);
  const attacker = await api.signup("attacker@example.test");

  const recipientResponse = await api.request("POST", "/v2/recipients", {
    key: owner.key,
    body: {
      name: "Private recipient",
      destination: { rail: "sepa", name: "Private recipient", iban: "DE02120300000000202051" },
    },
  });
  assert.equal(recipientResponse.status, 201);
  const recipient = recipientResponse.body;
  const destination = recipient.destinations[0];

  assert.equal((await api.request("GET", `/v2/recipients/${recipient.id}`, { key: ownerSecondKey.key })).status, 200);
  assert.equal((await api.request("GET", `/v2/recipients/${recipient.id}`, { key: attacker.key })).status, 404);
  assert.deepEqual((await api.request("GET", "/v2/recipients", { key: attacker.key })).body.data, []);

  assert.equal((await api.request("GET", `/v2/destinations/${destination.id}`, { key: ownerSecondKey.key })).status, 200);
  for (const [method, body] of [
    ["GET", undefined],
    ["PATCH", { name: "Stolen" }],
    ["DELETE", undefined],
    ["POST", { name: "Stolen" }],
  ]) {
    const suffix = method === "POST" ? "/verify" : "";
    const response = await api.request(method, `/v2/destinations/${destination.id}${suffix}`, { key: attacker.key, body });
    assert.equal(response.status, 404, `${method} destination must hide cross-tenant identifiers`);
  }

  const quoteResponse = await api.request("POST", "/v2/quotes", {
    key: owner.key,
    body: { from: "EUR", to: "USD", amount: "100.00" },
  });
  assert.equal(quoteResponse.status, 201);
  assert.equal((await api.request("GET", `/v2/quotes/${quoteResponse.body.id}`, { key: ownerSecondKey.key })).status, 200);
  assert.equal((await api.request("GET", `/v2/quotes/${quoteResponse.body.id}`, { key: attacker.key })).status, 404);
});
