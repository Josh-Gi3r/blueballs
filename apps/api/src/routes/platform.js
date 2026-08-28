/** PLATFORM family — Webhooks, Sandbox, Events, Ledger & statements, Fees,
 *  Rails registry (calendar), Reference data.
 *
 *  Owns exactly this file. Resources that don't live in the shared `db`
 *  (webhooks, deliveries, simulations, statements, fee config) get their own
 *  durable `collection(name)` here — kernel's `db` object is a frozen shared
 *  surface (see kernel.js header) and isn't extended by family files.
 */

import { randomBytes, createHmac, createHash } from "node:crypto";
import {
  route,
  db,
  ksuid,
  need,
  must,
  ownedBy,
  paginate,
  now,
  ApiError,
  fromMinor,
  toMinor,
  post,
  balanceOf,
  RAILS,
  emit,
  collection,
  visibleTo,
  principalId,
  subscribeToEvents,
} from "../kernel.js";
import {
  WEBHOOK_DELIVERY_MODE,
  validateWebhookUrl,
  fetchWebhook,
} from "../webhook-egress.js";

const API_VERSION = "2026-08-06";

/* =========================================================================
 * WEBHOOKS — real signed HTTP delivery, delivery log, replay.
 * ====================================================================== */

const webhooks = collection("webhooks"); // whk_id -> target
const deliveries = collection("deliveries"); // whd_id -> delivery record

/** Sign `${timestamp}.${body}` with the target's secret and POST it.
 *  Never throws — failures land in the delivery log, not the caller's face. */
async function deliver(wh, evt, opts = {}) {
  const deliveryId = ksuid("whd");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = {
    id: evt.id,
    type: evt.type,
    created: evt.created_at,
    api_version: API_VERSION,
    delivery_id: deliveryId,
    data: evt.data,
  };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", wh.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  const record = {
    id: deliveryId,
    object: "webhook_delivery",
    webhook: wh.id,
    event_id: evt.id,
    event_type: evt.type,
    data: evt.data,
    url: wh.url,
    replay: !!opts.replay,
    replayed_from: opts.replayedFrom ?? null,
    owner: wh.owner,
    status: "pending",
    response_code: null,
    error: null,
    attempted_at: now(),
  };
  deliveries.set(record.id, record);

  try {
    const headers = {
      "content-type": "application/json",
      "x-webhook-id": wh.id,
      "x-webhook-event": evt.type,
      "x-webhook-signature": `t=${timestamp},v1=${signature}`,
    };
    if (opts.replay) headers["x-webhook-replay"] = "true";
    const res = await fetchWebhook(wh.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
    record.status = res.ok ? "succeeded" : "failed";
    record.response_code = res.status;
  } catch (e) {
    record.status = "failed";
    record.error = e.message;
  }
  deliveries.set(record.id, record);
  return record;
}

function dispatchToWebhooks(evt) {
  for (const wh of webhooks.values()) {
    if (wh.owner !== evt.tenant_id) continue;
    if (wh.status !== "enabled") continue;
    if (!(wh.events.includes("*") || wh.events.includes(evt.type))) continue;
    deliver(wh, evt).catch(() => {}); // fire-and-forget — never blocks the caller
  }
}

/** Emit a platform event AND deliver it to matching webhooks right away. */
function notify(type, data, tenantId) {
  return emit(type, data, { tenantId });
}

subscribeToEvents((evt) => {
  if (webhooks.size) dispatchToWebhooks(evt);
});

function withoutSecret(wh) {
  const { secret: _secret, ...publicTarget } = wh;
  return publicTarget;
}

route(
  "POST",
  "/v2/webhooks",
  ({ body, key }) => {
    need(body, ["url"]);
    if (WEBHOOK_DELIVERY_MODE !== "allowlist") {
      throw new ApiError(
        "service-unavailable",
        503,
        "Webhook delivery is disabled on this host",
      );
    }
    const targetUrl = validateWebhookUrl(body.url);
    const events =
      Array.isArray(body.events) && body.events.length ? body.events : ["*"];
    const wh = {
      id: ksuid("whk"),
      object: "webhook_target",
      url: targetUrl,
      events,
      status: "enabled",
      delivery_mode: WEBHOOK_DELIVERY_MODE,
      secret: "whsec_" + randomBytes(24).toString("base64url"),
      owner: principalId(key),
      client_reference_id: body.client_reference_id ?? null,
      created_at: now(),
    };
    webhooks.set(wh.id, wh);
    return wh;
  },
  { created: true },
);

