import assert from "node:assert/strict";
import test from "node:test";

import {
  INSTRUMENT_KINDS,
  MonetaryEngine,
  previewRemittance,
} from "../src/index.js";

function engineAt(clock = { now: 1_000 }) {
  const engine = new MonetaryEngine({ now: () => clock.now });
  engine.configureInstrument({
    code: "USD",
    name: "Reference USD-backed stablecoin",
    kind: INSTRUMENT_KINDS.STABLECOIN,
    reserveCurrency: "USD",
    decimals: 6,
  });
  return engine;
}

test("pending reserve cannot support minting and settled reserve cannot be double allocated", () => {
  const engine = engineAt();
  const deposit = engine.createReserveDeposit({
    reserveCurrency: "USD",
    amount: "100000",
    providerRef: "bank:1",
  });
  assert.throws(
    () =>
      engine.mint({
        instrumentCode: "USD",
        amount: "1",
        beneficiaryRef: "wallet:1",
      }),
    { code: "INSUFFICIENT_SETTLED_RESERVE" },
  );
  engine.settleReserveDeposit(deposit.depositId);
  assert.equal(
    engine.mint({
      instrumentCode: "USD",
      amount: "100000",
      beneficiaryRef: "wallet:1",
    }).supply,
    "100000",
  );
  assert.throws(
    () =>
      engine.mint({
        instrumentCode: "USD",
        amount: "1",
        beneficiaryRef: "wallet:2",
      }),
    { code: "INSUFFICIENT_SETTLED_RESERVE" },
  );
  assert.equal(engine.health().reserves[0].coverageBps, 10_000);
  engine.close();
});

test("risk capital remains outside reserve coverage", () => {
  const engine = engineAt();
  engine.setRiskCapital({ reserveCurrency: "USD", amount: "999999999" });
  const health = engine.health().reserves[0];
  assert.equal(health.settledReserve, "0");
  assert.equal(health.riskCapital, "999999999");
  assert.equal(health.riskCapitalCountedAsReserve, false);
  assert.throws(
    () =>
      engine.mint({
        instrumentCode: "USD",
        amount: "1",
        beneficiaryRef: "wallet:1",
      }),
    { code: "INSUFFICIENT_SETTLED_RESERVE" },
  );
  engine.close();
});

test("obsolete zero-supply reference instruments can be retired but funded instruments cannot", () => {
  const engine = engineAt();
  assert.equal(engine.disableInstrument("USD").enabled, false);
  assert.deepEqual(engine.listInstruments(), []);
  engine.configureInstrument({
    code: "USD",
    name: "Reference USD-backed stablecoin",
    kind: INSTRUMENT_KINDS.STABLECOIN,
    reserveCurrency: "USD",
    decimals: 6,
  });
  const deposit = engine.createReserveDeposit({
    reserveCurrency: "USD",
    amount: "1",
    providerRef: "bank:retire",
  });
  engine.settleReserveDeposit(deposit.depositId);
  engine.mint({
    instrumentCode: "USD",
    amount: "1",
    beneficiaryRef: "wallet:retire",
  });
  assert.throws(() => engine.disableInstrument("USD"), {
    code: "INSTRUMENT_HAS_SUPPLY",
  });
  engine.close();
});

test("minimum coverage is enforced with exact ceiling arithmetic", () => {
  const engine = new MonetaryEngine({ now: () => 1_000 });
  engine.configureInstrument({
    code: "EUR",
    name: "Overcollateralized EUR reference deposit",
    kind: INSTRUMENT_KINDS.TOKENIZED_DEPOSIT,
    reserveCurrency: "EUR",
    decimals: 6,
    minCoverageBps: 10_500,
  });
  const deposit = engine.createReserveDeposit({
    reserveCurrency: "EUR",
    amount: "105",
    providerRef: "bank:coverage",
  });
  engine.settleReserveDeposit(deposit.depositId);
  engine.mint({
    instrumentCode: "EUR",
    amount: "100",
    beneficiaryRef: "wallet:coverage",
  });
  assert.throws(
    () =>
      engine.mint({
        instrumentCode: "EUR",
        amount: "1",
        beneficiaryRef: "wallet:coverage",
      }),
    { code: "COVERAGE_LIMIT" },
  );
  engine.close();
});

