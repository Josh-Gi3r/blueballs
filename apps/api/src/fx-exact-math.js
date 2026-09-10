/** Exact monetary arithmetic for the compatibility FX engine.
 * Monetary quantities stay BigInt minor units. Spread inputs are normalized to
 * hundredths of one basis point before they touch money. */
import { exactRate } from "./exact-rates.js";

const CENTIBPS_PER_WHOLE = 100n;
const CENTIBPS_DENOMINATOR = 10_000n * CENTIBPS_PER_WHOLE;

export function bpsToCentibps(value) {
  const scaled = Number(value) * 100;
  const centibps = Math.round(scaled);
  if (!Number.isSafeInteger(centibps) || Math.abs(scaled - centibps) > 1e-9) {
    throw new RangeError("spread bps must have at most two decimal places");
  }
  if (centibps < 0 || centibps > 1_000_000) {
    throw new RangeError("spread bps must be between 0 and 10000");
  }
  return BigInt(centibps);
}

/** Mid conversion, rounded down so the engine never creates value by rounding. */
export function convertAtMid(amountMinor, from, to) {
  const { numerator, denominator } = exactRate(from, to);
  return (BigInt(amountMinor) * numerator) / denominator;
}

/** Apply a spread quoted in bps (up to 2 decimal places), entirely in integers. */
export function convertWithSpread(amountMinor, from, to, spreadBps) {
  const { numerator, denominator } = exactRate(from, to);
  const spreadCentibps = bpsToCentibps(spreadBps);
  const keep = CENTIBPS_DENOMINATOR - spreadCentibps;
  if (keep < 0n) throw new RangeError("spread cannot exceed 10000 bps");
  return (
    BigInt(amountMinor) * numerator * keep /
    (denominator * CENTIBPS_DENOMINATOR)
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
