/** Stablecoin FX — the three legs, priced honestly.
 * Owned by this file. See ../assets.js for the model.
 */

import {
  route,
  ApiError,
  need,
  toMinor,
  fromMinor,
  ksuid,
  db,
  post,
  balanceOf,
  emit,
  collection,
  now,
  must,
  visibleTo,
  principalId,
} from "../kernel.js";
import {
  FIAT,
  STABLECOINS,
  isFiat,
  isStable,
  priceLeg,
  routeFor,
  CORRIDORS,
  rampSettlement,
  RAMP_GAP_POLICY,
} from "../assets.js";
import { convertMinor } from "../exact-rates.js";

const ramps = collection("ramps");

/* ---- what the stack can hold and route ---- */
route(
  "GET",
  "/v2/assets",
  () => ({
    object: "list",
    data: [
      ...Object.values(FIAT).map((f) => ({ ...f, kind: "fiat" })),
      ...Object.values(STABLECOINS).map((s) => ({ ...s, kind: "stablecoin" })),
    ],
  }),
  { public: true },
);

/* ---- corridors: the only leg that carries FX ---- */
route(
  "GET",
  "/v2/corridors",
  () => ({
    object: "list",
    data: Object.entries(CORRIDORS).map(([pair, c]) => {
      const [from, to] = pair.split("/");
      const thin = c.base_bps >= 50;
      return {
        pair,
        from,
        to,
        depth: { amount: c.depth, currency: from },
        spread_bps: c.base_bps,
        liquidity: thin ? "thin" : "deep",
        settlement: thin ? "when_matched" : "instant",
      };
    }),
  }),
  { public: true },
);

/* ---- price a single leg ---- */
route("POST", "/v2/fx/quote", ({ body }) => {
  need(body, ["from", "to", "amount"]);
  const from = String(body.from).toUpperCase();
  const to = String(body.to).toUpperCase();
  const amount = toMinor(body.amount);
  const priced = priceLeg(from, to, amount);
  if (!priced) {
    throw new ApiError(
      "validation-error",
      400,
      `Cannot route ${from} → ${to}`,
      [
        {
          field: "from",
          message: "must be a known fiat or stablecoin",
          code: "unknown_asset",
        },
      ],
    );
  }

  const out =
    priced.spread_bps == null
      ? null
      : convertMinor(amount, from, to, priced.spread_bps);

  return {
    id: ksuid("quo"),
    leg: priced.kind,
    from,
    to,
    amount: { amount: body.amount, currency: from },
    receives:
      out == null ? null : { amount: fromMinor(out), currency: to },
    ...priced,
    expires_at: new Date(Date.now() + 30000).toISOString(),
    created_at: now(),
  };
});

/* ---- the full cross-border route, leg by leg ---- */
route("POST", "/v2/fx/route", ({ body }) => {
  need(body, ["from", "to", "amount"]);
  const from = String(body.from).toUpperCase();
  const to = String(body.to).toUpperCase();
  if (!isFiat(from) || !isFiat(to)) {
    throw new ApiError(
      "validation-error",
      400,
      "Route takes two fiat currencies — it shows you the stablecoin path between them",
    );
  }
  const legs = routeFor(from, to);
  if (!legs) {
    throw new ApiError(
      "validation-error",
      400,
      `No stablecoin exists for ${from} or ${to} yet`,
    );
  }

  let running = toMinor(body.amount);
  const priced = legs.map((leg) => {
    const before = running;
    running = convertMinor(
      running,
      leg.from,
      leg.to,
      leg.spread_bps ?? 0,
    );
    return {
      ...leg,
      in: { amount: fromMinor(before), currency: leg.from },
      out: { amount: fromMinor(running), currency: leg.to },
    };
  });

  const totalBps = legs.reduce((n, leg) => n + (leg.spread_bps ?? 0), 0);
  return {
    id: ksuid("quo"),
    from,
    to,
    amount: { amount: body.amount, currency: from },
    receives: { amount: fromMinor(running), currency: to },
    legs: priced,
    total_spread_bps: totalBps,
    note: "One spread, not three. The ramps are 1:1 — only the corridor is priced.",
    settlement: (() => {
      const inbound = rampSettlement(from);
      const outbound = rampSettlement(to);
      const worst = [inbound, outbound]
        .filter((item) => item.window_seconds != null)
        .reduce(
          (a, b) => (a.window_seconds >= b.window_seconds ? a : b),
          { window_seconds: 0 },
        );
      const blocked = [
        inbound.rail ? null : from,
        outbound.rail ? null : to,
      ].filter(Boolean);
      return {
        on_ramp: inbound,
        off_ramp: outbound,
        deliverable: blocked.length === 0,
        ...(blocked.length
          ? {
              blocked_on: blocked,
              blocked_reason: `No settlement rail is configured for ${blocked.join(" or ")}, so that leg cannot be delivered. The corridor price above is indicative only.`,
            }
          : {}),
        end_to_end_seconds: blocked.length
          ? null
          : (worst.window_seconds ?? null),
        corridor_leg_atomic: true,
        route_atomic: false,
        rate_risk_borne_by: RAMP_GAP_POLICY,
        note:
          "The corridor leg settles atomically — both sides post together or neither does. " +
          "The fiat ramps either side ride external rails and do not, so the route as a whole is not atomic. " +
          "The rate is struck when the corridor leg executes.",
      };
    })(),
    expires_at: new Date(Date.now() + 30000).toISOString(),
  };
});

