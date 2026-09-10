/** Effective operation-level response contracts used by published OpenAPI and runtime validation. */
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  responseContractFor as legacyResponseContractFor,
} from "./response-contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const T = "2026-09-10T00:00:00.000Z";
const MONEY = { amount: "1250.00", currency: "EUR" };

const LIST_OVERRIDES = {
  getCountries: "Country",
  getCurrencies: "CurrencyReference",
  getNetworks: "Network",
};

const SCHEMA_EXAMPLES = {
  KeyPrincipal: {
    id: "key_example",
    tenant_id: "ten_example",
    email: "builder@example.test",
    scope: "sandbox",
    created_at: T,
    expires: "2026-09-11T00:00:00.000Z",
  },
  Customer: {
    id: "cus_example",
    type: "individual",
    name: "Ada Lovelace",
    email: "ada@example.test",
    status: "completed",
    decision: "approved",
    tier: 3,
    created_at: T,
  },
  Application: {
    id: "app_example",
    type: "individual",
    customer: "cus_example",
    status: "submitted",
    decision: null,
    business: null,
    individual: { name: "Ada Lovelace" },
    individuals: [],
    documents: [],
    attestations: [],
    created_at: T,
  },
  Account: {
    id: "acc_example",
    customer: "cus_example",
    currency: "EUR",
    type: "holding",
    status: "open",
    balance: MONEY,
    created_at: T,
  },
  ReceivingDetail: {
    id: "adt_example",
    account: "acc_example",
    rail: "sepa",
    details: { iban: "DE02120300000000202051" },
    created_at: T,
  },
  Wallet: {
    id: "wal_example",
    customer: "cus_example",
    currency: "EUR",
    network: "base",
    address: "0x0000000000000000000000000000000000000001",
    balance: MONEY,
    approval_chain: null,
    created_at: T,
  },
  Recipient: {
    id: "rcp_example",
    name: "Example Supplier",
    destinations: [],
    created_at: T,
  },
  Destination: {
    id: "dst_example",
    rail: "sepa",
    name: "Example Supplier",
    currency: "EUR",
    name_check: "unchecked",
    created_at: T,
  },
  Quote: {
    id: "quo_example",
    from: "EUR",
    to: "GBP",
    amount: { amount: "100.00", currency: "EUR" },
    receives: { amount: "85.00", currency: "GBP" },
    rate: "0.850000",
    spread_bps: 4,
    lockable: true,
    settlement: "instant",
    liquidity: "deep",
    expires_at: "2026-09-10T00:00:30.000Z",
    created_at: T,
  },
  Transfer: {
    id: "trf_example",
    from: "acc_example",
    recipient: null,
    destination: null,
    amount: { amount: "75.00", currency: "EUR" },
    rail: "sepa",
    status: "funds_received",
    legs: [{ id: "leg_example", rail: "sepa", status: "funds_received" }],
    created_at: T,
  },
  Card: {
    id: "crd_example",
    customer: "cus_example",
    account: "acc_example",
    type: "virtual",
    status: "active",
    last4: "4242",
    currency: "EUR",
    spend_limits: {},
    merchant_categories: { blocked: [], allowed: [] },
    created_at: T,
  },
  Authorisation: {
    id: "aut_example",
    card: "crd_example",
    customer: "cus_example",
    account: "acc_example",
    amount: { amount: "24.00", currency: "EUR" },
    merchant: { name: "Example merchant", mcc: "5812" },
    status: "pending",
    created_at: T,
  },
  Dispute: {
    id: "dsp_example",
    authorisation: "aut_example",
    reason_code: "R13",
    description: "Goods not received",
    status: "open",
    created_at: T,
  },
  Vault: {
    id: "vlt_example",
    account: "acc_example",
    currency: "EUR",
    name: "Savings vault",
    rate: 0.03,
    status: "active",
    balance: { amount: "500.00", currency: "EUR" },
    accrued_interest: { amount: "1.00", currency: "EUR" },
    created_at: T,
  },
  CreditLine: {
    id: "crl_example",
    account: "acc_example",
    currency: "EUR",
    limit: { amount: "10000.00", currency: "EUR" },
    drawn: { amount: "250.00", currency: "EUR" },
    available: { amount: "7750.00", currency: "EUR" },
    ltv_max: 0.8,
    collateral: null,
    status: "active",
    created_at: T,
  },
  Policy: {
    id: "pol_example",
    name: "Treasury controls",
    rules: [],
    attached: [],
    created_at: T,
  },
  Approval: {
    id: "apr_example",
    chain: "apc_example",
    wallet: "wal_example",
    amount: { amount: "25.00", currency: "EUR" },
    to: "0x0000000000000000000000000000000000000002",
    status: "pending",
    decisions: [],
    required: 2,
    created_at: T,
  },
  Organisation: {
    id: "org_example",
    name: "Example Bank",
    members: [{ id: "mem_example", key: null, email: "member@example.test", role: "member", status: "invited", joined_at: T }],
    created_at: T,
  },
  OrganisationMember: {
    id: "mem_example",
    key: null,
    email: "member@example.test",
    role: "member",
    status: "invited",
    joined_at: T,
  },
  LedgerEntry: {
    id: "led_example",
    txn: "led_txn_example",
    at: T,
    account: "acc_example",
    currency: "EUR",
    amount: "75.00",
    memo: "example posting",
  },
  FeeConfig: { object: "fee_config", schedule: {}, payout_account: null, updated_at: null },
  Rail: { id: "sepa", currency: "EUR", speed: "next business day", cutoff: "15:00 CET", weekend: false, min: "0.01", max: "999999.00" },
  Subscription: {
    id: "sub_example",
    customer: "cus_example",
    mandate: "mnd_example",
    amount: { amount: "29.00", currency: "EUR" },
    schedule: { interval: "month", interval_count: 1, start_date: T },
    status: "active",
    next_run_date: "2026-10-10T00:00:00.000Z",
    created_at: T,
  },
  Webhook: { id: "whk_example", url: "https://hooks.example.test/blueballs", events: ["transfer.created"], status: "enabled", delivery_mode: "allowlist", created_at: T },
  WebhookDelivery: { id: "whd_example", webhook: "whk_example", event_id: "evt_example", event_type: "transfer.created", status: "pending", attempt_count: 0, response_code: null, attempted_at: null, next_attempt_at: T },
  Event: { id: "evt_example", type: "transfer.created", data: { id: "trf_example" }, created_at: T },
  SandboxRun: { id: "sim_example", object: "sandbox.payment", scenario: "payment.success", status: "settled", history: [], created_at: T },
  SandboxScenario: { name: "payment.success", kind: "payment", awaiting_advance: false, does: "Inbound payment settles immediately." },
  DestinationVerification: { destination: "dst_example", recipient: "rcp_example", checked_name: "Example Supplier", held_name: "Example Supplier", result: "match", checked_at: T },
  Country: { code: "DE", name: "Germany", currency: "EUR" },
  CurrencyReference: { code: "EUR", thin_liquidity: false },
  Network: { id: "base", name: "Base", chain_id: 8453, native_currency: "ETH", supports: ["USDC"] },
};

