/** Money products family: savings vaults, credit lines, quote execution,
 *  rate/pair reference data, and the two remaining transfer endpoints.
 *
 *  Owns exactly this file per the M2 fan-out contract in kernel.js. Vaults and
 *  credit lines use the shared SQLite-backed collection adapter. Every balance
 *  (vault holdings, credit drawn amount) is derived from the shared ledger via
 *  balanceOf(), never stored as a field, and every movement goes through post().
 */
import {
  route,
  db,
  ksuid,
  need,
  must,
  paginate,
  now,
  ApiError,
  toMinor,
  fromMinor,
  post,
  balanceOf,
  emit,
  RATES,
  THIN,
  collection,
  visibleTo,
  principalId,
  positiveMinor,
} from "../kernel.js";
import { convertMinor, rateString } from "../exact-rates.js";

const vaults = collection("vaults");
const creditLines = collection("creditLines");

/* ======================= Savings vaults ======================= */

function vaultView(v) {
  const balance = balanceOf(v.id, v.currency);
  const days = Math.max(0, (Date.now() - Date.parse(v.created_at)) / 86400000);
  const accrued =
    v.status === "active"
      ? (Number(fromMinor(balance)) * v.rate * days) / 365
      : 0;
  return {
    ...v,
    balance: { amount: fromMinor(balance), currency: v.currency },
    accrued_interest: { amount: accrued.toFixed(2), currency: v.currency },
  };
}

route(
  "POST",
  "/v2/vaults",
  ({ body, key }) => {
    need(body, ["account"]);
    const acc = must(db.accounts, body.account, "account", key);
    const v = {
      id: ksuid("vlt"),
      account: acc.id,
      currency: acc.currency,
      name: body.name ?? "Savings vault",
      rate: typeof body.rate === "number" ? body.rate : 0.03,
      status: "active",
      client_reference_id: body.client_reference_id ?? null,
      created_at: now(),
      owner: principalId(key),
    };
    vaults.set(v.id, v);
    emit("vault.created", v, { tenantId: v.owner });
    return vaultView(v);
  },
  { created: true },
);

route("GET", "/v2/vaults/:id", ({ params, key }) =>
  vaultView(must(vaults, params.id, "vault", key)),
);

route("GET", "/v2/vaults", ({ url, key }) =>
  paginate(visibleTo([...vaults.values()], key).map(vaultView), url),
);

