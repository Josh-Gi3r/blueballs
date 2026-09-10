/** Compatibility stablecoin FX market.
 *
 * This surface remains for banking-API compatibility; the canonical FX runtime
 * lives in apps/fx-node. The compatibility engine still obeys the same financial
 * invariants: exact money, explicit source/destination accounts, attributable
 * counterparties, bounded principal risk and atomic request-level settlement. */

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
  paginate,
} from "../kernel.js";
import { isStable } from "../assets.js";
import { priceCorridor, principalQuote, DEFAULT_APPETITE } from "../pricing.js";
import * as PRICING from "../pricing.js";
import {
  convertAtMid,
  convertWithSpread,
  percentageSaved,
} from "../fx-exact-math.js";
import { creditProviders, poolAccount } from "./fx-lp.js";

const intents = collection("fxIntents");
const fills = collection("fxFills");
const batches = collection("fxBatches");
const appetite = collection("fxAppetite");
const rfqs = collection("fxRfqs");

const pairKey = (a, b) => `${a}/${b}`;
const LADDER = { p2p: 1, lp: 1.25, principal: 2 };
const RFQ_WINDOW_MS = 60_000;
const RFQ_FIRMNESS_BPS = 2;

const pseudonym = (customerId) =>
  "ctp_" + Buffer.from(customerId).toString("base64url").slice(-10);

function restingDepth() {
  const out = {};
  for (const intent of intents.values()) {
    if (intent.status !== "open" || intent.mode !== "maker") continue;
    if (Date.parse(intent.expires_at) <= Date.now()) continue;
    const key = pairKey(intent.from, intent.to);
    out[key] = (out[key] ?? 0n) + BigInt(intent.remaining);
  }
  return out;
}

function priceNow(from, to, sizeMinor = 0n) {
  return priceCorridor(restingDepth(), from, to, sizeMinor);
}

function appetiteFor(pair) {
  return (
    appetite.get(pair) ?? {
      pair,
      ...DEFAULT_APPETITE,
      currency: pair.split("/")[0],
    }
  );
}

function principalPosition(currency) {
  const value = balanceOf(`principal:${currency}`, currency);
  return value < 0n ? -value : value;
}

function validatePair(from, to) {
  if (!isStable(from) || !isStable(to)) {
    throw new ApiError(
      "validation-error",
      400,
      "Swap legs must both be stablecoins — use /v2/ramps to cross fiat",
    );
  }
  if (from === to)
    throw new ApiError("validation-error", 400, "from and to must differ");
}

/** Resolve explicit source/output accounts. For pre-1.0 compatibility an omitted
 * receive_account may be auto-resolved only when exactly one same-customer account
 * exists in the target currency. Ambiguity fails closed. */
function settlementAccounts(body, key, from, to) {
  const source = must(db.accounts, body.account, "account", key);
  if (source.currency !== from) {
    throw new ApiError(
      "validation-error",
      400,
      `Source account ${source.id} holds ${source.currency}, not ${from}`,
    );
  }

  let receive = null;
  if (body.receive_account) {
    receive = must(db.accounts, body.receive_account, "receive account", key);
  } else {
    const candidates = visibleTo([...db.accounts.values()], key).filter(
      (candidate) =>
        candidate.customer === source.customer &&
        candidate.currency === to &&
        candidate.status !== "closed",
    );
    if (candidates.length === 1) receive = candidates[0];
    else {
      throw new ApiError(
        "validation-error",
        400,
        candidates.length
          ? `Multiple ${to} accounts exist for customer ${source.customer}; provide receive_account explicitly`
          : `No ${to} receive account exists for customer ${source.customer}; create one or provide receive_account`,
      );
    }
  }

  if (receive.customer !== source.customer) {
    throw new ApiError(
      "validation-error",
      400,
      "Source and receive accounts must belong to the same customer",
    );
  }
  if (receive.currency !== to) {
    throw new ApiError(
      "validation-error",
      400,
      `Receive account ${receive.id} holds ${receive.currency}, not ${to}`,
    );
  }
  if (receive.status === "closed") {
    throw new ApiError("conflict", 409, `Receive account ${receive.id} is closed`);
  }
  return { source, receive };
}

function scaledBps(base, multiplier) {
  return Math.round(base * multiplier * 10_000) / 10_000;
}

