/** PAYMENTS family — QR & payment links, bills & subscriptions.
 *
 *  Owns exactly this file (M2 fan-out contract, see kernel.js header). Storage for
 *  the resources introduced here (payment links, mandates, subscriptions) lives in
 *  plain in-process Maps — same get/set/values() shape as the collections in
 *  lib.js's `db`, just not persisted to sqlite, since this family doesn't touch
 *  lib.js. QR generate/decode is stateless by nature (decode must accept any
 *  EMVCo-shaped payload, not just ones we minted) so nothing is stored for it.
 */
import { route, db, ksuid, need, must, paginate, now, ApiError, toMinor, RATES, collection } from "../kernel.js";

/* ---------------- local collections ---------------- */
const links = collection("links");
const mandates = collection("mandates");
const subscriptions = collection("subscriptions");

/* =====================================================================
 * CRC-16/CCITT-FALSE — implemented from scratch, no dependencies.
 * poly 0x1021, init 0xFFFF, no input/output reflection, xorout 0x0000.
 * Verified against the standard CRC catalogue check value: crc("123456789")
 * must equal 0x29B1 — confirmed by hand before wiring this in.
 * ===================================================================== */
function crc16ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}
const crcHex = (str) => crc16ccitt(str).toString(16).toUpperCase().padStart(4, "0");

/* =====================================================================
 * EMVCo Merchant Presented QR — minimal TLV codec.
 * ===================================================================== */

/** ISO 4217 numeric codes for the currencies this sandbox supports. USDX has
 *  no ISO 4217 numeric code (it isn't a fiat currency), so it can't legally
 *  populate EMVCo tag 53 — QR generate rejects it rather than fake a code. */
const ISO4217_NUMERIC = { USD: "840", EUR: "978", GBP: "826", SGD: "702", MYR: "458" };
const ISO4217_ALPHA = Object.fromEntries(Object.entries(ISO4217_NUMERIC).map(([a, n]) => [n, a]));

const MAX_LEN = { merchant_name: 25, merchant_city: 15, reference: 25 };

const tlv = (id, value) => `${id}${String(value).length.toString().padStart(2, "0")}${value}`;
const buildTLV = (fields) => fields.map(([id, v]) => tlv(id, v)).join("");

/** Parse a TLV string into a flat { id: value } map. Throws on any structural
 *  defect (truncated tag/length, value running past the end, non-numeric length) —
 *  the same failure mode a tampered or corrupted payload produces. */
function parseTLV(s) {
  const out = {};
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) throw new ApiError("validation-error", 400, "Malformed TLV: truncated tag/length near position " + i);
    const id = s.slice(i, i + 2);
    const lenStr = s.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(lenStr)) throw new ApiError("validation-error", 400, `Malformed TLV: non-numeric length for tag ${id}`);
    const len = Number(lenStr);
    i += 4;
    if (i + len > s.length) throw new ApiError("validation-error", 400, `Malformed TLV: value for tag ${id} runs past end of payload`);
    out[id] = s.slice(i, i + len);
    i += len;
  }
  return out;
}

const defaultScheme = (currency) =>
  ({ EUR: "sepa_dd", GBP: "bacs", USD: "ach_debit", SGD: "giro", MYR: "fpx_dd" }[currency] ?? "direct_debit");

