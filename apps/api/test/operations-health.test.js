import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const OPERATOR_KEY = "bb_operations_operator_1234567890abcdef";
const BOOTSTRAP_KEY = "bb_operations_bootstrap_1234567890abcdef";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("sandbox health/readiness are public while detailed operations metrics are operator-only", async (t) => {
  const api = await createApiFixture({
    env: { OPERATOR_API_KEY_HASH: sha256(OPERATOR_KEY) },
  });
  t.after(() => api.close());

  const health = await api.request("GET", "/v2/_health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.mode, "sandbox");
  assert.ok(Number.isInteger(health.body.schema_version));

  const ready = await api.request("GET", "/v2/_ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, "ready");
  assert.equal(ready.body.checks.database_schema, true);

  const anonymous = await api.request("GET", "/v2/_ops/metrics");
  assert.equal(anonymous.status, 401);

  const tenant = await api.signup("operations-metrics@example.test");
  const tenantAttempt = await api.request("GET", "/v2/_ops/metrics", {
    key: tenant.key,
  });
  assert.equal(tenantAttempt.status, 403);

  const metrics = await api.request("GET", "/v2/_ops/metrics", {
    key: OPERATOR_KEY,
  });
  assert.equal(metrics.status, 200);
  assert.equal(metrics.body.object, "operational_metrics");
  assert.equal(metrics.body.mode, "sandbox");
  assert.ok(metrics.body.resources.tenants >= 1);
  assert.equal(typeof metrics.body.provider.pending, "number");
  assert.equal(typeof metrics.body.webhooks.pending, "number");
  assert.equal(typeof metrics.body.reconciliation.open, "number");
  assert.equal(typeof metrics.body.audit.records, "number");
});

test("production readiness fails closed when required provider dependencies are absent", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "operations-production@example.test",
      OPERATOR_API_KEY_HASH: sha256(OPERATOR_KEY),
    },
  });
  t.after(() => api.close());

  const health = await api.request("GET", "/v2/_health");
  assert.equal(health.status, 200);
  assert.equal(health.body.mode, "production");

  const ready = await api.request("GET", "/v2/_ready");
  assert.equal(ready.status, 503);
  assert.equal(ready.body.type, "service-unavailable");
  assert.match(ready.body.detail, /provider_transport/);
  assert.match(ready.body.detail, /provider_payload_encryption/);
  assert.match(ready.body.detail, /provider_inbound_auth/);
});
