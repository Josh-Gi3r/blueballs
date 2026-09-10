/** Imbalance pricing — deterministic, exact on every monetary quantity.
 *
 * Monetary depth, size and principal exposure stay as BigInt minor units. Only
 * bounded dimensionless ratios and bps values are converted to Number for JSON
 * display after the economic decision has already been made with integer math.
 */
import { fromMinor, toMinor } from "./lib.js";

export const BASE_BPS = 4;
export const MAX_SKEW_BPS = 120;
export const REBATE_THRESHOLD = 0.35;
export const MAX_REBATE_BPS = 8;
export const THIN_DEPTH = 100_000;

const RATIO_SCALE = 1_000_000n;
const BPS_SCALE = 100n; // hundredths of one basis point
const BASE_CENTIBPS = BigInt(BASE_BPS) * BPS_SCALE;
const MAX_SKEW_CENTIBPS = BigInt(MAX_SKEW_BPS) * BPS_SCALE;
const SIZE_IMPACT_CENTIBPS = 48n * BPS_SCALE; // MAX_SKEW_BPS * 0.4
const MAX_REBATE_CENTIBPS = BigInt(MAX_REBATE_BPS) * BPS_SCALE;
const REBATE_THRESHOLD_SCALED = 350_000n;
const REBATE_RANGE_SCALED = RATIO_SCALE - REBATE_THRESHOLD_SCALED;
const THIN_DEPTH_MINOR = BigInt(THIN_DEPTH) * 100n;

function abs(n) {
  return n < 0n ? -n : n;
}

function min(a, b) {
  return a < b ? a : b;
}

function roundedDiv(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  if (numerator < 0n) return -roundedDiv(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

function scaledRatio(numerator, denominator) {
  if (denominator === 0n) return 0n;
  return roundedDiv(numerator * RATIO_SCALE, denominator);
}

function ratioNumber(value, decimals = 3) {
  const decimalScale = 10n ** BigInt(decimals);
  const rounded = roundedDiv(value * decimalScale, RATIO_SCALE);
  return Number(rounded) / Number(decimalScale);
}

function centiBpsNumber(value) {
  return Number(value) / 100;
}

/**
 * @param resting { [pair]: BigInt } resting depth in minor units
 * @param from,to direction being priced
 * @param sizeMinor taker size in minor units
 */
export function priceCorridor(resting, from, to, sizeMinor = 0n) {
  const hereMinor = BigInt(resting[`${from}/${to}`] ?? 0n);
  const thereMinor = BigInt(resting[`${to}/${from}`] ?? 0n);
  const totalMinor = hereMinor + thereMinor;

  // Positive means our requested side is scarcer / flow is already going this way.
  const imbalanceScaled =
    totalMinor === 0n
      ? 0n
      : scaledRatio(hereMinor - thereMinor, totalMinor);

  // Original model treated an empty opposing side as one major unit of depth.
  // Preserve that behavior exactly without floating-point conversion.
  const depthAgainstMinor = thereMinor || 100n;
  const impactScaled = min(
    RATIO_SCALE,
    scaledRatio(BigInt(sizeMinor), depthAgainstMinor),
  );

  let bpsCenti = BASE_CENTIBPS;
  if (imbalanceScaled > 0n) {
    bpsCenti += roundedDiv(
      MAX_SKEW_CENTIBPS * imbalanceScaled,
      RATIO_SCALE,
    );
  }
  bpsCenti += roundedDiv(
    SIZE_IMPACT_CENTIBPS * impactScaled,
    RATIO_SCALE,
  );

  let rebateCenti = 0n;
  if (imbalanceScaled < -REBATE_THRESHOLD_SCALED) {
    const strengthScaled = min(
      RATIO_SCALE,
      scaledRatio(
        abs(imbalanceScaled) - REBATE_THRESHOLD_SCALED,
        REBATE_RANGE_SCALED,
      ),
    );
    rebateCenti = roundedDiv(
      MAX_REBATE_CENTIBPS * strengthScaled,
      RATIO_SCALE,
    );
    bpsCenti = BASE_CENTIBPS > rebateCenti
      ? BASE_CENTIBPS - rebateCenti
      : 0n;
  }

  const liquidity =
    totalMinor === 0n
      ? "none"
      : totalMinor < THIN_DEPTH_MINOR
        ? "thin"
        : "deep";
  const canSettleNow = thereMinor >= BigInt(sizeMinor) && liquidity !== "none";

  const spreadBps = centiBpsNumber(bpsCenti);
  const rebateBps = centiBpsNumber(rebateCenti);
  const imbalance = ratioNumber(imbalanceScaled, 3);
  const impact = ratioNumber(impactScaled, 3);
  const imbalancePercent = Math.round(ratioNumber(abs(imbalanceScaled), 4) * 100);

  return {
    spread_bps: spreadBps,
    rebate_bps: rebateBps,
    imbalance,
    depth: {
      with_flow: fromMinor(hereMinor),
      against_flow: fromMinor(thereMinor),
    },
    liquidity,
    settlement: canSettleNow ? "instant" : "when_matched",
    reason:
      rebateCenti > 0n
        ? `This corridor is ${imbalancePercent}% one-sided against you — you are being paid ${rebateBps.toFixed(1)} bps to help level it.`
        : imbalanceScaled > 200_000n
          ? `Everyone is going this way (${imbalancePercent}% one-sided), so the price is wider. Go the other way and you earn a rebate.`
          : liquidity === "none"
            ? "No resting liquidity. Priced against the backstop and settles when matched."
            : "Balanced corridor, priced at the floor.",
    inputs: {
      base_bps: BASE_BPS,
      max_skew_bps: MAX_SKEW_BPS,
      imbalance,
      impact,
    },
  };
}

export const DEFAULT_APPETITE = {
  enabled: true,
  max_position: "250000.00",
  markup_bps: 25,
  currency: "USD",
};

/** Principal appetite decision. Position and size remain exact minor units. */
export function principalQuote(appetite, position, sizeMinor, imbalanceBps) {
  if (!appetite.enabled) {
    return {
      available: false,
      reason:
        "The operator has switched off principal fills for this corridor.",
    };
  }

  const limitMinor = toMinor(appetite.max_position);
  const afterMinor = BigInt(position) + BigInt(sizeMinor);
  if (afterMinor > limitMinor) {
    return {
      available: false,
      reason: `Would take the book to ${fromMinor(afterMinor)} against a ${appetite.max_position} limit. Rest an order instead — it fills when a counterparty appears.`,
    };
  }

  return {
    available: true,
    spread_bps:
      Math.round((Number(imbalanceBps) + Number(appetite.markup_bps)) * 100) /
      100,
    markup_bps: appetite.markup_bps,
    headroom: fromMinor(limitMinor - afterMinor),
  };
}
