import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

function assertProblem(response, status) {
  assert.equal(response.status, status);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/problem\+json/,
  );
  assert.equal(response.body?.status, status);
  assert.equal(typeof response.body?.type, "string");
  assert.equal(typeof response.body?.detail, "string");
  assert.equal(typeof response.body?.request_id, "string");
  assert.equal(
    response.headers.get("x-request-id"),
    response.body.request_id,
    "transport and RFC 9457 request correlation must agree",
  );
  assert.ok(response.headers.get("x-command-id"));
}

test("banking errors use one correlated RFC 9457 problem contract", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("problem-contract@example.test");

  const bad = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual" },
  });
  assertProblem(bad, 400);

  const anonymous = await api.request("GET", "/v2/customers");
  assertProblem(anonymous, 401);

  const missing = await api.request("GET", "/v2/customers/cus_missing", {
    key: tenant.key,
  });
  assertProblem(missing, 404);

  const headers = { "x-idempotency-key": "problem-contract-idem-1" };
  const first = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    headers,
    body: { type: "individual", name: "Idempotent One" },
  });
  assert.equal(first.status, 201);
  const conflict = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    headers,
    body: { type: "individual", name: "Different Parameters" },
  });
  assertProblem(conflict, 409);

  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Card Customer" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: {
      customer: customer.body.id,
      account: account.body.id,
      type: "virtual",
    },
  });
  assert.equal(card.status, 201);
  const adapterRequired = await api.request(
    "POST",
    `/v2/cards/${card.body.id}/pin`,
    { key: tenant.key },
  );
  assertProblem(adapterRequired, 503);
});

test("production sandbox controls produce a correlated 403", async (t) => {
  const bootstrap = "bb_problem_production_1234567890abcdef123456";
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: bootstrap,
      BANK_BOOTSTRAP_EMAIL: "problem-production@example.test",
    },
  });
  t.after(() => api.close());

  const forbidden = await api.request("POST", "/v2/auth/signup", {
    body: { email: "not-allowed@example.test" },
  });
  assertProblem(forbidden, 403);
});

test("oversized request bodies return 413 problem details", async (t) => {
  const api = await createApiFixture({ env: { BODY_LIMIT_BYTES: "128" } });
  t.after(() => api.close());

  const oversized = await api.request("POST", "/v2/auth/signup", {
    body: { email: `${"a".repeat(256)}@example.test` },
  });
  assertProblem(oversized, 413);
});

test("source throttling returns 429 with retry evidence", async (t) => {
  // The fixture readiness probe also passes through the source limiter, so loop
  // until the intentionally tiny bucket is exhausted instead of depending on
  // whether the first explicit request is request 1 or request 2.
  const api = await createApiFixture({
    env: {
      SOURCE_RATE_LIMIT_PER_MIN: "2",
      TENANT_RATE_LIMIT_PER_MIN: "10000",
    },
  });
  t.after(() => api.close());

  let limited = null;
  for (let i = 0; i < 5; i++) {
    const response = await api.request("GET", "/v2");
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  assert.ok(limited, "source quota should become exhausted deterministically");
  assertProblem(limited, 429);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
});

test("weekend-only rails return the documented 422 problem response", async (t) => {
  const api = await createApiFixture({
    nodeArgs: ["--import", "./test/helpers/fixed-weekend-clock.mjs"],
  });
  t.after(() => api.close());
  const tenant = await api.signup("weekend-rail@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Weekend Customer" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: tenant.key,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  await api.request("POST", `/v2/accounts/${account.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "100.00" },
  });
  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: { from: account.body.id, amount: "10.00", rail: "sepa" },
  });
  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.status, "funds_received");

  const unavailable = await api.request(
    "POST",
    `/v2/transfers/${transfer.body.id}/settle`,
    { key: tenant.key },
  );
  assertProblem(unavailable, 422);
});