/* ---- on-ramp: fiat in, stablecoin minted 1:1 ---- */
route("POST", "/v2/ramps/on", ({ body, key }) => {
  need(body, ["account", "amount", "to"]);
  const acc = must(db.accounts, body.account, "account", key);
  const to = String(body.to).toUpperCase();
  if (!isStable(to)) {
    throw new ApiError("validation-error", 400, `${to} is not a stablecoin`);
  }
  if (STABLECOINS[to].peg !== acc.currency) {
    throw new ApiError(
      "validation-error",
      400,
      `${to} redeems against ${STABLECOINS[to].peg}, not ${acc.currency}. On-ramp is 1:1 — convert first.`,
    );
  }
  const minor = toMinor(body.amount);
  if (balanceOf(acc.id, acc.currency) < minor) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(acc.id, acc.currency))} ${acc.currency}`,
    );
  }

  post(
    [
      { account: acc.id, currency: acc.currency, amount: -minor },
      {
        account: `reserve:${STABLECOINS[to].issuer}`,
        currency: acc.currency,
        amount: minor,
      },
    ],
    `on-ramp ${acc.currency}→${to}`,
  );
  post(
    [
      { account: acc.id, currency: to, amount: minor },
      { account: `issuance:${to}`, currency: to, amount: -minor },
    ],
    `mint ${to}`,
  );

  const r = {
    id: ksuid("rmp"),
    kind: "on_ramp",
    account: acc.id,
    from: { amount: body.amount, currency: acc.currency },
    to: { amount: body.amount, currency: to },
    rate: "1.000000",
    spread_bps: 0,
    issuer: STABLECOINS[to].issuer,
    status: "settled",
    created_at: now(),
    owner: principalId(key),
    settlement: (() => {
      const settlement = rampSettlement(acc.currency);
      return {
        rail: settlement.rail,
        basis: settlement.basis,
        window_seconds: settlement.window_seconds,
        atomic_with_swap: false,
        rate_risk_borne_by: RAMP_GAP_POLICY,
        note:
          RAMP_GAP_POLICY === "taker"
            ? "The corridor rate is struck when you swap, not when this ramp was requested. Over the rail's window it can move, and that movement is yours."
            : `Movement across the ramp window is carried by: ${RAMP_GAP_POLICY}.`,
      };
    })(),
  };
  ramps.set(r.id, r);
  emit("ramp.settled", r, { tenantId: r.owner });
  return r;
});

/* ---- off-ramp: stablecoin redeemed 1:1 back to fiat ---- */
route("POST", "/v2/ramps/off", ({ body, key }) => {
  need(body, ["account", "amount", "from"]);
  const acc = must(db.accounts, body.account, "account", key);
  const from = String(body.from).toUpperCase();
  if (!isStable(from)) {
    throw new ApiError("validation-error", 400, `${from} is not a stablecoin`);
  }
  if (STABLECOINS[from].peg !== acc.currency) {
    throw new ApiError(
      "validation-error",
      400,
      `${from} redeems to ${STABLECOINS[from].peg}, not ${acc.currency}`,
    );
  }
  const minor = toMinor(body.amount);
  if (balanceOf(acc.id, from) < minor) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(acc.id, from))} ${from}`,
    );
  }

  post(
    [
      { account: acc.id, currency: from, amount: -minor },
      { account: `issuance:${from}`, currency: from, amount: minor },
    ],
    `burn ${from}`,
  );
  post(
    [
      { account: acc.id, currency: acc.currency, amount: minor },
      {
        account: `reserve:${STABLECOINS[from].issuer}`,
        currency: acc.currency,
        amount: -minor,
      },
    ],
    `off-ramp ${from}→${acc.currency}`,
  );

  const r = {
    id: ksuid("rmp"),
    kind: "off_ramp",
    account: acc.id,
    from: { amount: body.amount, currency: from },
    to: { amount: body.amount, currency: acc.currency },
    rate: "1.000000",
    spread_bps: 0,
    issuer: STABLECOINS[from].issuer,
    status: "settled",
    created_at: now(),
    owner: principalId(key),
  };
  ramps.set(r.id, r);
  emit("ramp.settled", r, { tenantId: r.owner });
  return r;
});

route("GET", "/v2/ramps", ({ url, key }) => {
  const rows = visibleTo([...ramps.values()], key);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return {
    object: "list",
    data: rows.slice(0, limit),
    has_more: rows.length > limit,
  };
});
