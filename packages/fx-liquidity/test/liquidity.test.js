import test from "node:test";
import assert from "node:assert/strict";

import { planExactOutput, reservePlan } from "../src/index.js";

const NOW = 1_000_000;

function slice({
  sourceType = "INSTITUTIONAL_LP",
  sourceId,
  sliceId,
  priceNum,
  priceDen = "1",
  maxOutput = "100",
  expiresAt = NOW + 10_000,
  policyAuthorizationId = "auth",
}) {
  return {
    sourceType,
    sourceId,
    sliceId,
    inputAsset: "USD",
    outputAsset: "EUR",
    inputNumerator: String(priceNum),
    inputDenominator: String(priceDen),
    maxOutput: String(maxOutput),
    expiresAt,
    policyAuthorizationId,
  };
}

test("planner chooses cheapest executable liquidity regardless of source class", () => {
  const plan = planExactOutput({
    inputAsset: "USD",
    outputAsset: "EUR",
    desiredOutput: "100",
    now: NOW,
    slices: [
      slice({
        sourceType: "BANK_PRINCIPAL",
        sourceId: "bank",
        sliceId: "b",
        priceNum: "205",
        priceDen: "100",
        maxOutput: "100",
      }),
      slice({
        sourceType: "PRIVATE_MARKET",
        sourceId: "maker",
        sliceId: "m",
        priceNum: "200",
        priceDen: "100",
        maxOutput: "40",
      }),
      slice({
        sourceType: "ISSUER",
        sourceId: "issuer",
        sliceId: "i",
        priceNum: "202",
        priceDen: "100",
        maxOutput: "60",
      }),
    ],
  });
  assert.deepEqual(
    plan.legs.map((x) => x.sourceType),
    ["PRIVATE_MARKET", "ISSUER"],
  );
  assert.equal(plan.totalInput, "202");
  assert.equal(plan.totalOutput, "100");
});

test("planner skips unauthorized expired and wrong-pair slices", () => {
  const good = slice({
    sourceId: "good",
    sliceId: "g",
    priceNum: "2",
    maxOutput: "100",
  });
  const plan = planExactOutput({
    inputAsset: "USD",
    outputAsset: "EUR",
    desiredOutput: "100",
    now: NOW,
    slices: [
      { ...good, sourceId: "unauth", sliceId: "u", policyAuthorizationId: "" },
      { ...good, sourceId: "expired", sliceId: "e", expiresAt: NOW },
      { ...good, sourceId: "wrong", sliceId: "w", inputAsset: "SGD" },
      good,
    ],
  });
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0].sourceId, "good");
});

test("equal prices use deterministic source and slice tie-breaks", () => {
  const plan = planExactOutput({
    inputAsset: "USD",
    outputAsset: "EUR",
    desiredOutput: "3",
    now: NOW,
    slices: [
      slice({ sourceId: "z", sliceId: "1", priceNum: "2", maxOutput: "1" }),
      slice({ sourceId: "a", sliceId: "2", priceNum: "2", maxOutput: "1" }),
      slice({ sourceId: "a", sliceId: "1", priceNum: "2", maxOutput: "1" }),
    ],
  });
  assert.deepEqual(
    plan.legs.map((x) => `${x.sourceId}:${x.sliceId}`),
    ["a:1", "a:2", "z:1"],
  );
});

test("insufficient executable capacity fails without a partial route", () => {
  assert.throws(
    () =>
      planExactOutput({
        inputAsset: "USD",
        outputAsset: "EUR",
        desiredOutput: "101",
        now: NOW,
        slices: [
          slice({
            sourceId: "a",
            sliceId: "1",
            priceNum: "2",
            maxOutput: "100",
          }),
        ],
      }),
    (error) => error.code === "NO_LIQUIDITY" && error.missingOutput === "1",
  );
});

test("reservation failure compensates every earlier source in reverse order", async () => {
  const events = [];
  const adapters = {
    PRIVATE_MARKET: {
      reserve: async () => {
        events.push("reserve-market");
        return { reservationHandle: "rm" };
      },
      release: async () => {
        events.push("release-market");
      },
    },
    ISSUER: {
      reserve: async () => {
        events.push("reserve-issuer");
        return { reservationHandle: "ri" };
      },
      release: async () => {
        events.push("release-issuer");
      },
    },
    BANK_PRINCIPAL: {
      reserve: async () => {
        events.push("reserve-bank");
        throw new Error("bank risk changed");
      },
      release: async () => {
        events.push("release-bank");
      },
    },
  };
  const plan = {
    inputAsset: "USD",
    outputAsset: "EUR",
    totalInput: "100",
    totalOutput: "100",
    legs: [
      { sourceType: "PRIVATE_MARKET", sourceId: "m", sliceId: "m1" },
      { sourceType: "ISSUER", sourceId: "i", sliceId: "i1" },
      { sourceType: "BANK_PRINCIPAL", sourceId: "b", sliceId: "b1" },
    ],
  };
  await assert.rejects(
    () => reservePlan({ routeId: "r1", plan, adapters }),
    /bank risk changed/,
  );
  assert.deepEqual(events, [
    "reserve-market",
    "reserve-issuer",
    "reserve-bank",
    "release-issuer",
    "release-market",
  ]);
});

test("successful reservation returns source-specific handles for reconciliation", async () => {
  const adapter = (prefix) => ({
    reserve: async ({ index }) => ({ reservationHandle: `${prefix}-${index}` }),
    release: async () => undefined,
  });
  const plan = {
    inputAsset: "USD",
    outputAsset: "EUR",
    totalInput: "200",
    totalOutput: "100",
    legs: [
      { sourceType: "PRIVATE_MARKET", sourceId: "m", sliceId: "m1" },
      { sourceType: "BANK_PRINCIPAL", sourceId: "b", sliceId: "b1" },
    ],
  };
  const route = await reservePlan({
    routeId: "r1",
    plan,
    adapters: {
      PRIVATE_MARKET: adapter("market"),
      BANK_PRINCIPAL: adapter("bank"),
    },
  });
  assert.deepEqual(
    route.legs.map((x) => x.reservationHandle),
    ["market-0", "bank-1"],
  );
});
