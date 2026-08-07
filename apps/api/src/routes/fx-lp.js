/** Liquidity provision — the same mechanism for a bank and for a person.
 *
 *  The point of the whole design: anyone verified can supply a corridor and earn a
 *  share of the spread their liquidity produced. A bank is not a different kind of
 *  participant, only a larger one. That is what makes the network compound — every
 *  neobank on the stack is both a consumer of the FX rail and a provider into it.
 *
 *  Yield comes from real flow — the spread a taker actually paid — not from emissions.
 *  If no one trades the corridor, an LP earns nothing. That is correct.
 *
 *  Who is naturally suited to which corridor:
 *    issuer         reserves ARE that currency — near-zero inventory risk
 *    bank           already long its deposit base — monetises exposure it has anyway
 *    person / fund  no native position, must round-trip — the only class that can
 *                   get stuck, which is why they are paid the widest share
 */

import {
  route, ApiError, need, toMinor, fromMinor, ksuid, db, post, balanceOf,
  emit, collection, now,
} from "../kernel.js";
import { isStable } from "../assets.js";

const positions = collection("fxLpPositions");
const earnings = collection("fxLpEarnings");

/** How a spread is split. The provider takes the majority — they carry the risk.
 *  Everything here is integer basis points: these numbers multiply real money, and
 *  0.70 + 0.10 is not 0.80 in binary floating point. */
export const SPREAD_SPLIT_BPS = { provider: 7000, operator: 3000 };
const MAX_SHARE_BPS = 9500;

/** Class only affects the share, never access. Anyone verified can provide. */
const CLASS_BONUS_BPS = {
  issuer: 0,      // near-zero risk, so no premium
  bank: 500,      // long its deposits already
  member: 1000,   // no native position — paid most for round-trip risk
};

/** The class is DERIVED from the verified customer, never taken on trust from the
 *  request. Self-declaration would be free money: `member` pays the most, so every
 *  bank would simply call itself one. Since the premium exists to compensate real
 *  round-trip risk, it has to follow who the customer actually is.
 *
 *  A provider may still declare a class *below* the one they qualify for — an issuer
 *  being honest about holding native reserves — but never above it. */
const CLASS_RANK = { issuer: 0, bank: 1, member: 2 };

function classFor(customer, declared) {
  const derived = customer.type === "business" ? "bank" : "member";
  if (declared && CLASS_RANK[declared] !== undefined
      && CLASS_RANK[declared] < CLASS_RANK[derived]) {
    return declared; // claiming down is allowed
  }
  return derived;
}

const shareBpsFor = (klass) =>
  Math.min(MAX_SHARE_BPS, SPREAD_SPLIT_BPS.provider + CLASS_BONUS_BPS[klass]);

/** Positions committed before shares moved to integer basis points are still live in
 *  the store. Read their share through here so an old row can never become NaN
 *  halfway through a payout. */
const shareBpsOf = (p) =>
  Number.isInteger(p.share_bps) ? p.share_bps
    : typeof p.share === "number" ? Math.round(p.share * 10000)
      : shareBpsFor(p.class ?? "member");

const pairKey = (a, b) => `${a}/${b}`;
/** A corridor is bidirectional — the same pool serves USDX/EURX and EURX/USDX.
 *  Always compare on the normalised form or providers silently never get paid. */
export const normPair = (p) => p.split("/").sort().join("/");