route("POST", "/v2/vaults/:id/deposit", ({ params, body, key }) => {
  const v = must(vaults, params.id, "vault", key);
  if (v.status !== "active")
    throw new ApiError("conflict", 409, `Vault ${v.id} is ${v.status}`);
  need(body, ["amount"]);
  const minor = positiveMinor(body.amount);
  if (balanceOf(v.account, v.currency) < minor) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(v.account, v.currency))} ${v.currency}`,
    );
  }
  post(
    [
      { account: v.account, currency: v.currency, amount: -minor },
      { account: v.id, currency: v.currency, amount: minor },
    ],
    `vault ${v.id} deposit`,
  );
  emit(
    "vault.deposited",
    { id: v.id, amount: body.amount, currency: v.currency },
    { tenantId: v.owner },
  );
  return vaultView(v);
});

route("POST", "/v2/vaults/:id/withdraw", ({ params, body, key }) => {
  const v = must(vaults, params.id, "vault", key);
  if (v.status !== "active")
    throw new ApiError("conflict", 409, `Vault ${v.id} is ${v.status}`);
  need(body, ["amount"]);
  const minor = positiveMinor(body.amount);
  const bal = balanceOf(v.id, v.currency);
  if (bal < minor)
    throw new ApiError(
      "insufficient-balance",
      400,
      `Vault holds ${fromMinor(bal)} ${v.currency}`,
    );
  post(
    [
      { account: v.id, currency: v.currency, amount: -minor },
      { account: v.account, currency: v.currency, amount: minor },
    ],
    `vault ${v.id} withdraw`,
  );
  emit(
    "vault.withdrawn",
    { id: v.id, amount: body.amount, currency: v.currency },
    { tenantId: v.owner },
  );
  return vaultView(v);
});

route("DELETE", "/v2/vaults/:id", ({ params, key }) => {
  const v = must(vaults, params.id, "vault", key);
  if (v.status !== "active")
    throw new ApiError("conflict", 409, `Vault ${v.id} is already ${v.status}`);
  const bal = balanceOf(v.id, v.currency);
  if (bal > 0n) {
    post(
      [
        { account: v.id, currency: v.currency, amount: -bal },
        { account: v.account, currency: v.currency, amount: bal },
      ],
      `vault ${v.id} closed - sweep remaining balance`,
    );
  }
  v.status = "closed";
  v.closed_at = now();
  emit("vault.closed", { id: v.id }, { tenantId: v.owner });
  return vaultView(v);
});

/* ======================= Credit lines ======================= */

/** Convert collateral value into the credit line's currency (minor units) and
 *  cap it by LTV, mirroring the RATES-based conversion the quotes handler uses. */
function maxDrawableMinor(c) {
  const limitMinor = toMinor(c.limit);
  if (!c.collateral) return limitMinor;
  const collMinor = toMinor(c.collateral.amount);
  const valueInCreditCcy = convertMinor(
    collMinor,
    c.collateral.currency,
    c.currency,
  );
  const ltvCapMinor =
    (valueInCreditCcy * BigInt(c.ltv_bps ?? ltvBasisPoints(c.ltv_max))) /
    10_000n;
  return limitMinor < ltvCapMinor ? limitMinor : ltvCapMinor;
}

function ltvBasisPoints(value) {
  if (value === undefined) return 8_000;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {
    throw new ApiError(
      "validation-error",
      400,
      "ltv_max must be a number greater than 0 and no greater than 1",
    );
  }
  const basisPoints = Math.round(value * 10_000);
  if (basisPoints < 1) {
    throw new ApiError(
      "validation-error",
      400,
      "ltv_max must be at least 0.0001",
    );
  }
  return basisPoints;
}

function creditView(c) {
  const { ltv_bps: _ltvBasisPoints, ...publicCredit } = c;
  const drawn = balanceOf(c.id, c.currency);
  const maxDrawable = maxDrawableMinor(c);
  const available = maxDrawable - drawn;
  return {
    ...publicCredit,
    limit: { amount: c.limit, currency: c.currency },
    drawn: { amount: fromMinor(drawn), currency: c.currency },
    available: {
      amount: fromMinor(available > 0n ? available : 0n),
      currency: c.currency,
    },
  };
}

route(
  "POST",
  "/v2/credit",
  ({ body, key }) => {
    need(body, ["account", "limit"]);
    const acc = must(db.accounts, body.account, "account", key);
    positiveMinor(body.limit, "limit");
    if (body.collateral) {
      need(body.collateral, ["amount", "currency"]);
      positiveMinor(body.collateral.amount, "collateral.amount");
    }
    const collateralCurrency = body.collateral
      ? String(body.collateral.currency).toUpperCase()
      : null;
    if (collateralCurrency && !RATES[collateralCurrency]) {
      throw new ApiError(
        "validation-error",
        400,
        `${collateralCurrency} is not a supported currency`,
      );
    }
    const c = {
      id: ksuid("crl"),
      account: acc.id,
      currency: acc.currency,
      limit: body.limit,
      ltv_max: body.ltv_max ?? 0.8,
      ltv_bps: ltvBasisPoints(body.ltv_max),
      collateral: body.collateral
        ? { amount: body.collateral.amount, currency: collateralCurrency }
        : null,
      status: "active",
      client_reference_id: body.client_reference_id ?? null,
      created_at: now(),
      owner: principalId(key),
    };
    creditLines.set(c.id, c);
    emit("credit_line.opened", c, { tenantId: c.owner });
    return creditView(c);
  },
  { created: true },
);

route("GET", "/v2/credit/:id", ({ params, key }) =>
  creditView(must(creditLines, params.id, "credit line", key)),
);

route("GET", "/v2/credit", ({ url, key }) =>
  paginate(visibleTo([...creditLines.values()], key).map(creditView), url),
);

route("POST", "/v2/credit/:id/draw", ({ params, body, key }) => {
  const c = must(creditLines, params.id, "credit line", key);
  if (c.status !== "active")
    throw new ApiError("conflict", 409, `Credit line ${c.id} is ${c.status}`);
  need(body, ["amount"]);
  const minor = positiveMinor(body.amount);
  const drawn = balanceOf(c.id, c.currency);
  const available = maxDrawableMinor(c) - drawn;
  if (minor > available) {
    throw new ApiError(
      "limit-exceeded",
      400,
      `Draw of ${body.amount} ${c.currency} exceeds available credit (${fromMinor(available > 0n ? available : 0n)} ${c.currency}, limited by credit limit and LTV)`,
    );
  }
  // The cash movement and liability recognition are one four-leg transaction.
  // A process failure can therefore never leave customer funds without debt.
  post(
    [
      { account: "clearing:credit", currency: c.currency, amount: -minor },
      { account: c.account, currency: c.currency, amount: minor },
      { account: c.id, currency: c.currency, amount: minor },
      {
        account: "clearing:credit:liability",
        currency: c.currency,
        amount: -minor,
      },
    ],
    `credit ${c.id} draw`,
  );
  emit(
    "credit_line.drawn",
    { id: c.id, amount: body.amount, currency: c.currency },
    { tenantId: c.owner },
  );
  return creditView(c);
});

route("POST", "/v2/credit/:id/repay", ({ params, body, key }) => {
  const c = must(creditLines, params.id, "credit line", key);
  need(body, ["amount"]);
  const minor = positiveMinor(body.amount);
  const drawn = balanceOf(c.id, c.currency);
  if (minor > drawn) {
    throw new ApiError(
      "validation-error",
      400,
      `Cannot repay more than the ${fromMinor(drawn)} ${c.currency} drawn`,
    );
  }
  if (balanceOf(c.account, c.currency) < minor) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(c.account, c.currency))} ${c.currency}`,
    );
  }
  post(
    [
      { account: c.account, currency: c.currency, amount: -minor },
      { account: "clearing:credit", currency: c.currency, amount: minor },
      {
        account: "clearing:credit:liability",
        currency: c.currency,
        amount: minor,
      },
      { account: c.id, currency: c.currency, amount: -minor },
    ],
    `credit ${c.id} repay`,
  );
  emit(
    "credit_line.repaid",
    { id: c.id, amount: body.amount, currency: c.currency },
    { tenantId: c.owner },
  );
  return creditView(c);
});

