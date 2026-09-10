/** Exact monetary arithmetic for the compatibility FX engine.
 * Monetary quantities stay BigInt minor units. Spread inputs are normalized to
 * 1/10,000 of one basis point before they touch money. */
import { exactRate } from "./exact-rates.js";

const BPS_UNITS_PER_WHOLE = 10_000n;
const BPS_DENOMINATOR = 10_000n * BPS_UNITS_PER_WHOLE;

export function bpsToUnits(value) {
  const scaled = Number(value) * Number(BPS_UNITS_PER_WHOLE);
  const units = Math.round(scaled);
  if (!Number.isSafeInteger(units) || Math.abs(scaled - units) > 1e-7) {
    throw new RangeError("spread bps must have at most four decimal places");
  }
  if (units < 0 || units > Number(BPS_DENOMINATOR)) {
    throw new RangeError("spread bps must be between 0 and 10000");
  }
  return BigInt(units);
}

/** Mid conversion, rounded down so the engine never creates value by rounding. */
export function convertAtMid(amountMinor, from, to) {
  const { numerator, denominator } = exactRate(from, to);
  return (BigInt(amountMinor) * numerator) / denominator;
}

/** Apply a spread quoted in bps (up to 4 decimal places), entirely in integers. */
export function convertWithSpread(amountMinor, from, to, spreadBps) {
  const { numerator, denominator } = exactRate(from, to);
  const spreadUnits = bpsToUnits(spreadBps);
  const keep = BPS_DENOMINATOR - spreadUnits;
  if (keep < 0n) throw new RangeError("spread cannot exceed 10000 bps");
  return (
    (BigInt(amountMinor) * numerator * keep) /
    (denominator * BPS_DENOMINATOR)
  );
}

/** Percentage saved, two decimals, without Number(BigInt) conversion. */
export function percentageSaved(residualMinor, grossMinor) {
  const gross = BigInt(grossMinor);
  if (gross === 0n) return "0.00";
  const residual = BigInt(residualMinor);
  const saved = gross > residual ? gross - residual : 0n;
  const basisPointsOfPercent = (saved * 10_000n + gross / 2n) / gross;
  const whole = basisPointsOfPercent / 100n;
  const fraction = (basisPointsOfPercent % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}
