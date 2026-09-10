import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_production_bootstrap_test_secret_0123456789abcdef";

test("production mode bootstraps explicitly and disables sandbox shortcuts", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "platform-admin@example.test",
    },
  });
  t.after(() => api.close());

  const signup = await api.request("POST", "/v2/auth/signup", {
    body: { email: "public-signup@example.test" },
  });
  assert.equal(signup.status, 403);
  assert.match(signup.body.detail, /sandbox-only/);

  const keys = await api.request("GET", "/v2/keys", { key: BOOTSTRAP_KEY });
  assert.equal(keys.status, 200);
  assert.equal(keys.body.current.scope, "production_admin");
  assert.deepEqual(keys.body.current.permissions, ["*"]);
  assert.equal(keys.body.data.length, 1);
  assert.equal(keys.body.data[0].expires, null);

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "Production Customer" },
  });
  assert.equal(customer.status, 201);

  const fakeVerify = await api.request(
    "POST",
    `/v2/customers/${customer.body.id}/verify`,
    { key: BOOTSTRAP_KEY, body: { decision: "approved" } },
  );
  assert.equal(fakeVerify.status, 403);

  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  assert.equal(account.status, 201);

  const fakeCredit = await api.request(
    "POST",
    `/v2/accounts/${account.body.id}/credit`,
    { key: BOOTSTRAP_KEY, body: { amount: "100.00" } },
  );
  assert.equal(fakeCredit.status, 403);

  const scenarios = await api.request("GET", "/v2/sandbox/scenarios", {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(scenarios.status, 403);

  const mandate = await api.request("POST", "/v2/mandates", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  assert.equal(mandate.status, 403);
});

test("fresh production state refuses to boot without a bootstrap admin secret", async () => {
  await assert.rejects(
    () =>
      createApiFixture({
        env: {
          BANK_API_MODE: "production",
          BANK_BOOTSTRAP_API_KEY: "",
        },
      }),
    /BANK_BOOTSTRAP_API_KEY/,
  );
});
