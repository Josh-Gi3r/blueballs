/** Final production schema layer consumed by generated OpenAPI and runtime validation. */
import { EFFECTIVE_SCHEMAS } from "./effective-contracts.mjs";
import { KEY_PERMISSIONS } from "../key-permission-catalog.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const open = (properties = {}, required = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  ...(required.length ? { required } : {}),
});
const permissionArray = {
  type: "array",
  items: { type: "string", enum: ["*", ...KEY_PERMISSIONS] },
  minItems: 1,
};
const nullableTimestamp = { anyOf: [ref("Timestamp"), { type: "null" }] };

export const PRODUCTION_SCHEMAS = {
  ...EFFECTIVE_SCHEMAS,

  KeyPrincipal: open(
    {
      id: ref("Identifier"),
      tenant_id: ref("Identifier"),
      email: { type: ["string", "null"], format: "email" },
      scope: { type: "string" },
      permissions: permissionArray,
      created_at: ref("Timestamp"),
      expires: nullableTimestamp,
    },
    ["id", "tenant_id", "scope", "permissions", "created_at"],
  ),

  KeySecret: open(
    {
      id: ref("Identifier"),
      tenant_id: ref("Identifier"),
      key: { type: "string" },
      scope: { type: "string" },
      permissions: permissionArray,
      created_at: ref("Timestamp"),
      expires: nullableTimestamp,
      note: { type: "string" },
    },
    ["id", "tenant_id", "key", "scope", "permissions", "created_at", "expires"],
  ),

  Account: open(
    {
      id: ref("Identifier"),
      customer: ref("Identifier"),
      currency: ref("CurrencyCode"),
      type: { type: "string" },
      status: { type: "string" },
      details: {
        anyOf: [
          { type: "object", additionalProperties: true },
          { type: "null" },
        ],
        description:
          "Sandbox-generated reference details or null in production until a provider-backed receiving instrument is issued.",
      },
      balance: ref("Money"),
      created_at: ref("Timestamp"),
    },
    ["id", "customer", "currency", "status", "balance", "created_at"],
  ),

  ReceivingDetail: open(
    {
      id: ref("Identifier"),
      account: ref("Identifier"),
      rail: { type: "string" },
      currency: ref("CurrencyCode"),
      status: { type: "string" },
      type: {
        type: ["string", "null"],
        enum: ["iban", "sort_code", "aba", "paynow", "onchain", null],
      },
      iban: { type: ["string", "null"] },
      bic: { type: ["string", "null"] },
      account_number: { type: ["string", "null"] },
      routing_number: { type: ["string", "null"] },
      sort_code: { type: ["string", "null"] },
      proxy: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
      network: { type: ["string", "null"] },
      provider_operation_id: { type: "string" },
      provider_reference: { type: ["string", "null"] },
      provider_state: { type: ["string", "null"] },
      provider_status: { type: "string" },
      created_at: ref("Timestamp"),
    },
    ["id", "account", "rail", "currency", "status", "created_at"],
  ),

  Card: open(
    {
      id: ref("Identifier"),
      customer: ref("Identifier"),
      account: ref("Identifier"),
      type: { type: "string", enum: ["virtual", "physical"] },
      status: { type: "string" },
      status_reason: { type: ["string", "null"] },
      last4: {
        type: ["string", "null"],
        pattern: "^[0-9]{4}$",
        description:
          "Provider-backed last four digits when issued; null while production issuance is pending.",
      },
      bin: { type: ["string", "null"], pattern: "^[0-9]{6,8}$" },
      expires: { type: ["string", "null"] },
      currency: ref("CurrencyCode"),
      spend_limits: { type: "object", additionalProperties: true },
      merchant_categories: { type: "object", additionalProperties: true },
      provider_operation_id: { type: "string" },
      provider_reference: { type: ["string", "null"] },
      provider_state: { type: ["string", "null"] },
      provider_status: { type: "string" },
      processor_token: { type: "string" },
      created_at: ref("Timestamp"),
    },
    ["id", "customer", "account", "type", "status", "currency", "created_at"],
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
      command_id: { anyOf: [ref("Identifier"), { type: "null" }] },
    },
    ["id", "txn", "at", "account", "currency", "amount"],
  ),

  Event: open(
    {
      id: ref("Identifier"),
      type: { type: "string" },
      created_at: ref("Timestamp"),
      data: { type: "object", additionalProperties: true },
      command_id: { anyOf: [ref("Identifier"), { type: "null" }] },
    },
    ["id", "type", "created_at", "data"],
  ),

  Attestation: open(
    {
      id: ref("Identifier"),
      statement: { type: "string" },
      agreed: { type: "boolean", const: true },
      agreed_at: ref("Timestamp"),
    },
    ["id", "statement", "agreed", "agreed_at"],
  ),

  ApprovalChain: open(
    {
      id: ref("Identifier"),
      name: { type: "string" },
      threshold: ref("Money"),
      approvers: { type: "array", items: ref("Identifier") },
      steps: { type: "integer", minimum: 1 },
      resource: { type: ["object", "null"], additionalProperties: true },
      created_at: ref("Timestamp"),
    },
    ["id", "name", "threshold", "approvers", "steps", "created_at"],
  ),
};
