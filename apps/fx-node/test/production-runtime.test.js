import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadProductionRuntime,
  validateProductionRuntime,
} from "../src/production-runtime.js";

const validRuntime = () => ({
  market: {
    aggregateDepth() {},
    admitOrder() {},
    listOrdersForMaker() {},
    cancelOrderOffchain() {},
    getRoute() {},
  },
  quotes: {
    reserveExactOutput() {},
    getQuote() {},
    getPrivateQuote() {},
    markSubmitted() {},
    confirm() {},
    fail() {},
  },
  fiat: {
    createIntent() {},
    getIntent() {},
    reserveIntent() {},
    submitIntent() {},
    acceptAttestation() {},
    settleVerifiedIntent() {},
  },
  executionAdapter: { submit() {} },
  close() {},
  publicDepth: false,
});

test("production runtime contract accepts the complete provider composition", () => {
  assert.equal(validateProductionRuntime(validRuntime()).publicDepth, false);
});

test("production runtime contract requires an execution adapter", () => {
  const runtime = validRuntime();
  delete runtime.executionAdapter;
  assert.throws(
    () => validateProductionRuntime(runtime),
    /executionAdapter must expose submit/,
  );
});

test("production runtime loader resolves deployment adapter modules", async () => {
  const runtime = await loadProductionRuntime({
    env: {
      FX_NODE_PRODUCTION_ADAPTER: "./test/fixtures/production-adapter.mjs",
    },
    cwd: new URL("..", import.meta.url).pathname,
  });
  assert.equal(typeof runtime.executionAdapter.submit, "function");
  assert.equal(runtime.publicDepth, false);
});

test("production runtime loader requires a deployment adapter", async () => {
  await assert.rejects(
    () => loadProductionRuntime({ env: {} }),
    /FX_NODE_PRODUCTION_ADAPTER/,
  );
});
