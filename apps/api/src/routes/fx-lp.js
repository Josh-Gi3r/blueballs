/** Compatibility liquidity provision for the banking API FX surface.
 *
 * Monetary commitments, pool balances and earnings remain exact minor units.
 * The canonical production FX runtime lives in apps/fx-node; this module keeps
 * historical banking-API liquidity behavior financially coherent in sandbox mode.
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
  positiveMinor,
} from "../kernel.js";
import { isStable } from "../assets.js";

const positions = collection("fxLpPositions");
const earnings = collection("fxLpEarnings");

export const SPREAD_SPLIT_BPS = { provider: 7000, operator: 3000 };
const MAX_SHARE_BPS = 9500;
const CLASS_BONUS_BPS = {
  issuer: 0,
  bank: 500,
  member: 1000,
};
const CLASS_RANK = { issuer: 0, bank: 1, member: 2 };

function classFor(customer, declared) {
  const derived = customer.type === "business" ? "bank" : "member";
  if (
    declared &&
    CLASS_RANK[declared] !== undefined &&
    CLASS_RANK[declared] < CLASS_RANK[derived]
  ) {
    return declared;
  }
  return derived;
}

const shareBpsFor = (klass) =>
  Math.min(MAX_SHARE_BPS, SPREAD_SPLIT_BPS.provider + CLASS_BONUS_BPS[klass]);

const shareBpsOf = (position) =>
  Number.isInteger(position.share_bps)
    ? position.share_bps
    : typeof position.share === "number"
      ? Math.round(position.share * 10000)
      : shareBpsFor(position.class ?? "member");

export const normPair = (pair) => pair.split("/").sort().join("/");

export const poolAccount = (pair, currency) =>
  `lp:${normPair(pair.toUpperCase())}:${currency}`;

route(
  "POST",
  "/v2/fx/lp",
  ({ body, key }) => {
    need(body, ["account", "currency", "amount", "pair"]);
    const account = must(db.accounts, body.account, "account", key);
    if (account.status === "closed") {
      throw new ApiError("conflict", 409, `Account ${account.id} is closed`);
    }

    const customer = db.customers.get(account.customer);
    if (!customer || customer.decision !== "approved") {
      throw new ApiError(
        "tier-insufficient",
        403,
        "Liquidity providers must be verified before committing funds",
      );
    }

    const currency = String(body.currency).toUpperCase();
    if (!isStable(currency)) {
      throw new ApiError(
        "validation-error",
        400,
        `${currency} is not a configured stablecoin`,
      );
    }
    if (account.currency !== currency) {
      throw new ApiError(
        "validation-error",
        400,
        `Account ${account.id} holds ${account.currency}, not ${currency}`,
      );
    }

    const [a, b] = String(body.pair).toUpperCase().split("/");
    if (!a || !b || a === b || (currency !== a && currency !== b)) {
      throw new ApiError(
        "validation-error",
        400,
        `Committed currency must be one side of a two-asset corridor such as ${currency}/USDC`,
      );
    }
    if (!isStable(a) || !isStable(b)) {
      throw new ApiError(
        "validation-error",
        400,
        "Compatibility LP corridors support configured stablecoins only",
      );
    }

    const minor = positiveMinor(body.amount);
    const available = balanceOf(account.id, currency);
    if (available < minor) {
      throw new ApiError(
        "insufficient-balance",
        400,
        `Account holds ${fromMinor(available)} ${currency}`,
      );
    }

    const klass = classFor(customer, body.class);
    const pool = poolAccount(`${a}/${b}`, currency);
    post(
      [
        { account: account.id, currency, amount: -minor },
        { account: pool, currency, amount: minor },
      ],
      `lp commit ${currency} → ${a}/${b}`,
    );

    const position = {
      id: ksuid("lpp"),
      account: account.id,
      customer: account.customer,
      class: klass,
      pair: `${a}/${b}`,
      currency,
      committed: fromMinor(minor),
      share_bps: shareBpsFor(klass),
      status: "active",
      created_at: now(),
      owner: principalId(key),
    };
    positions.set(position.id, position);
    emit(
      "fx.lp.committed",
      { id: position.id, pair: position.pair, currency },
      { tenantId: position.owner },
    );

    return {
      ...position,
      share: `${position.share_bps / 100}%`,
      earned: { amount: "0.00", currency },
      class_note:
        body.class && body.class !== klass
          ? `Provider class follows the verified customer record; this position is recorded as ${klass}.`
          : undefined,
      note: `This position receives ${position.share_bps / 100}% of attributed spread when pooled liquidity is consumed.`,
    };
  },
  { created: true },
);

/** Credit active positions pro-rata when a fill consumes pooled liquidity. */
export function creditProviders(pair, currency, spreadMinor, fillId) {
  const active = [...positions.values()].filter(
    (position) =>
      position.status === "active" &&
      normPair(position.pair) === normPair(pair) &&
      position.currency === currency,
  );
  if (!active.length || spreadMinor <= 0n) return [];

  const total = active.reduce(
    (sum, position) => sum + toMinor(position.committed),
    0n,
  );
  if (total <= 0n) return [];

  const credited = [];
  for (const position of active) {
    const gross =
      (spreadMinor * toMinor(position.committed)) / total;
    const providerCut =
      (gross * BigInt(shareBpsOf(position))) / 10000n;
    if (providerCut <= 0n) continue;

    post(
      [
        { account: `spread:${pair}`, currency, amount: -providerCut },
        { account: position.account, currency, amount: providerCut },
      ],
      `lp earning ${fillId}`,
    );

    const earning = {
      id: ksuid("lpe"),
      position: position.id,
      fill: fillId,
      pair,
      currency,
      amount: fromMinor(providerCut),
      share_bps: shareBpsOf(position),
      at: now(),
      owner: position.owner,
    };
    earnings.set(earning.id, earning);
    credited.push(earning);
  }

  for (const earning of credited) {
    emit(
      "fx.lp.earned",
      {
        fill: fillId,
        position: earning.position,
        amount: earning.amount,
        currency,
      },
      { tenantId: earning.owner },
    );
  }
  return credited;
}

