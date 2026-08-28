import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SqliteFxMarket } from "../src/index.js";

const INPUT = "0x0000000000000000000000000000000000000011";
const OUTPUT = "0x0000000000000000000000000000000000000022";
const MAKER_A = "0x00000000000000000000000000000000000000a1";
const MAKER_B = "0x00000000000000000000000000000000000000b2";
const MAKER_C = "0x00000000000000000000000000000000000000c3";
const POLICY_HASH = `0x${"44".repeat(32)}`;

function hash(n) {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function salt(n) {
  return `0x${(10_000 + n).toString(16).padStart(64, "0")}`;
}

function makeAdmission({
  id,
  maker = MAKER_A,
  sellAmount = "100",
  buyAmount = "200",
  validAfter = 0,
  validUntil = 4_000_000_000,
  signature = "0x01",
  policyAuthorizationId = `policy-${id}`,
} = {}) {
  return {
    orderHash: hash(id),
    signature,
    policyAuthorizationId,
    policySnapshotHash: POLICY_HASH,
    order: {
      maker,
      sellToken: OUTPUT,
      buyToken: INPUT,
      sellAmount,
      buyAmount,
      recipient: maker,
      validAfter,
      validUntil,
      epoch: 1,
      salt: salt(id),
    },
  };
}

function market({
  now = () => 1_000_000,
  signatureVerifier,
  policyAuthorizer,
  path,
} = {}) {
  return new SqliteFxMarket({
    path,
    now,
    signatureVerifier: signatureVerifier ?? (async () => true),
    policyAuthorizer: policyAuthorizer ?? (async () => ({ eligible: true })),
  });
}

async function admitMany(book, admissions) {
  for (const admission of admissions) await book.admitOrder(admission);
}

function confirmationFromRoute(route) {
  return route.fills.map((fill) => ({
    orderHash: fill.orderHash,
    makerSellAmount: fill.makerSellAmount,
    takerPayAmount: fill.expectedTakerPay,
  }));
}

test("admission is compliance and signature gated", async () => {
  const rejectedSignature = market({ signatureVerifier: async () => false });
  await assert.rejects(
    () => rejectedSignature.admitOrder(makeAdmission({ id: 1 })),
    /signature rejected/,
  );
  rejectedSignature.close();

  const rejectedPolicy = market({
    policyAuthorizer: async () => ({ eligible: false, reason: "KYB expired" }),
  });
  await assert.rejects(
    () => rejectedPolicy.admitOrder(makeAdmission({ id: 2 })),
    /KYB expired/,
  );
  rejectedPolicy.close();
});

test("admission is idempotent but hash collision with different payload is rejected", async () => {
  const book = market();
  const first = makeAdmission({ id: 3 });
  const admitted = await book.admitOrder(first);
  const again = await book.admitOrder(first);
  assert.equal(again.sequence, admitted.sequence);

  const collision = makeAdmission({ id: 3, buyAmount: "201" });
  await assert.rejects(() => book.admitOrder(collision), /different payload/);
  book.close();
});

test("best price wins even when admitted later", async () => {
  const book = market();
  await book.admitOrder(
    makeAdmission({ id: 10, maker: MAKER_A, buyAmount: "200" }),
  );
  await book.admitOrder(
    makeAdmission({ id: 11, maker: MAKER_B, buyAmount: "190" }),
  );

  const route = book.reserveExactOutput({
    routeId: "best-price",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "100",
    expiresAt: 2_000_000,
  });

  assert.equal(route.fills.length, 1);
  assert.equal(route.fills[0].orderHash, hash(11));
  assert.equal(route.totalInput, "190");
  book.close();
});

test("equal economic price uses admission sequence before hash", async () => {
  const book = market();
  await book.admitOrder(
    makeAdmission({
      id: 21,
      maker: MAKER_A,
      sellAmount: "50",
      buyAmount: "100",
    }),
  );
  await book.admitOrder(
    makeAdmission({
      id: 20,
      maker: MAKER_B,
      sellAmount: "100",
      buyAmount: "200",
    }),
  );

  const route = book.reserveExactOutput({
    routeId: "time-priority",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "50",
    expiresAt: 2_000_000,
  });

  assert.equal(route.fills[0].orderHash, hash(21));
  book.close();
});

test("route can span multiple makers and reproduces exact signed payloads", async () => {
  const book = market();
  const a = makeAdmission({
    id: 30,
    maker: MAKER_A,
    sellAmount: "40",
    buyAmount: "80",
  });
  const b = makeAdmission({
    id: 31,
    maker: MAKER_B,
    sellAmount: "60",
    buyAmount: "114",
  });
  await admitMany(book, [a, b]);

  const route = book.reserveExactOutput({
    routeId: "multi",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "100",
    expiresAt: 2_000_000,
  });

  assert.equal(route.fills.length, 2);
  assert.equal(route.totalInput, "194");
  assert.deepEqual(route.fills[0].order, b.order);
  assert.equal(route.fills[0].signature, b.signature);
  assert.deepEqual(route.fills[1].order, a.order);
  assert.equal(route.fills[1].signature, a.signature);
  book.close();
});

test("insufficient liquidity rolls back all provisional reservations", async () => {
  const book = market();
  await admitMany(book, [
    makeAdmission({
      id: 40,
      maker: MAKER_A,
      sellAmount: "40",
      buyAmount: "80",
    }),
    makeAdmission({
      id: 41,
      maker: MAKER_B,
      sellAmount: "60",
      buyAmount: "120",
    }),
  ]);

  assert.throws(
    () =>
      book.reserveExactOutput({
        routeId: "too-large",
        inputToken: INPUT,
        outputToken: OUTPUT,
        desiredOutput: "101",
        expiresAt: 2_000_000,
      }),
    /insufficient eligible liquidity/,
  );

  assert.equal(book.getOrder(hash(40)).reservedSell, "0");
  assert.equal(book.getOrder(hash(41)).reservedSell, "0");
  assert.equal(book.getOrder(hash(40)).state, "OPEN");
  assert.equal(book.getOrder(hash(41)).state, "OPEN");
  book.close();
});

test("same maker order cannot be promised to two routes concurrently", async () => {
  const book = market();
  await book.admitOrder(
    makeAdmission({
      id: 50,
      maker: MAKER_A,
      sellAmount: "100",
      buyAmount: "200",
    }),
  );

  book.reserveExactOutput({
    routeId: "route-one",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "60",
    expiresAt: 2_000_000,
  });

  assert.throws(
    () =>
      book.reserveExactOutput({
        routeId: "route-two",
        inputToken: INPUT,
        outputToken: OUTPUT,
        desiredOutput: "1",
        expiresAt: 2_000_000,
      }),
    /insufficient eligible liquidity/,
  );
  book.close();
});

test("release and expiry restore liquidity exactly once", async () => {
  let now = 1_000_000;
  const book = market({ now: () => now });
  await book.admitOrder(makeAdmission({ id: 60 }));

  book.reserveExactOutput({
    routeId: "release-me",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "50",
    expiresAt: 1_100_000,
  });
  assert.equal(book.releaseRoute("release-me"), 1);
  assert.equal(book.releaseRoute("release-me"), 0);
  assert.equal(book.getOrder(hash(60)).reservedSell, "0");

  book.reserveExactOutput({
    routeId: "expire-me",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "50",
    expiresAt: 1_100_000,
  });
  now = 1_100_001;
  assert.equal(book.expireReservations(), 1);
  assert.equal(book.expireReservations(), 0);
  assert.equal(book.getOrder(hash(60)).state, "OPEN");
  book.close();
});

test("policy revocation immediately releases and removes liquidity", async () => {
  const book = market();
  await book.admitOrder(makeAdmission({ id: 70 }));
  book.reserveExactOutput({
    routeId: "policy-route",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "50",
    expiresAt: 2_000_000,
  });

  assert.equal(book.blockPolicy(hash(70), "sanctions refresh"), 1);
  assert.equal(book.getOrder(hash(70)).state, "POLICY_BLOCKED");
  assert.equal(book.getOrder(hash(70)).reservedSell, "0");
  assert.throws(
    () =>
      book.reserveExactOutput({
        routeId: "blocked-route",
        inputToken: INPUT,
        outputToken: OUTPUT,
        desiredOutput: "1",
        expiresAt: 2_000_000,
      }),
    /insufficient eligible liquidity/,
  );
  book.close();
});

test("off-chain cancellation is distinct from durable on-chain invalidation", async () => {
  const book = market();
  await book.admitOrder(makeAdmission({ id: 80 }));
  book.cancelOffchain(hash(80));
  let order = book.getOrder(hash(80));
  assert.equal(order.offChainHidden, true);
  assert.equal(order.onChainInvalidated, false);

  book.markOnChainInvalidated(hash(80));
  order = book.getOrder(hash(80));
  assert.equal(order.onChainInvalidated, true);
  assert.equal(order.state, "CANCELLED");
  book.close();
});

test("confirmed chain fills are exact and duplicate events are idempotent", async () => {
  const book = market();
  await book.admitOrder(
    makeAdmission({ id: 90, sellAmount: "100", buyAmount: "200" }),
  );
  const route = book.reserveExactOutput({
    routeId: "confirm-route",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "40",
    expiresAt: 2_000_000,
  });
  const fills = confirmationFromRoute(route);

  assert.deepEqual(
    book.confirmRoute({
      routeId: "confirm-route",
      eventId: "tx:1:log:0",
      fills,
    }),
    {
      duplicate: false,
    },
  );
  const after = book.getOrder(hash(90));
  assert.equal(after.confirmedFilledSell, "40");
  assert.equal(after.confirmedFilledBuy, "80");
  assert.equal(after.state, "PARTIALLY_FILLED");

  assert.deepEqual(
    book.confirmRoute({
      routeId: "confirm-route",
      eventId: "tx:1:log:0",
      fills,
    }),
    {
      duplicate: true,
    },
  );
  assert.equal(book.getOrder(hash(90)).confirmedFilledSell, "40");
  book.close();
});

test("failed settlement releases reservation without inventing a fill", async () => {
  const book = market();
  await book.admitOrder(makeAdmission({ id: 100 }));
  book.reserveExactOutput({
    routeId: "failed-route",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "30",
    expiresAt: 2_000_000,
  });

  const result = book.failRoute({
    routeId: "failed-route",
    eventId: "failed:1",
  });
  assert.equal(result.released, 1);
  const after = book.getOrder(hash(100));
  assert.equal(after.confirmedFilledSell, "0");
  assert.equal(after.reservedSell, "0");
  assert.equal(after.state, "OPEN");
  book.close();
});

test("market state survives process restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blueballs-fx-market-"));
  const dbPath = join(dir, "market.sqlite");
  try {
    const first = market({ path: dbPath });
    await first.admitOrder(makeAdmission({ id: 110, maker: MAKER_C }));
    first.close();

    const second = market({ path: dbPath });
    const restored = second.getOrder(hash(110));
    assert.equal(restored.order.maker, MAKER_C);
    assert.equal(restored.state, "OPEN");
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("maker-private lookup never returns another maker order", async () => {
  const book = market();
  await admitMany(book, [
    makeAdmission({ id: 120, maker: MAKER_A }),
    makeAdmission({ id: 121, maker: MAKER_B }),
  ]);

  const own = book.listOrdersForMaker(MAKER_A);
  assert.equal(own.length, 1);
  assert.equal(own[0].orderHash, hash(120));
  assert.equal(own[0].order.maker, MAKER_A);
  book.close();
});

test("aggregate depth combines equivalent prices and leaks no maker identity or signed payload", async () => {
  const book = market();
  await admitMany(book, [
    makeAdmission({
      id: 130,
      maker: MAKER_A,
      sellAmount: "50",
      buyAmount: "100",
    }),
    makeAdmission({
      id: 131,
      maker: MAKER_B,
      sellAmount: "100",
      buyAmount: "200",
    }),
  ]);

  const depth = book.aggregateDepth({ inputToken: INPUT, outputToken: OUTPUT });
  assert.equal(depth.length, 1);
  assert.equal(depth[0].buyAmount, "2");
  assert.equal(depth[0].sellAmount, "1");
  assert.equal(depth[0].availableSell, "150");
  assert.equal("maker" in depth[0], false);
  assert.equal("orderHash" in depth[0], false);
  assert.equal("signature" in depth[0], false);
  book.close();
});
