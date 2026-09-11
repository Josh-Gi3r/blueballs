import assert from "node:assert/strict";
import test from "node:test";

import { IntegratedQuoteCoordinator } from "../src/integrated-quote-coordinator.js";

const INPUT = "asset:input";
const OUTPUT = "asset:output";
const NOW = 1_000_000;

test("customer policy invalidation after reservation blocks submission before source hooks", async () => {
  let authorizationValid = true;
  let validateCalls = 0;
  let submitCalls = 0;
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
      return { reservationHandle: "reservation-1" };
    },
    async release() {},
    validateReserved() {
      validateCalls += 1;
    },
    markSubmitted() {
      submitCalls += 1;
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
      verifyAuthorization(authorizationId) {
        assert.equal(authorizationId, "customer-auth");
        return authorizationValid
          ? { valid: true, authorizationId }
          : { valid: false, reason: "PARTICIPANT_CHANGED" };
      },
    },
    privateAdapter,
    referenceBook: { listSlices: () => [] },
    staticAdapter: { reserve() {}, release() {} },
    principalAdapter: { listSlices: () => [], reserve() {}, release() {} },
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
    authorizationValid = false;

    assert.throws(
      () => coordinator.markSubmitted(quote.id, "submission-blocked"),
      (error) =>
        error.code === "POLICY_AUTHORIZATION_INVALID" &&
        error.status === 403 &&
        error.details?.reason === "PARTICIPANT_CHANGED",
    );
    assert.equal(coordinator.getQuote(quote.id).state, "RESERVED");
    assert.equal(validateCalls, 0);
    assert.equal(submitCalls, 0);

    authorizationValid = true;
    const submitted = coordinator.markSubmitted(quote.id, "submission-approved");
    assert.equal(submitted.state, "SUBMITTED");
    assert.equal(validateCalls, 1);
    assert.equal(submitCalls, 1);
  } finally {
    coordinator.close();
  }
});
