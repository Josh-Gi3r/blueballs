/**
 * Production HTTP response schemas.
 *
 * `contracts.mjs` predates several runtime response-shape improvements. Keep its
 * operation classification helpers stable, but publish/validate these corrected
 * schemas at the HTTP boundary. New response-shape work belongs here until the
 * legacy schema set is retired in one versioned API change.
 */
import { SCHEMAS as LEGACY_SCHEMAS } from "./contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const string = (description, extra = {}) => ({ type: "string", description, ...extra });
const open = (properties = {}, required = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  ...(required.length ? { required } : {}),
});
const closed = (properties = {}, required = []) => ({
  type: "object",
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {}),
});
const resource = (properties = {}, required = []) =>
  open(
    {
      id: ref("Identifier"),
      created_at: ref("Timestamp"),
      ...properties,
    },
    ["id", ...required],
  );

const money = ref("Money");

export const EFFECTIVE_SCHEMAS = {
  ...LEGACY_SCHEMAS,

  Money: closed(
    {
      amount: ref("DecimalAmount"),
      currency: ref("CurrencyCode"),
    },
    ["amount", "currency"],
  ),

  KeyPrincipal: open(
    {
      id: ref("Identifier"),
      tenant_id: ref("Identifier"),
      email: { type: ["string", "null"], format: "email" },
      scope: string("Granted key scope"),
      created_at: ref("Timestamp"),
      expires: ref("Timestamp"),
    },
    ["id", "tenant_id", "scope", "created_at"],
  ),

  Account: resource(
    {
      customer: ref("Identifier"),
      currency: ref("CurrencyCode"),
      type: string("Account type"),
      status: string("Account state"),
      details: { type: "object", additionalProperties: true },
      balance: money,
    },
    ["customer", "currency", "status"],
  ),

  Wallet: resource(
    {
      customer: ref("Identifier"),
      currency: ref("CurrencyCode"),
      network: string("Blockchain network"),
      address: string("Wallet address"),
      balance: money,
      approval_chain: { type: ["string", "null"] },
    },
    ["customer", "currency", "network", "address"],
  ),

  Destination: open(
    {
      id: ref("Identifier"),
      rail: string("Payment rail"),
      name: string("Destination account-holder name"),
      currency: { type: ["string", "null"] },
      name_check: string("Confirmation-of-payee state"),
      created_at: ref("Timestamp"),
    },
    ["id", "rail"],
  ),

  Quote: resource(
    {
      from: ref("CurrencyCode"),
      to: ref("CurrencyCode"),
      amount: money,
      receives: money,
      rate: ref("DecimalAmount"),
      spread_bps: { type: "integer", minimum: 0 },
      lockable: { type: "boolean" },
      settlement: string("Settlement mode"),
      liquidity: string("Liquidity classification"),
      expires_at: ref("Timestamp"),
      expired: { type: "boolean" },
    },
    ["from", "to", "amount", "receives", "rate", "expires_at"],
  ),

  Transfer: resource(
    {
      from: ref("Identifier"),
      recipient: { type: ["string", "null"] },
      destination: { type: ["string", "null"] },
      amount: money,
      rail: string("Payment rail"),
      status: string("Transfer state"),
      legs: { type: "array", items: ref("TransferLeg") },
    },
    ["from", "amount", "rail", "status", "legs"],
  ),

  Authorisation: resource(
    {
      card: ref("Identifier"),
      customer: ref("Identifier"),
      account: ref("Identifier"),
      amount: money,
      merchant: { type: "object", additionalProperties: true },
      status: string("Decision/settlement state"),
    },
    ["card", "amount", "status"],
  ),

  Dispute: resource(
    {
      authorisation: ref("Identifier"),
      reason_code: string("Dispute reason code"),
      description: { type: ["string", "null"] },
      status: string("Dispute state"),
    },
    ["authorisation", "status"],
  ),

  Vault: resource(
    {
      account: ref("Identifier"),
      currency: ref("CurrencyCode"),
      name: string("Vault name"),
      rate: { type: "number", minimum: 0 },
      status: string("Vault state"),
      balance: money,
      accrued_interest: money,
    },
    ["account", "currency", "status", "balance", "accrued_interest"],
  ),

  CreditLine: resource(
    {
      account: ref("Identifier"),
      currency: ref("CurrencyCode"),
      limit: money,
      drawn: money,
      available: money,
      ltv_max: { type: "number", exclusiveMinimum: 0, maximum: 1 },
      collateral: { type: ["object", "null"], additionalProperties: true },
      status: string("Credit state"),
    },
    ["account", "currency", "limit", "drawn", "available", "status"],
  ),

  Approval: resource(
    {
      chain: ref("Identifier"),
      wallet: ref("Identifier"),
      amount: money,
      to: string("Destination"),
      status: string("Approval state"),
      decisions: { type: "array", items: { type: "object", additionalProperties: true } },
      required: { type: "integer", minimum: 1 },
    },
    ["status"],
  ),

  OrganisationMember: open(
    {
      id: ref("Identifier"),
      key: { type: ["string", "null"] },
      email: { type: ["string", "null"], format: "email" },
      role: string("Organisation role"),
      status: string("Membership state"),
      joined_at: ref("Timestamp"),
    },
    ["id", "role", "status", "joined_at"],
  ),

  LedgerEntry: open(
    {
      id: ref("Identifier"),
      txn: ref("Identifier"),
      at: ref("Timestamp"),
      account: ref("Identifier"),
      currency: ref("CurrencyCode"),
      amount: ref("DecimalAmount"),
      memo: { type: ["string", "null"] },
    },
    ["id", "txn", "at", "account", "currency", "amount"],
  ),

  FeeConfig: open(
    {
      object: { type: "string", const: "fee_config" },
      schedule: { type: "object", additionalProperties: true },
      payout_account: { type: ["string", "null"] },
      updated_at: { anyOf: [ref("Timestamp"), { type: "null" }] },
    },
    ["object", "schedule", "payout_account"],
  ),

  Rail: open(
    {
      id: string("Rail identifier"),
      currency: ref("CurrencyCode"),
      speed: string("Expected settlement speed"),
      cutoff: { type: ["string", "null"] },
      weekend: { type: "boolean" },
      min: ref("DecimalAmount"),
      max: ref("DecimalAmount"),
    },
    ["id", "currency", "speed", "weekend", "min", "max"],
  ),

  Subscription: resource(
    {
      customer: ref("Identifier"),
      mandate: ref("Identifier"),
      amount: money,
      schedule: { type: "object", additionalProperties: true },
      status: string("Subscription state"),
      next_run_date: ref("Timestamp"),
    },
    ["customer", "mandate", "amount", "schedule", "status", "next_run_date"],
  ),

  DestinationVerification: open(
    {
      destination: ref("Identifier"),
      recipient: ref("Identifier"),
      checked_name: string("Name supplied for verification"),
      held_name: string("Name held on destination"),
      result: { type: "string", enum: ["match", "close_match", "no_match"] },
      checked_at: ref("Timestamp"),
    },
    ["destination", "recipient", "result", "checked_at"],
  ),

  WebhookDelivery: open(
    {
      id: ref("Identifier"),
      webhook: ref("Identifier"),
      event_id: ref("Identifier"),
      event_type: string("Event type"),
      status: {
        type: "string",
        enum: ["pending", "attempting", "retrying", "succeeded", "failed"],
      },
      attempt_count: { type: "integer", minimum: 0 },
      response_code: { type: ["integer", "null"] },
      attempted_at: { anyOf: [ref("Timestamp"), { type: "null" }] },
      next_attempt_at: { anyOf: [ref("Timestamp"), { type: "null" }] },
    },
    ["id", "webhook", "status"],
  ),

  SandboxScenario: open(
    {
      name: string("Scenario identifier"),
      kind: { type: "string", enum: ["payment", "onboarding"] },
      awaiting_advance: { type: "boolean" },
      does: string("Scenario behavior"),
    },
    ["name", "kind", "awaiting_advance", "does"],
  ),

  Country: open(
    {
      code: string("ISO country code", { pattern: "^[A-Z]{2}$" }),
      name: string("Country name"),
      currency: ref("CurrencyCode"),
    },
    ["code", "name", "currency"],
  ),

  CurrencyReference: open(
    {
      code: ref("CurrencyCode"),
      thin_liquidity: { type: "boolean" },
    },
    ["code", "thin_liquidity"],
  ),

  Network: open(
    {
      id: string("Network identifier"),
      name: string("Network name"),
      chain_id: { type: ["integer", "null"] },
      native_currency: string("Native network currency"),
      supports: { type: "array", items: ref("CurrencyCode") },
    },
    ["id", "name", "chain_id", "native_currency", "supports"],
  ),
};