route("GET", "/v2/webhooks/:id", ({ params, key }) =>
  withoutSecret(must(webhooks, params.id, "webhook target", key)),
);

route("GET", "/v2/webhooks", ({ url, key }) =>
  paginate(visibleTo([...webhooks.values()], key).map(withoutSecret), url),
);

route("PATCH", "/v2/webhooks/:id", ({ params, body, key }) => {
  const wh = must(webhooks, params.id, "webhook target", key);
  if (body.url !== undefined) {
    wh.url = validateWebhookUrl(body.url);
  }
  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || !body.events.length) {
      throw new ApiError(
        "validation-error",
        400,
        "events must be a non-empty array",
      );
    }
    wh.events = body.events;
  }
  if (body.status !== undefined) {
    if (!["enabled", "disabled"].includes(body.status)) {
      throw new ApiError(
        "validation-error",
        400,
        "status must be enabled or disabled",
      );
    }
    if (body.status === "enabled" && WEBHOOK_DELIVERY_MODE !== "allowlist") {
      throw new ApiError(
        "conflict",
        409,
        "Webhook delivery is disabled on this host",
      );
    }
    wh.status = body.status;
  }
  webhooks.set(wh.id, wh);
  return withoutSecret(wh);
});

route("DELETE", "/v2/webhooks/:id", ({ params, key }) => {
  const wh = must(webhooks, params.id, "webhook target", key);
  webhooks.delete(params.id);
  return { ...withoutSecret(wh), deleted: true };
});

route("GET", "/v2/webhooks/:id/deliveries", ({ params, url, key }) => {
  must(webhooks, params.id, "webhook target", key);
  const rows = [...deliveries.values()]
    .filter((d) => d.webhook === params.id && d.owner === principalId(key))
    .sort((a, b) => a.attempted_at.localeCompare(b.attempted_at));
  return paginate(rows, url);
});

route(
  "POST",
  "/v2/webhooks/deliveries/:did/replay",
  async ({ params, key }) => {
    if (WEBHOOK_DELIVERY_MODE !== "allowlist") {
      throw new ApiError(
        "service-unavailable",
        503,
        "Webhook delivery is disabled on this host",
      );
    }
    const original = must(deliveries, params.did, "delivery", key);
    const wh = must(webhooks, original.webhook, "webhook target", key);
    const evtLike = {
      id: original.event_id,
      type: original.event_type,
      created_at: original.attempted_at,
      data: original.data,
    };
    return deliver(wh, evtLike, { replay: true, replayedFrom: original.id });
  },
);

/* =========================================================================
 * SANDBOX — scenario catalogue, stateful payment/onboarding simulations,
 * pause with awaiting_advance, then advance past it. Idempotent on
 * `simulation_id`. Wired to real webhook delivery via notify() above.
 * ====================================================================== */

const simulations = collection("simulations"); // sim_id -> record

const PAYMENT_SCENARIOS = {
  "payment.success": {
    awaiting_advance: false,
    status: "settled",
    does: "Inbound payment settles immediately.",
  },
  "payment.unconfirmed": {
    awaiting_advance: true,
    status: "awaiting_confirmation",
    does: "Inbound payment stalls awaiting confirmation. Pauses with awaiting_advance: true until you call advance.",
  },
  "payment.failed": {
    awaiting_advance: false,
    status: "failed",
    does: "Inbound payment fails outright — force a failure on purpose.",
  },
};

const ONBOARDING_SCENARIOS = {
  "onboarding.approved": {
    awaiting_advance: false,
    status: "completed",
    decision: "approved",
    does: "Onboarding completes and is approved immediately.",
  },
  "onboarding.manual_review": {
    awaiting_advance: true,
    status: "in_review",
    decision: null,
    does: "Onboarding pauses for manual review. Pauses with awaiting_advance: true until you call advance.",
  },
  "onboarding.compliance_hold": {
    awaiting_advance: true,
    status: "compliance_hold",
    decision: null,
    does: "Onboarding is placed on compliance hold. Pauses with awaiting_advance: true until you call advance.",
  },
  "onboarding.declined": {
    awaiting_advance: false,
    status: "completed",
    decision: "declined",
    does: "Onboarding is declined outright — force a failure on purpose.",
  },
};

