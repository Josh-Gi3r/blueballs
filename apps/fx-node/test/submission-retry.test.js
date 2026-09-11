import assert from "node:assert/strict";
import test from "node:test";

import { IntegratedQuoteCoordinator } from "../src/integrated-quote-coordinator.js";

const INPUT = "asset:input";
const OUTPUT = "asset:output";
const NOW = 1_000_000;

function slice(id, maxOutput = "5") {
  return {
    sourceType: "PRIVATE_MARKET",
    sourceId: `maker-${id}`,
    sliceId: `slice-${id}`,
    inputAsset: INPUT,
    outputAsset: OUTPUT,
    maxOutput,
    inputNumerator: "1",
    inputDenominator: "1",
    policyAuthorizationId: `auth-${id}`,
    expiresAt: NOW + 60_000,
  };
}

test("same submission reference completes source hooks left partial by a crash", async () => {
  const submittedCalls = new Map();
  let failSecondOnce = true;
  const privateAdapter = {
    listSlices() {
      return [slice("a"), slice("b")];
    },
    async reserve({ leg }) {
      return { reservationHandle: `reserved:${leg.sliceId}` };
    },
    async release() {},
    validateReserved() {},
    markSubmitted({ reservationHandle, submissionRef }) {
      submittedCalls.set(
        reservationHandle,
        (submittedCalls.get(reservationHandle) ?? 0) + 1,
      );
      if (reservationHandle === "reserved:slice-b" && failSecondOnce) {
        failSecondOnce = false;
        throw new Error("simulated process failure between source submissions");
      }
      return { reservationHandle, submissionRef };
    },
  };
  const unusedStaticAdapter = {
    async reserve() {
      throw new Error("unexpected static reservation");
    },
    async release() {},
  };
  const principalAdapter = {
    listSlices() {
      return [];
    },
    async reserve() {
      throw new Error("unexpected principal reservation");
    },
    async release() {},
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
      verifyAuthorization() {
        return { valid: true, authorizationId: "customer-auth" };
      },
    },
    privateAdapter,
    referenceBook: { listSlices: () => [] },
    staticAdapter: unusedStaticAdapter,
    principalAdapter,
    assetFor: (asset) => ({ id: asset, symbol: asset }),
    now: () => NOW,
  });

  try {
    const quote = await coordinator.reserveExactOutput({
      inputAsset: INPUT,
      outputAsset: OUTPUT,
      exactOutput: "10",
      expiresInMs: 30_000,
    });
    assert.equal(quote.sources.length, 2);

    assert.throws(
      () => coordinator.markSubmitted(quote.id, "submission-1"),
      /simulated process failure/,
    );
    assert.equal(coordinator.getQuote(quote.id).state, "SUBMITTED");

    const retried = coordinator.markSubmitted(quote.id, "submission-1");
    assert.equal(retried.state, "SUBMITTED");
    assert.equal(retried.submissionRef, "submission-1");
    assert.equal(submittedCalls.get("reserved:slice-a"), 2);
    assert.equal(submittedCalls.get("reserved:slice-b"), 2);

    assert.throws(
      () => coordinator.markSubmitted(quote.id, "different-submission"),
      /cannot execute from SUBMITTED/,
    );
  } finally {
    coordinator.close();
  }
});
