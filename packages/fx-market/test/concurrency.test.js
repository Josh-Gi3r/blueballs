import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { SqliteFxMarket } from "../src/index.js";

const INPUT = "0x0000000000000000000000000000000000000011";
const OUTPUT = "0x0000000000000000000000000000000000000022";
const MAKER = "0x00000000000000000000000000000000000000a1";
const NOW = 1_000_000;

function admission() {
  return {
    orderHash: `0x${"11".repeat(32)}`,
    signature: "0x01",
    policyAuthorizationId: "policy-concurrency",
    policySnapshotHash: `0x${"22".repeat(32)}`,
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
      salt: `0x${"33".repeat(32)}`,
    },
  };
}

function startWorker(path, routeId) {
  const worker = new Worker(new URL("./reserve-worker.js", import.meta.url), {
    workerData: {
      path,
      routeId,
      inputToken: INPUT,
      outputToken: OUTPUT,
      desiredOutput: "60",
      expiresAt: 2_000_000,
      now: NOW,
    },
  });

  return new Promise((resolve, reject) => {
    let started = false;
    worker.on("message", (message) => {
      if (message.ready && !started) {
        started = true;
        worker.postMessage("go");
        return;
      }
      if ("ok" in message) resolve(message);
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`worker exited ${code}`));
    });
  });
}

test("two independent SQLite connections cannot double-reserve the same maker order", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blueballs-fx-concurrency-"));
  const path = join(dir, "market.sqlite");

  try {
    const seed = new SqliteFxMarket({
      path,
      signatureVerifier: async () => true,
      policyAuthorizer: async () => ({ eligible: true }),
      now: () => NOW,
    });
    await seed.admitOrder(admission());
    seed.close();

    const [a, b] = await Promise.all([
      startWorker(path, "route-a"),
      startWorker(path, "route-b"),
    ]);
    const results = [a, b];
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    assert.match(
      results.find((result) => !result.ok).error,
      /insufficient eligible liquidity/,
    );

    const inspect = new SqliteFxMarket({
      path,
      signatureVerifier: async () => true,
      policyAuthorizer: async () => ({ eligible: true }),
      now: () => NOW,
    });
    const stored = inspect.getOrder(admission().orderHash);
    assert.equal(stored.reservedSell, "60");
    assert.equal(stored.confirmedFilledSell, "0");
    inspect.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