/* =========================== DEPTH =========================== */
route(
  "GET",
  "/v2/fx/depth",
  ({ url }) => {
    const requestedPair = url.searchParams.get("pair")?.toUpperCase() ?? null;
    const live = [...intents.values()].filter(
      (intent) =>
        intent.status === "open" &&
        intent.mode === "maker" &&
        Date.parse(intent.expires_at) > Date.now(),
    );
    const byPair = {};
    for (const intent of live) {
      const pair = pairKey(intent.from, intent.to);
      if (requestedPair && pair !== requestedPair) continue;
      byPair[pair] ??= {
        pair,
        from: intent.from,
        to: intent.to,
        resting: 0n,
        orders: 0,
      };
      byPair[pair].resting += BigInt(intent.remaining);
      byPair[pair].orders += 1;
    }

    return {
      object: "list",
      disclosure: "aggregate",
      note:
        "Aggregate depth only. Maker identity and per-order detail remain private.",
      data: Object.values(byPair).map((depth) => {
        const price = priceNow(depth.from, depth.to);
        return {
          pair: depth.pair,
          from: depth.from,
          to: depth.to,
          resting: { amount: fromMinor(depth.resting), currency: depth.from },
          makers:
            depth.orders < 3 ? "few" : depth.orders < 10 ? "several" : "many",
          spread_bps: price.spread_bps,
          rebate_bps: price.rebate_bps,
          imbalance: price.imbalance,
          liquidity: price.liquidity,
        };
      }),
    };
  },
  { public: true },
);

/* =========================== INTENTS =========================== */
route(
  "POST",
  "/v2/fx/intents",
  ({ body, key }) => {
    need(body, ["account", "from", "to", "amount", "min_receive"]);
    const from = String(body.from).toUpperCase();
    const to = String(body.to).toUpperCase();
    validatePair(from, to);
    const { source, receive } = settlementAccounts(body, key, from, to);

    const amount = positiveMinor(body.amount);
    positiveMinor(body.min_receive, "min_receive");
    if (balanceOf(source.id, from) < amount) {
      throw new ApiError(
        "insufficient-balance",
        400,
        `Account holds ${fromMinor(balanceOf(source.id, from))} ${from}`,
      );
    }

    const customer = db.customers.get(source.customer);
    if (!customer || customer.decision !== "approved") {
      throw new ApiError(
        "tier-insufficient",
        403,
        "Counterparties must be verified before they can provide or take liquidity",
      );
    }

    const mode = body.mode === "maker" ? "maker" : "taker";
    const ttlSeconds = body.ttl_seconds ?? 300;
    const intent = {
      id: ksuid("int"),
      account: source.id,
      receive_account: receive.id,
      customer: source.customer,
      counterparty: pseudonym(source.customer),
      from,
      to,
      amount: body.amount,
      remaining: amount.toString(),
      min_receive: body.min_receive,
      signature: body.signature ?? null,
      signed: !!body.signature,
      mode,
      status: "open",
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      created_at: now(),
      owner: principalId(key),
    };
    intents.set(intent.id, intent);
    emit(
      "fx.intent.created",
      { id: intent.id, pair: pairKey(from, to) },
      { tenantId: intent.owner },
    );

    if (mode === "maker") {
      return {
        ...intents.get(intent.id),
        filled: false,
        fill_legs: [],
        resting: true,
        note: "Resting on the private book until crossed, cancelled or expired.",
      };
    }

    const result = matchIntent(intent);
    return { ...intents.get(intent.id), ...result };
  },
  { created: true },
);

