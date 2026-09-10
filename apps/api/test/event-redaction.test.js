import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("stored events recursively redact persistence-only ownership metadata", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const principal = await api.signup("event-redaction@example.test");
  const customer = await api.request("POST", "/v2/customers", {
    key: principal.key,
    body: { type: "individual", name: "No internal metadata" },
  });
  assert.equal(customer.status, 201);

  const events = await api.request("GET", "/v2/events", { key: principal.key });
  assert.equal(events.status, 200);
  const created = events.body.data.find(
    (event) => event.type === "customer.created" && event.data.id === customer.body.id,
  );
  assert.ok(created);
  assert.equal("owner" in created.data, false);
  assert.equal(JSON.stringify(created).includes('"owner"'), false);
  assert.match(created.command_id, /^cmd_/);
});
