import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("idempotency keys are stable within a tenant and isolated between tenants", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const tenantA = await api.signup("idempotency-a@example.test");
  const tenantB = await api.signup("idempotency-b@example.test");
  const secondKey = await api.request("POST", "/v2/keys", {
    key: tenantA.key,
    body: { scope: "sandbox" },
  });
  assert.equal(secondKey.status, 201);

  const headers = { "x-idempotency-key": "same-caller-value" };
  const first = await api.request("POST", "/v2/customers", {
    key: tenantA.key, headers, body: { type: "individual", name: "Tenant A" },
  });
  const replay = await api.request("POST", "/v2/customers", {
    key: secondKey.body.key, headers, body: { name: "Tenant A", type: "individual" },
  });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.id, first.body.id);
  assert.equal(replay.body.replayed, true);

  const otherTenant = await api.request("POST", "/v2/customers", {
    key: tenantB.key, headers, body: { type: "individual", name: "Tenant B" },
  });
  assert.equal(otherTenant.status, 201);
  assert.notEqual(otherTenant.body.id, first.body.id);

  const conflict = await api.request("POST", "/v2/customers", {
    key: tenantA.key, headers, body: { type: "individual", name: "Changed request" },
  });
  assert.equal(conflict.status, 409);
});