route("GET", "/v2/sandbox/scenarios", () => ({
  object: "list",
  data: [
    ...Object.entries(PAYMENT_SCENARIOS).map(([name, s]) => ({
      name,
      kind: "payment",
      awaiting_advance: s.awaiting_advance,
      does: s.does,
    })),
    ...Object.entries(ONBOARDING_SCENARIOS).map(([name, s]) => ({
      name,
      kind: "onboarding",
      awaiting_advance: s.awaiting_advance,
      does: s.does,
    })),
  ],
}));

/** Move real money into `account` for a settled sandbox payment, if one was given. */
function creditSandboxAccount(sim) {
  if (!sim.account) return;
  const acc = db.accounts.get(sim.account);
  if (!acc) return;
  const minor = toMinor(sim.amount.amount);
  post(
    [
      { account: acc.id, currency: acc.currency, amount: minor },
      { account: "external:sandbox", currency: acc.currency, amount: -minor },
    ],
    `sandbox simulation ${sim.id}`,
  );
}

route(
  "POST",
  "/v2/sandbox/payments",
  ({ body, key }) => {
    need(body, ["scenario", "amount", "currency"]);
    const scenario = PAYMENT_SCENARIOS[body.scenario];
    if (!scenario) {
      throw new ApiError(
        "validation-error",
        400,
        `Unknown scenario ${body.scenario}`,
        [
          {
            field: "scenario",
            message: `try one of: ${Object.keys(PAYMENT_SCENARIOS).join(", ")}`,
            code: "unknown_scenario",
          },
        ],
      );
    }
    const simId = body.simulation_id || ksuid("sim");
    const existing = simulations.get(simId);
    // Idempotent on simulation_id — but only for the tenant that owns the row.
    // Without ownedBy this create path is a read of anyone's simulation, while
    // GET and advance are both correctly scoped.
    if (existing) return ownedBy(existing, key, "simulation", simId);

    if (body.account) {
      // a simulation settles real ledger movement into this account, so it must
      // be the caller's own
      const acc = must(db.accounts, body.account, "account", key);
      if (acc.currency !== String(body.currency).toUpperCase()) {
        throw new ApiError(
          "validation-error",
          400,
          `Account ${acc.id} holds ${acc.currency}, not ${body.currency}`,
        );
      }
    }

    const nowStamp = now();
    const sim = {
      id: simId,
      object: "sandbox.payment",
      scenario: body.scenario,
      status: scenario.status,
      awaiting_advance: scenario.awaiting_advance,
      amount: {
        amount: body.amount,
        currency: String(body.currency).toUpperCase(),
      },
      account: body.account ?? null,
      owner: principalId(key),
      event_ids: [],
      history: [
        {
          status: scenario.status,
          awaiting_advance: scenario.awaiting_advance,
          at: nowStamp,
        },
      ],
      created_at: nowStamp,
      updated_at: nowStamp,
    };

    if (scenario.status === "settled") creditSandboxAccount(sim);

    const evt = notify(
      `sandbox.payment.${scenario.status === "awaiting_confirmation" ? "unconfirmed" : scenario.status}`,
      {
        simulation_id: sim.id,
        previous_status: null,
        current_status: sim.status,
        amount: sim.amount,
        awaiting_advance: sim.awaiting_advance,
      },
      sim.owner,
    );
    sim.event_ids.push(evt.id);

    simulations.set(sim.id, sim);
    return sim;
  },
  { created: true },
);

