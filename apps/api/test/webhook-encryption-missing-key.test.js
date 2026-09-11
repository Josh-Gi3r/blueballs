import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_webhook_missing_crypto_bootstrap_1234567890abcdef";

test("production webhook creation fails closed without durable secret encryption", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "webhook-missing-crypto@example.test",
      WEBHOOK_DELIVERY_MODE: "allowlist",
      WEBHOOK_ALLOWED_HOSTS: "hooks.example.test",
    },
  });
  t.after(() => api.close());

  const target = await api.request("POST", "/v2/webhooks", {
    key: BOOTSTRAP_KEY,
    body: {
      url: "https://hooks.example.test/blueballs",
      events: ["customer.created"],
    },
  });
  assert.equal(target.status, 503);
  assert.equal(target.body.type, "service-unavailable");
  assert.match(target.body.detail, /encryption/i);

  const list = await api.request("GET", "/v2/webhooks", {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 0, "failed webhook creation must roll back target state");
});
