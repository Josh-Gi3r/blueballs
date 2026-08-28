import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("duplicate emails create isolated tenant principals", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const tenantA = await api.signup("same@example.test");
  const tenantB = await api.signup("same@example.test");

  assert.notEqual(tenantA.tenant_id, tenantB.tenant_id);

  const keysA = await api.request("GET", "/v2/keys", { key: tenantA.key });
  const keysB = await api.request("GET", "/v2/keys", { key: tenantB.key });
  assert.deepEqual(
    keysA.body.data.map((key) => key.id),
    [tenantA.id],
  );
  assert.deepEqual(
    keysB.body.data.map((key) => key.id),
    [tenantB.id],
  );

  const crossTenantGet = await api.request("GET", `/v2/keys/${tenantA.id}`, {
    key: tenantB.key,
  });
  const crossTenantDelete = await api.request(
    "DELETE",
    `/v2/keys/${tenantA.id}`,
    { key: tenantB.key },
  );
  assert.equal(crossTenantGet.status, 404);
  assert.equal(crossTenantDelete.status, 404);

  const revokeB = await api.request("DELETE", "/v2/keys", { key: tenantB.key });
  assert.equal(revokeB.status, 200);
  assert.equal(revokeB.body.revoked, 1);

  const aStillWorks = await api.request("GET", "/v2/keys", {
    key: tenantA.key,
  });
  assert.equal(aStillWorks.status, 200);
  assert.deepEqual(
    aStillWorks.body.data.map((key) => key.id),
    [tenantA.id],
  );
});

test("secondary keys inherit tenant and cannot escalate scope", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const primary = await api.signup("owner@example.test");
  const secondaryResponse = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { scope: "sandbox" },
  });
  assert.equal(secondaryResponse.status, 201);
  assert.equal(secondaryResponse.body.tenant_id, primary.tenant_id);

  const secondary = secondaryResponse.body;
  const sharedList = await api.request("GET", "/v2/keys", {
    key: secondary.key,
  });
  assert.equal(sharedList.status, 200);
  assert.deepEqual(
    new Set(sharedList.body.data.map((key) => key.id)),
    new Set([primary.id, secondary.id]),
  );

  const escalation = await api.request("POST", "/v2/keys", {
    key: primary.key,
    body: { scope: "operator" },
  });
  assert.equal(escalation.status, 403);

  const revokePrimary = await api.request("DELETE", `/v2/keys/${primary.id}`, {
    key: secondary.key,
  });
  assert.equal(revokePrimary.status, 200);

  const secondaryStillWorks = await api.request("GET", "/v2/keys", {
    key: secondary.key,
  });
  assert.equal(secondaryStillWorks.status, 200);
  assert.deepEqual(
    secondaryStillWorks.body.data.map((key) => key.id),
    [secondary.id],
  );
});
