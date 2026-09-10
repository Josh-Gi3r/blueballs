import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

function jsonRows(databasePath, table) {
  const database = new DatabaseSync(databasePath);
  try {
    return database
      .prepare(`SELECT data FROM "${table}" ORDER BY id`)
      .all()
      .map((row) => JSON.parse(row.data));
  } finally {
    database.close();
  }
}

async function waitFor(check, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

test("webhook delivery intent commits with the event and survives retry/restart with one stable delivery id", async (t) => {
  const api = await createApiFixture({
    env: {
      WEBHOOK_DELIVERY_MODE: "allowlist",
      WEBHOOK_ALLOWED_HOSTS: "127.0.0.1:65535",
      WEBHOOK_RETRY_DELAYS_MS: "0,50,100",
      WEBHOOK_PUMP_MS: "25",
      WEBHOOK_LEASE_MS: "100",
    },
  });
  t.after(() => api.close());

  const tenant = await api.signup("webhook-outbox@example.test");
  const target = await api.request("POST", "/v2/webhooks", {
    key: tenant.key,
    body: {
      url: "https://127.0.0.1:65535/hook",
      events: ["customer.created"],
    },
  });
  assert.equal(target.status, 201);

  const customer = await api.request("POST", "/v2/customers", {
    key: tenant.key,
    body: { type: "individual", name: "Durable outbox" },
  });
  assert.equal(customer.status, 201);

  // The network target is deliberately unreachable, but the financial/domain
  // command still committed a durable event + delivery intent atomically.
  const initial = jsonRows(api.databasePath, "deliveries");
  const jobs = jsonRows(api.databasePath, "webhookOutbox");
  assert.equal(initial.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(initial[0].event_type, "customer.created");
  assert.ok(initial[0].event_created_at);
  assert.equal(jobs[0].delivery_id, initial[0].id);
  const deliveryId = initial[0].id;

  const attempted = await waitFor(() => {
    const [record] = jsonRows(api.databasePath, "deliveries");
    return record?.attempt_count > 0 ? record : null;
  });
  assert.ok(attempted, "delivery pump never attempted the durable job");
  assert.equal(attempted.id, deliveryId);

  await api.restart();

  const terminal = await waitFor(() => {
    const rows = jsonRows(api.databasePath, "deliveries");
    const [record] = rows;
    return record?.status === "failed" ? { rows, record } : null;
  }, 3_000);
  assert.ok(terminal, "delivery did not resume and exhaust retries after restart");
  assert.equal(terminal.rows.length, 1, "retry created a duplicate logical delivery");
  assert.equal(terminal.record.id, deliveryId);
  assert.equal(terminal.record.attempt_count, 3);
  assert.equal(terminal.record.response_code, null);
  assert.match(terminal.record.error ?? "", /fetch|connect|ECONN|network|failed/i);

  const finalJobs = jsonRows(api.databasePath, "webhookOutbox");
  assert.equal(finalJobs.length, 1);
  assert.equal(finalJobs[0].delivery_id, deliveryId);
  assert.equal(finalJobs[0].status, "failed");
});
