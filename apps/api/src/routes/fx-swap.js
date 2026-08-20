/** The swap engine.
 *
 *  Design decisions, and why:
 *
 *  1. THE BOOK IS OFF-CHAIN. Orders, matching, KYC and the ledger live here. The only
 *     thing that needs to be trustless is custody and the atomic swap itself. Putting
 *     the book on-chain would leak every customer's flow and buy nothing.
 *
 *  2. INTENTS, NOT ORDERS. A user signs an intent — what they'll give, the least they'll
 *     accept, and an expiry. It only binds when matched. Nothing locks until commit, so
 *     nobody sits in a pool being picked off.
 *
 *  3. THE FALLBACK LADDER. A corridor is never dead, only expensive:
 *       p2p        match against an opposing intent      tightest
 *       lp         a liquidity provider fills            +25% of spread
 *       principal  the operator fills as last resort     +100% of spread
 *
 *  4. AGGREGATE DEPTH IS PUBLIC, IDENTITY IS NOT. Anyone offering quotes leaks
 *     aggregate depth anyway — you can ladder quote sizes and reconstruct it. So we
 *     publish it properly (L2) and keep what probing CANNOT recover private: maker
 *     identity and per-order detail (L3). Peers can price; peers cannot pick each
 *     other off. The operator can attribute every fill for compliance.
 *
 *  5. NETTING. Flow in a corridor is netted before settlement, so liquidity has to
 *     cover the NET imbalance, not the gross. This is the difference between needing
 *     a balance sheet and needing a clearing house.
 *
 *  6. SETTLEMENT IS ATOMIC. Both legs post in one double-entry transaction or neither
 *     does — post() throws unless entries sum to zero.
 */

import {
  route, ApiError, need, toMinor, fromMinor, ksuid, db, post, balanceOf,
  emit, collection, now, randomBytes, must, visibleTo, principalId,
} from "../kernel.js";
import { isStable, midOf, CORRIDORS } from "../assets.js";
import { priceCorridor, principalQuote, DEFAULT_APPETITE } from "../pricing.js";
import * as PRICING from "../pricing.js";
import { creditProviders, poolAccount } from "./fx-lp.js";

const intents = collection("fxIntents");   // signed, unmatched
const fills = collection("fxFills");       // matched, settled
const batches = collection("fxBatches");   // netting runs

const pairKey = (a, b) => `${a}/${b}`;
const LADDER = { p2p: 1.0, lp: 1.25, principal: 2.0 };

/** A stable pseudonym for a counterparty: peers see this, never the customer id.
 *  The operator can still resolve it — attribution without exposure. */
const pseudonym = (customerId) =>
  "ctp_" + Buffer.from(customerId).toString("base64url").slice(-10);

/** Live resting depth per direction — the input the price is derived from. */
function restingDepth() {
  const out = {};
  for (const i of intents.values()) {
    if (i.status !== "open" || i.mode !== "maker") continue;
    if (Date.parse(i.expires_at) <= Date.now()) continue;
    const k = pairKey(i.from, i.to);
    out[k] = (out[k] ?? 0n) + BigInt(i.remaining);
  }
  return out;
}

/** The price, derived from book state — never a static number. */
function priceNow(from, to, sizeMinor = 0n) {
  return priceCorridor(restingDepth(), from, to, sizeMinor);
}

const appetite = collection("fxAppetite");
const appetiteFor = (pair) => appetite.get(pair) ?? { pair, ...DEFAULT_APPETITE };
const principalPosition = (cur) => {
  const v = balanceOf(`principal:${cur}`, cur);
  return v < 0n ? -v : v;
};

