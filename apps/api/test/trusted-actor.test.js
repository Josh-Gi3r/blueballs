import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const SECRET = "trusted-actor-test-secret-0123456789abcdef0123456789abcdef";

function actorHeaders({ keyId, method, path, actorId, assurance = "normal", timestamp = Math.floor(Date.now() / 1000) }) {
  const stamp = String(timestamp);
  const message = ["v1", stamp, keyId, method, path, actorId, assurance].join("\n");
  const signature = createHmac("sha256", SECRET).update(message).digest("hex");
  return {
    "x-blueballs-actor-id": actorId,
    "x-blueballs-actor-timestamp": stamp,
    "x-blueballs-actor-assurance": assurance,
    "x-blueballs-actor-signature": `v1=${signature}`,
  };
}

function audits(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare('SELECT data FROM "auditRecords" ORDER BY rowid')
      .all()
      .map((row) => JSON.parse(row.data));
  } finally {
    db.close();
  }
}

test("a signed external IAM actor is attributed without replacing the machine API credential", async (t) => {
  const api = await createApiFixture({
    env: { BANK_TRUSTED_ACTOR_SECRET: SECRET },
  });
  t.after(() => api.close());
  const principal = await api.signup("trusted-actor@example.test");

  const headers = actorHeaders({
    keyId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId: "idp:alice@example.test",
    assurance: "step_up",
  });
  const created = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers,
    body: { type: "individual", name: "IAM Actor Customer" },
  });
  assert.equal(created.status, 201);

  const record = [...audits(api.databasePath)]
    .reverse()
    .find((row) => row.operation === "POST /v2/customers");
  assert.ok(record);
  assert.equal(record.actor_id, "idp:alice@example.test");
  assert.equal(record.actor_scope, `human:step_up;credential:${principal.id}`);
  assert.equal(record.tenant_id, principal.tenant_id);
});

test("forged, partial and stale actor assertions fail closed before the domain handler", async (t) => {
  const api = await createApiFixture({
    env: { BANK_TRUSTED_ACTOR_SECRET: SECRET },
  });
  t.after(() => api.close());
  const principal = await api.signup("trusted-actor-reject@example.test");

  const forged = actorHeaders({
    keyId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId: "idp:mallory",
  });
  forged["x-blueballs-actor-signature"] = `v1=${"0".repeat(64)}`;
  const forgedResponse = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: forged,
    body: { type: "individual", name: "Must Not Exist" },
  });
  assert.equal(forgedResponse.status, 401);

  const partial = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: { "x-blueballs-actor-id": "idp:partial" },
    body: { type: "individual", name: "Must Not Exist Either" },
  });
  assert.equal(partial.status, 401);

  const stale = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: actorHeaders({
      keyId: principal.id,
      method: "POST",
      path: "/v2/customers",
      actorId: "idp:stale",
      timestamp: Math.floor(Date.now() / 1000) - 3601,
    }),
    body: { type: "individual", name: "Stale Must Not Exist" },
  });
  assert.equal(stale.status, 401);

  const listed = await api.request("GET", "/v2/customers", { key: principal.key });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 0);
});