test("redemption burns supply and pays from settled reserve", () => {
  const engine = engineAt();
  const deposit = engine.createReserveDeposit({
    reserveCurrency: "USD",
    amount: "100000",
    providerRef: "bank:2",
  });
  engine.settleReserveDeposit(deposit.depositId);
  engine.mint({
    instrumentCode: "USD",
    amount: "80000",
    beneficiaryRef: "wallet:1",
  });
  const redemption = engine.redeem({
    instrumentCode: "USD",
    amount: "30000",
    holderRef: "wallet:1",
  });
  assert.equal(redemption.supply, "50000");
  const health = engine.health().reserves[0];
  assert.equal(health.settledReserve, "70000");
  assert.equal(health.redeemableSupply, "50000");
  assert.equal(health.coverageBps, 14_000);
  engine.close();
});

test("temporary receipts are non-transferable, reserve-backed, expiring and single-use", () => {
  const clock = { now: 10_000 };
  const engine = engineAt(clock);
  const deposit = engine.createReserveDeposit({
    reserveCurrency: "USD",
    amount: "50000",
    providerRef: "bank:3",
  });
  engine.settleReserveDeposit(deposit.depositId);
  const receipt = engine.createReceipt({
    reserveCurrency: "USD",
    amount: "10000",
    beneficiaryRef: "payout:1",
    purpose: "BRL-EUR remittance payout",
    expiresAt: 20_000,
  });
  assert.equal(receipt.transferable, false);
  assert.equal(engine.health().reserves[0].lockedReceipts, "10000");
  assert.equal(engine.consumeReceipt(receipt.receiptId).state, "CONSUMED");
  assert.throws(() => engine.consumeReceipt(receipt.receiptId), {
    code: "INVALID_STATE",
  });

  const expiring = engine.createReceipt({
    reserveCurrency: "USD",
    amount: "5000",
    beneficiaryRef: "payout:2",
    purpose: "second payout",
    expiresAt: 30_000,
  });
  clock.now = 30_000;
  assert.equal(engine.getReceipt(expiring.receiptId).state, "EXPIRED");
  assert.equal(engine.health().reserves[0].lockedReceipts, "0");
  engine.close();
});

test("remittance preview uses exact bps decomposition and rejects stale oracle evidence", () => {
  const oracle = {
    midNumerator: "78",
    midDenominator: "100",
    observedAt: 900,
    expiresAt: 1_100,
    sourceIds: ["bank-a", "bank-b", "venue-c"],
    confidence: "HIGH",
  };
  const preview = previewRemittance({
    inputAmount: "10000000",
    inputCurrency: "BRL",
    outputCurrency: "EUR",
    oracle,
    bps: {
      market: 5,
      volatility: 2,
      inventory: 3,
      sizeDepth: 1,
      rail: 4,
      finality: 2,
      margin: 5,
      nettingRebate: 7,
    },
    now: 1_000,
  });
  assert.equal(preview.cost.allInBps, 15);
  assert.equal(preview.output.midAmount, "7800000");
  assert.equal(preview.output.amount, "7788300");
  assert.equal(preview.cost.outputAmount, "11700");
  assert.deepEqual(preview.oracle.sourceIds, oracle.sourceIds);
  assert.throws(
    () =>
      previewRemittance({
        inputAmount: "1",
        inputCurrency: "BRL",
        outputCurrency: "EUR",
        oracle,
        bps: {},
        now: 1_100,
      }),
    { code: "ORACLE_STALE" },
  );
});
