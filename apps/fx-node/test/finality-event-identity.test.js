import assert from "node:assert/strict";
import test from "node:test";

import { IntegratedQuoteCoordinator } from "../src/integrated-quote-coordinator.js";

const INPUT = "asset:input";
const OUTPUT = "asset:output";
const NOW = 1_000_000;

function buildCoordinator({ failConfirmOnce = false } = {}) {
  let shouldFail = failConfirmOnce;
  const confirmCalls = [];
  const failCalls = [];
  let reservation = 0;
  const privateAdapter = {
    listSlices() {
      return [
        {
          sourceType: "PRIVATE_MARKET",
          sourceId: "maker",
          sliceId: "slice",
          inputAsset: INPUT,
          outputAsset: OUTPUT,
          maxOutput: "100",
          inputNumerator: "1",
          inputDenominator: "1",
          policyAuthorizationId: "maker-auth",
          expiresAt: NOW + 60_000,
        },
      ];
    },
    async reserve() {
      reservation += 1;
      return { reservationHandle: `reservation-${reservation}` };
    },
    async release() {},
    validateReserved() {},
    markSubmitted() {},
    confirm(args) {
      confirmCalls.push(args);
      if (shouldFail) {
        shouldFail = false;
        throw new Error("simulated reconciliation interruption");
      }
      return { duplicate: false };
    },
    fail(args) {
      failCalls.push(args);
      return { duplicate: false };
    },
  };
  const coordinator = new IntegratedQuoteCoordinator({
    market: { getRoute() {} },
    policyEngine: {
      authorize() {
        return {
          eligible: true,
          authorizationId: "customer-auth",
          expiresAt: NOW + 60_000,
          policyId: "policy",
          policyVersion: 1,
        };
      },
    },
    privateAdapter,
    referenceBook: { listSlices: () => [] },
    staticAdapter: { reserve() {}, release() {} },
    principalAdapter: { listSlices: () => [], reserve() {}, release() {} },
    assetFor: (asset) => ({ id: asset, symbol: asset }),
    now: () => NOW,
  });
  return { coordinator, confirmCalls, failCalls };
}

async function submittedQuote(coordinator, suffix) {
  const quote = await coordinator.reserveExactOutput({
    inputAsset: INPUT,
    outputAsset: OUTPUT,
    exactOutput: "10",
    expiresInMs: 30_000,
  });
  coordinator.markSubmitted(quote.id, `submission-${suffix}`);
  return quote;
}

test("one finality event cannot settle two integrated quotes or opposite outcomes", async () => {
  const { coordinator } = buildCoordinator();
  try {
    const first = await submittedQuote(coordinator, "first");
    const second = await submittedQuote(coordinator, "second");

    const confirmed = coordinator.confirm(first.id, { eventId: "external-event-1" });
    assert.equal(confirmed.quote.state, "CONFIRMED");

    assert.throws(
      () => coordinator.confirm(second.id, { eventId: "external-event-1" }),
      (error) => error.code === "FINALITY_EVENT_COLLISION" && error.status === 409,
    );
    assert.equal(coordinator.getQuote(second.id).state, "SUBMITTED");

    assert.throws(
      () =>
        coordinator.fail(second.id, {
          eventId: "external-event-1",
          reason: "provider-reverted",
        }),
      (error) => error.code === "FINALITY_EVENT_COLLISION" && error.status === 409,
    );
    assert.equal(coordinator.getQuote(second.id).state, "SUBMITTED");
  } finally {
    coordinator.close();
  }
});

test("partial confirmation binds the event so only the same evidence can finish retry", async () => {
  const { coordinator, confirmCalls } = buildCoordinator({ failConfirmOnce: true });
  try {
    const quote = await submittedQuote(coordinator, "partial");

    assert.throws(
      () => coordinator.confirm(quote.id, { eventId: "external-event-partial" }),
      /simulated reconciliation interruption/,
    );
    assert.equal(coordinator.getQuote(quote.id).state, "SUBMITTED");

    assert.throws(
      () => coordinator.confirm(quote.id, { eventId: "different-event" }),
      (error) => error.code === "FINALITY_EVENT_COLLISION",
    );

    const retried = coordinator.confirm(quote.id, {
      eventId: "external-event-partial",
    });
    assert.equal(retried.quote.state, "CONFIRMED");
    assert.equal(confirmCalls.length, 2);
    assert.equal(
      coordinator.confirm(quote.id, { eventId: "external-event-partial" }).duplicate,
      true,
    );
  } finally {
    coordinator.close();
  }
});
