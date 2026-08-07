/** The asset model — what makes stablecoin FX different from correspondent banking.
 *
 *  A currency here is one of two kinds:
 *    fiat       — money in the banking system, moved on a rail (SEPA, ACH, PayNow…)
 *    stablecoin — a token an issuer redeems 1:1 for a specific fiat currency
 *
 *  That distinction is the whole point. Three legs, priced very differently:
 *
 *    on_ramp   fiat → stablecoin    1:1 mint. No FX. Issuer fee only.
 *    fx        stablecoin → stable  the ONLY leg carrying an FX spread.
 *    off_ramp  stablecoin → fiat    1:1 redeem. No FX. Issuer fee only.
 *
 *  Correspondent banking charges a spread at every hop and takes days. Here the
 *  edges are 1:1 and the middle is a single atomic swap, so a cross-border payment
 *  costs one spread instead of three and settles in seconds.
 *
 *  Issuers are pluggable — this file is configuration, not a dependency on anyone.
 *
 *  TICKERS HERE ARE ILLUSTRATIVE. USDX / EURX / SGDX / MYRX are placeholders for a
 *  reference implementation. Whoever deploys this maps them to the real tokens and
 *  issuers they actually clear with. We deliberately do not ship real tickers — the
 *  stack should not imply an endorsement of, or dependency on, any particular issuer.
 */

export const FIAT = {
  USD: { code: "USD", name: "US dollar", decimals: 2, rails: ["ach", "wire"] },
  EUR: { code: "EUR", name: "Euro", decimals: 2, rails: ["sepa_instant", "sepa"] },
  GBP: { code: "GBP", name: "Pound sterling", decimals: 2, rails: ["faster_payments"] },
  SGD: { code: "SGD", name: "Singapore dollar", decimals: 2, rails: ["paynow"] },
  MYR: { code: "MYR", name: "Malaysian ringgit", decimals: 2, rails: [] },
};

/** Each stablecoin names the fiat it redeems against and who stands behind it.
 *  `issuer` is a label you configure — swap it for whoever you actually clear with. */
export const STABLECOINS = {
  USDX: { code: "USDX", name: "USD stablecoin", peg: "USD", decimals: 6, issuer: "issuer-a", networks: ["base", "ethereum"], redeemable: true },
  EURX: { code: "EURX", name: "EUR stablecoin", peg: "EUR", decimals: 6, issuer: "issuer-a", networks: ["base", "ethereum"], redeemable: true },
  SGDX: { code: "SGDX", name: "SGD stablecoin", peg: "SGD", decimals: 6, issuer: "issuer-b", networks: ["ethereum"], redeemable: true },
  MYRX: { code: "MYRX", name: "MYR stablecoin", peg: "MYR", decimals: 6, issuer: "issuer-c", networks: ["ethereum"], redeemable: true },
};

export const isFiat = (c) => !!FIAT[c];
export const isStable = (c) => !!STABLECOINS[c];
export const pegOf = (c) => STABLECOINS[c]?.peg ?? null;

/** Which of the three legs is this? Returns null for a pair we cannot route. */
export function legKind(from, to) {
  if (isFiat(from) && isStable(to)) return STABLECOINS[to].peg === from ? "on_ramp" : "on_ramp_fx";
  if (isStable(from) && isFiat(to)) return STABLECOINS[from].peg === to ? "off_ramp" : "off_ramp_fx";
  if (isStable(from) && isStable(to)) return "fx";
  if (isFiat(from) && isFiat(to)) return "fiat_fx";
  return null;
}

/** Reference mid rates against USD. Replace with your rate feed — this is the
 *  reference the corridor skew is applied to, not a price we invent. */
export const MID = { USD: 1, EUR: 1.083, GBP: 1.271, SGD: 0.742, MYR: 0.213 };
export const midOf = (c) => MID[isStable(c) ? pegOf(c) : c] ?? null;

/** Corridor depth. A corridor is a stablecoin pair — the only leg that carries FX.
 *  `depth` is what a taker can fill right now; it is what drives the skew below. */
export const CORRIDORS = {
  "USDX/EURX": { depth: "2400000.00", base_bps: 4 },
  "EURX/USDX": { depth: "2400000.00", base_bps: 4 },
  "USDX/SGDX": { depth: "610000.00", base_bps: 6 },
  "SGDX/USDX": { depth: "610000.00", base_bps: 6 },
  "EURX/SGDX": { depth: "180000.00", base_bps: 12 },
  "SGDX/EURX": { depth: "180000.00", base_bps: 12 },
  "USDX/MYRX": { depth: "94000.00", base_bps: 85 },
  "MYRX/USDX": { depth: "31000.00", base_bps: 85 },
};

/** Issuer fee on a 1:1 ramp, in bps. This is NOT FX — it is the cost of minting or
 *  redeeming. Kept separate so the UI can show a user that the edges carry no spread. */
export const RAMP_BPS = 0;

/**
 * Price a leg.
 *
 * Ramps are 1:1 by construction — no spread, because no currency is being changed.
 * Only the stablecoin↔stablecoin leg is priced, and its spread widens as the
 * corridor thins. That is the thermostat: a one-way corridor quotes worse, which
 * both pays whoever takes the hard side and pulls new liquidity in.
 */
export function priceLeg(from, to, amountMinor) {
  const kind = legKind(from, to);
  if (!kind) return null;

  if (kind === "on_ramp" || kind === "off_ramp") {
    return {
      kind, rate: "1.000000", spread_bps: RAMP_BPS,
      corridor: null, depth: null, liquidity: "n/a",
      settlement: "instant",
      note: kind === "on_ramp"
        ? "Minted 1:1 against your deposit. No FX on this leg."
        : "Redeemed 1:1 to your bank account. No FX on this leg.",
    };
  }

  if (kind === "fx") {
    const key = `${from}/${to}`;
    const c = CORRIDORS[key];
    const rate = midOf(from) / midOf(to);
    const bps = c ? c.base_bps : 120; // unlisted corridor: priced defensively, still quotable
    const thin = bps >= 50;
    return {
      kind, rate: rate.toFixed(6), spread_bps: bps,
      corridor: key, depth: c ? c.depth : null,
      liquidity: !c ? "unlisted" : thin ? "thin" : "deep",
      settlement: thin ? "when_matched" : "instant",
      note: thin
        ? "Thin corridor. The spread is wider and it settles when a counterparty is matched — never a dead route."
        : "Deep corridor. Matches immediately and settles atomically.",
    };
  }

  // fiat↔fiat or a cross-peg ramp: route it through the stablecoin leg
  return {
    kind, rate: null, spread_bps: null, corridor: null, depth: null,
    liquidity: "routed",
    settlement: "instant",
    note: "Routed as ramp → corridor → ramp. Quote each leg to see the full cost.",
  };
}

/** The full route for a cross-border payment, leg by leg, so the cost is legible. */
export function routeFor(fromFiat, toFiat) {
  const fromStable = Object.values(STABLECOINS).find((s) => s.peg === fromFiat)?.code;
  const toStable = Object.values(STABLECOINS).find((s) => s.peg === toFiat)?.code;
  if (!fromStable || !toStable) return null;
  return [
    { step: 1, kind: "on_ramp", from: fromFiat, to: fromStable, ...priceLeg(fromFiat, fromStable) },
    { step: 2, kind: "fx", from: fromStable, to: toStable, ...priceLeg(fromStable, toStable) },
    { step: 3, kind: "off_ramp", from: toStable, to: toFiat, ...priceLeg(toStable, toFiat) },
  ];
}
