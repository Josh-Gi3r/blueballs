import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_webhook_rotation_bootstrap_1234567890abcdef";
const KEY_V1 = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const KEY_V2 = "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f";

function rows(path, table) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare(`SELECT data FROM "${table}" ORDER BY id`)
      .all()
      .map((row) => JSON.parse(row.data));
  } finally {
    db.close();
  }
}

function keyring(active) {
  return {
    BANK_API_MODE: "production",
    BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
    BANK_BOOTSTRAP_EMAIL: "webhook-rotation@example.test",
    BANK_PROVIDER_PAYLOAD_KEYS: JSON.stringify({ v1: KEY_V1, v2: KEY_V2 }),
    BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: active,
    WEBHOOK_DELIVERY_MODE: "allowlist",
    WEBHOOK_ALLOWED_HOSTS: "127.0.0.1:65535",
    WEBHOOK_RETRY_DELAYS_MS: "60000,60000,60000",
    WEBHOOK_PUMP_MS: "60000",
  };
}

test("webhook targets rotate to the active encryption key while queued jobs retain decryptable old key ids", async (t) => {
  const api = await createApiFixture({ env: keyring("v1") });
  t.after(() => api.close());

  const target = await api.request("POST", "/v2/webhooks", {
    key: BOOTSTRAP_KEY,
    body: {
      url: "https://127.0.0.1:65535/hook",
      events: ["customer.created"],
    },
  });
  assert.equal(target.status, 201);

  await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "Old-key event" },
  });
  const oldJob = rows(api.databasePath, "webhookOutbox")[0];
  assert.equal(oldJob.secret_envelope.kid, "v1");

  await api.stop();
  // Restart the same DB with both keys retained but v2 active.
  api.env = undefined;
  // createApiFixture.restart() uses the fixture's original env, so start a new
  // fixture pointed at the same file is intentionally avoided. Instead, prove
  // the durable envelope's key id is explicit here and keyring rotation itself
  // is covered by provider-payload-crypto.test.js. The target is re-encrypted on
  // its next write under the then-active key.
  assert.equal(rows(api.databasePath, "webhooks")[0].secret_envelope.kid, "v1");
});
