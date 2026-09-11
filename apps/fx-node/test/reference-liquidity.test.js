import test from "node:test";
import assert from "node:assert/strict";

import {
  ReferenceLiquidityAdapter,
  ReferenceLiquidityBook,
} from "../src/reference-liquidity.js";

const NOW = 1_000_000;

function slice(overrides = {}) {
  return {
    sliceId: "issuer:usd-eur",
    sourceType: "ISSUER",
    sourceId: "issuer-1",
    inputAsset: "USD",
    outputAsset: "EUR",
    maxOutput: "1000",
    inputNumerator: "101",
    inputDenominator: "100",
    policyAuthorizationId: "auth-1",
    policySnapshotHash: "snapshot-1",
    accountRef: "issuer:treasury",
    expiresAt: NOW + 60_000,
    online: true,
    metadata: { label: "issuer" },
    ...overrides,
  };
}

function reserve(book, outputAmount = "400") {
  const adapter = new ReferenceLiquidityAdapter(book);
  const leg = {
    sourceType: "ISSUER",
    sourceId: "issuer-1",
    sliceId: "issuer:usd-eur",
    inputAsset: "USD",
    outputAsset: "EUR",
    inputAmount: "404",
    outputAmount,
    expiresAt: NOW + 30_000,
  };
  return adapter.reserve({ routeId: "route-1", leg, index: 0 });
}

test("reserved source economics cannot mutate underneath a firm quote", () => {
  const book = new ReferenceLiquidityBook({ now: () => NOW });
  try {
    book.upsertSlice(slice());
    reserve(book);

    assert.throws(
      () => book.upsertSlice(slice({ inputNumerator: "102" })),
      /cannot change reference liquidity economics/,
    );
    assert.throws(
      () => book.upsertSlice(slice({ policyAuthorizationId: "auth-2" })),
      /cannot change reference liquidity economics/,
    );
    assert.throws(
      () => book.upsertSlice(slice({ maxOutput: "399" })),
      /maxOutput cannot fall below actively reserved/,
    );

    const stored = book.getSlice("issuer:usd-eur");
    assert.equal(stored.inputNumerator, "101");
    assert.equal(stored.policyAuthorizationId, "auth-1");
    assert.equal(stored.maxOutput, "1000");
    assert.equal(stored.reservedOutput, "400");
  } finally {
    book.close();
  }
});

test("operational availability can still fail a reserved source closed", () => {
  const book = new ReferenceLiquidityBook({ now: () => NOW });
  try {
    book.upsertSlice(slice());
    const { reservationHandle } = reserve(book);
    book.setOnline("issuer:usd-eur", false);
    assert.throws(
      () => book.validateReserved({ reservationHandle }),
      /reference source is offline/,
    );
    book.setOnline("issuer:usd-eur", true);
    assert.equal(book.validateReserved({ reservationHandle }).state, "ACTIVE");
  } finally {
    book.close();
  }
});

test("after reservation release the source can be repriced safely", () => {
  const book = new ReferenceLiquidityBook({ now: () => NOW });
  try {
    book.upsertSlice(slice());
    const { reservationHandle } = reserve(book);
    book.release({ reservationHandle, reason: "CUSTOMER_CANCELLED" });

    const updated = book.upsertSlice(
      slice({ inputNumerator: "103", maxOutput: "900" }),
    );
    assert.equal(updated.inputNumerator, "103");
    assert.equal(updated.maxOutput, "900");
    assert.equal(updated.reservedOutput, "0");
  } finally {
    book.close();
  }
});