/* ------------------------------------------------------------------ */
/* Depth — aggregated only. No maker, no per-order rows, by design.     */
/* ------------------------------------------------------------------ */
route("GET", "/v2/fx/depth", ({ url }) => {
  const pair = url.searchParams.get("pair");
  const live = [...intents.values()].filter((i) => i.status === "open" && Date.parse(i.expires_at) > Date.now());

  const byPair = {};
  for (const i of live) {
    const k = pairKey(i.from, i.to);
    if (pair && k !== pair) continue;
    byPair[k] ??= { pair: k, from: i.from, to: i.to, resting: 0n, orders: 0 };
    byPair[k].resting += BigInt(i.remaining);
    byPair[k].orders += 1;
  }

  return {
    object: "list",
    disclosure: "aggregate",
    note: "Aggregate depth only. Maker identity and per-order detail are never served — " +
          "they cannot be recovered by quote-probing, so keeping them private is meaningful.",
    data: Object.values(byPair).map((d) => ({
      pair: d.pair, from: d.from, to: d.to,
      resting: { amount: fromMinor(d.resting), currency: d.from },
      // deliberately coarse: a count band, not an order count you could fingerprint
      makers: d.orders === 0 ? "none" : d.orders < 3 ? "few" : d.orders < 10 ? "several" : "many",
      ...(() => { const p = priceNow(d.from, d.to); return { spread_bps: p.spread_bps, rebate_bps: p.rebate_bps, imbalance: p.imbalance, liquidity: p.liquidity }; })(),
    })),
  };
}, { public: true });

