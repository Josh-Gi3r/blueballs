/** Imbalance pricing — the thermostat.
 *
 *  A corridor is never blocked, only priced. The spread is not a number in a config
 *  file; it is DERIVED from how one-sided the corridor currently is, applied to a
 *  reference mid. Two consequences, both intended:
 *
 *    · Taking the SCARCE side costs more. That pays whoever is willing to hold the
 *      hard currency, which is the only reason anyone would.
 *    · Taking the ABUNDANT side costs less — and past a threshold earns a REBATE.
 *      That is what pulls the correcting flow in without anyone intervening.
 *
 *  So a one-way corridor doesn't die. It gets expensive in the direction everyone
 *  wants, cheap in the direction nobody wants, and the price drags it back to level.
 *
 *  Nothing here is discretionary. Same book state in, same price out — a bank can
 *  reproduce every quote it was given, which is what makes it auditable.
 */

/** Floor: what a perfectly balanced, deep corridor costs. */
export const BASE_BPS = 4;

/** How hard imbalance bites. At full one-sidedness the spread reaches BASE + MAX_SKEW. */
export const MAX_SKEW_BPS = 120;

/** Past this imbalance, the correcting side is paid to trade. */
export const REBATE_THRESHOLD = 0.35;
export const MAX_REBATE_BPS = 8;

/** Depth below which a corridor cannot promise instant settlement. */
export const THIN_DEPTH = 100_000;

/**
 * @param resting  { [pair]: minorUnits } resting depth per direction, e.g.
 *                 { "USDC/EURC": 2_000_00n, "EURC/USDC": 200_00n }
 * @param from,to  the direction being priced
 * @param sizeMinor the taker's size — large orders eat depth and pay for it
 */
export function priceCorridor(resting, from, to, sizeMinor = 0n) {
  const here = Number(resting[`${from}/${to}`] ?? 0n) / 100;
  const there = Number(resting[`${to}/${from}`] ?? 0n) / 100;
  const total = here + there;

  // imbalance ∈ [-1, 1]. Positive = the side we want is SCARCE (everyone is going our way).
  const imbalance = total === 0 ? 0 : (here - there) / total;

  // size pressure: taking a big bite out of a shallow corridor widens it further
  const depthAgainst = there || 1;
  const impact = Math.min(1, Number(sizeMinor) / 100 / depthAgainst);

  let bps =
    BASE_BPS +
    MAX_SKEW_BPS * Math.max(0, imbalance) +
    MAX_SKEW_BPS * 0.4 * impact;
  let rebate = 0;

  // trading against the flow — the corridor wants this, so pay for it
  if (imbalance < -REBATE_THRESHOLD) {
    const strength = Math.min(
      1,
      (Math.abs(imbalance) - REBATE_THRESHOLD) / (1 - REBATE_THRESHOLD),
    );
    rebate = MAX_REBATE_BPS * strength;
    bps = Math.max(0, BASE_BPS - rebate);
  }

  const liquidity = total === 0 ? "none" : total < THIN_DEPTH ? "thin" : "deep";
  const canSettleNow = there >= Number(sizeMinor) / 100 && liquidity !== "none";

  return {
    spread_bps: Math.round(bps * 100) / 100,
    rebate_bps: Math.round(rebate * 100) / 100,
    imbalance: Math.round(imbalance * 1000) / 1000,
    depth: { with_flow: here.toFixed(2), against_flow: there.toFixed(2) },
    liquidity,
    settlement: canSettleNow ? "instant" : "when_matched",
    reason:
      rebate > 0
        ? `This corridor is ${Math.round(Math.abs(imbalance) * 100)}% one-sided against you — you are being paid ${rebate.toFixed(1)} bps to help level it.`
        : imbalance > 0.2
          ? `Everyone is going this way (${Math.round(imbalance * 100)}% one-sided), so the price is wider. Go the other way and you earn a rebate.`
          : liquidity === "none"
            ? "No resting liquidity. Priced against the backstop and settles when matched."
            : "Balanced corridor, priced at the floor.",
    // reproducible: a bank can recompute this exact number from the same inputs
    inputs: {
      base_bps: BASE_BPS,
      max_skew_bps: MAX_SKEW_BPS,
      imbalance,
      impact: Math.round(impact * 1000) / 1000,
    },
  };
}

/** Principal appetite — the one discretionary knob, and it belongs to the operator.
 *  How much the bank will warehouse as the backstop, and what it charges to do it. */
export const DEFAULT_APPETITE = {
  enabled: true,
  max_position: "250000.00", // per corridor, in the currency it ends up long
  markup_bps: 25, // on top of the imbalance price, for taking the risk
  currency: "USD",
};

/** Will the backstop take this, and at what price? */
export function principalQuote(appetite, position, sizeMinor, imbalanceBps) {
  if (!appetite.enabled) {
    return {
      available: false,
      reason:
        "The operator has switched off principal fills for this corridor.",
    };
  }
  const after = Number(position) / 100 + Number(sizeMinor) / 100;
  if (after > Number(appetite.max_position)) {
    return {
      available: false,
      reason: `Would take the book to ${after.toFixed(2)} against a ${appetite.max_position} limit. Rest an order instead — it fills when a counterparty appears.`,
    };
  }
  return {
    available: true,
    spread_bps: Math.round((imbalanceBps + appetite.markup_bps) * 100) / 100,
    markup_bps: appetite.markup_bps,
    headroom: (Number(appetite.max_position) - after).toFixed(2),
  };
}