/* ---- POST /v2/qr/generate — build a real EMVCo merchant-presented QR payload ---- */
route("POST", "/v2/qr/generate", ({ body }) => {
  need(body, ["merchant_name", "merchant_city", "country", "currency"]);

  const currency = String(body.currency).toUpperCase();
  const numeric = ISO4217_NUMERIC[currency];
  if (!numeric) {
    throw new ApiError("validation-error", 400, `${currency} has no ISO 4217 numeric code, which EMVCo tag 53 requires`, [
      { field: "currency", message: `try one of: ${Object.keys(ISO4217_NUMERIC).join(", ")}`, code: "unsupported_currency" },
    ]);
  }

  const country = String(body.country).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new ApiError("validation-error", 400, "country must be an ISO 3166-1 alpha-2 code", [
      { field: "country", message: "expected two letters, e.g. \"SG\"", code: "invalid_format" },
    ]);
  }

  const merchantName = String(body.merchant_name);
  const merchantCity = String(body.merchant_city);
  const reference = body.reference !== undefined && body.reference !== null ? String(body.reference) : null;
  const overLong = [
    merchantName.length > MAX_LEN.merchant_name && "merchant_name",
    merchantCity.length > MAX_LEN.merchant_city && "merchant_city",
    reference && reference.length > MAX_LEN.reference && "reference",
  ].filter(Boolean);
  if (overLong.length) {
    throw new ApiError("validation-error", 400, "Field exceeds the EMVCo maximum length", overLong.map((field) => ({
      field, message: `max ${MAX_LEN[field]} characters`, code: "too_long",
    })));
  }

  const dynamic = body.amount !== undefined && body.amount !== null;
  if (dynamic) toMinor(body.amount); // validates decimal-string shape, throws otherwise

  const merchantId = body.merchant_id ? String(body.merchant_id) : ksuid("mid").slice(-16);
  const mcc = body.mcc ? String(body.mcc).replace(/\D/g, "").padStart(4, "0").slice(0, 4) : "0000";

  const merchantAccountInfo = buildTLV([
    ["00", "com.blueballs.qr"], // GUID — reverse-domain identifies the acquirer template
    ["01", merchantId],
  ]);

  const fields = [
    ["00", "01"],                          // payload format indicator — always "01"
    ["01", dynamic ? "12" : "11"],         // point of initiation: 11 static, 12 dynamic
    ["26", merchantAccountInfo],           // merchant account info template
    ["52", mcc],                           // merchant category code
    ["53", numeric],                       // transaction currency, ISO 4217 numeric
  ];
  if (dynamic) fields.push(["54", body.amount]); // transaction amount — dynamic QR only
  fields.push(["58", country]);
  fields.push(["59", merchantName]);
  fields.push(["60", merchantCity]);
  if (reference) fields.push(["62", buildTLV([["05", reference]])]); // additional data: reference label

  const withoutCRC = buildTLV(fields) + "6304";
  const payload = withoutCRC + crcHex(withoutCRC);

  const record = {
    id: ksuid("qr"),
    object: "qr_code",
    type: dynamic ? "dynamic" : "static",
    payload,
    merchant: { name: merchantName, city: merchantCity, country, id: merchantId, category_code: mcc },
    currency,
    amount: dynamic ? body.amount : null,
    reference,
    created_at: now(),
  };
  return record;
});

/* ---- POST /v2/qr/decode — parse TLV back to structured fields, verify CRC ---- */
route("POST", "/v2/qr/decode", ({ body }) => {
  need(body, ["payload"]);
  const payload = String(body.payload);

  if (payload.length < 8 || payload.slice(-8, -4) !== "63" + "04") {
    throw new ApiError("validation-error", 400, "Payload does not terminate with a well-formed CRC tag (6304xxxx)", [
      { field: "payload", message: "expected the last field to be tag 63, length 04", code: "missing_crc_tag" },
    ]);
  }
  const crcClaimed = payload.slice(-4).toUpperCase();
  const message = payload.slice(0, -4); // everything up to and including "6304"
  const crcComputed = crcHex(message);
  if (crcComputed !== crcClaimed) {
    throw new ApiError("validation-error", 400, "CRC check failed — payload is corrupted or has been tampered with", [
      { field: "payload", message: `expected CRC ${crcComputed}, payload carries ${crcClaimed}`, code: "crc_mismatch" },
    ]);
  }

  const fields = parseTLV(payload);
  const merchantTemplate = fields["26"] ? parseTLV(fields["26"]) : {};
  const additional = fields["62"] ? parseTLV(fields["62"]) : {};
  const currencyNumeric = fields["53"] ?? null;

  return {
    object: "qr_decode",
    valid: true,
    point_of_initiation: fields["01"] === "12" ? "dynamic" : "static",
    payload_format_indicator: fields["00"] ?? null,
    merchant: {
      name: fields["59"] ?? null,
      city: fields["60"] ?? null,
      country: fields["58"] ?? null,
      category_code: fields["52"] ?? null,
      id: merchantTemplate["01"] ?? null,
      guid: merchantTemplate["00"] ?? null,
    },
    currency: currencyNumeric ? (ISO4217_ALPHA[currencyNumeric] ?? null) : null,
    currency_numeric: currencyNumeric,
    amount: fields["54"] ?? null,
    reference: additional["05"] ?? null,
    crc: { tag: "63", value: crcClaimed, valid: true },
  };
});

/* ---- POST /v2/links — shareable payment link ---- */
const LINK_BASE = "https://pay.blueballs.dev/l/";

