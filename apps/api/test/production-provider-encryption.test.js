import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_provider_encryption_bootstrap_1234567890abcdef";
const PAYLOAD_KEY = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

function providerRows(path) {
  const db = new DatabaseSync(path);
  try {
    return db.prepare('SELECT id, data FROM "providerOutbox" ORDER BY id').all();
  } finally {
    db.close();
  }
}

function productionEnv(extra = {}) {
  return {
    BANK_API_MODE: "production",
    BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
    BANK_BOOTSTRAP_EMAIL: "provider-encryption@example.test",
    BANK_PROVIDER_GATEWAY_URL: "http://127.0.0.1:9/provider",
    BANK_PROVIDER_GATEWAY_TOKEN: "provider-encryption-test-token",
    BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST: "true",
    BANK_PROVIDER_TIMEOUT_MS: "100",
    BANK_PROVIDER_PUMP_MS: "60000",
    BANK_PROVIDER_RETRY_DELAYS_MS: "60000,60000",
    ...extra,
  };
}

async function createCard(api, name) {
  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name },
  });
  assert.equal(customer.status, 201);
  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "USD" },
  });
  assert.equal(account.status, 201);
  return api.request("POST", "/v2/cards", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, account: account.body.id, type: "virtual" },
  });
}

test("production outbox rows contain ciphertext instead of provider plaintext", async (t) => {
  const api = await createApiFixture({
    env: productionEnv({
      BANK_PROVIDER_PAYLOAD_KEY: PAYLOAD_KEY,
      BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "test-v1",
    }),
  });
  t.after(() => api.close());

  const card = await createCard(api, "Ciphertext Only Customer");
  assert.equal(card.status, 201);
  assert.equal(card.body.status, "pending_issuance");

  const rows = providerRows(api.databasePath);
  assert.equal(rows.length, 1);
  const raw = String(rows[0].data);
  assert.match(raw, /A256GCM/);
  assert.doesNotMatch(raw, /Ciphertext Only Customer/);
  assert.doesNotMatch(raw, /customer.*name/i);
  assert.doesNotMatch(raw, /account_number|routing_number|iban/i);
});

test("production provider command fails closed and rolls back when encryption is missing", async (t) => {
  const api = await createApiFixture({ env: productionEnv() });
  t.after(() => api.close());

  const card = await createCard(api, "Missing Encryption Customer");
  assert.equal(card.status, 503);
  assert.equal(card.body.type, "service-unavailable");
  assert.match(card.body.detail, /encryption/i);

  const cards = await api.request("GET", "/v2/cards", { key: BOOTSTRAP_KEY });
  assert.equal(cards.status, 200);
  assert.equal(cards.body.data.length, 0);
  assert.equal(providerRows(api.databasePath).length, 0);
});