/* ---- commit liquidity to a corridor ---- */
route("POST", "/v2/fx/lp", ({ body, key }) => {
  need(body, ["account", "currency", "amount", "pair"]);
  const acc = db.accounts.get(body.account);
  if (!acc) throw new ApiError("not-found", 404, `No account ${body.account}`);

  const cus = db.customers.get(acc.customer);
  if (!cus || cus.decision !== "approved") {
    throw new ApiError("tier-insufficient", 403, "Liquidity providers must be verified — that is what makes every fill attributable");
  }

  const cur = String(body.currency).toUpperCase();
  if (!isStable(cur)) throw new ApiError("validation-error", 400, `${cur} is not a stablecoin — ramp fiat first`);

  const [a, b] = String(body.pair).toUpperCase().split("/");
  if (!a || !b || (cur !== a && cur !== b)) {
    throw new ApiError("validation-error", 400, `Committed currency must be one side of ${body.pair}`);
  }

  const minor = toMinor(body.amount);
  if (balanceOf(acc.id, cur) < minor) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(acc.id, cur))} ${cur}`);
  }

  const klass = classFor(cus, body.class);

  // liquidity moves into the corridor's pool account — still the LP's, but committed
  const pool = `lp:${a}/${b}:${cur}`;
  post([
    { account: acc.id, currency: cur, amount: -minor },
    { account: pool, currency: cur, amount: minor },
  ], `lp commit ${cur} → ${a}/${b}`);

  const p = {
    id: ksuid("lpp"),
    account: acc.id, customer: acc.customer, class: klass,
    pair: `${a}/${b}`, currency: cur,
    committed: body.amount,
    share_bps: shareBpsFor(klass),
    status: "active", created_at: now(), owner: key.id,
  };
  positions.set(p.id, p);
  emit("fx.lp.committed", { id: p.id, pair: p.pair, currency: cur });

  return {
    ...p,
    share: (p.share_bps / 100).toFixed(0) + "%",
    earned: { amount: "0.00", currency: cur },
    class_note: body.class && body.class !== klass
      ? `Class is derived from your verified customer record, not the request — you were recorded as ${klass}.`
      : undefined,
    note: `Earning ${p.share_bps / 100}% of the spread on fills your liquidity provides. Yield comes from real flow — no trades, no earnings.`,
  };
});

/** Called by the swap engine when a fill consumed pooled liquidity.
 *  Credits the providers pro-rata to what each has committed. */
export function creditProviders(pair, currency, spreadMinor, fillId) {
  const active = [...positions.values()]
    .filter((p) => p.status === "active" && normPair(p.pair) === normPair(pair) && p.currency === currency);
  if (!active.length || spreadMinor <= 0n) return [];

  const total = active.reduce((n, p) => n + toMinor(p.committed), 0n);
  if (total <= 0n) return [];

  const credited = [];
  for (const p of active) {
    // All integer: spread x stake-weight x share, in minor units and basis points.
    // Any float here would round real money in a way that never reconciles.
    const gross = (spreadMinor * toMinor(p.committed)) / total;
    const providerCut = (gross * BigInt(shareBpsOf(p))) / 10000n;
    if (providerCut <= 0n) continue;

    post([
      { account: `spread:${pair}`, currency, amount: -providerCut },
      { account: p.account, currency, amount: providerCut },
    ], `lp earning ${fillId}`);

    const e = {
      id: ksuid("lpe"), position: p.id, fill: fillId, pair, currency,
      amount: fromMinor(providerCut), share_bps: shareBpsOf(p), at: now(), owner: p.owner,
    };
    earnings.set(e.id, e);
    credited.push(e);
  }
  if (credited.length) emit("fx.lp.earned", { fill: fillId, providers: credited.length });
  return credited;
}

/* ---- positions and what they have earned ---- */
route("GET", "/v2/fx/lp", ({ key }) => {
  const mine = [...positions.values()].filter((p) => p.owner === key.id);
  return {
    object: "list",
    data: mine.map((p) => {
      const earned = [...earnings.values()]
        .filter((e) => e.position === p.id)
        .reduce((n, e) => n + toMinor(e.amount), 0n);
      return {
        ...p,
        share: `${shareBpsOf(p) / 100}%`,
        earned: { amount: fromMinor(earned), currency: p.currency },
        fills: [...earnings.values()].filter((e) => e.position === p.id).length,
      };
    }),
  };
});

route("GET", "/v2/fx/lp/earnings", ({ key, url }) => {
  const rows = [...earnings.values()].filter((e) => e.owner === key.id);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return { object: "list", data: rows.slice(0, limit), has_more: rows.length > limit };
});

/* ---- pull liquidity back out ---- */
route("POST", "/v2/fx/lp/:id/withdraw", ({ params, key }) => {
  const p = positions.get(params.id);
  if (!p) throw new ApiError("not-found", 404, `No position ${params.id}`);
  if (p.owner !== key.id) throw new ApiError("forbidden", 403, "Not your position");
  if (p.status !== "active") throw new ApiError("conflict", 409, "Already withdrawn");

  const pool = `lp:${p.pair}:${p.currency}`;
  const available = balanceOf(pool, p.currency);
  const want = toMinor(p.committed);
  const give = available < want ? available : want;

  if (give > 0n) {
    post([
      { account: pool, currency: p.currency, amount: -give },
      { account: p.account, currency: p.currency, amount: give },
    ], `lp withdraw ${p.id}`);
  }

  p.status = "withdrawn";
  p.withdrawn = fromMinor(give);
  positions.set(p.id, p);
  emit("fx.lp.withdrawn", { id: p.id, amount: p.withdrawn });

  return {
    ...p,
    returned: { amount: fromMinor(give), currency: p.currency },
    note: give < want
      ? "Part of your liquidity is still working in unsettled fills. The rest returns as they settle."
      : "Liquidity returned in full. Earnings were paid to your account as they were made.",
  };
});

/* ---- who is providing what, in aggregate. No identity, same rule as depth. ---- */
route("GET", "/v2/fx/lp/pools", () => {
  const byPair = {};
  for (const p of positions.values()) {
    if (p.status !== "active") continue;
    const k = `${p.pair}:${p.currency}`;
    byPair[k] ??= { pair: p.pair, currency: p.currency, committed: 0n, providers: 0, classes: new Set() };
    byPair[k].committed += toMinor(p.committed);
    byPair[k].providers += 1;
    byPair[k].classes.add(p.class);
  }
  return {
    object: "list",
    disclosure: "aggregate",
    data: Object.values(byPair).map((d) => ({
      pair: d.pair, currency: d.currency,
      committed: { amount: fromMinor(d.committed), currency: d.currency },
      providers: d.providers < 3 ? "few" : d.providers < 10 ? "several" : "many",
      provider_classes: [...d.classes].sort(),
    })),
  };
}, { public: true });