route(
  "POST",
  "/v2/sandbox/onboarding",
  ({ body, key }) => {
    need(body, ["scenario"]);
    const scenario = ONBOARDING_SCENARIOS[body.scenario];
    if (!scenario) {
      throw new ApiError(
        "validation-error",
        400,
        `Unknown scenario ${body.scenario}`,
        [
          {
            field: "scenario",
            message: `try one of: ${Object.keys(ONBOARDING_SCENARIOS).join(", ")}`,
            code: "unknown_scenario",
          },
        ],
      );
    }
    const simId = body.simulation_id || ksuid("sim");
    const existing = simulations.get(simId);
    // Idempotent on simulation_id — but only for the tenant that owns the row.
    if (existing) return ownedBy(existing, key, "simulation", simId);

    // a simulation may only touch the caller's own customer
    if (body.customer) must(db.customers, body.customer, "customer", key);

    const nowStamp = now();
    const sim = {
      id: simId,
      object: "sandbox.onboarding",
      scenario: body.scenario,
      status: scenario.status,
      decision: scenario.decision,
      awaiting_advance: scenario.awaiting_advance,
      customer: body.customer ?? null,
      owner: principalId(key),
      event_ids: [],
      history: [
        {
          status: scenario.status,
          decision: scenario.decision,
          awaiting_advance: scenario.awaiting_advance,
          at: nowStamp,
        },
      ],
      created_at: nowStamp,
      updated_at: nowStamp,
    };

    if (sim.customer) {
      const c = db.customers.get(sim.customer);
      c.status = scenario.status;
      c.decision = scenario.decision;
      db.customers.set(c.id, c);
    }

    const evt = notify(
      `sandbox.onboarding.${body.scenario.split(".")[1]}`,
      {
        simulation_id: sim.id,
        previous_status: null,
        current_status: sim.status,
        decision: sim.decision,
        awaiting_advance: sim.awaiting_advance,
      },
      sim.owner,
    );
    sim.event_ids.push(evt.id);

    simulations.set(sim.id, sim);
    return sim;
  },
  { created: true },
);

route("POST", "/v2/sandbox/:id/advance", ({ params, body, key }) => {
  const sim = must(simulations, params.id, "simulation", key);
  if (!sim.awaiting_advance) {
    throw new ApiError(
      "conflict",
      409,
      `Simulation ${sim.id} is not awaiting advance (status: ${sim.status})`,
    );
  }
  const previous = sim.status;

  if (sim.object === "sandbox.payment") {
    sim.status = body.outcome === "fail" ? "failed" : "settled";
    sim.awaiting_advance = false;
    if (sim.status === "settled") creditSandboxAccount(sim);
    const evt = notify(
      `sandbox.payment.${sim.status === "failed" ? "failed" : "confirmed"}`,
      {
        simulation_id: sim.id,
        previous_status: previous,
        current_status: sim.status,
        amount: sim.amount,
      },
      sim.owner,
    );
    sim.event_ids.push(evt.id);
  } else {
    sim.status = "completed";
    sim.decision =
      body.decision ??
      (sim.scenario === "onboarding.compliance_hold" ? "declined" : "approved");
    sim.awaiting_advance = false;
    if (sim.customer) {
      const c = db.customers.get(sim.customer);
      if (c) {
        c.status = sim.status;
        c.decision = sim.decision;
        db.customers.set(c.id, c);
      }
    }
    const evt = notify(
      "sandbox.onboarding.reviewed",
      {
        simulation_id: sim.id,
        previous_status: previous,
        current_status: sim.status,
        decision: sim.decision,
      },
      sim.owner,
    );
    sim.event_ids.push(evt.id);
  }

  sim.updated_at = now();
  sim.history.push({
    status: sim.status,
    decision: sim.decision ?? null,
    awaiting_advance: sim.awaiting_advance,
    at: sim.updated_at,
  });
  simulations.set(sim.id, sim);
  return sim;
});

route("GET", "/v2/sandbox/:id", ({ params, key }) => {
  const sim = must(simulations, params.id, "simulation", key);
  const callbacks = sim.event_ids
    .flatMap((eid) =>
      [...deliveries.values()].filter((d) => d.event_id === eid),
    )
    .map(({ id, webhook, status, response_code, replay, attempted_at }) => ({
      id,
      webhook,
      status,
      response_code,
      replay,
      attempted_at,
    }));
  return { ...sim, callbacks };
});

/* =========================================================================
 * EVENTS — the one remaining stub: fetch a single event.
 * ====================================================================== */

route("GET", "/v2/events/:id", ({ params, key }) => {
  const evt = [...db.events].find(
    (e) => e.id === params.id && e.tenant_id === principalId(key),
  );
  if (!evt) throw new ApiError("not-found", 404, `No event ${params.id}`);
  const { tenant_id: _tenantId, ...publicEvent } = evt;
  return publicEvent;
});

/* =========================================================================
 * LEDGER & STATEMENTS
 * ====================================================================== */