function matchIntent(intent) {
  const plan = [];
  let remaining = BigInt(intent.remaining);

  const opposing = [...intents.values()]
    .filter(
      (maker) =>
        maker.status === "open" &&
        maker.id !== intent.id &&
        maker.mode === "maker" &&
        maker.from === intent.to &&
        maker.to === intent.from &&
        maker.customer !== intent.customer &&
        Date.parse(maker.expires_at) > Date.now(),
    )
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  for (const maker of opposing) {
    if (remaining <= 0n) break;
    const makerRemaining = BigInt(maker.remaining);
    const makerCapacityInTakerCurrency = convertAtMid(
      makerRemaining,
      intent.to,
      intent.from,
    );
    const take =
      remaining < makerCapacityInTakerCurrency
        ? remaining
        : makerCapacityInTakerCurrency;
    if (take <= 0n) continue;

    const priced = priceNow(intent.from, intent.to, take);
    const bps = scaledBps(priced.spread_bps, LADDER.p2p);
    const grossOut = convertAtMid(take, intent.from, intent.to);
    const out = convertWithSpread(take, intent.from, intent.to, bps);
    if (balanceOf(maker.account, intent.to) < grossOut) continue;

    plan.push({
      source: "p2p",
      counterInAccount: maker.receive_account,
      counterOutAccount: maker.account,
      take,
      grossOut,
      out,
      bps,
      maker,
      makerRemaining: (makerRemaining - grossOut).toString(),
      leg: {
        source: "p2p",
        counterparty: maker.counterparty,
        in: fromMinor(take),
        out: fromMinor(out),
        spread_bps: Math.round(bps * 100) / 100,
      },
    });
    remaining -= take;
  }

  for (const source of ["lp", "principal"]) {
    if (remaining <= 0n) break;
    const priced = priceNow(intent.from, intent.to, remaining);
    let bps = scaledBps(priced.spread_bps, LADDER[source]);
    let counterInAccount;
    let counterOutAccount;

    if (source === "lp") {
      const pair = pairKey(intent.from, intent.to);
      counterInAccount = poolAccount(pair, intent.from);
      counterOutAccount = poolAccount(pair, intent.to);
      const grossOut = convertAtMid(remaining, intent.from, intent.to);
      if (balanceOf(counterOutAccount, intent.to) < grossOut) {
        plan.push({
          declined: true,
          leg: {
            source: "lp",
            declined: true,
            reason: "corridor output pool cannot cover the gross settlement amount",
          },
        });
        continue;
      }
    } else {
      const pair = pairKey(intent.from, intent.to);
      const principal = principalQuote(
        appetiteFor(pair),
        principalPosition(intent.from),
        remaining,
        priced.spread_bps,
      );
      if (!principal.available) {
        plan.push({
          declined: true,
          leg: {
            source: "principal",
            declined: true,
            reason: principal.reason,
          },
        });
        break;
      }
      bps = principal.spread_bps;
      counterInAccount = `principal:${intent.from}`;
      counterOutAccount = `principal:${intent.to}`;
    }

    const grossOut = convertAtMid(remaining, intent.from, intent.to);
    const out = convertWithSpread(remaining, intent.from, intent.to, bps);
    plan.push({
      source,
      counterInAccount,
      counterOutAccount,
      take: remaining,
      grossOut,
      out,
      bps,
      leg: {
        source,
        counterparty: source,
        in: fromMinor(remaining),
        out: fromMinor(out),
        spread_bps: Math.round(bps * 100) / 100,
        pricing: priced.reason,
      },
    });
    remaining = 0n;
  }

  const totalOut = plan.reduce(
    (total, step) => total + (step.declined ? 0n : step.out),
    0n,
  );
  if (totalOut < toMinor(intent.min_receive)) {
    throw new ApiError(
      "validation-error",
      400,
      `Best available fill is ${fromMinor(totalOut)} ${intent.to}, below your min_receive of ${intent.min_receive}`,
    );
  }

  const legs = [];
  for (const step of plan) {
    if (step.declined) {
      legs.push(step.leg);
      continue;
    }
    settle(
      intent,
      step.counterInAccount,
      step.counterOutAccount,
      step.take,
      step.grossOut,
      step.out,
      step.source,
      step.bps,
    );
    if (step.maker) {
      step.maker.remaining = step.makerRemaining;
      if (BigInt(step.maker.remaining) <= 0n) step.maker.status = "filled";
      intents.set(step.maker.id, step.maker);
    }
    legs.push(step.leg);
  }

  const stored = intents.get(intent.id);
  stored.remaining = remaining.toString();
  stored.status = remaining <= 0n ? "filled" : "open";
  intents.set(stored.id, stored);

  return {
    filled: legs.some((leg) => !leg.declined),
    fill_legs: legs,
    received: { amount: fromMinor(totalOut), currency: intent.to },
    receive_account: intent.receive_account,
    ladder: "p2p → lp → principal",
  };
}

/** Request-level atomic settlement. The counterparty may have separate input and
 * output accounts; LP/principal use currency-specific system accounts. */
