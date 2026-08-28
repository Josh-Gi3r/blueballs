import test from "node:test";
import assert from "node:assert/strict";

import { FiatSettlementStore } from "../../../packages/fx-fiat/src/index.js";
import { FxMarketService } from "../../../packages/fx-market/src/index.js";
import { PrivateMarketQuoteCoordinator } from "../src/quote-coordinator.js";
import { createFxNodeServer } from "../src/server.js";

const NOW = 1_000_000;
const API_KEY = "test-api-key-123";
const INPUT = "0x0000000000000000000000000000000000000011";
const OUTPUT = "0x0000000000000000000000000000000000000022";
const MAKER = "0x00000000000000000000000000000000000000a1";

function hash(n) {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function order(id = 1) {
  return {
    orderHash: hash(id),
    signature: "0x01",
    policyAuthorizationId: "auth-maker",
    policySnapshotHash: hash(999),
    order: {
      maker: MAKER,
      sellToken: OUTPUT,
      buyToken: INPUT,
      sellAmount: "100",
      buyAmount: "200",
      recipient: MAKER,
      validAfter: 0,
      validUntil: 4_000_000_000,
      epoch: 1,
      salt: hash(10_000 + id),
    },
  };
}

async function setup({ adapter = {} } = {}) {
  const market = new FxMarketService({
    now: () => NOW,
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true }),
  });
  const quotes = new PrivateMarketQuoteCoordinator({ market, now: () => NOW });
  const fiat = new FiatSettlementStore({ now: () => NOW });
  const node = createFxNodeServer({
    market,
    quotes,
    fiat,
    executionAdapter: adapter,
    apiKey: API_KEY,
    now: () => NOW,
  });
  const address = await node.listen();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = "GET", body, auth = true } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: `Bearer ${API_KEY}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { response, json: await response.json() };
  }

  return {
    market,
    quotes,
    fiat,
    node,
    adapter,
    request,
    async close() {
      await node.close();
      quotes.close();
      fiat.close();
      market.close();
    },
  };
}

test("health is public while financial endpoints require authentication", async () => {
  const env = await setup();
  try {
    const health = await env.request("/health", { auth: false });
    assert.equal(health.response.status, 200);
    assert.equal(health.json.status, "ok");

    const denied = await env.request("/v2/fx/quotes", {
      method: "POST",
      auth: false,
      body: { inputAsset: INPUT, outputAsset: OUTPUT, exactOutput: "10" },
    });
    assert.equal(denied.response.status, 401);
    assert.equal(denied.json.error.code, "AUTH_REQUIRED");
  } finally {
    await env.close();
  }
});

test("order and firm quote endpoints use real market reservations and do not leak maker payload", async () => {
  const env = await setup();
  try {
    const admitted = await env.request("/v2/fx/orders", {
      method: "POST",
      body: order(1),
    });
    assert.equal(admitted.response.status, 201);
    assert.equal(admitted.json.sequence, "1");

    const depth = await env.request(
      `/v2/fx/depth?inputAsset=${INPUT}&outputAsset=${OUTPUT}`,
    );
    assert.equal(depth.response.status, 200);
    assert.equal(depth.json.levels.length, 1);

    const quoted = await env.request("/v2/fx/quotes", {
      method: "POST",
      body: {
        inputAsset: INPUT,
        outputAsset: OUTPUT,
        exactOutput: "100",
        expiresInMs: 10_000,
      },
    });
    assert.equal(quoted.response.status, 201);
    assert.equal(quoted.json.state, "RESERVED");
    assert.equal(quoted.json.maxInput, "200");
    assert.deepEqual(quoted.json.sources, [
      { type: "PRIVATE_MARKET", input: "200", output: "100" },
    ]);
    assert.equal("maker" in quoted.json.sources[0], false);
    assert.equal("signature" in quoted.json.sources[0], false);
    assert.equal("orderHash" in quoted.json.sources[0], false);

    const route = await env.request(`/v2/fx/routes/${quoted.json.routeId}`);
    assert.equal(route.json.state, "RESERVED");
  } finally {
    await env.close();
  }
});

test("execute fails closed without adapter and does not change reservation state", async () => {
  const env = await setup();
  try {
    await env.request("/v2/fx/orders", { method: "POST", body: order(2) });
    const quoted = await env.request("/v2/fx/quotes", {
      method: "POST",
      body: { inputAsset: INPUT, outputAsset: OUTPUT, exactOutput: "100" },
    });

    const execution = await env.request(
      `/v2/fx/quotes/${quoted.json.id}/execute`,
      { method: "POST" },
    );
    assert.equal(execution.response.status, 503);
    assert.equal(execution.json.error.code, "EXECUTION_UNAVAILABLE");

    const route = await env.request(`/v2/fx/routes/${quoted.json.routeId}`);
    assert.equal(route.json.state, "RESERVED");
  } finally {
    await env.close();
  }
});

test("accepted execution commits route before adapter and remains reconciliation-driven", async () => {
  const adapter = {
    async submit(_privateQuote, { submissionRef }) {
      assert.match(submissionRef, /^submit_/);
      return { status: "ACCEPTED", externalRef: "0xtxhash" };
    },
  };
  const env = await setup({ adapter });
  try {
    await env.request("/v2/fx/orders", { method: "POST", body: order(3) });
    const quoted = await env.request("/v2/fx/quotes", {
      method: "POST",
      body: { inputAsset: INPUT, outputAsset: OUTPUT, exactOutput: "100" },
    });
    const execution = await env.request(
      `/v2/fx/quotes/${quoted.json.id}/execute`,
      { method: "POST" },
    );
    assert.equal(execution.response.status, 202);
    assert.equal(execution.json.state, "SUBMITTED");
    assert.equal(execution.json.execution.status, "ACCEPTED");
    assert.equal(execution.json.execution.externalRef, "0xtxhash");

    const route = await env.request(`/v2/fx/routes/${quoted.json.routeId}`);
    assert.equal(route.json.state, "SUBMITTED");
  } finally {
    await env.close();
  }
});

test("ambiguous adapter failure leaves route submitted for reconciliation instead of releasing liquidity", async () => {
  const adapter = {
    async submit() {
      throw new Error("network connection lost after send");
    },
  };
  const env = await setup({ adapter });
  try {
    await env.request("/v2/fx/orders", { method: "POST", body: order(4) });
    const quoted = await env.request("/v2/fx/quotes", {
      method: "POST",
      body: { inputAsset: INPUT, outputAsset: OUTPUT, exactOutput: "100" },
    });
    const execution = await env.request(
      `/v2/fx/quotes/${quoted.json.id}/execute`,
      { method: "POST" },
    );
    assert.equal(execution.response.status, 202);
    assert.equal(execution.json.execution.status, "UNKNOWN");

    const route = await env.request(`/v2/fx/routes/${quoted.json.routeId}`);
    assert.equal(route.json.state, "SUBMITTED");
    assert.throws(
      () => env.market.releaseRoute(quoted.json.routeId),
      /submitted route cannot be released/,
    );
  } finally {
    await env.close();
  }
});

test("fiat intent lifecycle is exposed without pretending submission equals settlement", async () => {
  const env = await setup();
  try {
    const intent = {
      intentId: "fiat-node-1",
      routeId: "mixed-route",
      edgeId: "fiat-edge",
      edgeType: "VERIFIED_FIAT_PAYMENT",
      finalityClass: "ATTESTED_EXTERNAL",
      payerParticipantId: "payer",
      payeeParticipantId: "payee",
      payerAccountRef: "payer:bank",
      payeeAccountRef: "payee:bank",
      currency: "MYR",
      amount: "10000",
      rail: "DUITNOW",
      providerId: "provider",
      policyAuthorizationId: "auth-fiat",
      createdAt: NOW,
      expiresAt: NOW + 60_000,
      nonce: "1",
    };
    const created = await env.request("/v2/fx/fiat/intents", {
      method: "POST",
      body: intent,
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.json.state, "CREATED");

    const reserved = await env.request(
      "/v2/fx/fiat/intents/fiat-node-1/reserve",
      { method: "POST" },
    );
    assert.equal(reserved.json.state, "RESERVED");
    const submitted = await env.request(
      "/v2/fx/fiat/intents/fiat-node-1/submit",
      {
        method: "POST",
        body: { submissionRef: "bank-transfer-1" },
      },
    );
    assert.equal(submitted.response.status, 202);
    assert.equal(submitted.json.state, "SUBMITTED");
    assert.equal(submitted.json.settledAt, null);
  } finally {
    await env.close();
  }
});
