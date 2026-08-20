import { ApiError } from "./lib.js";
import { isStable, pegOf } from "./assets.js";

// Reference mids in millionths of USD. Integers keep every balance mutation
// outside IEEE-754; display strings and settlement use this same source.
export const EXACT_MID = Object.freeze({
  USD: 1_000_000n,
  EUR: 1_083_000n,
  GBP: 1_271_000n,
  SGD: 742_000n,
  MYR: 213_000n,
});

function fiatCode(currency) {
  return isStable(currency) ? pegOf(currency) : currency;
}

export function exactRate(from, to) {
  const numerator = EXACT_MID[fiatCode(from)];
  const denominator = EXACT_MID[fiatCode(to)];
  if (!numerator || !denominator) {
    throw new ApiError("validation-error", 400, "Unsupported currency pair");
  }
  return { numerator, denominator };
}

export function rateString(from, to, decimals = 6) {
  const { numerator, denominator } = exactRate(from, to);
  const scale = 10n ** BigInt(decimals);
  const rounded = (numerator * scale + denominator / 2n) / denominator;
  const raw = rounded.toString().padStart(decimals + 1, "0");
  return `${raw.slice(0, -decimals)}.${raw.slice(-decimals)}`;
}

/** Convert minor units and round down, so a quote never credits more than its exact economics. */
export function convertMinor(amountMinor, from, to, spreadBps = 0) {
  const { numerator, denominator } = exactRate(from, to);
  const spread = BigInt(10_000 - spreadBps);
  return (amountMinor * numerator * spread) / (denominator * 10_000n);
}