function settle(
  intent,
  counterInAccount,
  counterOutAccount,
  inMinor,
  grossOutMinor,
  outMinor,
  source,
  bps,
) {
  post(
    [
      { account: intent.account, currency: intent.from, amount: -inMinor },
      { account: counterInAccount, currency: intent.from, amount: inMinor },
    ],
    `swap ${intent.id} ${source} input`,
  );
  post(
    [
      {
        account: counterOutAccount,
        currency: intent.to,
        amount: -outMinor,
      },
      {
        account: intent.receive_account,
        currency: intent.to,
        amount: outMinor,
      },
    ],
    `swap ${intent.id} ${source} output`,
  );

  const spread = grossOutMinor - outMinor;
  if (spread > 0n) {
    post(
      [
        {
          account: counterOutAccount,
          currency: intent.to,
          amount: -spread,
        },
        {
          account: `spread:${pairKey(intent.from, intent.to)}`,
          currency: intent.to,
          amount: spread,
        },
      ],
      `spread ${intent.id} ${source}`,
    );
  }

  const fill = {
    id: ksuid("fil"),
    intent: intent.id,
    source,
    pair: pairKey(intent.from, intent.to),
    in: { amount: fromMinor(inMinor), currency: intent.from },
    out: { amount: fromMinor(outMinor), currency: intent.to },
    spread_bps: Math.round(bps * 100) / 100,
    taker: intent.counterparty,
    taker_customer: intent.customer,
    settled_at: now(),
    owner: intent.owner,
  };
  fills.set(fill.id, fill);
  emit(
    "fx.fill.settled",
    { id: fill.id, pair: fill.pair, source },
    { tenantId: fill.owner },
  );

  if (source === "lp" && spread > 0n) {
    const credited = creditProviders(
      pairKey(intent.from, intent.to),
      intent.to,
      spread,
      fill.id,
    );
    if (credited.length) {
      fill.spread_shared_with = credited.length;
      fill.spread = fromMinor(spread);
      fills.set(fill.id, fill);
    }
  }
}

route("GET", "/v2/fx/intents", ({ url, key }) =>
  paginate(visibleTo([...intents.values()], key), url),
);

route("POST", "/v2/fx/intents/:id/cancel", ({ params, key }) => {
  const intent = must(intents, params.id, "intent", key);
  if (intent.status === "filled")
    throw new ApiError("conflict", 409, "Already filled");
  if (intent.status === "cancelled")
    throw new ApiError("conflict", 409, "Already cancelled");
  intent.status = "cancelled";
  intent.cancelled_at = now();
  emit(
    "fx.intent.cancelled",
    { id: intent.id },
    { tenantId: intent.owner },
  );
  return intent;
});

/* =========================== FILLS / NETTING =========================== */
route(
  "GET",
  "/v2/fx/fills",
  ({ url }) => {
    const rows = [...fills.values()].map(
      ({ taker_customer: _customer, owner: _owner, ...fill }) => fill,
    );
    const page = paginate(rows, url);
    return {
      ...page,
      note:
        "Counterparties appear as pseudonyms. The operator retains private attribution for compliance.",
    };
  },
  { access: "GLOBAL_READ" },
);

route(
  "POST",
  "/v2/fx/net",
  ({ key }) => {
    const unsettled = [...fills.values()].filter((fill) => !fill.batch);
    const net = {};
    let grossUsd = 0n;
    const participants = new Set();

    for (const fill of unsettled) {
      const [a, b] = fill.pair.split("/");
      const normalized = [a, b].sort().join("/");
      net[normalized] ??= { pair: normalized, [a]: 0n, [b]: 0n };
      const input = toMinor(fill.in.amount);
      const output = toMinor(fill.out.amount);
      net[normalized][a] = (net[normalized][a] ?? 0n) - input;
      net[normalized][b] = (net[normalized][b] ?? 0n) + output;
      grossUsd += convertAtMid(input, a, "USD");
      if (fill.owner) participants.add(fill.owner);
    }

    let residualUsd = 0n;
    const rows = Object.values(net).map((position) => {
      const [a, b] = position.pair.split("/");
      const absA = position[a] < 0n ? -position[a] : position[a];
      const absB = position[b] < 0n ? -position[b] : position[b];
      const aUsd = convertAtMid(absA, a, "USD");
      const bUsd = convertAtMid(absB, b, "USD");
      const settleCurrency = aUsd >= bUsd ? a : b;
      const settleAmount = settleCurrency === a ? absA : absB;
      residualUsd += aUsd >= bUsd ? aUsd : bUsd;
      return {
        pair: position.pair,
        net_position: {
          [a]: fromMinor(position[a]),
          [b]: fromMinor(position[b]),
        },
        residual_to_settle: {
          amount: fromMinor(settleAmount),
          currency: settleCurrency,
        },
      };
    });

    const batch = {
      id: ksuid("bat"),
      fills: unsettled.length,
      gross: fromMinor(grossUsd),
      residual: fromMinor(residualUsd),
      reporting_currency: "USD",
      saved_pct: percentageSaved(residualUsd, grossUsd),
      rows,
      participant_tenants: [...participants].sort(),
      created_at: now(),
      owner: principalId(key),
    };
    for (const fill of unsettled) {
      fill.batch = batch.id;
      fills.set(fill.id, fill);
    }
    batches.set(batch.id, batch);
    emit(
      "fx.batch.netted",
      { id: batch.id, fills: batch.fills },
      { tenantId: batch.owner },
    );

    const { participant_tenants: _participants, ...publicBatch } = batch;
    return {
      ...publicBatch,
      note:
        "Gross and residual are normalized to USD reference value solely for the netting-efficiency ratio; settlement remains per asset in rows.",
    };
  },
  { access: "OPERATOR" },
);

