import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

async function createCard(api, key) {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Freeze Authority Customer" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customer.body.id, currency: "USD" },
  });
  return api.request("POST", "/v2/cards", {
    key,
    body: {
      customer: customer.body.id,
      account: account.body.id,
      type: "virtual",
    },
  });
}

test("only the freezing credential or an unrestricted tenant credential may unfreeze", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const root = await api.signup("freeze-authority@example.test");
  const card = await createCard(api, root.key);
  assert.equal(card.status, 201);

  const freezer = await api.request("POST", "/v2/keys", {
    key: root.key,
    body: { permissions: ["cards:write", "cards:read"] },
  });
  const sibling = await api.request("POST", "/v2/keys", {
    key: root.key,
    body: { permissions: ["cards:write", "cards:read"] },
  });
  assert.equal(freezer.status, 201);
  assert.equal(sibling.status, 201);

  const frozen = await api.request("POST", `/v2/cards/${card.body.id}/freeze`, {
    key: freezer.body.key,
    body: { reason: "fraud_review" },
  });
  assert.equal(frozen.status, 200);
  assert.equal(frozen.body.status, "frozen");

  const siblingAttempt = await api.request(
    "POST",
    `/v2/cards/${card.body.id}/unfreeze`,
    { key: sibling.body.key, body: {} },
  );
  assert.equal(siblingAttempt.status, 403);

  const stillFrozen = await api.request("GET", `/v2/cards/${card.body.id}`, {
    key: root.key,
  });
  assert.equal(stillFrozen.body.status, "frozen");

  // The tenant root is the explicit administrative recovery authority if the
  // initiating restricted credential is unavailable/revoked.
  const rootUnfreeze = await api.request(
    "POST",
    `/v2/cards/${card.body.id}/unfreeze`,
    { key: root.key, body: {} },
  );
  assert.equal(rootUnfreeze.status, 200);
  assert.equal(rootUnfreeze.body.status, "active");
});
