/** Apply unsolicited provider evidence inside the banking transaction boundary.
 *
 * Outbound provider jobs cover commands Blueballs initiates. Real institutions
 * also receive provider-originated facts such as settled account credits and
 * custody deposits. This module applies only canonical, already-settled evidence
 * delivered through the operator-authenticated internal route.
 */
import { createHash } from "node:crypto";
import {
  ApiError,
  emit,
  post,
  setCommandContext,
  toMinor,
} from "./lib.js";

const SUPPORTED = new Set([
  "payments.account_credit_settled",
  "custody.wallet_deposit_settled",
]);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(body) {
  return createHash("sha256").update(stable(body)).digest("hex");
}

function required(body, name) {
  const value = body?.[name];
  if (value === undefined || value === null || value === "") {
    throw new ApiError(
      "validation-error",
      400,
      `Provider inbound event requires ${name}`,
      [{ field: name, message: "is required", code: "missing" }],
    );
  }
  return value;
}

function exactPositiveMoney(body) {
  const money = required(body, "amount");
  if (!money || typeof money !== "object" || Array.isArray(money)) {
    throw new ApiError(
      "validation-error",
      400,
      "amount must be an exact money object",
    );
  }
  const amount = required(money, "amount");
  const currency = String(required(money, "currency")).toUpperCase();
  const minor = toMinor(amount);
  if (minor <= 0n) {
    throw new ApiError("validation-error", 400, "amount must be greater than zero");
  }
  return { amount: String(amount), currency, minor };
}

function ownedResource(collection, id, tenantId, noun) {
  const row = collection?.get(id);
  if (!row || row.owner !== tenantId) {
    throw new ApiError("not-found", 404, `No ${noun} ${id}`);
  }
  return row;
}

function compactRecord({ body, money, resourceType, receivedAt, hash }) {
  return {
    id: body.event_id,
    object: "provider_inbound_event",
    type: body.type,
    tenant_id: body.tenant_id,
    resource_type: resourceType,
    resource_id: body.resource_id,
    amount: { amount: money.amount, currency: money.currency },
    provider_reference: body.provider_reference,
    provider_state: body.provider_state ?? "settled",
    source: body.source ?? null,
    fingerprint: hash,
    received_at: receivedAt,
    owner: body.tenant_id,
  };
}

/** Apply one provider event. The caller supplies the versioned persistent map so
 * duplicate provider event IDs survive restarts and Durable Object eviction. */
export function applyProviderInboundEvent({ body, db, inboundEvents, mode }) {
  if (mode !== "production") {
    throw new ApiError(
      "forbidden",
      403,
      "Provider inbound settlement is available only in production mode",
    );
  }

  const eventId = String(required(body, "event_id"));
  if (!/^[A-Za-z0-9._:-]{6,200}$/.test(eventId)) {
    throw new ApiError(
      "validation-error",
      400,
      "event_id must be 6-200 characters using letters, digits, dot, underscore, colon or hyphen",
    );
  }
  body = { ...body, event_id: eventId };
  const type = String(required(body, "type"));
  if (!SUPPORTED.has(type)) {
    throw new ApiError(
      "validation-error",
      400,
      `Unsupported provider inbound event type ${type}`,
    );
  }
  const tenantId = String(required(body, "tenant_id"));
  const resourceId = String(required(body, "resource_id"));
  const providerReference = String(required(body, "provider_reference"));
  body = {
    ...body,
    type,
    tenant_id: tenantId,
    resource_id: resourceId,
    provider_reference: providerReference,
  };

  if (!db.tenants.has(tenantId)) {
    throw new ApiError("not-found", 404, `No tenant ${tenantId}`);
  }

  const hash = fingerprint(body);
  const prior = inboundEvents.get(eventId);
  if (prior) {
    if (prior.fingerprint !== hash) {
      throw new ApiError(
        "conflict",
        409,
        `Provider event ${eventId} was already used with different evidence`,
      );
    }
    return { ...prior, replayed: true };
  }

  const money = exactPositiveMoney(body);
  const receivedAt = new Date().toISOString();
  setCommandContext({
    tenant_id: tenantId,
    actor_id: "provider-inbound",
    actor_scope: "system",
  });

  let resourceType;
  if (type === "payments.account_credit_settled") {
    const account = ownedResource(db.accounts, resourceId, tenantId, "account");
    if (account.status === "closed") {
      throw new ApiError("conflict", 409, `Account ${account.id} is closed`);
    }
    if (String(account.currency).toUpperCase() !== money.currency) {
      throw new ApiError(
        "validation-error",
        400,
        `Account ${account.id} is denominated in ${account.currency}, not ${money.currency}`,
      );
    }
    const rail = String(body.rail ?? "provider");
    post(
      [
        {
          account: `external:inbound:${rail}`,
          currency: money.currency,
          amount: -money.minor,
        },
        {
          account: account.id,
          currency: money.currency,
          amount: money.minor,
        },
      ],
      `provider inbound credit ${eventId}`,
    );
    emit(
      "account.payment_received",
      {
        account: account.id,
        amount: { amount: money.amount, currency: money.currency },
        rail,
        provider_reference: providerReference,
        provider_event_id: eventId,
      },
      { tenantId },
    );
    resourceType = "account";
  }

  if (type === "custody.wallet_deposit_settled") {
    const wallet = ownedResource(db.wallets, resourceId, tenantId, "wallet");
    if (wallet.status && wallet.status !== "active") {
      throw new ApiError(
        "conflict",
        409,
        `Wallet ${wallet.id} is ${wallet.status}, not active`,
      );
    }
    if (String(wallet.currency).toUpperCase() !== money.currency) {
      throw new ApiError(
        "validation-error",
        400,
        `Wallet ${wallet.id} is denominated in ${wallet.currency}, not ${money.currency}`,
      );
    }
    const network = String(body.network ?? wallet.network ?? "provider");
    post(
      [
        {
          account: `external:custody:${network}`,
          currency: money.currency,
          amount: -money.minor,
        },
        {
          account: wallet.id,
          currency: money.currency,
          amount: money.minor,
        },
      ],
      `custody deposit ${eventId}`,
    );
    emit(
      "wallet.deposit_settled",
      {
        wallet: wallet.id,
        amount: { amount: money.amount, currency: money.currency },
        network,
        provider_reference: providerReference,
        provider_event_id: eventId,
      },
      { tenantId },
    );
    resourceType = "wallet";
  }

  const record = compactRecord({
    body,
    money,
    resourceType,
    receivedAt,
    hash,
  });
  inboundEvents.set(eventId, record);
  return record;
}

export const PROVIDER_INBOUND_EVENT_TYPES = Object.freeze([...SUPPORTED]);