route("PATCH", "/v2/credit/:id/collateral", ({ params, body, key }) => {
  const c = must(creditLines, params.id, "credit line", key);
  need(body, ["amount", "currency"]);
  const cur = String(body.currency).toUpperCase();
  if (!RATES[cur])
    throw new ApiError(
      "validation-error",
      400,
      `${cur} is not a supported currency`,
    );
  positiveMinor(body.amount);
  c.collateral = { amount: body.amount, currency: cur };
  emit(
    "credit_line.collateral_adjusted",
    { id: c.id, collateral: c.collateral },
    { tenantId: c.owner },
  );
  return creditView(c);
});

/* ======================= Quotes & exchange ======================= */

route("POST", "/v2/quotes/:id/execute", ({ params, body, key }) => {
  const q = must(db.quotes, params.id, "quote", key);
  if (Date.parse(q.expires_at) < Date.now()) {
    throw new ApiError(
      "quote-expired",
      409,
      `Quote ${q.id} expired at ${q.expires_at}`,
    );
  }
  if (q.executed)
    throw new ApiError("conflict", 409, `Quote ${q.id} was already executed`);
  need(body, ["from_account", "to_account"]);
  const fromAcc = must(db.accounts, body.from_account, "account", key);
  const toAcc = must(db.accounts, body.to_account, "account", key);
  if (fromAcc.currency !== q.from) {
    throw new ApiError(
      "validation-error",
      400,
      `from_account must be in ${q.from}, got ${fromAcc.currency}`,
    );
  }
  if (toAcc.currency !== q.to) {
    throw new ApiError(
      "validation-error",
      400,
      `to_account must be in ${q.to}, got ${toAcc.currency}`,
    );
  }
  const debitMinor = toMinor(q.amount.amount);
  const creditMinor = toMinor(q.receives.amount);
  if (balanceOf(fromAcc.id, q.from) < debitMinor) {
    throw new ApiError(
      "insufficient-balance",
      400,
      `Account holds ${fromMinor(balanceOf(fromAcc.id, q.from))} ${q.from}`,
    );
  }
  // Settles atomically against the account balance: two same-currency legs,
  // each its own balanced double entry through the FX clearing account.
  post(
    [
      { account: fromAcc.id, currency: q.from, amount: -debitMinor },
      { account: "fx:clearing", currency: q.from, amount: debitMinor },
    ],
    `quote ${q.id} execute - from leg`,
  );
  post(
    [
      { account: "fx:clearing", currency: q.to, amount: -creditMinor },
      { account: toAcc.id, currency: q.to, amount: creditMinor },
    ],
    `quote ${q.id} execute - to leg`,
  );

  q.executed = true;
  q.executed_at = now();
  q.settlement_status =
    q.settlement === "when_matched" ? "pending_match" : "settled";
  q.from_account = fromAcc.id;
  q.to_account = toAcc.id;
  emit(
    "quote.executed",
    { id: q.id, from_account: fromAcc.id, to_account: toAcc.id },
    { tenantId: q.owner },
  );
  return q;
});

