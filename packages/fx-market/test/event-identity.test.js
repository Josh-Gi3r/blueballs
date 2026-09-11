import assert from "node:assert/strict";
import test from "node:test";

import { FxMarketService } from "../src/index.js";

const INPUT = "0x0000000000000000000000000000000000000011";
const OUTPUT = "0x0000000000000000000000000000000000000022";
const MAKER = "0x00000000000000000000000000000000000000a1";
const POLICY_HASH = `0x${"55".repeat(32)}`;

function admission(id) {
  return {
    orderHash: `0x${id.toString(16).padStart(64, "0")}`,
    signature: "0x01",
    policyAuthorizationId: `policy-${id}`,
    policySnapshotHash: POLICY_HASH,
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
      salt: `0x${(50_000 + id).toString(16).padStart(64, "0")}`,
    },
  };
}

function service() {
  return new FxMarketService({
    now: () => 1_000_000,
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true }),
  });
}

function reserve(fx, routeId) {
  return fx.reserveExactOutput({
    routeId,
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "40",
    expiresAt: 2_000_000,
  });
}

const fills = (route) =>
  route.fills.map((fill) => ({
    orderHash: fill.orderHash,
    makerSellAmount: fill.makerSellAmount,
    takerPayAmount: fill.expectedTakerPay,
  }));

test("a failure event cannot be replayed as confirmation for another route", async () => {
  const fx = service();
  try {
    await fx.admitOrder(admission(1));
    const first = reserve(fx, "route-a");
    fx.markRouteSubmitted(first.routeId, "submission-a");
    fx.failSubmittedRoute({
      routeId: first.routeId,
      eventId: "shared-chain-event",
      reason: "REVERTED",
    });

    const second = reserve(fx, "route-b");
    fx.markRouteSubmitted(second.routeId, "submission-b");
    assert.throws(
      () =>
        fx.confirmSubmittedRoute({
          routeId: second.routeId,
          eventId: "shared-chain-event",
          fills: fills(second),
        }),
      (error) => error.code === "CHAIN_EVENT_COLLISION",
    );
    assert.equal(fx.getRoute(second.routeId).state, "SUBMITTED");
    assert.equal(fx.getOrder(admission(1).orderHash).reservedSell, "40");
  } finally {
    fx.close();
  }
});

test("a confirmation event cannot fail another route and same failure event remains idempotent", async () => {
  const fx = service();
  try {
    await fx.admitOrder(admission(2));
    await fx.admitOrder(admission(3));

    const first = reserve(fx, "route-confirmed");
    fx.markRouteSubmitted(first.routeId, "submission-confirmed");
    fx.confirmSubmittedRoute({
      routeId: first.routeId,
      eventId: "event-confirmed",
      fills: fills(first),
    });

    const second = reserve(fx, "route-pending");
    fx.markRouteSubmitted(second.routeId, "submission-pending");
    assert.throws(
      () =>
        fx.failSubmittedRoute({
          routeId: second.routeId,
          eventId: "event-confirmed",
          reason: "REVERTED",
        }),
      (error) => error.code === "CHAIN_EVENT_COLLISION",
    );
    assert.equal(fx.getRoute(second.routeId).state, "SUBMITTED");

    const failed = fx.failSubmittedRoute({
      routeId: second.routeId,
      eventId: "event-failed",
      reason: "REVERTED",
    });
    assert.equal(failed.duplicate, false);
    assert.deepEqual(
      fx.failSubmittedRoute({
        routeId: second.routeId,
        eventId: "event-failed",
        reason: "REVERTED",
      }),
      { duplicate: true, released: 0 },
    );
  } finally {
    fx.close();
  }
});
