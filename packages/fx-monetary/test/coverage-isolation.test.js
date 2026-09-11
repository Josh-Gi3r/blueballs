import assert from "node:assert/strict";
import test from "node:test";

import { INSTRUMENT_KINDS, MonetaryEngine } from "../src/index.js";

function overcollateralized() {
  const engine = new MonetaryEngine({ now: () => 1_000 });
  engine.configureInstrument({
    code: "USDX",
    name: "Overcollateralized USD instrument",
    kind: INSTRUMENT_KINDS.STABLECOIN,
    reserveCurrency: "USD",
    decimals: 6,
    minCoverageBps: 15_000,
  });
  return engine;
}

test("settlement receipts can use only reserve above exact minimum coverage", () => {
  const engine = overcollateralized();
  try {
    const deposit = engine.createReserveDeposit({
      reserveCurrency: "USD",
      amount: "160",
      providerRef: "bank:coverage-receipt",
    });
    engine.settleReserveDeposit(deposit.depositId);
    engine.mint({
      instrumentCode: "USDX",
      amount: "100",
      beneficiaryRef: "wallet:holder",
    });

    const health = engine.health().reserves[0];
    assert.equal(health.settledReserve, "160");
    assert.equal(health.requiredCoverageReserve, "150");
    assert.equal(health.unallocatedReserve, "10");

    const receipt = engine.createReceipt({
      reserveCurrency: "USD",
      amount: "10",
      beneficiaryRef: "payout:allowed",
      purpose: "approved payout",
      expiresAt: 2_000,
    });
    assert.equal(receipt.amount, "10");
    assert.equal(engine.health().reserves[0].unallocatedReserve, "0");
    assert.throws(
      () =>
        engine.createReceipt({
          reserveCurrency: "USD",
          amount: "1",
          beneficiaryRef: "payout:blocked",
          purpose: "must not consume coverage",
          expiresAt: 2_000,
        }),
      { code: "INSUFFICIENT_SETTLED_RESERVE" },
    );

    assert.equal(engine.consumeReceipt(receipt.receiptId).state, "CONSUMED");
    const after = engine.health().reserves[0];
    assert.equal(after.settledReserve, "150");
    assert.equal(after.requiredCoverageReserve, "150");
    assert.equal(after.coverageBps, 15_000);
  } finally {
    engine.close();
  }
});

test("redemption cannot invade reserve locked for another liability or receipt", () => {
  const engine = new MonetaryEngine({ now: () => 1_000 });
  try {
    engine.configureInstrument({
      code: "USDA",
      name: "USD A",
      kind: INSTRUMENT_KINDS.STABLECOIN,
      reserveCurrency: "USD",
      decimals: 6,
      minCoverageBps: 10_000,
    });
    engine.configureInstrument({
      code: "USDB",
      name: "USD B",
      kind: INSTRUMENT_KINDS.STABLECOIN,
      reserveCurrency: "USD",
      decimals: 6,
      minCoverageBps: 10_000,
    });
    const deposit = engine.createReserveDeposit({
      reserveCurrency: "USD",
      amount: "200",
      providerRef: "bank:shared-cover",
    });
    engine.settleReserveDeposit(deposit.depositId);
    engine.mint({ instrumentCode: "USDA", amount: "100", beneficiaryRef: "a" });
    engine.mint({ instrumentCode: "USDB", amount: "100", beneficiaryRef: "b" });

    assert.throws(
      () => engine.createReceipt({
        reserveCurrency: "USD",
        amount: "1",
        beneficiaryRef: "payout",
        purpose: "no free reserve",
        expiresAt: 2_000,
      }),
      { code: "INSUFFICIENT_SETTLED_RESERVE" },
    );
  } finally {
    engine.close();
  }
});

test("instruments sharing one reserve currency must share atomic precision", () => {
  const engine = new MonetaryEngine({ now: () => 1_000 });
  try {
    engine.configureInstrument({
      code: "USD6",
      name: "USD six decimals",
      kind: INSTRUMENT_KINDS.STABLECOIN,
      reserveCurrency: "USD",
      decimals: 6,
    });
    assert.throws(
      () =>
        engine.configureInstrument({
          code: "USD18",
          name: "USD eighteen decimals",
          kind: INSTRUMENT_KINDS.STABLECOIN,
          reserveCurrency: "USD",
          decimals: 18,
        }),
      { code: "RESERVE_UNIT_MISMATCH" },
    );
  } finally {
    engine.close();
  }
});
