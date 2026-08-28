import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("sandbox keys expire and secondary lifetimes are bounded", async (t) => {
  const api = await createApiFixture({
    env: { SANDBOX_KEY_LIFETIME_HOURS: "0.0001" },
  });
  t.after(() => api.close());

  const primary = await api.signup("expiry@example.test");
  assert.ok(Date.parse(primary.expires) > Date.now());
  await new Promise((resolve) => setTimeout(resolve, 500));

  const expired = await api.request("GET", "/v2/keys", { key: primary.key });
  assert.equal(expired.status, 401);
  assert.match(expired.body.detail, /expired/);
});

test("secondary sandbox keys cannot exceed the seven-day ceiling", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const primary = await api.signup("secondary-expiry@example.test");

  const rejected = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { lifetime_hours: 169 },
  });
  assert.equal(rejected.status, 400);

  const accepted = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { lifetime_hours: 1 },
  });
  assert.equal(accepted.status, 201);
  assert.ok(Date.parse(accepted.body.expires) > Date.now());
});
