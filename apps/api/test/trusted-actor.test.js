import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { signTrustedActorHeaders } from "../../../spec/trusted-actor-signing.mjs";
import { createApiFixture } from "./helpers/api-process.js";

const SECRET = "trusted-actor-test-secret-0123456789abcdef0123456789abcdef";

function actorHeaders({
  keyId,
  method,
  path,
  actorId,
  assurance = "normal",
  timestamp = Math.floor(Date.now() / 1000),
  body = {},
  query = "",
}) {
  return signTrustedActorHeaders({
    secret: SECRET,
    credentialId: keyId,
    method,
    path,
    actorId,
    assurance,
    timestamp,
    body,
    url: `https://blueballs.test${path}${query}`,
  });
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
  const body = { type: "individual", name: "IAM Actor Customer" };

  const headers = actorHeaders({
    keyId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId: "idp:alice@example.test",
    assurance: "step_up",
    body,
  });
  const created = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers,
    body,
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

test("actor signatures cannot be replayed onto a different body or query", async (t) => {
  const api = await createApiFixture({
    env: { BANK_TRUSTED_ACTOR_SECRET: SECRET },
  });
  t.after(() => api.close());
  const principal = await api.signup("trusted-actor-intent@example.test");

  const signedBody = { type: "individual", name: "Approved Intent" };
  const bodyHeaders = actorHeaders({
    keyId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId: "idp:alice@example.test",
    body: signedBody,
  });
  const tamperedBody = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: bodyHeaders,
    body: { ...signedBody, name: "Tampered Intent" },
  });
  assert.equal(tamperedBody.status, 401);

  const queryHeaders = actorHeaders({
    keyId: principal.id,
    method: "GET",
    path: "/v2/customers",
    actorId: "idp:alice@example.test",
    query: "?limit=1",
  });
  const tamperedQuery = await api.request("GET", "/v2/customers?limit=2", {
    key: principal.key,
    headers: queryHeaders,
  });
  assert.equal(tamperedQuery.status, 401);

  const validQuery = await api.request("GET", "/v2/customers?limit=1", {
    key: principal.key,
    headers: queryHeaders,
  });
  assert.equal(validQuery.status, 200);
});

test("forged, partial and stale actor assertions fail closed before the domain handler", async (t) => {
  const api = await createApiFixture({
    env: { BANK_TRUSTED_ACTOR_SECRET: SECRET },
  });
  t.after(() => api.close());
  const principal = await api.signup("trusted-actor-reject@example.test");

  const forgedBody = { type: "individual", name: "Must Not Exist" };
  const forged = actorHeaders({
    keyId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId: "idp:mallory",
    body: forgedBody,
  });
  forged["x-blueballs-actor-signature"] = `v1=${"0".repeat(64)}`;
  const forgedResponse = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: forged,
    body: forgedBody,
  });
  assert.equal(forgedResponse.status, 401);

  const partial = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: { "x-blueballs-actor-id": "idp:partial" },
    body: { type: "individual", name: "Must Not Exist Either" },
  });
  assert.equal(partial.status, 401);

  const staleBody = { type: "individual", name: "Stale Must Not Exist" };
  const stale = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: actorHeaders({
      keyId: principal.id,
      method: "POST",
      path: "/v2/customers",
      actorId: "idp:stale",
      timestamp: Math.floor(Date.now() / 1000) - 3601,
      body: staleBody,
    }),
    body: staleBody,
  });
  assert.equal(stale.status, 401);

  const listed = await api.request("GET", "/v2/customers", { key: principal.key });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 0);
});
