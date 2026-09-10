/** Blueballs API — banking runtime.
 * Node stdlib only: `node src/server.js` starts the complete banking API. */

import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { hashKey, inRequestScope } from "./lib.js";
import { FAMILIES } from "../../../src/endpoints.ts";
import {
  ksuid,
  toMinor,
  fromMinor,
  ApiError,
  db,
  emit,
  post,
  balanceOf,
  RAILS,
  RATES,
  THIN,
  routes,
  route,
  match,
  need,
  paginate,
  must,
  visibleTo,
  positiveMinor,
  principalId,
  setCommandContext,
  BANK_API_MODE,
} from "./kernel.js";
import {
  ibanGenerate,
  abaGenerate,
} from "../../../packages/validation/src/index.js";
import { convertMinor, rateString } from "./exact-rates.js";

function positiveIntegerEnv(name, fallback, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

function positiveNumberEnv(name, fallback, { max = Number.MAX_VALUE } = {}) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be greater than 0 and no greater than ${max}`);
  }
  return value;
}

export const API_PORT = positiveIntegerEnv("PORT", 5281, { max: 65535 });
const VERSION = "2026-09-10";
const SOURCE_COMMIT = process.env.BLUEBALLS_GIT_SHA || "development";

export const RATE_LIMIT = positiveIntegerEnv("RATE_LIMIT_PER_MIN", 60, {
  max: 1_000_000,
});
const SOURCE_RATE_LIMIT = positiveIntegerEnv(
  "SOURCE_RATE_LIMIT_PER_MIN",
  RATE_LIMIT,
  { max: 1_000_000 },
);
const TENANT_RATE_LIMIT = positiveIntegerEnv(
  "TENANT_RATE_LIMIT_PER_MIN",
  RATE_LIMIT,
  { max: 1_000_000 },
);
const BODY_LIMIT_BYTES = positiveIntegerEnv("BODY_LIMIT_BYTES", 1_048_576, {
  max: 100 * 1024 * 1024,
});
const IDEMPOTENCY_TTL_MS = positiveIntegerEnv(
  "IDEMPOTENCY_TTL_MS",
  24 * 60 * 60 * 1000,
  { max: 30 * 24 * 60 * 60 * 1000 },
);
const SANDBOX_KEY_LIFETIME_HOURS = positiveNumberEnv(
  "SANDBOX_KEY_LIFETIME_HOURS",
  24,
  { max: 168 },
);

const trustProxyRaw = process.env.TRUST_PROXY ?? "false";
if (!["true", "false"].includes(trustProxyRaw)) {
  throw new Error("TRUST_PROXY must be true or false");
}
const TRUST_PROXY = trustProxyRaw === "true";
const BODY_METHODS = new Set(["POST", "PATCH", "PUT"]);
const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const WINDOW_MS = 60_000;
const buckets = new Map();

/* ---------------- transport helpers ---------------- */
const json = (res, status, body, extra = {}) => {
  const payload = JSON.stringify(
    body,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
  res.writeHead(status, {
    "content-type":
      status >= 400 && body?.type
        ? "application/problem+json"
        : "application/json",
    "x-api-version": VERSION,
    "x-blueballs-source-commit": SOURCE_COMMIT,
    "x-ratelimit-limit": String(RATE_LIMIT),
    "access-control-allow-headers":
      "content-type,x-api-key,x-idempotency-key",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    ...extra,
  });
  res.end(payload);
};

function rateLimit(id, limit) {
  const nowMs = Date.now();
  let bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= nowMs) {
    bucket = { count: 0, resetAt: nowMs + WINDOW_MS };
    buckets.set(id, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [key, value] of buckets) {
      if (value.resetAt <= nowMs) buckets.delete(key);
    }
  }
  return {
    remaining: Math.max(0, limit - bucket.count),
    reset: Math.floor(bucket.resetAt / 1000),
    exceeded: bucket.count > limit,
  };
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    let bytes = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > BODY_LIMIT_BYTES) {
        settled = true;
        req.pause();
        setImmediate(() => req.resume());
        reject(
          new ApiError(
            "payload-too-large",
            413,
            `Body over ${BODY_LIMIT_BYTES} bytes`,
          ),
        );
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ApiError("validation-error", 400, "Body is not valid JSON"));
      }
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

const CORS_ORIGINS = new Set(
  String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
for (const origin of CORS_ORIGINS) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`CORS_ORIGINS contains invalid origin ${origin}`);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`CORS_ORIGINS must contain exact http(s) origins: ${origin}`);
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  return origin && CORS_ORIGINS.has(origin)
    ? { "access-control-allow-origin": origin, vary: "origin" }
    : {};
}

function sourceAddress(req) {
  if (TRUST_PROXY && req.headers["cf-connecting-ip"]) {
    return String(req.headers["cf-connecting-ip"]);
  }
  return req.socket.remoteAddress || "unknown";
}

/* ---------------- authentication ---------------- */
function auth(req) {
  const secret = req.headers["x-api-key"];
  if (!secret || Array.isArray(secret)) {
    throw new ApiError(
      "authentication-error",
      401,
      "Send your key in the x-api-key header",
    );
  }
  const record = db.keys.get(hashKey(secret));
  if (!record)
    throw new ApiError("authentication-error", 401, "That key is not valid");
  if (record.expires && Date.parse(record.expires) <= Date.now()) {
    throw new ApiError(
      "authentication-error",
      401,
      "That sandbox key has expired; create a new one",
    );
  }
  if (!record.tenant_id || !db.tenants.has(record.tenant_id)) {
    throw new ApiError(
      "authentication-error",
      401,
      "That key belongs to an unsupported pre-release schema",
    );
  }
  return record;
}

function equalHexHash(actualHex, expectedHex) {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex ?? "")) return false;
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function operatorAuth(req) {
  const supplied = req.headers["x-api-key"];
  if (!supplied || Array.isArray(supplied)) {
    throw new ApiError(
      "authentication-error",
      401,
      "Send the operator key in the x-api-key header",
    );
  }
  const expectedHash = process.env.OPERATOR_API_KEY_HASH;
  if (!expectedHash) {
    throw new ApiError(
      "service-unavailable",
      503,
      "Operator API access is not configured",
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(expectedHash)) {
    throw new ApiError(
      "service-unavailable",
      503,
      "Operator API key hash is misconfigured",
    );
  }
  if (!equalHexHash(hashKey(String(supplied)), expectedHash)) {
    throw new ApiError(
      "forbidden",
      403,
      "A tenant key cannot access operator state",
    );
  }
  return { id: "operator", tenant_id: "operator", scope: "operator" };
}

/* ---------------- idempotency ---------------- */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

async function idempotent(
  { req, body, url, route: matchedRoute, key: principal },
  fn,
) {
  const rawHeader = req.headers["x-idempotency-key"];
  if (!rawHeader || !principal) return fn();
  if (Array.isArray(rawHeader) || rawHeader.length > 255) {
    throw new ApiError(
      "validation-error",
      400,
      "x-idempotency-key must be one non-empty value no longer than 255 characters",
    );
  }
  const headerKey = rawHeader.trim();
  if (!headerKey) {
    throw new ApiError(
      "validation-error",
      400,
      "x-idempotency-key must not be empty",
    );
  }

  const idempotencyKeyHash = createHash("sha256").update(headerKey).digest("hex");
  setCommandContext({ idempotency_key_hash: idempotencyKeyHash });

  const operation = `${req.method} ${matchedRoute.pattern}`;
  const storageKey = createHash("sha256")
    .update(`${principalId(principal)}\0${operation}\0${headerKey}`)
    .digest("hex");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        canonical({ body, query: [...url.searchParams.entries()].sort() }),
      ),
    )
    .digest("hex");

  const seen = db.idempotency.get(storageKey);
  if (seen) {
    if (Date.parse(seen.expires_at) <= Date.now()) {
      db.idempotency.delete(storageKey);
    } else {
      if (seen.fingerprint !== fingerprint) {
        throw new ApiError(
          "conflict",
          409,
          "This idempotency key was used with different parameters",
        );
      }
      setCommandContext({ idempotent_replay: true });
      return { ...seen.result, replayed: true };
    }
  }

  const result = await fn();
  db.idempotency.set(storageKey, {
    tenant_id: principalId(principal),
    operation,
    fingerprint,
    result,
    expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
  });
  return result;
}

/* ---------------- discovery / auth ---------------- */
route(
  "GET",
  "/v2",
  () => ({
    name: "Blueballs API",
    version: VERSION,
    mode: BANK_API_MODE,
    source_commit: SOURCE_COMMIT,
    docs: `${process.env.PUBLIC_SITE_URL || "http://localhost:5280"}/developers`,
    signup:
      BANK_API_MODE === "sandbox"
        ? "POST /v2/auth/signup — issues a sandbox key instantly"
        : "disabled in production; bootstrap through deployment secret/IAM",
  }),
  { public: true },
);

route(
  "POST",
  "/v2/auth/signup",
  async ({ body }) => {
    need(body, ["email"]);
    const tenant = {
      id: ksuid("ten"),
      email: body.email,
      mode: "sandbox",
      created_at: new Date().toISOString(),
    };
    const secret = "bb_sandbox_" + randomBytes(18).toString("base64url");
    const expires = new Date(
      Date.now() + SANDBOX_KEY_LIFETIME_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const record = {
      id: ksuid("key"),
      tenant_id: tenant.id,
      email: body.email,
      scope: "sandbox",
      created_at: new Date().toISOString(),
      expires,
    };
    db.tenants.set(tenant.id, tenant);
    db.keys.set(hashKey(secret), record);
    emit(
      "key.issued",
      { id: record.id, scope: record.scope },
      { tenantId: record.tenant_id },
    );
    return {
      ...record,
      key: secret,
      note: `This sandbox key expires at ${expires}. This is the only time the key is shown.`,
    };
  },
  { public: true, created: true },
);

route("GET", "/v2/keys", ({ key }) => ({
  object: "list",
  data: [...db.keys.values()]
    .filter((candidate) => candidate.tenant_id === key.tenant_id)
    .map((candidate) => ({ ...candidate })),
}));

/* ---------------- customers ---------------- */
route(
  "POST",
  "/v2/customers",
  async ({ body, key }) => {
    need(body, ["type", "name"]);
    if (!["individual", "business"].includes(body.type)) {
      throw new ApiError(
        "validation-error",
        400,
        "type must be individual or business",
      );
    }
    const customer = {
      id: ksuid("cus"),
      type: body.type,
      name: body.name,
      email: body.email ?? null,
      status: "pending",
      decision: null,
      tier: 1,
      client_reference_id: body.client_reference_id ?? null,
      created_at: new Date().toISOString(),
      owner: principalId(key),
    };
    db.customers.set(customer.id, customer);
    emit("customer.created", customer, { tenantId: customer.owner });
    return customer;
  },
  { created: true },
);

route("GET", "/v2/customers", ({ url, key }) =>
  paginate(visibleTo([...db.customers.values()], key), url),
);

route("GET", "/v2/customers/:id", ({ params, key }) =>
  must(db.customers, params.id, "customer", key),
);

route("GET", "/v2/customers/:id/capabilities", ({ params, key }) => {
  const customer = must(db.customers, params.id, "customer", key);
  const verified =
    customer.status === "completed" && customer.decision === "approved";
  return {
    object: "list",
    data: Object.values(RAILS).map((rail) => ({
      rail: rail.id,
      status: verified ? "active" : "inactive",
      requirements: verified ? [] : ["identity_verification"],
      limit: verified ? rail.max : "1000.00",
    })),
  };
});

route("POST", "/v2/customers/:id/verify", ({ params, body, key }) => {
  const customer = must(db.customers, params.id, "customer", key);
  customer.status = "completed";
  customer.decision = body.decision ?? "approved";
  customer.tier = customer.decision === "approved" ? 3 : 1;
  emit(
    "customer.status_changed",
    {
      id: customer.id,
      status: customer.status,
      decision: customer.decision,
    },
    { tenantId: customer.owner },
  );
  return customer;
});

/* ---------------- accounts ---------------- */
route(
  "POST",
  "/v2/accounts",
  async ({ body, key }) => {
    need(body, ["customer", "currency"]);
    const customer = must(db.customers, body.customer, "customer", key);
    const currency = String(body.currency).toUpperCase();
    if (!RATES[currency]) {
      throw new ApiError(
        "validation-error",
        400,
        `${currency} is not a supported currency`,
      );
    }

    const account = {
      id: ksuid("acc"),
      customer: customer.id,
      currency,
      type: body.type ?? "holding",
      status: "open",
      created_at: new Date().toISOString(),
      // Production receiving details must come from a connected bank/payment
      // provider, never from the fictional sandbox generator below.
      details: BANK_API_MODE === "sandbox" ? detailsFor(currency) : null,
      owner: principalId(key),
    };
    db.accounts.set(account.id, account);
    emit("account.opened", account, { tenantId: account.owner });
    return {
      ...account,
      balance: { amount: "0.00", currency },
    };
  },
  { created: true },
);

const EUR_BANK_CODE = "50000888";
const USD_ROUTING_PREFIX = "05000088";

const randomDigits = (length) => {
  let out = "";
  while (out.length < length) {
    out += randomBytes(4).readUInt32BE(0).toString().padStart(10, "0");
  }
  return out.slice(0, length);
};

function detailsFor(currency) {
  if (currency === "EUR") {
    const bban = EUR_BANK_CODE + randomDigits(10);
    return { type: "iban", iban: ibanGenerate("DE", bban), bic: "BLBLDEB2" };
  }
  if (currency === "GBP") {
    return {
      type: "sort_code",
      account_number: randomDigits(8),
      sort_code: `${randomDigits(2)}-${randomDigits(2)}-${randomDigits(2)}`,
    };
  }
  if (currency === "USD") {
    return {
      type: "aba",
      account_number: randomDigits(10),
      routing_number: abaGenerate(USD_ROUTING_PREFIX),
    };
  }
  if (currency === "SGD") {
    return { type: "paynow", proxy: "+65" + randomDigits(8) };
  }
  return {
    type: "onchain",
    address: "0x" + randomBytes(20).toString("hex"),
    network: "base",
  };
}

route("GET", "/v2/accounts", ({ url, key }) =>
  paginate(visibleTo([...db.accounts.values()], key), url),
);

route("GET", "/v2/accounts/:id", ({ params, key }) => {
  const account = must(db.accounts, params.id, "account", key);
  return {
    ...account,
    balance: {
      amount: fromMinor(balanceOf(account.id, account.currency)),
      currency: account.currency,
    },
  };
});

route("POST", "/v2/accounts/:id/credit", ({ params, body, key }) => {
  const account = must(db.accounts, params.id, "account", key);
  need(body, ["amount"]);
  const amount = positiveMinor(body.amount);
  post(
    [
      { account: account.id, currency: account.currency, amount },
      {
        account: "external:funding",
        currency: account.currency,
        amount: -amount,
      },
    ],
    "sandbox funding",
  );
  emit(
    "account.credited",
    {
      account: account.id,
      amount: body.amount,
      currency: account.currency,
    },
    { tenantId: account.owner },
  );
  return {
    ...account,
    balance: {
      amount: fromMinor(balanceOf(account.id, account.currency)),
      currency: account.currency,
    },
  };
});

/* ---------------- recipients ---------------- */
route(
  "POST",
  "/v2/recipients",
  ({ body, key }) => {
    need(body, ["name"]);
    const recipient = {
      id: ksuid("rcp"),
      name: body.name,
      destinations: [],
      created_at: new Date().toISOString(),
      owner: principalId(key),
    };
    if (body.destination) {
      recipient.destinations.push({
        id: ksuid("dst"),
        ...body.destination,
        name_check: "unchecked",
      });
    }
    db.recipients.set(recipient.id, recipient);
    return recipient;
  },
  { created: true },
);

route("GET", "/v2/recipients", ({ url, key }) =>
  paginate(visibleTo([...db.recipients.values()], key), url),
);

/* ---------------- quotes ---------------- */
route(
  "POST",
  "/v2/quotes",
  ({ body, key }) => {
    need(body, ["from", "to", "amount"]);
    const from = String(body.from).toUpperCase();
    const to = String(body.to).toUpperCase();
    if (!RATES[from] || !RATES[to]) {
      throw new ApiError("validation-error", 400, "Unsupported currency pair");
    }
    const thin = THIN.has(from) || THIN.has(to);
    const spreadBps = thin ? 85 : 4;
    const amount = positiveMinor(body.amount);
    const output = convertMinor(amount, from, to, spreadBps);
    const quote = {
      id: ksuid("quo"),
      owner: principalId(key),
      from,
      to,
      amount: { amount: body.amount, currency: from },
      receives: { amount: fromMinor(output), currency: to },
      rate: rateString(from, to),
      spread_bps: spreadBps,
      lockable: true,
      settlement: thin ? "when_matched" : "instant",
      liquidity: thin ? "thin" : "deep",
      expires_at: new Date(Date.now() + 30_000).toISOString(),
      created_at: new Date().toISOString(),
    };
    db.quotes.set(quote.id, quote);
    return quote;
  },
  { created: true },
);

route("GET", "/v2/quotes/:id", ({ params, key }) => {
  const quote = must(db.quotes, params.id, "quote", key);
  return { ...quote, expired: Date.parse(quote.expires_at) < Date.now() };
});

/* ---------------- transfers ---------------- */
route(
  "POST",
  "/v2/transfers",
  async ({ body, key }) => {
    need(body, ["from", "amount", "rail"]);
    const account = must(db.accounts, body.from, "account", key);
    const rail = RAILS[body.rail];
    if (!rail) {
      throw new ApiError("validation-error", 400, `Unknown rail ${body.rail}`, [
        {
          field: "rail",
          message: `try one of: ${Object.keys(RAILS).join(", ")}`,
          code: "unknown_rail",
        },
      ]);
    }
    if (rail.currency !== account.currency) {
      throw new ApiError(
        "validation-error",
        400,
        `${rail.id} settles in ${rail.currency}, not ${account.currency}`,
      );
    }
    if (
      body.currency !== undefined &&
      String(body.currency).toUpperCase() !== account.currency
    ) {
      throw new ApiError(
        "validation-error",
        400,
        `Transfer currency must match source account currency ${account.currency}`,
      );
    }

    const recipient = body.recipient
      ? must(db.recipients, body.recipient, "recipient", key)
      : null;
    let destination = null;
    if (body.destination) {
      const ownedRecipients = visibleTo([...db.recipients.values()], key);
      for (const candidate of ownedRecipients) {
        const found = candidate.destinations.find(
          (item) => item.id === body.destination,
        );
        if (!found) continue;
        destination = found;
        if (recipient && candidate.id !== recipient.id) {
          throw new ApiError(
            "validation-error",
            400,
            `Destination ${found.id} does not belong to recipient ${recipient.id}`,
          );
        }
        break;
      }
      if (!destination) {
        throw new ApiError(
          "not-found",
          404,
          `No destination ${body.destination}`,
        );
      }
      if (destination.rail && destination.rail !== rail.id) {
        throw new ApiError(
          "validation-error",
          400,
          `Destination ${destination.id} uses ${destination.rail}, not ${rail.id}`,
        );
      }
      if (
        destination.currency &&
        destination.currency !== account.currency
      ) {
        throw new ApiError(
          "validation-error",
          400,
          `Destination ${destination.id} settles in ${destination.currency}, not ${account.currency}`,
        );
      }
    }

    const amount = positiveMinor(body.amount);
    if (amount < toMinor(rail.min)) {
      throw new ApiError(
        "below-minimum",
        400,
        `${rail.id} minimum is ${rail.min} ${rail.currency}`,
      );
    }
    if (amount > toMinor(rail.max)) {
      throw new ApiError(
        "limit-exceeded",
        400,
        `${rail.id} maximum is ${rail.max} ${rail.currency}`,
      );
    }
    const available = balanceOf(account.id, account.currency);
    if (available < amount) {
      throw new ApiError(
        "insufficient-balance",
        400,
        `Account holds ${fromMinor(available)} ${account.currency}`,
      );
    }

    const createdAt = new Date().toISOString();
    const transfer = {
      id: ksuid("trf"),
      status: "created",
      from: account.id,
      recipient: recipient?.id ?? null,
      destination: destination?.id ?? null,
      amount: { amount: body.amount, currency: account.currency },
      rail: rail.id,
      legs: [
        {
          id: ksuid("leg"),
          rail: rail.id,
          status: "created",
          amount: body.amount,
          currency: account.currency,
        },
      ],
      client_reference_id: body.client_reference_id ?? null,
      created_at: createdAt,
      owner: principalId(key),
    };

    post(
      [
        { account: account.id, currency: account.currency, amount: -amount },
        {
          account: "clearing:" + rail.id,
          currency: account.currency,
          amount,
        },
      ],
      `transfer ${transfer.id}`,
    );

    db.transfers.set(transfer.id, transfer);
    emit("transfer.created", transfer, { tenantId: transfer.owner });
    advance(transfer, "funds_received");

    if (BANK_API_MODE === "sandbox" && rail.speed === "seconds") {
      advance(transfer, "submitted");
      advance(transfer, "settled");
    } else if (BANK_API_MODE === "production") {
      emit(
        "transfer.awaiting_provider_submission",
        {
          id: transfer.id,
          rail: transfer.rail,
          current_status: "funds_received",
        },
        { tenantId: transfer.owner },
      );
    }
    return db.transfers.get(transfer.id);
  },
  { created: true },
);

function advance(transfer, status) {
  const stored = db.transfers.get(transfer.id);
  if (!stored) return;
  const previous = stored.status;
  stored.status = status;
  stored.legs[0].status = status;
  db.transfers.set(stored.id, stored);
  emit(
    "transfer.status_changed",
    { id: stored.id, previous_status: previous, current_status: status },
    { tenantId: stored.owner },
  );
}

route("POST", "/v2/transfers/:id/settle", ({ params, key }) => {
  const transfer = must(db.transfers, params.id, "transfer", key);
  if (transfer.status !== "funds_received") {
    throw new ApiError(
      "conflict",
      409,
      `Transfer ${transfer.id} is ${transfer.status}, not waiting for a rail window`,
    );
  }
  const rail = RAILS[transfer.rail];
  if (!rail.weekend && [0, 6].includes(new Date().getUTCDay())) {
    throw new ApiError(
      "rail-unavailable",
      422,
      `${rail.id} does not run at weekends. Next window is Monday.`,
    );
  }
  advance(transfer, "submitted");
  advance(transfer, "confirming");
  advance(transfer, "settled");
  return db.transfers.get(transfer.id);
});

route("GET", "/v2/transfers", ({ url, key }) =>
  paginate(visibleTo([...db.transfers.values()], key), url),
);
route("GET", "/v2/transfers/:id", ({ params, key }) =>
  must(db.transfers, params.id, "transfer", key),
);

/* ---------------- ledger / rails / events / reference ---------------- */
route("GET", "/v2/ledger", ({ url, key }) => {
  const accountFilter = url.searchParams.get("account");
  const mine = new Set(
    visibleTo([...db.accounts.values()], key).map((account) => account.id),
  );
  const rows = db.ledger
    .map((row, index) => ({
      id: `led_${index}`,
      ...row,
      amount: fromMinor(row.amount),
    }))
    .filter((row) => mine.has(row.account))
    .filter((row) => !accountFilter || row.account === accountFilter);
  return paginate(rows, url);
});

route(
  "GET",
  "/v2/rails",
  () => ({ object: "list", data: Object.values(RAILS) }),
  { public: true },
);
route(
  "GET",
  "/v2/rails/:id",
  ({ params }) => {
    const rail = RAILS[params.id];
    if (!rail) throw new ApiError("not-found", 404, `No rail ${params.id}`);
    return rail;
  },
  { public: true },
);

route("GET", "/v2/events", ({ url, key }) =>
  paginate(
    [...db.events]
      .filter((event) => event.tenant_id === principalId(key))
      .reverse()
      .map(({ tenant_id: _tenantId, ...event }) => event),
    url,
  ),
);

route(
  "GET",
  "/v2/currencies",
  () => ({
    object: "list",
    data: Object.keys(RATES).map((code) => ({
      code,
      thin_liquidity: THIN.has(code),
    })),
  }),
  { public: true },
);

/* ---------------- family fan-out ---------------- */
const FAMILY_MODULES = [
  ["builder.js", () => import("./routes/builder.js")],
  ["business.js", () => import("./routes/business.js")],
  ["cards.js", () => import("./routes/cards.js")],
  ["fx-lp.js", () => import("./routes/fx-lp.js")],
  ["fx-swap.js", () => import("./routes/fx-swap.js")],
  ["fx.js", () => import("./routes/fx.js")],
  ["identity.js", () => import("./routes/identity.js")],
  ["payments.js", () => import("./routes/payments.js")],
  ["platform.js", () => import("./routes/platform.js")],
  ["products.js", () => import("./routes/products.js")],
];
for (const [, load] of FAMILY_MODULES) await load();
console.log(
  `  loaded ${FAMILY_MODULES.length} family module(s): ${FAMILY_MODULES.map(([file]) => file).join(", ")}`,
);

/* ---------------- catalogue reconciliation ---------------- */
let stubbed = 0;
let cataloguedCount = 0;
export function registerCatalogue(endpoints) {
  let added = 0;
  for (const { verb, path, access } of endpoints) {
    const existing = routes.find(
      (candidate) => candidate.method === verb && candidate.pattern === path,
    );
    if (existing) {
      if (existing.access !== access) {
        throw new Error(
          `Access mismatch for ${verb} ${path}: router=${existing.access}, catalogue=${access}`,
        );
      }
      continue;
    }
    route(
      verb,
      path,
      () => {
        throw new ApiError(
          "not-implemented",
          501,
          `${verb} ${path} is in the catalogue but not implemented yet.`,
        );
      },
      { access },
    );
    added += 1;
  }
  cataloguedCount = endpoints.length;
  stubbed += added;
}
registerCatalogue(FAMILIES.flatMap(({ endpoints }) => endpoints));

route(
  "GET",
  "/v2/site/stats",
  () => ({
    accounts: db.accounts.size,
    customers: db.customers.size,
    transfers: db.transfers.size,
    currencies: Object.keys(RATES).length,
    rails: Object.keys(RAILS).length,
    endpoints_implemented: cataloguedCount - stubbed,
    endpoints_catalogued: cataloguedCount,
    source_commit: SOURCE_COMMIT,
  }),
  { public: true },
);

/* ---------------- request pipeline ---------------- */
const server = createServer(async (req, res) => {
  const requestId = ksuid("req");
  const commandId = ksuid("cmd");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return json(res, 204, {}, cors);

  const sourceQuota = rateLimit(
    `source:${sourceAddress(req)}`,
    SOURCE_RATE_LIMIT,
  );
  let quotaHeaders = {
    "x-ratelimit-limit": String(SOURCE_RATE_LIMIT),
    "x-ratelimit-remaining": String(sourceQuota.remaining),
    "x-ratelimit-reset": String(sourceQuota.reset),
    ...cors,
  };
  if (sourceQuota.exceeded) {
    const error = new ApiError(
      "rate-limited",
      429,
      `Over ${SOURCE_RATE_LIMIT} requests per minute from this source. Try again shortly.`,
    );
    return json(res, 429, error.toProblem(url.pathname, requestId), {
      ...quotaHeaders,
      "retry-after": String(
        Math.max(1, sourceQuota.reset - Math.floor(Date.now() / 1000)),
      ),
      "x-request-id": requestId,
      "x-command-id": commandId,
    });
  }

  try {
    const hit = match(req.method, url.pathname);
    if (!hit) {
      throw new ApiError(
        "not-found",
        404,
        `No route for ${req.method} ${url.pathname}`,
      );
    }
    const body = BODY_METHODS.has(req.method) ? await readBody(req) : {};

    const result = await inRequestScope(
      async () => {
        // Set command metadata before auth so authentication/authorization
        // failures are durable security audit events without recording secrets.
        setCommandContext({
          request_id: requestId,
          operation: `${req.method} ${hit.r.pattern}`,
          method: req.method,
          path: url.pathname,
          access: hit.r.access,
          audit: hit.r.access !== "PUBLIC" || req.method !== "GET",
        });

        const key =
          hit.r.access === "PUBLIC"
            ? null
            : hit.r.access === "OPERATOR"
              ? operatorAuth(req)
              : auth(req);

        if (key) {
          setCommandContext({
            tenant_id: key.tenant_id ?? null,
            actor_id: key.id ?? null,
            actor_scope: key.scope ?? null,
          });
        }

        if (key && hit.r.access !== "OPERATOR") {
          const tenantQuota = rateLimit(
            `tenant:${principalId(key)}`,
            TENANT_RATE_LIMIT,
          );
          quotaHeaders = {
            ...quotaHeaders,
            "x-ratelimit-limit": String(
              Math.min(SOURCE_RATE_LIMIT, TENANT_RATE_LIMIT),
            ),
            "x-ratelimit-remaining": String(
              Math.min(sourceQuota.remaining, tenantQuota.remaining),
            ),
            "x-ratelimit-reset": String(
              Math.min(sourceQuota.reset, tenantQuota.reset),
            ),
          };
          if (tenantQuota.exceeded) {
            throw new ApiError(
              "rate-limited",
              429,
              `Over ${TENANT_RATE_LIMIT} requests per minute for this tenant. Try again shortly.`,
            );
          }
        }

        const ctx = { params: hit.params, body, url, key, req };
        return MUTATION_METHODS.has(req.method)
          ? idempotent({ req, body, url, route: hit.r, key }, () =>
              hit.r.handler(ctx),
            )
          : hit.r.handler(ctx);
      },
      { command_id: commandId, request_id: requestId },
    );

    json(res, hit.r.successStatus, result, {
      ...quotaHeaders,
      "x-request-id": requestId,
      "x-command-id": commandId,
    });
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError("internal-error", 500, error.message);
    if (!(error instanceof ApiError)) console.error(error);
    json(res, apiError.status, apiError.toProblem(url.pathname, requestId), {
      ...quotaHeaders,
      "x-request-id": requestId,
      "x-command-id": error?.command_id ?? commandId,
    });
  }
});

server.listen(API_PORT, () => {
  console.log(
    `  mode ${BANK_API_MODE} · ${cataloguedCount - stubbed} implemented · ${stubbed} deliberate 501s · ${cataloguedCount} catalogued`,
  );
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Blueballs API                                         ║
╠════════════════════════════════════════════════════════╣
║  http://localhost:${API_PORT}/v2                              ║
║  Docs:       http://localhost:5280/developers          ║
╚════════════════════════════════════════════════════════╝`);
});
