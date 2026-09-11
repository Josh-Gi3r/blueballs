import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_production_bootstrap_test_secret_0123456789abcdef";

async function assertSandboxOnly(api, method, path, body = undefined) {
  const response = await api.request(method, path, {
    key: BOOTSTRAP_KEY,
    ...(body === undefined ? {} : { body }),
  });
  assert.equal(
    response.status,
    403,
    `${method} ${path} should fail closed in production: ${JSON.stringify(response.body)}`,
  );
  assert.match(response.body.detail, /sandbox-only/);
  return response;
}

test("production mode bootstraps explicitly and disables sandbox/reference controls", async (t) => {
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

  await assertSandboxOnly(
    api,
    "POST",
    `/v2/customers/${customer.body.id}/verify`,
    { decision: "approved" },
  );

  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "EUR" },
  });
  assert.equal(account.status, 201);

  await assertSandboxOnly(
    api,
    "POST",
    `/v2/accounts/${account.body.id}/credit`,
    { amount: "100.00" },
  );

  const blocked = [
    ["POST", "/v2/destinations/dst_reference/verify", { name: "Reference" }],
    ["POST", "/v2/cards/crd_reference/freeze", { reason: "reference" }],
    ["POST", "/v2/cards/crd_reference/unfreeze", {}],
    ["PATCH", "/v2/cards/crd_reference/controls", { spend_limits: {} }],
    ["GET", "/v2/cards/crd_reference/transactions"],
    ["GET", "/v2/cards/crd_reference/statements"],
    ["POST", "/v2/cards/crd_reference/authorisations", {}],
    ["GET", "/v2/authorisations"],
    ["POST", "/v2/disputes", {}],
    ["POST", "/v2/vaults", {}],
    ["GET", "/v2/vaults"],
    ["POST", "/v2/credit", {}],
    ["GET", "/v2/credit"],
    ["POST", "/v2/links", { currency: "EUR" }],
    ["GET", "/v2/links/lnk_reference"],
    ["POST", "/v2/mandates", {}],
    ["GET", "/v2/mandates/mnd_reference"],
    ["POST", "/v2/subscriptions", {}],
    ["GET", "/v2/subscriptions"],
    ["POST", "/v2/quotes", {}],
    ["POST", "/v2/fx/quote", {}],
    ["GET", "/v2/sandbox/scenarios"],
  ];
  for (const [method, path, body] of blocked) {
    await assertSandboxOnly(api, method, path, body);
  }

  // Non-mutating public compatibility data may remain readable as explicitly
  // indicative/reference information. It is never execution or a lockable quote.
  const rates = await api.request("GET", "/v2/rates");
  assert.equal(rates.status, 200);
  const depth = await api.request("GET", "/v2/fx/depth");
  assert.equal(depth.status, 200);
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