/** Indicative pricing for every supported pair — same thin/deep spread logic
 *  as POST /v2/quotes, but not lockable and not held as a resource. */
function ratePairs() {
  const currencies = Object.keys(RATES);
  const pairs = [];
  for (const from of currencies) {
    for (const to of currencies) {
      if (from === to) continue;
      const thin = THIN.has(from) || THIN.has(to);
      pairs.push({
        from,
        to,
        rate: rateString(from, to),
        spread_bps: thin ? 85 : 4,
        liquidity: thin ? "thin" : "deep",
        settlement: thin ? "when_matched" : "instant",
        lockable: false,
      });
    }
  }
  return pairs;
}

route(
  "GET",
  "/v2/rates",
  ({ url }) => {
    const from = url.searchParams.get("from")?.toUpperCase();
    const to = url.searchParams.get("to")?.toUpperCase();
    const all = ratePairs();
    if (from && to) {
      const pair = all.find((p) => p.from === from && p.to === to);
      if (!pair)
        throw new ApiError(
          "validation-error",
          400,
          "Unsupported currency pair",
        );
      return { ...pair, as_of: now() };
    }
    return { object: "list", data: all.map((p) => ({ ...p, as_of: now() })) };
  },
  { public: true },
);

route(
  "GET",
  "/v2/pairs",
  () => ({
    object: "list",
    data: ratePairs().map(({ from, to, liquidity, settlement }) => ({
      from,
      to,
      tradable: true,
      liquidity,
      settlement,
    })),
  }),
  { public: true },
);

/* ======================= Transfers (remaining) ======================= */

route("POST", "/v2/transfers/:id/cancel", ({ params, key }) => {
  const t = must(db.transfers, params.id, "transfer", key);
  // Every state before submission. The money is in the rail's clearing account
  // and has not been handed to the rail, so it can still be given back.
  if (!["created", "awaiting_funds", "funds_received"].includes(t.status)) {
    throw new ApiError(
      "conflict",
      409,
      `Transfer ${t.id} is ${t.status} and can no longer be canceled`,
    );
  }
  const minor = toMinor(t.amount.amount);
  post(
    [
      { account: t.from, currency: t.amount.currency, amount: minor },
      {
        account: "clearing:" + t.rail,
        currency: t.amount.currency,
        amount: -minor,
      },
    ],
    `transfer ${t.id} canceled - refund`,
  );
  const previous = t.status;
  t.status = "canceled";
  t.legs[0].status = "canceled";
  t.canceled_at = now();
  emit(
    "transfer.status_changed",
    { id: t.id, previous_status: previous, current_status: "canceled" },
    { tenantId: t.owner },
  );
  return t;
});

route("GET", "/v2/transfers/:id/legs", ({ params, url, key }) => {
  const t = must(db.transfers, params.id, "transfer", key);
  return paginate(t.legs, url);
});
