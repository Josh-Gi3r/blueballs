import assert from "node:assert/strict";
import test from "node:test";
import { signTrustedActorHeaders } from "../../../spec/trusted-actor-signing.mjs";
import { createApiFixture } from "./helpers/api-process.js";

const ACTOR_SECRET = "idempotency-preflight-actor-secret-0123456789abcdef012345";

function actorHeaders(principal, body, actorId = "idp:approver@example.test") {
  return signTrustedActorHeaders({
    secret: ACTOR_SECRET,
    credentialId: principal.id,
    method: "POST",
    path: "/v2/customers",
    actorId,
    assurance: "step_up",
    body,
    url: "https://blueballs.test/v2/customers",
  });
}

test("idempotency replay still runs current actor/security preflight", async (t) => {
  const api = await createApiFixture({
    env: { BANK_TRUSTED_ACTOR_SECRET: ACTOR_SECRET },
  });
  t.after(() => api.close());
  const principal = await api.signup("idem-preflight@example.test");
  const body = { type: "individual", name: "Preflight Customer" };
  const idempotency = "idem-preflight-customer-1";

  const first = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: {
      ...actorHeaders(principal, body),
      "x-idempotency-key": idempotency,
    },
    body,
  });
  assert.equal(first.status, 201);

  const forged = actorHeaders(principal, body, "idp:mallory@example.test");
  forged["x-blueballs-actor-signature"] = `v1=${"0".repeat(64)}`;
  const replayWithForgedActor = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: {
      ...forged,
      "x-idempotency-key": idempotency,
    },
    body,
  });
  assert.equal(
    replayWithForgedActor.status,
    401,
    "cached mutation must not bypass a forged actor assertion",
  );

  const validReplay = await api.request("POST", "/v2/customers", {
    key: principal.key,
    headers: {
      ...actorHeaders(principal, body),
      "x-idempotency-key": idempotency,
    },
    body,
  });
  assert.equal(validReplay.status, 201);
  assert.equal(validReplay.body.id, first.body.id);
  assert.equal(validReplay.body.replayed, true);
});
