/** Stablecoin FX — the three legs, priced honestly.
 *  Owned by this file. See ../assets.js for the model. */

import { route, ApiError, need, toMinor, fromMinor, ksuid, db, post, balanceOf, emit, collection, now } from "../kernel.js";
import { FIAT, STABLECOINS, isFiat, isStable, legKind, priceLeg, routeFor, CORRIDORS, midOf } from "../assets.js";

const ramps = collection("ramps");

/* ---- what the stack can hold and route ---- */
route("GET", "/v2/assets", () => ({
  object: "list",
  data: [
    ...Object.values(FIAT).map((f) => ({ ...f, kind: "fiat" })),
    ...Object.values(STABLECOINS).map((s) => ({ ...s, kind: "stablecoin" })),
  ],
}), { public: true });

/* ---- corridors: the only leg that carries FX ---- */
route("GET", "/v2/corridors", () => ({
  object: "list",
  data: Object.entries(CORRIDORS).map(([pair, c]) => {
    const [from, to] = pair.split("/");
    const thin = c.base_bps >= 50;
    return {
      pair, from, to,
      depth: { amount: c.depth, currency: from },
      spread_bps: c.base_bps,
      liquidity: thin ? "thin" : "deep",
      settlement: thin ? "when_matched" : "instant",
    };
  }),
}), { public: true });

/* ---- price a single leg ---- */
route("POST", "/v2/fx/quote", ({ body }) => {
  need(body, ["from", "to", "amount"]);
  const from = String(body.from).toUpperCase(), to = String(body.to).toUpperCase();
  const priced = priceLeg(from, to, toMinor(body.amount));
  if (!priced) {
    throw new ApiError("validation-error", 400, `Cannot route ${from} → ${to}`, [
      { field: "from", message: "must be a known fiat or stablecoin", code: "unknown_asset" },
    ]);
  }
  const amount = toMinor(body.amount);
  const rate = priced.rate ? Number(priced.rate) : 1;
  const gross = (Number(amount) / 100) * rate;
  const out = priced.spread_bps == null ? null : gross * (1 - priced.spread_bps / 10000);

  return {
    id: ksuid("quo"),
    leg: priced.kind,
    from, to,
    amount: { amount: body.amount, currency: from },
    receives: out == null ? null : { amount: out.toFixed(2), currency: to },
    ...priced,
    expires_at: new Date(Date.now() + 30000).toISOString(),
    created_at: now(),
  };
});

/* ---- the full cross-border route, leg by leg ---- */
route("POST", "/v2/fx/route", ({ body }) => {
  need(body, ["from", "to", "amount"]);
  const from = String(body.from).toUpperCase(), to = String(body.to).toUpperCase();
  if (!isFiat(from) || !isFiat(to)) {
    throw new ApiError("validation-error", 400, "Route takes two fiat currencies — it shows you the stablecoin path between them");
  }
  const legs = routeFor(from, to);
  if (!legs) throw new ApiError("validation-error", 400, `No stablecoin exists for ${from} or ${to} yet`);

  const startMinor = toMinor(body.amount);
  let running = Number(startMinor) / 100;
  const priced = legs.map((l) => {
    const rate = l.rate ? Number(l.rate) : 1;
    const before = running;
    running = running * rate * (1 - (l.spread_bps ?? 0) / 10000);
    return {
      ...l,
      in: { amount: before.toFixed(2), currency: l.from },
      out: { amount: running.toFixed(2), currency: l.to },
    };
  });

  const totalBps = legs.reduce((n, l) => n + (l.spread_bps ?? 0), 0);
  return {
    id: ksuid("quo"),
    from, to,
    amount: { amount: body.amount, currency: from },
    receives: { amount: running.toFixed(2), currency: to },
    legs: priced,
    total_spread_bps: totalBps,
    note: "One spread, not three. The ramps are 1:1 — only the corridor is priced.",
    expires_at: new Date(Date.now() + 30000).toISOString(),
  };
});

/* ---- on-ramp: fiat in, stablecoin minted 1:1 ---- */
route("POST", "/v2/ramps/on", ({ body, key }) => {
  need(body, ["account", "amount", "to"]);
  const acc = db.accounts.get(body.account);
  if (!acc) throw new ApiError("not-found", 404, `No account ${body.account}`);
  const to = String(body.to).toUpperCase();
  if (!isStable(to)) throw new ApiError("validation-error", 400, `${to} is not a stablecoin`);
  if (STABLECOINS[to].peg !== acc.currency) {
    throw new ApiError("validation-error", 400, `${to} redeems against ${STABLECOINS[to].peg}, not ${acc.currency}. On-ramp is 1:1 — convert first.`);
  }
  const minor = toMinor(body.amount);
  if (balanceOf(acc.id, acc.currency) < minor) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(acc.id, acc.currency))} ${acc.currency}`);
  }

  // 1:1 — the fiat leaves the account, the token appears. No FX.
  post([
    { account: acc.id, currency: acc.currency, amount: -minor },
    { account: `reserve:${STABLECOINS[to].issuer}`, currency: acc.currency, amount: minor },
  ], `on-ramp ${acc.currency}→${to}`);
  post([
    { account: acc.id, currency: to, amount: minor },
    { account: `issuance:${to}`, currency: to, amount: -minor },
  ], `mint ${to}`);

  const r = {
    id: ksuid("rmp"), kind: "on_ramp", account: acc.id,
    from: { amount: body.amount, currency: acc.currency },
    to: { amount: body.amount, currency: to },
    rate: "1.000000", spread_bps: 0,
    issuer: STABLECOINS[to].issuer, status: "settled", created_at: now(), owner: key.id,
  };
  ramps.set(r.id, r);
  emit("ramp.settled", r);
  return r;
});

/* ---- off-ramp: stablecoin redeemed 1:1 back to fiat ---- */
route("POST", "/v2/ramps/off", ({ body, key }) => {
  need(body, ["account", "amount", "from"]);
  const acc = db.accounts.get(body.account);
  if (!acc) throw new ApiError("not-found", 404, `No account ${body.account}`);
  const from = String(body.from).toUpperCase();
  if (!isStable(from)) throw new ApiError("validation-error", 400, `${from} is not a stablecoin`);
  if (STABLECOINS[from].peg !== acc.currency) {
    throw new ApiError("validation-error", 400, `${from} redeems to ${STABLECOINS[from].peg}, not ${acc.currency}`);
  }
  const minor = toMinor(body.amount);
  if (balanceOf(acc.id, from) < minor) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(acc.id, from))} ${from}`);
  }

  post([
    { account: acc.id, currency: from, amount: -minor },
    { account: `issuance:${from}`, currency: from, amount: minor },
  ], `burn ${from}`);
  post([
    { account: acc.id, currency: acc.currency, amount: minor },
    { account: `reserve:${STABLECOINS[from].issuer}`, currency: acc.currency, amount: -minor },
  ], `off-ramp ${from}→${acc.currency}`);

  const r = {
    id: ksuid("rmp"), kind: "off_ramp", account: acc.id,
    from: { amount: body.amount, currency: from },
    to: { amount: body.amount, currency: acc.currency },
    rate: "1.000000", spread_bps: 0,
    issuer: STABLECOINS[from].issuer, status: "settled", created_at: now(), owner: key.id,
  };
  ramps.set(r.id, r);
  emit("ramp.settled", r);
  return r;
});

route("GET", "/v2/ramps", ({ url, key }) => {
  const rows = [...ramps.values()].filter((r) => r.owner === key.id);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return { object: "list", data: rows.slice(0, limit), has_more: rows.length > limit };
});
