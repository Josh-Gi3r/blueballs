import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("builder creates, provisions, tests and persists an isolated sandbox", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const alpha = await api.signup("builder-alpha@example.test");
  const beta = await api.signup("builder-beta@example.test");

  const created = await api.request("POST", "/v2/builder/projects", {
    key: alpha.key,
    body: {
      name: "Maker Bank",
      brief: "A Singapore account and card product for independent designers with cross-border FX.",
      audience: "Independent designers and small studios",
      markets: ["SG"],
      currencies: ["SGD", "USD", "USDX"],
      capabilities: ["accounts", "onboarding", "transfers", "cards", "fx"],
      rails: ["paynow", "wire"],
      brand: { accent: "#0868FF", personality: "direct and optimistic" },
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "blueprint_ready");
  assert.equal(created.body.plan.active_users_included, 10000);
  assert.equal(created.body.plan.ai, "bring_your_own");
  assert.deepEqual(created.body.blueprint.markets, ["SG"]);
  assert.equal(created.body.accounts.length, 0);

  const projectId = created.body.id;
  assert.equal((await api.request("GET", `/v2/builder/projects/${projectId}`, { key: beta.key })).status, 404);
  const betaProjects = await api.request("GET", "/v2/builder/projects", { key: beta.key });
  assert.equal(betaProjects.status, 200);
  assert.deepEqual(betaProjects.body.data, []);

  const provisioned = await api.request("POST", `/v2/builder/projects/${projectId}/provision`, { key: alpha.key });
  assert.equal(provisioned.status, 200);
  assert.equal(provisioned.body.status, "ready");
  assert.equal(provisioned.body.environment.mode, "sandbox");
  assert.equal(provisioned.body.environment.real_money, false);
  assert.equal(provisioned.body.customers.length, 3);
  assert.equal(provisioned.body.accounts.length, 9);
  assert.ok(provisioned.body.build.steps.every((step) => step.status === "complete"));

  const reprovisioned = await api.request("POST", `/v2/builder/projects/${projectId}/provision`, { key: alpha.key });
  assert.equal(reprovisioned.status, 200);
  assert.equal(reprovisioned.body.accounts.length, 9, "provisioning is idempotent after the environment is ready");

  const source = provisioned.body.accounts.find((account) => account.currency === "SGD");
  assert.ok(source);
  assert.equal(source.balance.amount, "10000.00");
  const payment = await api.request("POST", `/v2/builder/projects/${projectId}/test-payments`, {
    key: alpha.key,
    body: { from_account: source.id, amount: "125.50", recipient: "Studio Supplies", rail: "paynow" },
  });
  assert.equal(payment.status, 200);
  assert.equal(payment.body.journeys[0].status, "settled");
  assert.equal(payment.body.journeys[0].amount.amount, "125.50");
  assert.equal(payment.body.accounts.find((account) => account.id === source.id).balance.amount, "9874.50");

  assert.equal((await api.request("POST", `/v2/builder/projects/${projectId}/test-payments`, {
    key: beta.key,
    body: { from_account: source.id, amount: "1.00", recipient: "Not allowed" },
  })).status, 404);

  await api.restart();
  const restored = await api.request("GET", `/v2/builder/projects/${projectId}`, { key: alpha.key });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.status, "ready");
  assert.equal(restored.body.journeys.length, 1);
  assert.equal(restored.body.accounts.find((account) => account.id === source.id).balance.amount, "9874.50");
});

test("builder validates blueprints and protects provisioned financial configuration", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("builder-validation@example.test");

  const invalid = await api.request("POST", "/v2/builder/projects", {
    key: tenant.key,
    body: { name: "Bad project", brief: "Test", audience: "Everyone", currencies: ["DOGE"] },
  });
  assert.equal(invalid.status, 400);

  const created = await api.request("POST", "/v2/builder/projects", {
    key: tenant.key,
    body: { name: "Freelance Bank", brief: "Accounts and invoices for UK freelancers", audience: "UK freelancers" },
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.blueprint.markets, ["GB"]);
  assert.ok(created.body.blueprint.capabilities.includes("accounts"));

  const revised = await api.request("PATCH", `/v2/builder/projects/${created.body.id}`, {
    key: tenant.key,
    body: { brand: { accent: "#FF4D00" } },
  });
  assert.equal(revised.status, 200);
  assert.equal(revised.body.blueprint.brand.accent, "#FF4D00");

  await api.request("POST", `/v2/builder/projects/${created.body.id}/provision`, { key: tenant.key });
  assert.equal((await api.request("PATCH", `/v2/builder/projects/${created.body.id}`, {
    key: tenant.key,
    body: { currencies: ["USD"] },
  })).status, 409);
});