route("GET", "/v2/fx/batches", ({ url, key }) => {
  const tenant = principalId(key);
  const rows = [...batches.values()]
    .filter((batch) => batch.participant_tenants?.includes(tenant))
    .map(({ participant_tenants: _participants, ...batch }) => batch);
  return paginate(rows, url);
});

/* =========================== PRICING =========================== */
route(
  "GET",
  "/v2/fx/price",
  ({ url }) => {
    const from = (url.searchParams.get("from") || "").toUpperCase();
    const to = (url.searchParams.get("to") || "").toUpperCase();
    validatePair(from, to);
    const size = url.searchParams.get("size")
      ? positiveMinor(url.searchParams.get("size"), "size")
      : 0n;
    const price = priceNow(from, to, size);
    const reverse = priceNow(to, from, size);
    return {
      pair: pairKey(from, to),
      ...price,
      reverse_direction: {
        pair: pairKey(to, from),
        spread_bps: reverse.spread_bps,
        rebate_bps: reverse.rebate_bps,
      },
      note:
        "Derived from live book state using fixed-point monetary arithmetic.",
    };
  },
  { public: true },
);

route(
  "GET",
  "/v2/fx/appetite",
  () => ({
    object: "list",
    data: [...appetite.values()].length
      ? [...appetite.values()]
      : [{ pair: "*", ...DEFAULT_APPETITE }],
  }),
  { access: "GLOBAL_READ" },
);

route(
  "PUT",
  "/v2/fx/appetite",
  ({ body, key }) => {
    need(body, ["pair"]);
    const pair = String(body.pair).toUpperCase();
    const [from, to] = pair.split("/");
    validatePair(from, to);
    if (body.max_position !== undefined)
      positiveMinor(body.max_position, "max_position");
    if (
      body.markup_bps !== undefined &&
      (!Number.isFinite(body.markup_bps) ||
        body.markup_bps < 0 ||
        body.markup_bps > 10_000)
    ) {
      throw new ApiError(
        "validation-error",
        400,
        "markup_bps must be a finite number between 0 and 10000",
      );
    }
    const value = {
      pair,
      ...DEFAULT_APPETITE,
      ...body,
      pair,
      currency: from,
    };
    appetite.set(pair, value);
    emit("fx.appetite.updated", value, { tenantId: principalId(key) });
    return value;
  },
  { access: "OPERATOR" },
);

route(
  "GET",
  "/v2/fx/pricing-model",
  () => ({
    base_bps: PRICING.BASE_BPS,
    max_skew_bps: PRICING.MAX_SKEW_BPS,
    rebate_threshold: PRICING.REBATE_THRESHOLD,
    max_rebate_bps: PRICING.MAX_REBATE_BPS,
    thin_depth: PRICING.THIN_DEPTH,
    arithmetic: "fixed_point",
    formula: [
      "imbalance = (depth_with_flow - depth_against_flow) / total_depth",
      "impact = min(1, size / depth_against_flow)",
      "spread = base + max_skew * max(0, imbalance) + max_skew * 0.4 * impact",
      "correcting flow beyond the threshold receives a bounded rebate",
    ],
    note:
      "All monetary depth and size arithmetic is integer/fixed-point; bounded bps and ratios are serialized as numbers.",
  }),
  { public: true },
);

