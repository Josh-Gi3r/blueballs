/** Cards family — spec/conventions.md, "Cards" / "Authorisations" / "Disputes".
 *
 *  Cards, authorisations and disputes use the shared SQLite-backed collection
 *  adapter. `db.cards` is shared with the business-policy family so attaching
 *  a policy validates the same persisted card record.
 *
 *  One sandbox endpoint lives here too:
 *  `POST /v2/cards/:id/authorisations` — a sandbox helper that simulates an inbound
 *  authorisation request arriving from the network, mirroring the precedent already
 *  set in server.js (`POST /v2/accounts/:id/credit`, `POST /v2/customers/:id/verify`
 *  are both sandbox helpers outside the catalogue). Without it there is no way to
 *  produce an authorisation for the real catalogued endpoints (get/list/approve/
 *  decline) to operate on, since no processor is wired up.
 */

import {
  route, db, ksuid, need, must, paginate, now, ApiError,
  toMinor, fromMinor, randomBytes, emit, post, balanceOf, collection,
  visibleTo, principalId, positiveMinor } from "../kernel.js";

/* ---------------- durable storage ---------------- */
db.cards ??= collection("cards");
const cards = db.cards;
const cardSecrets = collection("cardSecrets");     // card id -> { pan, cvv } — never served directly
const ephemeralKeys = collection("ephemeralKeys");   // token -> { card, expires_at }
const authorisations = collection("authorisations");
const disputes = collection("disputes");

/* ---------------- helpers ---------------- */