route("GET", "/v2/fx/lp", ({ key }) => {
  const mine = visibleTo([...positions.values()], key);
  return {
    object: "list",
    data: mine.map((position) => {
      const earned = [...earnings.values()]
        .filter((earning) => earning.position === position.id)
        .reduce((sum, earning) => sum + toMinor(earning.amount), 0n);
      return {
        ...position,
        share: `${shareBpsOf(position) / 100}%`,
        earned: { amount: fromMinor(earned), currency: position.currency },
        fills: [...earnings.values()].filter(
          (earning) => earning.position === position.id,
        ).length,
      };
    }),
  };
});

route("GET", "/v2/fx/lp/earnings", ({ key, url }) => {
  const rows = visibleTo([...earnings.values()], key);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return {
    object: "list",
    data: rows.slice(0, limit),
    has_more: rows.length > limit,
  };
});

route("POST", "/v2/fx/lp/:id/withdraw", ({ params, key }) => {
  const position = must(positions, params.id, "position", key);
  if (position.status !== "active") {
    throw new ApiError("conflict", 409, "Position is not active");
  }

  const pool = poolAccount(position.pair, position.currency);
  const available = balanceOf(pool, position.currency);
  const committed = toMinor(position.committed);

  // A position is either returned in full or left active. Marking a partially
  // returned position withdrawn would silently destroy the remaining LP claim.
  if (available < committed) {
    throw new ApiError(
      "liquidity-in-use",
      409,
      `Pool currently has ${fromMinor(available)} ${position.currency} available against ${position.committed} committed; the position remains active until enough same-asset inventory is available`,
    );
  }

  post(
    [
      { account: pool, currency: position.currency, amount: -committed },
      { account: position.account, currency: position.currency, amount: committed },
    ],
    `lp withdraw ${position.id}`,
  );

  position.status = "withdrawn";
  position.withdrawn = fromMinor(committed);
  position.withdrawn_at = now();
  positions.set(position.id, position);
  emit(
    "fx.lp.withdrawn",
    { id: position.id, amount: position.withdrawn },
    { tenantId: position.owner },
  );

  return {
    ...position,
    returned: { amount: fromMinor(committed), currency: position.currency },
  };
});

route(
  "GET",
  "/v2/fx/lp/pools",
  () => {
    const byPair = {};
    for (const position of positions.values()) {
      if (position.status !== "active") continue;
      const key = `${normPair(position.pair)}:${position.currency}`;
      byPair[key] ??= {
        pair: normPair(position.pair),
        currency: position.currency,
        committed: 0n,
        providers: 0,
        classes: new Set(),
      };
      byPair[key].committed += toMinor(position.committed);
      byPair[key].providers += 1;
      byPair[key].classes.add(position.class);
    }
    return {
      object: "list",
      disclosure: "aggregate",
      data: Object.values(byPair).map((pool) => ({
        pair: pool.pair,
        currency: pool.currency,
        committed: {
          amount: fromMinor(pool.committed),
          currency: pool.currency,
        },
        providers:
          pool.providers < 3 ? "few" : pool.providers < 10 ? "several" : "many",
        provider_classes: [...pool.classes].sort(),
      })),
    };
  },
  { public: true },
);