/* =========================== RFQ =========================== */
route(
  "POST",
  "/v2/fx/rfq",
  ({ body, key }) => {
    need(body, ["account", "from", "to", "amount"]);
    const from = String(body.from).toUpperCase();
    const to = String(body.to).toUpperCase();
    validatePair(from, to);
    const { source, receive } = settlementAccounts(body, key, from, to);

    const customer = db.customers.get(source.customer);
    if (!customer || customer.decision !== "approved") {
      throw new ApiError(
        "tier-insufficient",
        403,
        "Counterparties must be verified before they can request firm liquidity",
      );
    }
    if (customer.type !== "business") {
      throw new ApiError(
        "tier-insufficient",
        403,
        "Firm quotes are available to verified business/integrator customers",
      );
    }

    const size = positiveMinor(body.amount);
    const pair = pairKey(from, to);
    const priced = priceNow(from, to, size);
    const principal = principalQuote(
      appetiteFor(pair),
      principalPosition(from),
      size,
      priced.spread_bps,
    );
    if (!principal.available) {
      throw new ApiError(
        "conflict",
        409,
        `No firm price available for that size: ${principal.reason}`,
      );
    }

    const bps = principal.spread_bps + RFQ_FIRMNESS_BPS;
    const receives = convertWithSpread(size, from, to, bps);
    const rfq = {
      id: ksuid("rfq"),
      account: source.id,
      receive_account: receive.id,
      customer: source.customer,
      counterparty: pseudonym(source.customer),
      pair,
      from,
      to,
      amount: { amount: body.amount, currency: from },
      receives: { amount: fromMinor(receives), currency: to },
      locked_bps: Math.round(bps * 100) / 100,
      firm: true,
      status: "open",
      expires_at: new Date(Date.now() + RFQ_WINDOW_MS).toISOString(),
      created_at: now(),
      owner: principalId(key),
    };
    rfqs.set(rfq.id, rfq);
    emit(
      "fx.rfq.quoted",
      { id: rfq.id, pair, locked_bps: rfq.locked_bps },
      { tenantId: rfq.owner },
    );

    return {
      ...rfq,
      disclosure: "firm-quote",
      depth_at_your_size: {
        liquidity: priced.liquidity,
        imbalance: priced.imbalance,
        indicative_bps: priced.spread_bps,
        firmness_bps: RFQ_FIRMNESS_BPS,
      },
      note:
        "Binding for the quote window. Other participants' identities/orders remain private.",
    };
  },
  { created: true },
);

route("GET", "/v2/fx/rfq", ({ key, url }) =>
  paginate(visibleTo([...rfqs.values()], key), url),
);

route("POST", "/v2/fx/rfq/:id/accept", ({ params, key }) => {
  const rfq = must(rfqs, params.id, "quote", key);
  if (rfq.status !== "open")
    throw new ApiError("conflict", 409, `Quote ${rfq.id} is already ${rfq.status}`);
  if (Date.parse(rfq.expires_at) <= Date.now()) {
    rfq.status = "expired";
    rfqs.set(rfq.id, rfq);
    throw new ApiError("conflict", 409, "That firm quote has expired");
  }

  const size = toMinor(rfq.amount.amount);
  if (balanceOf(rfq.account, rfq.from) < size) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(rfq.account, rfq.from))} ${rfq.from}`,
    );
  }

  const intent = {
    id: ksuid("int"),
    account: rfq.account,
    receive_account: rfq.receive_account,
    customer: rfq.customer,
    counterparty: rfq.counterparty,
    from: rfq.from,
    to: rfq.to,
    amount: rfq.amount.amount,
    remaining: size.toString(),
    min_receive: rfq.receives.amount,
    mode: "taker",
    status: "open",
    rfq: rfq.id,
    expires_at: rfq.expires_at,
    created_at: now(),
    owner: principalId(key),
  };
  intents.set(intent.id, intent);

  const out = toMinor(rfq.receives.amount);
  const grossOut = convertAtMid(size, rfq.from, rfq.to);
  settle(
    intent,
    `principal:${rfq.from}`,
    `principal:${rfq.to}`,
    size,
    grossOut,
    out,
    "principal",
    rfq.locked_bps,
  );

  intent.remaining = "0";
  intent.status = "filled";
  intents.set(intent.id, intent);

  const live = priceNow(rfq.from, rfq.to, size);
  rfq.status = "accepted";
  rfq.accepted_at = now();
  rfq.intent = intent.id;
  rfqs.set(rfq.id, rfq);
  emit(
    "fx.rfq.accepted",
    { id: rfq.id, intent: intent.id },
    { tenantId: rfq.owner },
  );

  return {
    ...rfq,
    filled: true,
    received: rfq.receives,
    honoured_at_bps: rfq.locked_bps,
    corridor_now_bps: live.spread_bps,
    drift_bps:
      Math.round((live.spread_bps - rfq.locked_bps) * 100) / 100,
    note:
      "Filled at the locked rate; movement inside the quote window remained with the operator.",
  };
});
