import test from "node:test";
import assert from "node:assert/strict";

import { FiatSettlementStore } from "../../../packages/fx-fiat/src/index.js";
import { FxMarketService } from "../../../packages/fx-market/src/index.js";
import { PrivateMarketQuoteCoordinator } from "../src/quote-coordinator.js";
import { createFxNodeServer } from "../src/server.js";

const CLIENT_KEY = "client-test-key-123456789";
const OPERATOR_KEY = "operator-test-key-987654321";

async function setup() {
  const market = new FxMarketService({
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true }),
  });
  const quotes = new PrivateMarketQuoteCoordinator({ market });
  const fiat = new FiatSettlementStore();
  const node = createFxNodeServer({
    market,
    quotes,
    fiat,
    apiKey: CLIENT_KEY,
    operatorApiKey: OPERATOR_KEY,
    sourceCommit: "deadbeef",
  });
  const address = await node.listen();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = "GET", body, key } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: await response.json() };
  }

  return {
    request,
    async close() {
      await node.close();
      quotes.close();
      fiat.close();
      market.close();
    },
  };
}

test("client credential cannot assert quote finality", async () => {
  const env = await setup();
  try {
    const denied = await env.request("/v2/fx/ops/quotes/missing/confirmed", {
      method: "POST",
      key: CLIENT_KEY,
      body: { eventId: "chain-event-1", fills: [] },
    });
    assert.equal(denied.response.status, 401);
    assert.equal(denied.json.error.code, "OPERATOR_AUTH_REQUIRED");

    const operator = await env.request("/v2/fx/ops/quotes/missing/confirmed", {
      method: "POST",
      key: OPERATOR_KEY,
      body: { eventId: "chain-event-1", fills: [] },
    });
    assert.equal(operator.response.status, 404);
    assert.equal(operator.json.error.code, "NOT_FOUND");
  } finally {
    await env.close();
  }
});

test("client credential cannot inject fiat evidence or settlement", async () => {
  const env = await setup();
  try {
    for (const [path, body] of [
      ["/v2/fx/fiat/attestations", {}],
      ["/v2/fx/fiat/intents/missing/settle", { eventId: "evt-1" }],
    ]) {
      const denied = await env.request(path, {
        method: "POST",
        key: CLIENT_KEY,
        body,
      });
      assert.equal(denied.response.status, 401);
      assert.equal(denied.json.error.code, "OPERATOR_AUTH_REQUIRED");
    }
  } finally {
    await env.close();
  }
});

test("operator credential does not automatically grant client execution authority", async () => {
  const env = await setup();
  try {
    const denied = await env.request("/v2/fx/quotes/missing", {
      key: OPERATOR_KEY,
    });
    assert.equal(denied.response.status, 401);
    assert.equal(denied.json.error.code, "AUTH_REQUIRED");
  } finally {
    await env.close();
  }
});

test("health exposes exact runtime provenance without authentication", async () => {
  const env = await setup();
  try {
    const health = await env.request("/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.json.source_commit, "deadbeef");
  } finally {
    await env.close();
  }
});

test("CORS configuration accepts exact origins only", () => {
  const market = new FxMarketService();
  const quotes = new PrivateMarketQuoteCoordinator({ market });
  const fiat = new FiatSettlementStore();
  try {
    assert.throws(
      () =>
        createFxNodeServer({
          market,
          quotes,
          fiat,
          apiKey: CLIENT_KEY,
          operatorApiKey: OPERATOR_KEY,
          corsOrigins: ["https://example.test/path"],
        }),
      /exact HTTP\(S\) origin/,
    );
  } finally {
    quotes.close();
    fiat.close();
    market.close();
  }
});
