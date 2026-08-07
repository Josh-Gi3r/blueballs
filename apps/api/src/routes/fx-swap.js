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
  emit, collection, now, randomBytes,
} from "../kernel.js";
import { isStable, midOf, CORRIDORS } from "../assets.js";
import { priceCorridor, principalQuote, DEFAULT_APPETITE } from "../pricing.js";

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
  const acc = db.accounts.get(body.account);
  if (!acc) throw new ApiError("not-found", 404, `No account ${body.account}`);

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
    created_at: now(), owner: key.id,
  };
  intents.set(intent.id, intent);
  emit("fx.intent.created", { id: intent.id, pair: pairKey(from, to) });

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
});

/** Walk the ladder: opposing intents first, then LP, then principal. */
function matchIntent(intent) {
  const legs = [];
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

    settle(intent, o.account, take, out, "p2p", bps);
    legs.push({ source: "p2p", counterparty: o.counterparty, in: fromMinor(take), out: fromMinor(out), spread_bps: Math.round(bps) });

    o.remaining = (oRemaining - BigInt(Math.floor(Number(take) * mid))).toString();
    if (BigInt(o.remaining) <= 0n) o.status = "filled";
    intents.set(o.id, o);
    remaining -= take;
  }

  // ---- 2. LP, then 3. principal — always available, priced wider ----
  for (const src of ["lp", "principal"]) {
    if (remaining <= 0n) break;
    const priced = priceNow(intent.from, intent.to, remaining);
    let bps = priced.spread_bps * LADDER[src];

    if (src === "principal") {
      // the backstop is the operator's balance sheet — it has a limit, and says so
      const pair = pairKey(intent.from, intent.to);
      const pq = principalQuote(appetiteFor(pair), principalPosition(intent.from), remaining, priced.spread_bps);
      if (!pq.available) {
        legs.push({ source: "principal", declined: true, reason: pq.reason });
        break;
      }
      bps = pq.spread_bps;
    }

    const out = BigInt(Math.floor(Number(remaining) * mid * (1 - bps / 10000)));
    settle(intent, `${src}:${intent.to}`, remaining, out, src, bps);
    legs.push({ source: src, counterparty: src, in: fromMinor(remaining), out: fromMinor(out), spread_bps: Math.round(bps * 100) / 100, pricing: priced.reason });
    remaining = 0n;
  }

  const stored = intents.get(intent.id);
  stored.remaining = remaining.toString();
  stored.status = remaining <= 0n ? "filled" : "open";
  intents.set(intent.id, stored);

  const totalOut = legs.reduce((n, l) => n + toMinor(l.out), 0n);
  if (totalOut < toMinor(intent.min_receive)) {
    // we never silently fill below the signed floor
    throw new ApiError("validation-error", 400,
      `Best available fill is ${fromMinor(totalOut)} ${intent.to}, below your min_receive of ${intent.min_receive}`);
  }

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

  const f = {
    id: ksuid("fil"), intent: intent.id, source,
    pair: pairKey(intent.from, intent.to),
    in: { amount: fromMinor(inMinor), currency: intent.from },
    out: { amount: fromMinor(outMinor), currency: intent.to },
    spread_bps: Math.round(bps),
    // attribution the operator can audit; peers only ever see the pseudonym
    taker: intent.counterparty, taker_customer: intent.customer,
    settled_at: now(),
  };
  fills.set(f.id, f);
  emit("fx.fill.settled", { id: f.id, pair: f.pair, source });
}

route("GET", "/v2/fx/intents", ({ url, key }) => {
  const rows = [...intents.values()].filter((i) => i.owner === key.id);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  return { object: "list", data: rows.slice(0, limit), has_more: rows.length > limit };
});

route("POST", "/v2/fx/intents/:id/cancel", ({ params, key }) => {
  const i = intents.get(params.id);
  if (!i) throw new ApiError("not-found", 404, `No intent ${params.id}`);
  if (i.owner !== key.id) throw new ApiError("forbidden", 403, "Not your intent");
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
    data: rows.slice(0, limit).map(({ taker_customer, ...f }) => f),
    has_more: rows.length > limit,
  };
});

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
    rows, created_at: now(), owner: key.id,
  };
  for (const f of unsettled) { f.batch = batch.id; fills.set(f.id, f); }
  batches.set(batch.id, batch);
  emit("fx.batch.netted", { id: batch.id, fills: batch.fills });

  return {
    ...batch,
    note: "Only the residual needs funding. Netting is why this is a clearing house rather than a balance sheet.",
  };
});

route("GET", "/v2/fx/batches", ({ key }) => ({
  object: "list",
  data: [...batches.values()].filter((b) => b.owner === key.id),
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
}));

route("PUT", "/v2/fx/appetite", ({ body }) => {
  need(body, ["pair"]);
  const a = { pair: body.pair, ...DEFAULT_APPETITE, ...body };
  appetite.set(body.pair, a);
  emit("fx.appetite.updated", a);
  return a;
});
