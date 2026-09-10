import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("secondary keys can be least-privilege and cannot escalate", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const primary = await api.signup("permissions@example.test");
  assert.deepEqual(primary.permissions, ["*"]);

  const restricted = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: {
      lifetime_hours: 1,
      permissions: ["identity:read", "keys:write"],
    },
  });
  assert.equal(restricted.status, 201);
  assert.deepEqual(restricted.body.permissions, ["identity:read", "keys:write"]);

  const list = await api.request("GET", "/v2/keys", { key: restricted.body.key });
  assert.equal(list.status, 200);
  assert.equal(list.body.current.key_id, restricted.body.id);
  assert.equal(list.body.current.tenant_id, primary.tenant_id);
  assert.deepEqual(list.body.current.permissions, ["identity:read", "keys:write"]);

  const customers = await api.request("GET", "/v2/customers", {
    key: restricted.body.key,
  });
  assert.equal(customers.status, 200);

  const deniedWrite = await api.request("POST", "/v2/customers", {
    key: restricted.body.key,
    body: { type: "individual", name: "Should not be created" },
  });
  assert.equal(deniedWrite.status, 403);
  assert.match(deniedWrite.body.detail, /identity:write/);

  const escalation = await api.request("POST", "/v2/keys", {
    key: restricted.body.key,
    body: { permissions: ["fx:write"] },
  });
  assert.equal(escalation.status, 403);
  assert.match(escalation.body.detail, /cannot grant permission fx:write/);

  const child = await api.request("POST", "/v2/keys", {
    key: restricted.body.key,
    body: { permissions: ["identity:read"] },
  });
  assert.equal(child.status, 201);
  assert.deepEqual(child.body.permissions, ["identity:read"]);

  const childCannotMint = await api.request("POST", "/v2/keys", {
    key: child.body.key,
    body: { permissions: ["identity:read"] },
  });
  assert.equal(childCannotMint.status, 403);
  assert.match(childCannotMint.body.detail, /keys:write/);
});

test("omitted permissions inherit the parent for compatibility", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const primary = await api.signup("permissions-inherit@example.test");
  const secondary = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { lifetime_hours: 1 },
  });
  assert.equal(secondary.status, 201);
  assert.deepEqual(secondary.body.permissions, ["*"]);

  const create = await api.request("POST", "/v2/customers", {
    key: secondary.body.key,
    body: { type: "individual", name: "Inherited access" },
  });
  assert.equal(create.status, 201);
});