/** Fictional Blueballs card scheme — not a real network's BIN range. */
function genPan() {
  const bin = "555500";
  let digits = bin;
  while (digits.length < 15) digits += randomBytes(4).readUInt32BE(0).toString().padStart(10, "0");
  digits = digits.slice(0, 15);
  // Luhn check digit, so it at least looks like a real PAN in shape.
  let sum = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) {
    let d = Number(rev[i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return digits + String((10 - (sum % 10)) % 10);
}

function expiryString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function defaultLimits(currency, overrides = {}) {
  const base = {
    per_authorization: { amount: "500.00", currency },
    daily: { amount: "2000.00", currency },
    monthly: { amount: "10000.00", currency },
  };
  for (const k of Object.keys(base)) {
    if (overrides[k]?.amount) {
      positiveMinor(overrides[k].amount, `spend_limits.${k}.amount`);
      base[k] = { amount: overrides[k].amount, currency: overrides[k].currency ?? currency };
    }
  }
  return base;
}

// Generic, provider-neutral network reason codes — not any real network's own codes.
const DISPUTE_REASON_CODES = {
  R10: { description: "Cardholder does not recognise the transaction", category: "fraud", days_to_respond: 20 },
  R12: { description: "Duplicate processing", category: "processing_error", days_to_respond: 45 },
  R13: { description: "Goods or services not received", category: "consumer_dispute", days_to_respond: 30 },
  R41: { description: "Cancelled recurring transaction", category: "consumer_dispute", days_to_respond: 30 },
};

/* ================= CARDS ================= */

route("POST", "/v2/cards", ({ body, key }) => {
  need(body, ["customer", "account", "type"]);
  if (!["virtual", "physical"].includes(body.type)) {
    throw new ApiError("validation-error", 400, "type must be virtual or physical");
  }
  const customer = must(db.customers, body.customer, "customer", key);
  const account = must(db.accounts, body.account, "account", key);
  if (account.customer !== customer.id) {
    throw new ApiError("validation-error", 400, `Account ${account.id} does not belong to customer ${customer.id}`);
  }

  const currency = account.currency;
  const pan = genPan();
  const pending = body.type === "physical";
  const card = {
    id: ksuid("crd"),
    customer: customer.id, account: account.id,
    type: body.type, brand: "blueballs", last4: pan.slice(-4), bin: pan.slice(0, 6), expires: expiryString(),
    status: pending ? "pending_activation" : "active",
    status_reason: pending ? "awaiting_activation" : null,
    freeze: null,
    currency,
    spend_limits: defaultLimits(currency, body.spend_limits),
    merchant_categories: {
      blocked: Array.isArray(body.merchant_categories?.blocked) ? body.merchant_categories.blocked : [],
      allowed: Array.isArray(body.merchant_categories?.allowed) ? body.merchant_categories.allowed : [],
    },
    client_reference_id: body.client_reference_id ?? null,
    owner: principalId(key),
    created_at: now(),
  };
  cards.set(card.id, card);
  cardSecrets.set(card.id, { pan, cvv: String(Math.floor(100 + Math.random() * 900)) });
  emit("card.issued", card, { tenantId: card.owner });
  return card;
}, { created: true });

route("GET", "/v2/cards/:id", ({ params, key }) => must(cards, params.id, "card", key));

route("GET", "/v2/cards", ({ url, key }) => {
  let rows = [...cards.values()];
  const customer = url.searchParams.get("customer");
  if (customer) rows = rows.filter((c) => c.customer === customer);
  const account = url.searchParams.get("account");
  if (account) rows = rows.filter((c) => c.account === account);
  const status = url.searchParams.get("status");
  if (status) rows = rows.filter((c) => c.status === status);
  return paginate(visibleTo(rows, key), url);
});

/** Freeze is scoped to whoever set it: record the initiator. */
route("POST", "/v2/cards/:id/freeze", ({ params, body, key }) => {
  const card = must(cards, params.id, "card", key);
  if (card.status === "closed") throw new ApiError("conflict", 409, "A closed card cannot be frozen");
  const reason = body.reason || "frozen_by_customer";
  card.status = "frozen";
  card.status_reason = reason;
  card.freeze = { by: principalId(key), by_key: key.id, at: now(), reason };
  emit("card.status_changed", { id: card.id, status: card.status, status_reason: card.status_reason }, { tenantId: card.owner });
  return card;
});

/** Unfreeze must not silently clear a freeze set by a different initiator. */
route("POST", "/v2/cards/:id/unfreeze", ({ params, key }) => {
  const card = must(cards, params.id, "card", key);
  if (card.status !== "frozen") throw new ApiError("conflict", 409, `Card ${card.id} is not frozen`);
  if (card.freeze && card.freeze.by !== principalId(key)) {
    throw new ApiError("forbidden", 403,
      `This card was frozen by a different initiator (${card.freeze.by}); only they can unfreeze it.`);
  }
  card.status = "active";
  card.status_reason = null;
  card.freeze = null;
  emit("card.status_changed", { id: card.id, status: card.status, status_reason: card.status_reason }, { tenantId: card.owner });
  return card;
});

/** Secure PIN update link — never the PIN itself. */
route("POST", "/v2/cards/:id/pin", ({ params, key }) => {
  const card = must(cards, params.id, "card", key);
  if (card.status === "closed") throw new ApiError("conflict", 409, `Card ${card.id} is closed`);
  const token = "pinlnk_" + randomBytes(20).toString("base64url");
  return {
    card: card.id,
    url: `https://pin.blueballs.dev/${token}`,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
});

/** PCI-safe reveal: an ephemeral key that a secure widget exchanges for the PAN —
 *  the API itself never returns the PAN. */
route("POST", "/v2/cards/:id/reveal", ({ params, key }) => {
  const card = must(cards, params.id, "card", key);
  if (card.status === "closed") throw new ApiError("conflict", 409, `Card ${card.id} is closed`);
  const token = "ek_" + randomBytes(24).toString("base64url");
  const expires_at = new Date(Date.now() + 60_000).toISOString();
  ephemeralKeys.set(token, { card: card.id, expires_at });
  return {
    card: card.id,
    ephemeral_key: token,
    expires_at,
    note: "Exchange this key with your PCI-compliant reveal widget. The API never returns the PAN.",
  };
});

route("PATCH", "/v2/cards/:id/controls", ({ params, body, key }) => {
  const card = must(cards, params.id, "card", key);
  if (body.spend_limits) {
    for (const k of ["per_authorization", "daily", "monthly"]) {
      const v = body.spend_limits[k];
      if (v?.amount) {
        positiveMinor(v.amount, `spend_limits.${k}.amount`);
        card.spend_limits[k] = { amount: v.amount, currency: v.currency ?? card.currency };
      }
    }
  }
  if (body.merchant_categories) {
    if (Array.isArray(body.merchant_categories.blocked)) card.merchant_categories.blocked = body.merchant_categories.blocked;
    if (Array.isArray(body.merchant_categories.allowed)) card.merchant_categories.allowed = body.merchant_categories.allowed;
  }
  emit("card.controls_updated", { id: card.id, spend_limits: card.spend_limits, merchant_categories: card.merchant_categories }, { tenantId: card.owner });
  return card;
});

route("GET", "/v2/cards/:id/transactions", ({ params, url, key }) => {
  const card = must(cards, params.id, "card", key);
  const rows = [...authorisations.values()]
    .filter((a) => a.card === card.id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return paginate(visibleTo(rows, key), url);
});

route("GET", "/v2/cards/:id/statements", ({ params, url, key }) => {
  const card = must(cards, params.id, "card", key);
  const settled = [...authorisations.values()].filter((a) => a.card === card.id && a.status === "settled");
  const byPeriod = new Map();
  for (const a of settled) {
    const period = a.settled_at.slice(0, 7); // YYYY-MM
    if (!byPeriod.has(period)) byPeriod.set(period, []);
    byPeriod.get(period).push(a);
  }
  const statements = [...byPeriod.entries()]
    .map(([period, txns]) => {
      const totalMinor = txns.reduce((n, t) => n + toMinor(t.amount.amount), 0n);
      return {
        id: `stmt_${card.id}_${period}`,
        card: card.id,
        period,
        total_spend: { amount: fromMinor(totalMinor), currency: card.currency },
        transaction_count: txns.length,
        transactions: txns.map((t) => t.id),
      };
    })
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  return paginate(statements, url);
});

/** Sandbox helper (not in the catalogue) — simulates an inbound authorisation
 *  request from the network, so the Authorisations endpoints have something to
 *  act on. Same idea as server.js's account credit / customer verify helpers. */
route("POST", "/v2/cards/:id/authorisations", ({ params, body, key }) => {
  const card = must(cards, params.id, "card", key);
  need(body, ["amount", "merchant"]);
  const currency = body.currency ?? card.currency;
  if (currency !== card.currency) {
    throw new ApiError("validation-error", 400, `Card ${card.id} settles in ${card.currency}, not ${currency}`);
  }
  const minor = positiveMinor(body.amount);

  const base = {
    id: ksuid("aut"),
    card: card.id, customer: card.customer, account: card.account,
    amount: { amount: body.amount, currency },
    merchant: {
      name: body.merchant.name ?? "Unknown merchant",
      mcc: body.merchant.mcc ?? "5999",
      city: body.merchant.city ?? null,
      country: body.merchant.country ?? null,
    },
    client_reference_id: body.client_reference_id ?? null,
    owner: principalId(key),
    created_at: now(),
  };

  const declineWith = (decline_reason, network_response_code) => {
    const aut = { ...base, status: "declined", decline_reason, network_response_code, approved_at: null, declined_at: now(), settled_at: null };
    authorisations.set(aut.id, aut);
    emit("authorisation.declined", aut, { tenantId: aut.owner });
    return aut;
  };

  // Card-state declines are a resource outcome, not an HTTP error: the network still
  // returns a decline, it just never reaches your webhook to approve/decline.
  if (card.status === "frozen") return declineWith("card_frozen", "05");
  if (card.status === "closed") return declineWith("card_closed", "05");
  if (card.status === "pending_activation") return declineWith("card_inactive", "05");

  if (card.merchant_categories.blocked.includes(base.merchant.mcc)) return declineWith("merchant_category_blocked", "57");
  if (card.merchant_categories.allowed.length && !card.merchant_categories.allowed.includes(base.merchant.mcc)) {
    return declineWith("merchant_category_not_allowed", "57");
  }

  // Spend limits are enforced as a hard reject — the attempt never becomes a resource.
  const perAuthLimit = toMinor(card.spend_limits.per_authorization.amount);
  if (minor > perAuthLimit) {
    throw new ApiError("limit-exceeded", 400,
      `Authorisation of ${body.amount} ${currency} exceeds the per-authorisation limit of ${card.spend_limits.per_authorization.amount} ${currency}`);
  }
  const dailyLimit = toMinor(card.spend_limits.daily.amount);
  const today = now().slice(0, 10);
  const todaySpent = [...authorisations.values()]
    .filter((a) => a.card === card.id && ["approved", "settled"].includes(a.status) && a.created_at.slice(0, 10) === today)
    .reduce((n, a) => n + toMinor(a.amount.amount), 0n);
  if (todaySpent + minor > dailyLimit) {
    throw new ApiError("limit-exceeded", 400,
      `Authorisation would push today's spend to ${fromMinor(todaySpent + minor)} ${currency}, over the daily limit of ${card.spend_limits.daily.amount} ${currency}`);
  }

  const aut = { ...base, status: "pending", decline_reason: null, network_response_code: null, approved_at: null, declined_at: null, settled_at: null };
  authorisations.set(aut.id, aut);
  emit("authorisation.created", aut, { tenantId: aut.owner });
  return aut;
}, { created: true });

/* ================= AUTHORISATIONS ================= */

route("GET", "/v2/authorisations/:id", ({ params, key }) => must(authorisations, params.id, "authorisation", key));

route("GET", "/v2/authorisations", ({ url, key }) => {
  let rows = [...authorisations.values()];
  const card = url.searchParams.get("card");
  if (card) rows = rows.filter((a) => a.card === card);
  const status = url.searchParams.get("status");
  if (status) rows = rows.filter((a) => a.status === status);
  rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return paginate(visibleTo(rows, key), url);
});

/** Approving an already-pending authorisation is not gated on the card's current
 *  freeze state — a frozen card still lets authorisations approved before the
 *  freeze settle. Only NEW authorisation attempts (see the simulate helper above)
 *  get declined for a frozen card. */
route("POST", "/v2/authorisations/:id/approve", ({ params, key }) => {
  const aut = must(authorisations, params.id, "authorisation", key);
  if (aut.status !== "pending") throw new ApiError("conflict", 409, `Authorisation ${aut.id} is ${aut.status}, not pending`);

  const minor = toMinor(aut.amount.amount);
  const bal = balanceOf(aut.account, aut.amount.currency);
  if (bal < minor) {
    throw new ApiError("insufficient-balance", 400,
      `Account ${aut.account} holds ${fromMinor(bal)} ${aut.amount.currency}, cannot settle ${aut.amount.amount}`);
  }
  post([
    { account: aut.account, currency: aut.amount.currency, amount: -minor },
    { account: "clearing:card_authorisations", currency: aut.amount.currency, amount: minor },
  ], `authorisation ${aut.id} settled`);

  aut.status = "settled";
  aut.approved_at = now();
  aut.settled_at = now();
  aut.network_response_code = "00";
  emit("authorisation.approved", aut, { tenantId: aut.owner });
  return aut;
});

route("POST", "/v2/authorisations/:id/decline", ({ params, body, key }) => {
  const aut = must(authorisations, params.id, "authorisation", key);
  if (aut.status !== "pending") throw new ApiError("conflict", 409, `Authorisation ${aut.id} is ${aut.status}, not pending`);
  aut.status = "declined";
  aut.decline_reason = body.reason || "declined_by_customer";
  aut.declined_at = now();
  aut.network_response_code = "05";
  emit("authorisation.declined", aut, { tenantId: aut.owner });
  return aut;
});

/* ================= DISPUTES ================= */

route("POST", "/v2/disputes", ({ body, key }) => {
  need(body, ["authorisation", "reason_code"]);
  const aut = must(authorisations, body.authorisation, "authorisation", key);
  if (aut.status !== "settled") {
    throw new ApiError("validation-error", 400, `Only settled authorisations can be disputed (this one is ${aut.status})`);
  }
  const reason = DISPUTE_REASON_CODES[body.reason_code];
  if (!reason) {
    throw new ApiError("validation-error", 400, `Unknown reason_code ${body.reason_code}`, [
      { field: "reason_code", message: `must be one of: ${Object.keys(DISPUTE_REASON_CODES).join(", ")}`, code: "unknown_reason_code" },
    ]);
  }
  const existing = [...disputes.values()].find((d) => d.authorisation === aut.id && d.decision === null);
  if (existing) throw new ApiError("conflict", 409, `Authorisation ${aut.id} already has an open dispute ${existing.id}`);

  const d = {
    id: ksuid("dsp"),
    authorisation: aut.id, card: aut.card, customer: aut.customer,
    amount: aut.amount,
    reason_code: body.reason_code, reason_description: reason.description, reason_category: reason.category,
    status: "open", decision: null,
    deadline: new Date(Date.now() + reason.days_to_respond * 86_400_000).toISOString(),
    evidence: [],
    description: body.description ?? null,
    client_reference_id: body.client_reference_id ?? null,
    owner: principalId(key),
    created_at: now(),
  };
  disputes.set(d.id, d);
  emit("dispute.created", d, { tenantId: d.owner });
  return d;
}, { created: true });

route("GET", "/v2/disputes/:id", ({ params, key }) => must(disputes, params.id, "dispute", key));

route("GET", "/v2/disputes", ({ url, key }) => {
  let rows = [...disputes.values()];
  const card = url.searchParams.get("card");
  if (card) rows = rows.filter((d) => d.card === card);
  const status = url.searchParams.get("status");
  if (status) rows = rows.filter((d) => d.status === status);
  rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return paginate(visibleTo(rows, key), url);
});

route("POST", "/v2/disputes/:id/evidence", ({ params, body, key }) => {
  const d = must(disputes, params.id, "dispute", key);
  if (d.decision !== null) throw new ApiError("conflict", 409, `Dispute ${d.id} is already closed (${d.decision})`);
  if (Date.now() > Date.parse(d.deadline)) {
    throw new ApiError("conflict", 409, `The evidence deadline for dispute ${d.id} passed at ${d.deadline}`);
  }
  need(body, ["description"]);
  const entry = {
    id: `${d.id}_ev${d.evidence.length + 1}`,
    description: body.description,
    documents: Array.isArray(body.documents) ? body.documents : [],
    submitted_at: now(),
  };
  d.evidence.push(entry);
  d.status = "evidence_submitted";
  emit("dispute.evidence_submitted", { id: d.id, evidence: entry }, { tenantId: d.owner });
  return d;
});