/* ------------------------------------------------------------------ */
/* Submit a signed intent. Matching runs immediately down the ladder.   */
/* ------------------------------------------------------------------ */
route("POST", "/v2/fx/intents", ({ body, key }) => {
  need(body, ["account", "from", "to", "amount", "min_receive"]);
  const acc = must(db.accounts, body.account, "account", key);

  const from = String(body.from).toUpperCase(), to = String(body.to).toUpperCase();
  if (!isStable(from) || !isStable(to)) {
    throw new ApiError("validation-error", 400, "Swap legs must both be stablecoins — use /v2/ramps to cross fiat");
  }
  if (from === to) throw new ApiError("validation-error", 400, "from and to must differ");

  const amount = toMinor(body.amount);
  const minReceive = toMinor(body.min_receive);
  if (balanceOf(acc.id, from) < amount) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(acc.id, from))} ${from}`);
  }

  const cus = db.customers.get(acc.customer);
  if (!cus || cus.decision !== "approved") {
    // every counterparty is verified — that is what makes the book attributable
    throw new ApiError("tier-insufficient", 403, "Counterparties must be verified before they can provide or take liquidity");
  }

  // maker rests on the book and waits for a counterparty; taker walks the ladder now.
  // Without makers there are no resting orders, and without those there is no P2P at all.
  const mode = body.mode === "maker" ? "maker" : "taker";

  const intent = {
    id: ksuid("int"),
    account: acc.id, customer: acc.customer,
    counterparty: pseudonym(acc.customer),
    from, to,
    amount: body.amount, remaining: amount.toString(),
    min_receive: body.min_receive,
    // the signature binds the intent; we record it rather than inventing one
    signature: body.signature ?? null,
    signed: !!body.signature,
    mode,
    status: "open",
    expires_at: new Date(Date.now() + (Number(body.ttl_seconds) || 300) * 1000).toISOString(),
    created_at: now(), owner: principalId(key),
  };
  intents.set(intent.id, intent);
  emit("fx.intent.created", { id: intent.id, pair: pairKey(from, to) }, { tenantId: intent.owner });

  if (mode === "maker") {
    // rest only. A maker is never force-filled by the fallback ladder — that would
    // turn every liquidity provider into a taker at their own expense.
    return {
      ...intents.get(intent.id),
      filled: false, fill_legs: [], resting: true,
      note: "Resting on the book. It fills when a taker crosses it, or expires.",
    };
  }
  const result = matchIntent(intent);
  return { ...intents.get(intent.id), ...result };
}, { created: true });

/** Walk the ladder: opposing intents first, then LP, then principal.
 *
 *  Two phases, and the split is load-bearing. PLAN computes every leg without
 *  touching the ledger, the book or the intent; only once the total clears the
 *  signed min_receive floor does COMMIT apply any of it. Before this split the
 *  legs were settled as they were found and the floor was checked afterwards,
 *  so a refused fill returned HTTP 400 with the money already moved.
 *
 *  This cannot be solved with a database transaction: when the API runs inside
 *  a Durable Object, packages/sqlite-compat swallows BEGIN/COMMIT/ROLLBACK, so
 *  a rollback would work locally and silently do nothing in production. */
function matchIntent(intent) {
  const plan = [];
  let remaining = BigInt(intent.remaining);
  const mid = midOf(intent.from) / midOf(intent.to);

  // ---- 1. P2P: an opposing intent in the same corridor ----
  const opposing = [...intents.values()]
    .filter((o) =>
      o.status === "open" && o.id !== intent.id && o.mode === "maker" &&
      o.from === intent.to && o.to === intent.from &&
      o.customer !== intent.customer &&
      Date.parse(o.expires_at) > Date.now())
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  for (const o of opposing) {
    if (remaining <= 0n) break;
    const oRemaining = BigInt(o.remaining);
    // what the maker's side is worth in our currency
    const oInOurs = BigInt(Math.floor(Number(oRemaining) / mid));
    const take = remaining < oInOurs ? remaining : oInOurs;
    if (take <= 0n) continue;

    const priced = priceNow(intent.from, intent.to, take);
    const bps = priced.spread_bps * LADDER.p2p;
    const out = BigInt(Math.floor(Number(take) * mid * (1 - bps / 10000)));

    plan.push({
      source: "p2p", account: o.account, take, out, bps,
      leg: { source: "p2p", counterparty: o.counterparty, in: fromMinor(take), out: fromMinor(out), spread_bps: Math.round(bps) },
      maker: o,
      makerRemaining: (oRemaining - BigInt(Math.floor(Number(take) * mid))).toString(),
    });
    remaining -= take;
  }

  // ---- 2. LP, then 3. principal — always available, priced wider ----
  for (const src of ["lp", "principal"]) {
    if (remaining <= 0n) break;
    const priced = priceNow(intent.from, intent.to, remaining);
    let bps = priced.spread_bps * LADDER[src];
    let account = `${src}:${intent.to}`;

    if (src === "lp") {
      // Draw on the corridor's actual pool, not a synthetic `lp:<currency>`
      // account. They were different accounts: committed capital sat in the
      // pool while every fill was booked against the synthetic one, which had
      // no balance and no solvency check, so it ran unboundedly negative and
      // providers earned spread on liquidity nothing ever drew from.
      account = poolAccount(pairKey(intent.from, intent.to), intent.to);
      const out = BigInt(Math.floor(Number(remaining) * mid * (1 - bps / 10000)));
      if (balanceOf(account, intent.to) < out) {
        // A pool that cannot cover the fill is not a fill. Fall through to the
        // principal backstop rather than lending the pool money it never had.
        plan.push({ declined: true, leg: { source: "lp", declined: true, reason: "corridor pool cannot cover this size" } });
        continue;
      }
    }

    if (src === "principal") {
      // the backstop is the operator's balance sheet — it has a limit, and says so
      const pair = pairKey(intent.from, intent.to);
      const pq = principalQuote(appetiteFor(pair), principalPosition(intent.from), remaining, priced.spread_bps);
      if (!pq.available) {
        plan.push({ declined: true, leg: { source: "principal", declined: true, reason: pq.reason } });
        break;
      }
      bps = pq.spread_bps;
    }

    const out = BigInt(Math.floor(Number(remaining) * mid * (1 - bps / 10000)));
    plan.push({
      source: src, account, take: remaining, out, bps,
      leg: { source: src, counterparty: src, in: fromMinor(remaining), out: fromMinor(out), spread_bps: Math.round(bps * 100) / 100, pricing: priced.reason },
    });
    remaining = 0n;
  }

  // ---- the floor, checked while the plan is still only a plan ----
  const totalOut = plan.reduce((n, p) => n + (p.declined ? 0n : p.out), 0n);
  if (totalOut < toMinor(intent.min_receive)) {
    // we never silently fill below the signed floor — and now nothing has moved
    throw new ApiError("validation-error", 400,
      `Best available fill is ${fromMinor(totalOut)} ${intent.to}, below your min_receive of ${intent.min_receive}`);
  }

  // ---- COMMIT: from here the plan is applied; nothing above this line mutated ----
  const legs = [];
  for (const step of plan) {
    if (step.declined) { legs.push(step.leg); continue; }
    settle(intent, step.account, step.take, step.out, step.source, step.bps);
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
  intents.set(intent.id, stored);

  return {
    filled: legs.length > 0,
    fill_legs: legs,
    received: { amount: fromMinor(totalOut), currency: intent.to },
    ladder: "p2p → lp → principal",
  };
}

/** Atomic: both sides post in one transaction, or post() throws and nothing moves. */
function settle(intent, counterAccount, inMinor, outMinor, source, bps) {
  post([
    { account: intent.account, currency: intent.from, amount: -inMinor },
    { account: counterAccount, currency: intent.from, amount: inMinor },
  ], `swap ${intent.id} ${source} leg-in`);
  post([
    { account: intent.account, currency: intent.to, amount: outMinor },
    { account: counterAccount, currency: intent.to, amount: -outMinor },
  ], `swap ${intent.id} ${source} leg-out`);

  // The spread the taker paid is real money. Book it explicitly so it can be shared
  // with whoever provided the liquidity, rather than vanishing into a rounding gap.
  const gross = BigInt(Math.floor(Number(inMinor) * (midOf(intent.from) / midOf(intent.to))));
  const spread = gross - outMinor;
  if (spread > 0n) {
    post([
      { account: counterAccount, currency: intent.to, amount: -spread },
      { account: `spread:${pairKey(intent.from, intent.to)}`, currency: intent.to, amount: spread },
    ], `spread ${intent.id} ${source}`);
  }

  const f = {
    id: ksuid("fil"), intent: intent.id, source,
    pair: pairKey(intent.from, intent.to),
    in: { amount: fromMinor(inMinor), currency: intent.from },
    out: { amount: fromMinor(outMinor), currency: intent.to },
    spread_bps: Math.round(bps),
    // attribution the operator can audit; peers only ever see the pseudonym
    taker: intent.counterparty, taker_customer: intent.customer,
    settled_at: now(), owner: intent.owner,
  };
  fills.set(f.id, f);
  emit("fx.fill.settled", { id: f.id, pair: f.pair, source }, { tenantId: f.owner });

  // pay the providers whose liquidity made this fill possible
  if (spread > 0n) {
    const credited = creditProviders(pairKey(intent.from, intent.to), intent.to, spread, f.id);
    if (credited.length) {
      f.spread_shared_with = credited.length;
      f.spread = fromMinor(spread);
      fills.set(f.id, f);
    }
  }
}

route("GET", "/v2/fx/intents", ({ url, key }) => {
  const rows = visibleTo([...intents.values()], key);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return { object: "list", data: rows.slice(0, limit), has_more: rows.length > limit };
});

route("POST", "/v2/fx/intents/:id/cancel", ({ params, key }) => {
  const i = must(intents, params.id, "intent", key);
  if (i.status === "filled") throw new ApiError("conflict", 409, "Already filled");
  i.status = "cancelled";
  intents.set(i.id, i);
  return i;
});

route("GET", "/v2/fx/fills", ({ url, key }) => {
  const rows = [...fills.values()];
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return {
    object: "list",
    note: "Counterparties appear as pseudonyms. The operator can resolve them for compliance; peers cannot.",
    data: rows.slice(0, limit).map(({ taker_customer, owner, ...f }) => f),
    has_more: rows.length > limit,
  };
}, { access: "GLOBAL_READ" });

/* ------------------------------------------------------------------ */
/* Netting — liquidity covers the NET imbalance, not the gross.         */
/* ------------------------------------------------------------------ */
route("POST", "/v2/fx/net", ({ key }) => {
  const unsettled = [...fills.values()].filter((f) => !f.batch);
  const net = {};
  let gross = 0n;

  for (const f of unsettled) {
    const [a, b] = f.pair.split("/");
    const k = [a, b].sort().join("/");
    net[k] ??= { pair: k, [a]: 0n, [b]: 0n };
    net[k][a] = (net[k][a] ?? 0n) - toMinor(f.in.amount);
    net[k][b] = (net[k][b] ?? 0n) + toMinor(f.out.amount);
    gross += toMinor(f.in.amount);
  }

  const rows = Object.values(net).map((n) => {
    const [a, b] = n.pair.split("/");
    const residual = n[a] < 0n ? -n[a] : n[a];
    return {
      pair: n.pair,
      net_position: { [a]: fromMinor(n[a]), [b]: fromMinor(n[b]) },
      residual_to_settle: { amount: fromMinor(residual), currency: a },
    };
  });

  const residualTotal = rows.reduce((s, r) => s + toMinor(r.residual_to_settle.amount), 0n);
  const batch = {
    id: ksuid("bat"),
    fills: unsettled.length,
    gross: fromMinor(gross),
    residual: fromMinor(residualTotal),
    saved_pct: gross === 0n ? "0.00" : (100 - (Number(residualTotal) / Number(gross)) * 100).toFixed(2),
    rows, created_at: now(), owner: principalId(key),
  };
  for (const f of unsettled) { f.batch = batch.id; fills.set(f.id, f); }
  batches.set(batch.id, batch);
  emit("fx.batch.netted", { id: batch.id, fills: batch.fills }, { tenantId: batch.owner });

  return {
    ...batch,
    note: "Only the residual needs funding. Netting is why this is a clearing house rather than a balance sheet.",
  };
}, { access: "OPERATOR" });

route("GET", "/v2/fx/batches", ({ key }) => ({
  object: "list",
  data: visibleTo([...batches.values()], key),
}));

/* ------------------------------------------------------------------ */
/* Price a corridor without trading — same numbers the ladder will use. */
/* ------------------------------------------------------------------ */
route("GET", "/v2/fx/price", ({ url }) => {
  const from = (url.searchParams.get("from") || "").toUpperCase();
  const to = (url.searchParams.get("to") || "").toUpperCase();
  if (!isStable(from) || !isStable(to)) {
    throw new ApiError("validation-error", 400, "from and to must both be stablecoins");
  }
  const size = url.searchParams.get("size") ? toMinor(url.searchParams.get("size")) : 0n;
  const p = priceNow(from, to, size);
  const reverse = priceNow(to, from, size);
  return {
    pair: pairKey(from, to),
    ...p,
    reverse_direction: { pair: pairKey(to, from), spread_bps: reverse.spread_bps, rebate_bps: reverse.rebate_bps },
    note: "Derived from live book state, not a table. Same inputs always give the same price.",
  };
}, { public: true });

/* ---- principal appetite: the operator's risk limit, per corridor ---- */
route("GET", "/v2/fx/appetite", () => ({
  object: "list",
  data: [...appetite.values()].length ? [...appetite.values()] : [{ pair: "*", ...DEFAULT_APPETITE }],
}), { access: "GLOBAL_READ" });

route("PUT", "/v2/fx/appetite", ({ body, key }) => {
  need(body, ["pair"]);
  const a = { pair: body.pair, ...DEFAULT_APPETITE, ...body };
  appetite.set(body.pair, a);
  emit("fx.appetite.updated", a, { tenantId: principalId(key) });
  return a;
}, { access: "OPERATOR" });

/* ------------------------------------------------------------------ */
/* The pricing model itself — constants and formula, published.        */
/* A client can run the identical arithmetic and get the identical     */
/* number. Publishing this is what makes the pricing checkable rather  */
/* than something you have to take on trust.                           */
/* ------------------------------------------------------------------ */
route("GET", "/v2/fx/pricing-model", () => ({
  base_bps: PRICING.BASE_BPS,
  max_skew_bps: PRICING.MAX_SKEW_BPS,
  rebate_threshold: PRICING.REBATE_THRESHOLD,
  max_rebate_bps: PRICING.MAX_REBATE_BPS,
  thin_depth: PRICING.THIN_DEPTH,
  formula: [
    "imbalance = (depth_with_flow - depth_against_flow) / total_depth",
    "impact    = min(1, size / depth_against_flow)",
    "spread    = base + max_skew * max(0, imbalance) + max_skew * 0.4 * impact",
    "if imbalance < -rebate_threshold:",
    "  strength = min(1, (|imbalance| - threshold) / (1 - threshold))",
    "  rebate   = max_rebate * strength;  spread = max(0, base - rebate)",
  ],
  note: "Deterministic. Same book state always yields the same price, so any quote you were given can be recomputed and checked.",
}), { public: true });

/* =========================================================================
 * RFQ — the middle disclosure tier
 *
 * Three tiers exist, and they are set by who is asking, not by a plan:
 *
 *   public      GET /v2/fx/depth   aggregate depth only, no identity, no orders
 *   integrator  POST /v2/fx/rfq    a FIRM price for your own size, held for a window
 *   private     GET /v2/fx/intents your own orders, and never anyone else's
 *
 * The middle tier is what a bank integrating this rail actually needs: it cannot
 * quote its own customers off a rate that might move between the quote and the
 * click. So it asks for a price at a size, and that price is binding for a window.
 *
 * What an RFQ reveals is strictly more than aggregate depth — it tells you the
 * executable rate at your size, which is the shape of the book at that depth — and
 * strictly less than the book: no maker identity, no other participants' orders,
 * nothing about flow that is not yours.
 *
 * Honouring a firm price is principal risk. If the corridor moves against us inside
 * the window we pay the difference; if it moves our way we keep it. That is what
 * "firm" costs, and it is why the window is short and the size is capped by the
 * same appetite that governs the principal leg.
 * ========================================================================= */

const rfqs = collection("fxRfqs");
const RFQ_WINDOW_MS = 60_000;
/** A firm price is worth paying for: it is the operator, not the taker, carrying
 *  the movement inside the window. */
const RFQ_FIRMNESS_BPS = 2;

route("POST", "/v2/fx/rfq", ({ body, key }) => {
  need(body, ["account", "from", "to", "amount"]);
  const acc = must(db.accounts, body.account, "account", key);

  const cus = db.customers.get(acc.customer);
  if (!cus || cus.decision !== "approved") {
    throw new ApiError("tier-insufficient", 403, "Counterparties must be verified before they can provide or take liquidity");
  }
  if (cus.type !== "business") {
    throw new ApiError("tier-insufficient", 403,
      "Firm quotes are the integrator tier — they commit the operator's balance sheet for a window, so they are served to verified business customers. Use POST /v2/fx/quote for an indicative price.");
  }

  const from = String(body.from).toUpperCase(), to = String(body.to).toUpperCase();
  if (!isStable(from) || !isStable(to)) {
    throw new ApiError("validation-error", 400, "Swap legs must both be stablecoins — use /v2/ramps to cross fiat");
  }
  if (from === to) throw new ApiError("validation-error", 400, "from and to must differ");

  const size = toMinor(body.amount);
  const pair = pairKey(from, to);
  const priced = priceNow(from, to, size);

  // A firm quote consumes the same appetite the principal leg does — we cannot
  // promise a price we would not be willing to fill.
  const pq = principalQuote(appetiteFor(pair), principalPosition(from), size, priced.spread_bps);
  if (!pq.available) {
    throw new ApiError("conflict", 409,
      `No firm price available for that size right now: ${pq.reason}. The indicative price stands at POST /v2/fx/quote, or rest a maker order and wait for a counterparty.`);
  }

  const bps = pq.spread_bps + RFQ_FIRMNESS_BPS;
  const mid = midOf(from) / midOf(to);
  const receives = BigInt(Math.floor(Number(size) * mid * (1 - bps / 10000)));

  const r = {
    id: ksuid("rfq"),
    account: acc.id, customer: acc.customer,
    counterparty: pseudonym(acc.customer),
    pair, from, to,
    amount: { amount: body.amount, currency: from },
    receives: { amount: fromMinor(receives), currency: to },
    locked_bps: Math.round(bps * 100) / 100,
    firm: true,
    status: "open",
    expires_at: new Date(Date.now() + RFQ_WINDOW_MS).toISOString(),
    created_at: now(), owner: principalId(key),
  };
  rfqs.set(r.id, r);
  emit("fx.rfq.quoted", { id: r.id, pair, locked_bps: r.locked_bps }, { tenantId: r.owner });

  return {
    ...r,
    disclosure: "firm-quote",
    // the extra disclosure this tier buys, and its explicit limit
    depth_at_your_size: {
      liquidity: priced.liquidity,
      imbalance: priced.imbalance,
      indicative_bps: priced.spread_bps,
      firmness_bps: RFQ_FIRMNESS_BPS,
    },
    note: "Binding for the window. Accept it with POST /v2/fx/rfq/{id}/accept and you " +
          "get exactly this rate even if the corridor has moved. Maker identity and " +
          "other participants' orders are not disclosed at any tier.",
  };
}, { created: true });

route("GET", "/v2/fx/rfq", ({ key, url }) => {
  const rows = visibleTo([...rfqs.values()], key);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return { object: "list", disclosure: "own-quotes", data: rows.slice(0, limit), has_more: rows.length > limit };
});

route("POST", "/v2/fx/rfq/:id/accept", ({ params, key }) => {
  const r = must(rfqs, params.id, "quote", key);
  if (r.status !== "open") throw new ApiError("conflict", 409, `Quote ${r.id} is already ${r.status}`);
  if (Date.parse(r.expires_at) <= Date.now()) {
    r.status = "expired";
    rfqs.set(r.id, r);
    throw new ApiError("conflict", 409, "That quote has expired — ask for another. A firm price is only firm for its window.");
  }

  const size = toMinor(r.amount.amount);
  if (balanceOf(r.account, r.from) < size) {
    throw new ApiError("insufficient-balance", 400,
      `Account holds ${fromMinor(balanceOf(r.account, r.from))} ${r.from}`);
  }

  // Fill as principal at the LOCKED rate — not at whatever the corridor is doing
  // now. Any drift inside the window is the operator's, which is the whole point.
  const intent = {
    id: ksuid("int"),
    account: r.account, customer: r.customer, counterparty: r.counterparty,
    from: r.from, to: r.to,
    amount: r.amount.amount, remaining: size.toString(),
    min_receive: r.receives.amount,
    mode: "taker", status: "open", rfq: r.id,
    expires_at: r.expires_at, created_at: now(), owner: principalId(key),
  };
  intents.set(intent.id, intent);

  const out = toMinor(r.receives.amount);
  settle(intent, `principal:${r.to}`, size, out, "principal", r.locked_bps);

  intent.remaining = "0";
  intent.status = "filled";
  intents.set(intent.id, intent);

  const live = priceNow(r.from, r.to, size);
  r.status = "accepted";
  r.accepted_at = now();
  r.intent = intent.id;
  rfqs.set(r.id, r);
  emit("fx.rfq.accepted", { id: r.id, intent: intent.id }, { tenantId: r.owner });

  return {
    ...r,
    filled: true,
    received: r.receives,
    honoured_at_bps: r.locked_bps,
    corridor_now_bps: live.spread_bps,
    // stated plainly rather than quietly pocketed either way
    drift_bps: Math.round((live.spread_bps - r.locked_bps) * 100) / 100,
    note: "Filled at the locked rate. Movement inside the window sat with the operator, not with you.",
  };
});
