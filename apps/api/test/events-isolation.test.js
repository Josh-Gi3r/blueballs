import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("events are durable and visible only to their tenant", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const tenantA = await api.signup("events-a@example.test");
  const tenantB = await api.signup("events-b@example.test");

  const created = await api.request("POST", "/v2/customers", {
    key: tenantA.key,
    body: { type: "individual", name: "Tenant A event payload" },
  });
  assert.equal(created.status, 201);

  const eventsA = await api.request("GET", "/v2/events", { key: tenantA.key });
  const eventsB = await api.request("GET", "/v2/events", { key: tenantB.key });
  const customerEvent = eventsA.body.data.find((event) => event.type === "customer.created");
  assert.ok(customerEvent);
  assert.equal(customerEvent.data.id, created.body.id);
  assert.equal("tenant_id" in customerEvent, false);
  assert.equal(eventsB.body.data.some((event) => event.data?.id === created.body.id), false);
  assert.equal((await api.request("GET", `/v2/events/${customerEvent.id}`, { key: tenantB.key })).status, 404);

  await api.restart();
  const afterRestart = await api.request("GET", `/v2/events/${customerEvent.id}`, { key: tenantA.key });
  assert.equal(afterRestart.status, 200);
  assert.equal(afterRestart.body.data.id, created.body.id);
});

test("webhook metadata and delivery logs cannot cross tenants", async (t) => {
  const api = await createApiFixture({
    env: { WEBHOOK_DELIVERY_MODE: "allowlist", WEBHOOK_ALLOWED_HOSTS: "example.test" },
  });
  t.after(() => api.close());

  const tenantA = await api.signup("webhooks-a@example.test");
  const tenantB = await api.signup("webhooks-b@example.test");
  const created = await api.request("POST", "/v2/webhooks", {
    key: tenantA.key,
    body: { url: "https://example.test/callback", events: ["customer.created"] },
  });
  assert.equal(created.status, 201);
  assert.match(created.body.secret, /^whsec_/);
  assert.equal(created.body.status, "enabled");
  assert.equal(created.body.delivery_mode, "allowlist");

  const reread = await api.request("GET", `/v2/webhooks/${created.body.id}`, { key: tenantA.key });
  assert.equal(reread.status, 200);
  assert.equal("secret" in reread.body, false);
  assert.equal((await api.request("GET", `/v2/webhooks/${created.body.id}`, { key: tenantB.key })).status, 404);
  assert.deepEqual((await api.request("GET", "/v2/webhooks", { key: tenantB.key })).body.data, []);

  const insecure = await api.request("POST", "/v2/webhooks", {
    key: tenantA.key,
    body: { url: "http://127.0.0.1/internal" },
  });
  assert.equal(insecure.status, 400);
});

test("shared-host webhook creation fails honestly when delivery is disabled", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("webhooks-disabled@example.test");
  const response = await api.request("POST", "/v2/webhooks", {
    key: tenant.key,
    body: { url: "https://example.test/callback" },
  });
  assert.equal(response.status, 503);
});

test("allowlisted delivery attempts only the event owner's webhook", async (t) => {
  const api = await createApiFixture({
    env: { WEBHOOK_DELIVERY_MODE: "allowlist", WEBHOOK_ALLOWED_HOSTS: "example.test" },
  });
  t.after(() => api.close());

  const tenantA = await api.signup("delivery-a@example.test");
  const tenantB = await api.signup("delivery-b@example.test");
  const createTarget = (key) => api.request("POST", "/v2/webhooks", {
    key,
    body: { url: "https://example.test/callback", events: ["customer.created"] },
  });
  const webhookA = await createTarget(tenantA.key);
  const webhookB = await createTarget(tenantB.key);
  assert.equal(webhookA.body.status, "enabled");
  assert.equal(webhookB.body.status, "enabled");

  const rejected = await api.request("POST", "/v2/webhooks", {
    key: tenantA.key,
    body: { url: "https://unlisted.example/callback" },
  });
  assert.equal(rejected.status, 400);

  await api.request("POST", "/v2/customers", {
    key: tenantA.key,
    body: { type: "individual", name: "Only A receives this" },
  });

  let deliveriesA;
  for (let attempt = 0; attempt < 20; attempt++) {
    deliveriesA = await api.request("GET", `/v2/webhooks/${webhookA.body.id}/deliveries`, { key: tenantA.key });
    if (deliveriesA.body.data.length) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const deliveriesB = await api.request("GET", `/v2/webhooks/${webhookB.body.id}/deliveries`, { key: tenantB.key });
  assert.equal(deliveriesA.body.data.length, 1);
  assert.equal(deliveriesB.body.data.length, 0);
});