route("POST", "/v2/links", ({ body, key }) => {
  need(body, ["currency"]);
  const currency = String(body.currency).toUpperCase();
  if (!RATES[currency]) throw new ApiError("validation-error", 400, `${currency} is not a supported currency`);
  if (body.amount !== undefined && body.amount !== null) toMinor(body.amount); // open-amount links omit this

  const ttlSeconds = Number(body.expires_in_seconds ?? 7 * 24 * 60 * 60); // default 7 days
  const id = ksuid("lnk");
  const l = {
    id,
    object: "payment_link",
    url: LINK_BASE + id,
    amount: body.amount !== undefined ? body.amount : null,
    currency,
    description: body.description ?? null,
    reusable: !!body.reusable, // single-use unless explicitly reusable
    status: "active",
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    client_reference_id: body.client_reference_id ?? null,
    payments: [],
    created_at: now(),
    owner: key.id,
  };
  links.set(id, l);
  return l;
});

route("GET", "/v2/links/:id", ({ params }) => {
  const l = must(links, params.id, "payment link");
  const expired = Date.parse(l.expires_at) < Date.now();
  const status = expired && l.status === "active" ? "expired" : l.status;
  return { ...l, status };
});

/* ---- POST /v2/mandates — direct debit mandate ---- */
route("POST", "/v2/mandates", ({ body, key }) => {
  need(body, ["customer", "currency"]);
  const customer = must(db.customers, body.customer, "customer");
  const currency = String(body.currency).toUpperCase();
  if (!RATES[currency]) throw new ApiError("validation-error", 400, `${currency} is not a supported currency`);
  if (body.max_amount !== undefined && body.max_amount !== null) toMinor(body.max_amount);

  const m = {
    id: ksuid("mnd"),
    object: "mandate",
    customer: customer.id,
    scheme: body.scheme ?? defaultScheme(currency),
    reference: body.reference ?? null,
    currency,
    max_amount: body.max_amount !== undefined && body.max_amount !== null ? { amount: body.max_amount, currency } : null,
    // Sandbox self-serve, no human in the loop — same shortcut as /v2/customers/:id/verify.
    status: "active",
    client_reference_id: body.client_reference_id ?? null,
    created_at: now(),
    owner: key.id,
  };
  mandates.set(m.id, m);
  return m;
});

route("GET", "/v2/mandates/:id", ({ params }) => must(mandates, params.id, "mandate"));

/* ---- POST /v2/subscriptions — recurring payment against an active mandate ---- */
function computeNextRun(startISO, interval, count) {
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) throw new ApiError("validation-error", 400, "start_date must be a valid RFC 3339 timestamp");
  if (interval === "day") d.setUTCDate(d.getUTCDate() + count);
  else if (interval === "week") d.setUTCDate(d.getUTCDate() + count * 7);
  else if (interval === "month") d.setUTCMonth(d.getUTCMonth() + count);
  else d.setUTCFullYear(d.getUTCFullYear() + count);
  return d.toISOString();
}

route("POST", "/v2/subscriptions", ({ body, key }) => {
  need(body, ["customer", "mandate", "amount", "currency", "interval"]);
  const customer = must(db.customers, body.customer, "customer");
  const mandate = must(mandates, body.mandate, "mandate");
  if (mandate.status !== "active") {
    throw new ApiError("conflict", 409, `Mandate ${mandate.id} is ${mandate.status}, not active`);
  }
  const currency = String(body.currency).toUpperCase();
  if (!RATES[currency]) throw new ApiError("validation-error", 400, `${currency} is not a supported currency`);
  toMinor(body.amount);

  const interval = String(body.interval);
  if (!["day", "week", "month", "year"].includes(interval)) {
    throw new ApiError("validation-error", 400, "interval must be one of: day, week, month, year", [
      { field: "interval", message: "unsupported interval", code: "invalid_enum" },
    ]);
  }
  const intervalCount = Math.max(1, Number(body.interval_count ?? 1));
  const startDate = body.start_date ?? now();

  const s = {
    id: ksuid("sub"),
    object: "subscription",
    customer: customer.id,
    mandate: mandate.id,
    amount: { amount: body.amount, currency },
    schedule: { interval, interval_count: intervalCount, start_date: startDate },
    status: "active",
    next_run_date: computeNextRun(startDate, interval, intervalCount),
    client_reference_id: body.client_reference_id ?? null,
    created_at: now(),
    owner: key.id,
  };
  subscriptions.set(s.id, s);
  return s;
});

route("GET", "/v2/subscriptions", ({ url, key }) =>
  paginate([...subscriptions.values()].filter((s) => s.owner === key.id), url));