route("GET", "/v2/ledger/balances", ({ url, key }) => {
  const acctFilter = url.searchParams.get("account");
  // balances are derived from postings, which carry no owner — scope them to the
  // accounts this key holds, or any key could read any account's balance
  const mine = new Set(
    visibleTo([...db.accounts.values()], key).map((a) => a.id),
  );
  const pairs = new Map();
  for (const row of db.ledger) {
    if (!mine.has(row.account)) continue;
    if (acctFilter && row.account !== acctFilter) continue;
    pairs.set(`${row.account}|${row.currency}`, {
      account: row.account,
      currency: row.currency,
    });
  }
  const rows = [...pairs.values()]
    .map((p) => ({
      id: `bal_${p.account}_${p.currency}`,
      account: p.account,
      currency: p.currency,
      balance: fromMinor(balanceOf(p.account, p.currency)), // always derived, never stored
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return paginate(rows, url);
});

const statements = collection("statements"); // stm_id -> statement

route(
  "POST",
  "/v2/statements",
  ({ body, key }) => {
    need(body, ["account"]);
    const acc = must(db.accounts, body.account, "account", key);
    const format = body.format ?? "json";
    if (!["csv", "pdf", "json"].includes(format)) {
      throw new ApiError(
        "validation-error",
        400,
        "format must be csv, pdf or json",
      );
    }
    const from = body.from ? Date.parse(body.from) : -Infinity;
    const to = body.to ? Date.parse(body.to) : Infinity;
    if ((body.from && Number.isNaN(from)) || (body.to && Number.isNaN(to))) {
      throw new ApiError(
        "validation-error",
        400,
        "from/to must be parseable dates",
      );
    }

    // Pull every full transaction (both legs) that touches this account in
    // range — including the counter-leg guarantees debits == credits by
    // construction, since post() already enforces each txn sums to zero.
    const allRows = [...db.ledger];
    const txnIds = new Set(
      allRows
        .filter((r) => r.account === acc.id && r.currency === acc.currency)
        .filter((r) => {
          const t = Date.parse(r.at);
          return t >= from && t <= to;
        })
        .map((r) => r.txn),
    );
    const rows = allRows
      .filter((r) => txnIds.has(r.txn))
      .sort((a, b) => a.at.localeCompare(b.at));

    const totalDebits = rows
      .filter((r) => r.amount < 0n)
      .reduce((n, r) => n - r.amount, 0n);
    const totalCredits = rows
      .filter((r) => r.amount > 0n)
      .reduce((n, r) => n + r.amount, 0n);

    const accountRows = rows.filter((r) => r.account === acc.id);
    const net = accountRows.reduce((n, r) => n + r.amount, 0n);
    const closing = balanceOf(acc.id, acc.currency);
    const opening = closing - net;

    const lineItems = rows.map((r) => ({
      txn: r.txn,
      at: r.at,
      account: r.account,
      currency: r.currency,
      debit: r.amount < 0n ? fromMinor(-r.amount) : null,
      credit: r.amount > 0n ? fromMinor(r.amount) : null,
      memo: r.memo,
    }));

    const csvLines = ["txn,at,account,currency,debit,credit,memo"];
    for (const li of lineItems) {
      csvLines.push(
        [
          li.txn,
          li.at,
          li.account,
          li.currency,
          li.debit ?? "",
          li.credit ?? "",
          li.memo ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    csvLines.push(
      `TOTAL,,,,${fromMinor(totalDebits)},${fromMinor(totalCredits)},`,
    );
    const csv = csvLines.join("\n");

    const s = {
      id: ksuid("stm"),
      object: "statement",
      account: acc.id,
      currency: acc.currency,
      owner: principalId(key),
      from: body.from ?? null,
      to: body.to ?? null,
      format,
      opening_balance: fromMinor(opening),
      closing_balance: fromMinor(closing),
      total_debits: fromMinor(totalDebits),
      total_credits: fromMinor(totalCredits),
      balanced: totalDebits === totalCredits,
      line_items: lineItems,
      csv,
      created_at: now(),
    };
    s.signature = createHash("sha256")
      .update(
        JSON.stringify({
          account: s.account,
          from: s.from,
          to: s.to,
          line_items: s.line_items,
          total_debits: s.total_debits,
          total_credits: s.total_credits,
        }),
      )
      .digest("hex");
    if (format === "pdf") {
      s.pdf_base64 = Buffer.from(
        `Statement ${s.id}\nAccount ${s.account}\n${csv}`,
      ).toString("base64");
      s.note =
        "Sandbox PDF is a base64-encoded plaintext stand-in, not a rendered PDF binary.";
    }

    statements.set(s.id, s);
    return s;
  },
  { created: true },
);

route("GET", "/v2/statements/:id", ({ params, key }) =>
  must(statements, params.id, "statement", key),
);

/* =========================================================================
 * FEES
 * ====================================================================== */

const FEE_SCHEDULE = {
  sepa_instant: { flat: "0.10", bps: 5 },
  sepa: { flat: "0.00", bps: 2 },
  faster_payments: { flat: "0.05", bps: 3 },
  ach: { flat: "0.25", bps: 4 },
  wire: { flat: "15.00", bps: 0 },
  paynow: { flat: "0.05", bps: 3 },
};
const feeConfigs = collection("feeConfigs"); // tenant_id -> { payout_account, updated_at }

route("GET", "/v2/fees/config", ({ key }) => {
  const cfg = feeConfigs.get(principalId(key)) ?? {
    payout_account: null,
    updated_at: null,
  };
  return {
    object: "fee_config",
    schedule: FEE_SCHEDULE,
    payout_account: cfg.payout_account,
    updated_at: cfg.updated_at,
  };
});

route("PUT", "/v2/fees/config", ({ key, body }) => {
  need(body, ["payout_account"]);
  must(db.accounts, body.payout_account, "account", key);
  const cfg = { payout_account: body.payout_account, updated_at: now() };
  feeConfigs.set(principalId(key), cfg);
  return { object: "fee_config", schedule: FEE_SCHEDULE, ...cfg };
});

/* =========================================================================
 * RAILS REGISTRY — calendar
 * ====================================================================== */

// Fixed 2026 holiday sets, keyed by the currency each rail settles in.
const HOLIDAYS = {
  EUR: [
    "2026-01-01",
    "2026-04-03",
    "2026-04-06",
    "2026-05-01",
    "2026-12-25",
    "2026-12-26",
  ],
  GBP: [
    "2026-01-01",
    "2026-04-03",
    "2026-04-06",
    "2026-05-25",
    "2026-12-25",
    "2026-12-28",
  ],
  USD: ["2026-01-01", "2026-07-04", "2026-11-26", "2026-12-25"],
  SGD: ["2026-01-01", "2026-02-17", "2026-02-18", "2026-12-25"],
};

route(
  "GET",
  "/v2/rails/:id/calendar",
  ({ params, url }) => {
    const rail = RAILS[params.id];
    if (!rail) throw new ApiError("not-found", 404, `No rail ${params.id}`);
    const days = Math.min(Number(url.searchParams.get("days") || 30), 90);
    const holidays = new Set(HOLIDAYS[rail.currency] || []);

    const base = new Date();
    base.setUTCHours(0, 0, 0, 0);
    const data = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidays.has(iso);
      const closedForWeekend = isWeekend && !rail.weekend;
      data.push({
        date: iso,
        weekend: isWeekend,
        holiday: isHoliday,
        business_day: !isHoliday && !closedForWeekend,
      });
    }

    return {
      object: "list",
      rail: rail.id,
      currency: rail.currency,
      cutoff: rail.cutoff,
      runs_weekends: rail.weekend,
      data,
    };
  },
  { public: true },
);

/* =========================================================================
 * REFERENCE DATA
 * ====================================================================== */

const COUNTRIES = [
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
];
route("GET", "/v2/countries", () => ({ object: "list", data: COUNTRIES }), {
  public: true,
});

const NETWORKS = [
  {
    id: "base",
    name: "Base",
    chain_id: 8453,
    native_currency: "ETH",
    supports: ["USDC"],
  },
  {
    id: "ethereum",
    name: "Ethereum",
    chain_id: 1,
    native_currency: "ETH",
    supports: ["USDC"],
  },
  {
    id: "polygon",
    name: "Polygon",
    chain_id: 137,
    native_currency: "MATIC",
    supports: ["USDC"],
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    chain_id: 42161,
    native_currency: "ETH",
    supports: ["USDC"],
  },
  {
    id: "solana",
    name: "Solana",
    chain_id: null,
    native_currency: "SOL",
    supports: ["USDC"],
  },
];
route("GET", "/v2/networks", () => ({ object: "list", data: NETWORKS }), {
  public: true,
});
