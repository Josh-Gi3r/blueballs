import assert from "node:assert/strict";
import test from "node:test";
import {
  convertAtMid,
  convertWithSpread,
  percentageSaved,
} from "../src/fx-exact-math.js";

test("FX monetary conversions stay exact above Number.MAX_SAFE_INTEGER", () => {
  const huge = 9_007_199_254_740_993n;
  assert.equal(convertAtMid(huge, "USDC", "USDC"), huge);
  assert.equal(
    convertWithSpread(huge, "USDC", "USDC", 0),
    huge,
    "zero-spread conversion must be identity even above JS safe integer",
  );
  assert.equal(
    convertWithSpread(10_000_000n, "USDC", "USDC", 4),
    9_996_000n,
  );
});

test("sub-centibps ladder spreads use fixed point and netting percentage stays exact", () => {
  assert.equal(
    convertWithSpread(100_000_000n, "USDC", "USDC", 5.0375),
    99_949_625n,
  );
  assert.equal(percentageSaved(25n, 100n), "75.00");
  assert.equal(percentageSaved(0n, 0n), "0.00");
});
