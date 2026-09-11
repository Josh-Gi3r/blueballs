import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_webhook_crypto_bootstrap_1234567890abcdef";
const PAYLOAD_KEY =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

function rawRows(databasePath, table) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database
      .prepare(`SELECT id, data FROM "${table}" ORDER BY id`)
      .all()
      .map((row) => ({ id: row.id, raw: String(row.data), data: JSON.parse(row.data) }));
  } finally {
    database.close();
  }
}

test("production webhook target and durable delivery job never persist signing secrets as plaintext", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "webhook-crypto@example.test",
      BANK_PROVIDER_PAYLOAD_KEY: PAYLOAD_KEY,
      BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "webhook-test-v1",
      WEBHOOK_DELIVERY_MODE: "allowlist",
      WEBHOOK_ALLOWED_HOSTS: "127.0.0.1:65535",
      WEBHOOK_RETRY_DELAYS_MS: "60000,60000",
      WEBHOOK_PUMP_MS: "60000",
    },
  });
  t.after(() => api.close());

  const target = await api.request("POST", "/v2/webhooks", {
    key: BOOTSTRAP_KEY,
    body: {
      url: "https://127.0.0.1:65535/hook",
      events: ["customer.created"],
    },
  });
  assert.equal(target.status, 201);
  assert.match(target.body.secret, /^whsec_/);
  const clearSecret = target.body.secret;

  const storedTargets = rawRows(api.databasePath, "webhooks");
  assert.equal(storedTargets.length, 1);
  assert.equal(storedTargets[0].raw.includes(clearSecret), false);
  assert.equal(storedTargets[0].raw.includes("whsec_"), false);
  assert.equal(storedTargets[0].data.secret, undefined);
  assert.equal(storedTargets[0].data.secret_envelope?.format, "A256GCM");
  assert.equal(storedTargets[0].data.secret_envelope?.kid, "webhook-test-v1");

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "Encrypted Webhook Customer" },
  });
  assert.equal(customer.status, 201);

  const jobs = rawRows(api.databasePath, "webhookOutbox");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].raw.includes(clearSecret), false);
  assert.equal(jobs[0].raw.includes("whsec_"), false);
  assert.equal(jobs[0].data.secret, undefined);
  assert.equal(jobs[0].data.secret_envelope?.format, "A256GCM");
  assert.equal(jobs[0].data.secret_envelope?.kid, "webhook-test-v1");

  const readTarget = await api.request("GET", `/v2/webhooks/${target.body.id}`, {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(readTarget.status, 200);
  assert.equal(readTarget.body.secret, undefined);
  assert.equal(readTarget.body.secret_envelope, undefined);
});