const OPERATION_EXAMPLES = {
  postAuthSignup: {
    ...SCHEMA_EXAMPLES.KeyPrincipal,
    key: "bb_sandbox_returned_once",
    note: "This is the only time the key is shown.",
  },
  postKeys: {
    ...SCHEMA_EXAMPLES.KeyPrincipal,
    key: "bb_sandbox_returned_once",
    note: "This is the only time the key is shown.",
  },
  postLinks: {
    id: "lnk_example",
    object: "payment_link",
    url: "https://blueballs.tech/pay/lnk_example",
    amount: "29.00",
    currency: "EUR",
    status: "active",
    expires_at: "2026-09-17T00:00:00.000Z",
    created_at: T,
  },
  getLinksId: {
    id: "lnk_example",
    object: "payment_link",
    url: "https://blueballs.tech/pay/lnk_example",
    amount: "29.00",
    currency: "EUR",
    status: "active",
    expires_at: "2026-09-17T00:00:00.000Z",
    created_at: T,
  },
};

function schemaName(schema) {
  const prefix = "#/components/schemas/";
  return schema?.$ref?.startsWith(prefix) ? schema.$ref.slice(prefix.length) : null;
}

function exampleFor(name, fallback) {
  return SCHEMA_EXAMPLES[name] ?? fallback;
}

export function responseContractFor(input) {
  const base = legacyResponseContractFor(input);
  const listSchema = LIST_OVERRIDES[input.operationId];
  if (listSchema) {
    return {
      ...base,
      schema: {
        type: "object",
        additionalProperties: true,
        required: ["data"],
        properties: {
          object: { type: "string", const: "list" },
          data: { type: "array", items: ref(listSchema) },
          has_more: { type: "boolean" },
          next_cursor: { type: ["string", "null"] },
        },
      },
      example: { object: "list", data: [exampleFor(listSchema, {})], has_more: false, next_cursor: null },
    };
  }

  const itemName = schemaName(base.schema?.properties?.data?.items);
  if (itemName) {
    return {
      ...base,
      example: {
        ...base.example,
        data: [exampleFor(itemName, base.example?.data?.[0] ?? {})],
      },
    };
  }

  const singleName = schemaName(base.schema);
  const example = OPERATION_EXAMPLES[input.operationId]
    ?? (singleName ? exampleFor(singleName, base.example) : base.example);
  return { ...base, example };
}

export { PAGINATED_RESPONSE_OPERATIONS, RESPONSE_LIST_OPERATIONS };
