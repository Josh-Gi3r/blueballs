import test from "node:test";
import assert from "node:assert/strict";

import { BlueballsFxClient, BlueballsFxError } from "../src/index.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("SDK sends authenticated firm quote request with exact string amount", async () => {
  let seen;
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788/",
    apiKey: "secret-key",
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return jsonResponse({ id: "quote-1", state: "RESERVED" }, 201);
    },
  });

  const quote = await client.quote({
    inputAsset: "USDC",
    outputAsset: "EURC",
    exactOutput: 100000000n,
    expiresInMs: 15_000,
  });
  assert.equal(quote.id, "quote-1");
  assert.equal(seen.url, "http://localhost:8788/v2/fx/quotes");
  assert.equal(seen.options.headers.authorization, "Bearer secret-key");
  assert.deepEqual(JSON.parse(seen.options.body), {
    inputAsset: "USDC",
    outputAsset: "EURC",
    exactOutput: "100000000",
    expiresInMs: 15_000,
  });
});

test("public reference inspection and preview work without an API key", async () => {
  const seen = [];
  const client = new BlueballsFxClient({
    baseUrl: "https://fx.example.test",
    fetchImpl: async (url, options) => {
      seen.push({ url, options });
      return jsonResponse({ status: "ok" });
    },
  });
  await client.health();
  await client.referenceStatus();
  await client.previewReferenceTrade({ inputAmount: "50000.00" });
  assert.equal(seen.every(({ options }) => !("authorization" in options.headers)), true);
  await assert.rejects(
    () => client.reserveReferenceTrade({ inputAmount: "50000.00" }),
    (error) =>
      error instanceof BlueballsFxError && error.code === "AUTH_REQUIRED" && error.status === 0,
  );
});

test("atomic amount inputs reject unsafe JavaScript numbers", async () => {
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async () => jsonResponse({}),
  });
  await assert.rejects(
    () =>
      client.quote({
        inputAsset: "USDC",
        outputAsset: "EURC",
        exactOutput: Number.MAX_SAFE_INTEGER + 1,
      }),
    /positive safe integer/,
  );
  await assert.rejects(
    () =>
      client.referenceLiquidity({
        inputAsset: "USDC",
        outputAsset: "EURC",
        exactOutput: "1.25",
      }),
    /positive integer/,
  );
});

test("SDK validates its transport base before sending secrets", () => {
  assert.throws(
    () =>
      new BlueballsFxClient({
        baseUrl: "https://user:pass@example.test/path",
        apiKey: "secret-key",
        fetchImpl: async () => jsonResponse({}),
      }),
    /must not contain credentials/,
  );
  assert.throws(
    () =>
      new BlueballsFxClient({
        baseUrl: "file:///tmp/fx.sock",
        apiKey: "secret-key",
        fetchImpl: async () => jsonResponse({}),
      }),
    /HTTP or HTTPS/,
  );
});

test("health request is intentionally unauthenticated", async () => {
  let headers;
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return jsonResponse({ status: "ok" });
    },
  });
  await client.health();
  assert.equal("authorization" in headers, false);
});

test("SDK preserves machine-readable node errors", async () => {
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "bad-key",
    fetchImpl: async () =>
      jsonResponse(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "valid API key required",
            details: { scope: "fx" },
          },
        },
        401,
      ),
  });

  await assert.rejects(
    () => client.getQuote("missing"),
    (error) => {
      assert.ok(error instanceof BlueballsFxError);
      assert.equal(error.code, "AUTH_REQUIRED");
      assert.equal(error.status, 401);
      assert.deepEqual(error.details, { scope: "fx" });
      return true;
    },
  );
});

test("SDK normalizes network and protocol failures into structured errors", async () => {
  const network = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async () => {
      throw new Error("socket closed");
    },
  });
  await assert.rejects(
    () => network.getQuote("q1"),
    (error) =>
      error instanceof BlueballsFxError &&
      error.code === "NETWORK_ERROR" &&
      error.status === 0,
  );

  const protocol = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async () => new Response("gateway html", { status: 502 }),
  });
  await assert.rejects(
    () => protocol.getQuote("q1"),
    (error) =>
      error instanceof BlueballsFxError &&
      error.code === "PROTOCOL_ERROR" &&
      error.status === 502,
  );
});

test("SDK encodes resource identifiers and query values", async () => {
  const urls = [];
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse({ object: "list", data: [] });
    },
  });
  await client.listOrders("0x maker/value");
  assert.equal(
    urls[0],
    "http://localhost:8788/v2/fx/orders?maker=0x%20maker%2Fvalue",
  );
});

test("SDK exposes the connected public reference trade and scenario API", async () => {
  const requests = [];
  const client = new BlueballsFxClient({
    baseUrl: "http://localhost:8788",
    apiKey: "secret-key",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/preview"))
        return jsonResponse({ object: "fx_trade_preview", state: "PREVIEW" });
      if (url.endsWith("/scenario"))
        return jsonResponse({ id: "issuer_policy_blocked" });
      if (options.method === "DELETE")
        return jsonResponse({ object: "fx_trade", state: "RELEASED" });
      return jsonResponse(
        { object: "fx_trade", id: "trade_1", state: "RESERVED" },
        201,
      );
    },
  });

  await client.previewReferenceTrade({ inputAmount: "50000.00" });
  await client.reserveReferenceTrade({
    inputAmount: "50000.00",
    expiresInMs: 30_000,
  });
  await client.applyReferenceScenario("issuer_policy_blocked");
  await client.releaseReferenceTrade("trade/1");

  assert.equal(
    requests[0].url,
    "http://localhost:8788/v2/fx/reference/trades/preview",
  );
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    inputAmount: "50000.00",
  });
  assert.equal(requests[1].url, "http://localhost:8788/v2/fx/reference/trades");
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    id: "issuer_policy_blocked",
  });
  assert.equal(
    requests[3].url,
    "http://localhost:8788/v2/fx/reference/trades/trade%2F1",
  );
  assert.equal(requests[3].options.method, "DELETE");
});
