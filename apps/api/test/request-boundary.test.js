import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("rotating invalid key strings cannot evade the source rate limit", async (t) => {
  const api = await createApiFixture({
    env: { SOURCE_RATE_LIMIT_PER_MIN: "4" },
  });
  t.after(() => api.close());

  assert.equal(
    (await api.request("GET", "/v2/customers", { key: "invalid-one" })).status,
    401,
  );
  assert.equal(
    (await api.request("GET", "/v2/customers", { key: "invalid-two" })).status,
    401,
  );
  assert.equal(
    (await api.request("GET", "/v2/customers", { key: "invalid-three" }))
      .status,
    401,
  );
  assert.equal(
    (await api.request("GET", "/v2/customers", { key: "invalid-four" })).status,
    429,
  );
});

test("body limits count bytes and CORS only reflects configured origins", async (t) => {
  const api = await createApiFixture({
    env: { CORS_ORIGINS: "https://app.example.test", BODY_LIMIT_BYTES: "1024" },
  });
  t.after(() => api.close());
  const tenant = await api.signup("request-boundary@example.test");

  const oversized = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "🐝".repeat(400) },
  });
  assert.equal(oversized.status, 413);
  assert.match(oversized.body.detail, /1024 bytes/);

  const allowed = await api.request("GET", "/v2/customers", {
    key: tenant.key,
    headers: { origin: "https://app.example.test" },
  });
  const denied = await api.request("GET", "/v2/customers", {
    key: tenant.key,
    headers: { origin: "https://attacker.example" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://app.example.test",
  );
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});
