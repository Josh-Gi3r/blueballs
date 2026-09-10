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
        type: "string",
        enum: ["iban", "sort_code", "aba", "paynow", "onchain"],
      },
      iban: { type: "string" },
      bic: { type: "string" },
      account_number: { type: "string" },
      routing_number: { type: "string" },
      sort_code: { type: "string" },
      proxy: { type: "string" },
      address: { type: "string" },
      network: { type: "string" },
      created_at: ref("Timestamp"),
    },
    ["id", "account", "rail", "currency", "status", "type", "created_at"],
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
