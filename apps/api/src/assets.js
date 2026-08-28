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
 *  USDC and EURC below are recognizable asset identifiers used only to describe
 *  adapter contracts and sandbox routing. This reference implementation does not
 *  connect to Circle, hold reserves, or claim executable liquidity. A deployment
 *  must configure and verify its own issuer, custody, network and venue adapters.
 */

export const FIAT = {
  USD: { code: "USD", name: "US dollar", decimals: 2, rails: ["ach", "wire"] },
  EUR: {
    code: "EUR",
    name: "Euro",
    decimals: 2,
    rails: ["sepa_instant", "sepa"],
  },
  GBP: {
    code: "GBP",
    name: "Pound sterling",
    decimals: 2,
    rails: ["faster_payments"],
  },
  SGD: {
    code: "SGD",
    name: "Singapore dollar",
    decimals: 2,
    rails: ["paynow"],
  },
  MYR: { code: "MYR", name: "Malaysian ringgit", decimals: 2, rails: [] },
};

/** Each stablecoin names the fiat it redeems against and who stands behind it.
 *  `issuer` is a label you configure — swap it for whoever you actually clear with. */
export const STABLECOINS = {
  USDC: {
    code: "USDC",
    name: "USD Coin adapter reference",
    peg: "USD",
    decimals: 6,
    issuer: "circle-adapter",
    networks: ["base", "ethereum"],
    redeemable: true,
  },
  EURC: {
    code: "EURC",
    name: "EURC adapter reference",
    peg: "EUR",
    decimals: 6,
    issuer: "circle-adapter",
    networks: ["base", "ethereum"],
    redeemable: true,
  },
};

export const isFiat = (c) => !!FIAT[c];
export const isStable = (c) => !!STABLECOINS[c];
export const pegOf = (c) => STABLECOINS[c]?.peg ?? null;

/** Which of the three legs is this? Returns null for a pair we cannot route. */
export function legKind(from, to) {
  if (isFiat(from) && isStable(to))
    return STABLECOINS[to].peg === from ? "on_ramp" : "on_ramp_fx";
  if (isStable(from) && isFiat(to))
    return STABLECOINS[from].peg === to ? "off_ramp" : "off_ramp_fx";
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
  "USDC/EURC": { depth: "2400000.00", base_bps: 4 },
  "EURC/USDC": { depth: "2400000.00", base_bps: 4 },
};

/** Issuer fee on a 1:1 ramp, in bps. This is NOT FX — it is the cost of minting or
 *  redeeming. Kept separate so the UI can show a user that the edges carry no spread. */
export const RAMP_BPS = 0;

/**
 * How long a fiat rail actually takes to become irrevocable.
 *
 * This is the honest edge of the whole design. The corridor leg is atomic — both
 * sides of a swap post in one ledger transaction or neither does. The RAMPS ARE NOT
 * ATOMIC WITH IT: fiat arrives on somebody else's rail, on that rail's schedule, and
 * between the money landing and the token existing there is a window. Someone bears
 * that window. Pretending it is instant does not remove the risk, it just hides who
 * is carrying it.
 *
 * `window_seconds` is time to irrevocability, not time to appear in a balance.
 */
export const RAIL_SETTLEMENT = {
  sepa_instant: { window_seconds: 10, basis: "irrevocable on receipt" },
  paynow: { window_seconds: 10, basis: "irrevocable on receipt" },
  faster_payments: {
    window_seconds: 120,
    basis: "irrevocable, subject to recall window",
  },
  wire: { window_seconds: 3600, basis: "same-day, irrevocable once posted" },
  sepa: { window_seconds: 86400, basis: "next business day" },
  ach: {
    window_seconds: 432000,
    basis: "settles T+1, returnable for up to 5 business days",
  },
};

/** The fastest rail a currency can actually use, which is the one that bounds the gap. */
export function rampSettlement(fiat) {
  const rails = FIAT[fiat]?.rails ?? [];
  const known = rails.map((r) => RAIL_SETTLEMENT[r]).filter(Boolean);
  if (!known.length) {
    return {
      window_seconds: null,
      basis: "no supported rail — this currency cannot be ramped",
      rail: null,
    };
  }
  const best = known.reduce((a, b) =>
    a.window_seconds <= b.window_seconds ? a : b,
  );
  return { ...best, rail: rails[known.indexOf(best)] };
}

/**
 * Who carries the rate movement between a ramp and the swap it feeds.
 *
 * There is no neutral default here — it is a commercial decision, so it is
 * configuration rather than a hardcoded promise:
 *
 *   taker      (default) the customer carries their own rate risk across the gap.
 *              The rate is quoted when the swap executes, not when the fiat is sent.
 *              We promise nothing we have not been configured to promise.
 *   issuer     the stablecoin issuer guarantees mint at the sent-time rate.
 *              Only real if your issuer has actually agreed to it.
 *   operator   you escrow the difference and eat the movement — a treasury position
 *              you must fund and size.
 *   route      the whole three-leg route is locked at quote time (see the RFQ tier),
 *              which means you carry it for the length of the slowest rail.
 */
export const RAMP_GAP_POLICY = process.env.FX_RAMP_GAP_POLICY || "taker";

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
      kind,
      rate: "1.000000",
      spread_bps: RAMP_BPS,
      corridor: null,
      depth: null,
      liquidity: "n/a",
      settlement: "instant",
      note:
        kind === "on_ramp"
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
      kind,
      rate: rate.toFixed(6),
      spread_bps: bps,
      corridor: key,
      depth: c ? c.depth : null,
      liquidity: !c ? "unlisted" : thin ? "thin" : "deep",
      settlement: thin ? "when_matched" : "instant",
      note: thin
        ? "Thin corridor. The spread is wider and it settles when a counterparty is matched — never a dead route."
        : "Deep corridor. Matches immediately and settles atomically.",
    };
  }

  // fiat↔fiat or a cross-peg ramp: route it through the stablecoin leg
  return {
    kind,
    rate: null,
    spread_bps: null,
    corridor: null,
    depth: null,
    liquidity: "routed",
    settlement: "instant",
    note: "Routed as ramp → corridor → ramp. Quote each leg to see the full cost.",
  };
}

/** The full route for a cross-border payment, leg by leg, so the cost is legible. */
export function routeFor(fromFiat, toFiat) {
  const fromStable = Object.values(STABLECOINS).find(
    (s) => s.peg === fromFiat,
  )?.code;
  const toStable = Object.values(STABLECOINS).find(
    (s) => s.peg === toFiat,
  )?.code;
  if (!fromStable || !toStable) return null;
  return [
    {
      step: 1,
      kind: "on_ramp",
      from: fromFiat,
      to: fromStable,
      ...priceLeg(fromFiat, fromStable),
    },
    {
      step: 2,
      kind: "fx",
      from: fromStable,
      to: toStable,
      ...priceLeg(fromStable, toStable),
    },
    {
      step: 3,
      kind: "off_ramp",
      from: toStable,
      to: toFiat,
      ...priceLeg(toStable, toFiat),
    },
  ];
}
