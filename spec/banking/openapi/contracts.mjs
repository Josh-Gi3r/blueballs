/** Reusable OpenAPI contracts for the banking catalogue.
 *
 * Keep transport metadata here rather than in the website catalogue. The
 * catalogue says what exists; this module says what crosses the HTTP boundary.
 */

const string = (description, extra = {}) => ({
  type: "string",
  description,
  ...extra,
});
const object = (properties, required = []) => ({
  type: "object",
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {}),
});
const openObject = (properties, required = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  ...(required.length ? { required } : {}),
});
const resource = (properties = {}, required = []) =>
  object(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      created_at: { $ref: "#/components/schemas/Timestamp" },
      ...properties,
    },
    ["id", ...required],
  );

export const SCHEMAS = {
  Identifier: string("Opaque resource identifier", {
    pattern: "^[A-Za-z0-9_-]+$",
  }),
  Timestamp: string("RFC 3339 timestamp", { format: "date-time" }),
  DecimalAmount: string("Exact base-10 amount; never a JSON number", {
    pattern: "^-?[0-9]+(?:\\.[0-9]+)?$",
    example: "1250.00",
  }),
  CurrencyCode: string("ISO 4217 or configured stablecoin code", {
    pattern: "^[A-Z0-9]{3,12}$",
    example: "EUR",
  }),
  Problem: object(
    {
      type: string("Stable problem URI", { format: "uri-reference" }),
      title: string("Short error title"),
      status: { type: "integer", minimum: 400, maximum: 599 },
      detail: string("Human-readable error detail"),
      instance: string("Request-specific problem URI", {
        format: "uri-reference",
      }),
      request_id: string("Support correlation identifier"),
    },
    ["type", "title", "status", "detail", "request_id"],
  ),
  KeyPrincipal: resource(
    {
      tenant_id: { $ref: "#/components/schemas/Identifier" },
      name: string("Key label"),
      scopes: { type: "array", items: { type: "string" } },
      revoked_at: {
        anyOf: [{ $ref: "#/components/schemas/Timestamp" }, { type: "null" }],
      },
    },
    ["tenant_id", "scopes"],
  ),
  Customer: resource(
    {
      type: { type: "string", enum: ["individual", "business"] },
      name: string("Customer display or legal name"),
      status: string("Lifecycle status"),
    },
    ["type", "name"],
  ),
  Application: resource(
    {
      customer: { $ref: "#/components/schemas/Identifier" },
      status: string("Application state"),
    },
    ["status"],
  ),
  Account: resource(
    {
      customer: { $ref: "#/components/schemas/Identifier" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      balance: { $ref: "#/components/schemas/DecimalAmount" },
      status: string("Account state"),
    },
    ["customer", "currency", "balance"],
  ),
  ReceivingDetail: resource(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      rail: string("Payment rail"),
      details: { type: "object", additionalProperties: true },
    },
    ["account", "rail"],
  ),
  Wallet: resource(
    {
      customer: { $ref: "#/components/schemas/Identifier" },
      network: string("Blockchain network"),
      address: string("Wallet address"),
    },
    ["network"],
  ),
  Recipient: resource(
    { name: string("Recipient name"), type: string("Recipient kind") },
    ["name"],
  ),
  Destination: resource(
    {
      recipient: { $ref: "#/components/schemas/Identifier" },
      rail: string("Payment rail"),
      details: { type: "object", additionalProperties: true },
    },
    ["recipient", "rail"],
  ),
  Quote: resource(
    {
      from: { $ref: "#/components/schemas/CurrencyCode" },
      to: { $ref: "#/components/schemas/CurrencyCode" },
      amount: { $ref: "#/components/schemas/DecimalAmount" },
      rate: { $ref: "#/components/schemas/DecimalAmount" },
      expires_at: { $ref: "#/components/schemas/Timestamp" },
      status: string("Quote state"),
    },
    ["from", "to", "amount", "rate", "expires_at"],
  ),
  FxResource: openObject({
    id: { $ref: "#/components/schemas/Identifier" },
    pair: string("Currency pair"),
    amount: { $ref: "#/components/schemas/DecimalAmount" },
    status: string("FX lifecycle state"),
    created_at: { $ref: "#/components/schemas/Timestamp" },
  }),
  Transfer: resource(
    {
      from: { $ref: "#/components/schemas/Identifier" },
      destination: { $ref: "#/components/schemas/Identifier" },
      amount: { $ref: "#/components/schemas/DecimalAmount" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      rail: string("Payment rail"),
      status: string("Transfer state"),
    },
    ["amount", "status"],
  ),
  Card: resource(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      type: string("Card form"),
      status: string("Card state"),
      last4: string("Last four digits", { pattern: "^[0-9]{4}$" }),
    },
    ["status"],
  ),
  Authorisation: resource(
    {
      card: { $ref: "#/components/schemas/Identifier" },
      amount: { $ref: "#/components/schemas/DecimalAmount" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      status: string("Decision state"),
    },
    ["card", "amount", "status"],
  ),
  Dispute: resource(
    {
      authorisation: { $ref: "#/components/schemas/Identifier" },
      reason: string("Dispute reason code"),
      status: string("Dispute state"),
    },
    ["reason", "status"],
  ),
  Vault: resource(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      balance: { $ref: "#/components/schemas/DecimalAmount" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      status: string("Vault state"),
    },
    ["balance"],
  ),
  CreditLine: resource(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      limit: { $ref: "#/components/schemas/DecimalAmount" },
      drawn: { $ref: "#/components/schemas/DecimalAmount" },
      status: string("Credit state"),
    },
    ["limit", "drawn"],
  ),
  Policy: resource(
    {
      name: string("Policy name"),
      rules: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
    ["name"],
  ),
  Approval: resource(
    {
      resource: { $ref: "#/components/schemas/Identifier" },
      status: string("Approval state"),
      threshold: { type: "integer", minimum: 1 },
    },
    ["status"],
  ),
  Organisation: resource(
    {
      name: string("Organisation name"),
      members: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
    ["name"],
  ),
  LedgerEntry: resource(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      amount: { $ref: "#/components/schemas/DecimalAmount" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      direction: { type: "string", enum: ["debit", "credit"] },
    },
    ["account", "amount", "direction"],
  ),
  FeeConfig: object({
    destination: { type: ["string", "null"] },
    schedule: { type: "object", additionalProperties: true },
  }),
  Rail: object(
    {
      id: string("Rail identifier"),
      status: string("Availability"),
      currencies: {
        type: "array",
        items: { $ref: "#/components/schemas/CurrencyCode" },
      },
    },
    ["id", "status"],
  ),
  QrCode: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      object: { type: "string", const: "qr_code" },
      type: { type: "string", enum: ["static", "dynamic"] },
      payload: string("EMVCo TLV payload"),
      merchant: { type: "object", additionalProperties: true },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      amount: { type: ["string", "null"] },
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "object", "type", "payload", "merchant", "currency", "created_at"],
  ),
  QrDecode: openObject(
    {
      object: { type: "string", const: "qr_decode" },
      valid: { type: "boolean" },
      point_of_initiation: { type: "string", enum: ["static", "dynamic"] },
      merchant: { type: "object", additionalProperties: true },
      currency: { type: ["string", "null"] },
      amount: { type: ["string", "null"] },
      crc: { type: "object", additionalProperties: true },
    },
    ["object", "valid", "point_of_initiation", "merchant", "crc"],
  ),
  PaymentLink: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      object: { type: "string", const: "payment_link" },
      url: string("Hosted payment-link URL", { format: "uri" }),
      amount: { type: ["string", "null"] },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      status: string("Link state"),
      expires_at: { $ref: "#/components/schemas/Timestamp" },
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "object", "url", "currency", "status", "expires_at", "created_at"],
  ),
  Mandate: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      object: { type: "string", const: "mandate" },
      customer: { $ref: "#/components/schemas/Identifier" },
      scheme: string("Direct-debit scheme"),
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      max_amount: { type: ["object", "null"], additionalProperties: true },
      status: string("Mandate state"),
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "object", "customer", "scheme", "currency", "status", "created_at"],
  ),
  Subscription: resource(
    {
      amount: { $ref: "#/components/schemas/DecimalAmount" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      cadence: string("Recurrence cadence"),
      status: string("Mandate or subscription state"),
    },
    ["status"],
  ),
  Webhook: resource(
    {
      url: string("HTTPS delivery URL", { format: "uri" }),
      events: { type: "array", items: { type: "string" } },
      status: string("Target state"),
    },
    ["url", "events"],
  ),
  Event: resource(
    {
      type: string("Event type"),
      data: { type: "object", additionalProperties: true },
    },
    ["type", "data"],
  ),
  SandboxRun: resource(
    {
      scenario: string("Scenario identifier"),
      status: string("Simulation state"),
      history: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
    ["status"],
  ),
  SandboxProject: resource(
    {
      object: { type: "string", const: "sandbox_project" },
      status: string("Builder lifecycle state"),
      blueprint: { type: "object", additionalProperties: true },
      build: { type: "object", additionalProperties: true },
      environment: { type: ["object", "null"], additionalProperties: true },
      customers: {
        type: "array",
        items: { $ref: "#/components/schemas/Customer" },
      },
      accounts: {
        type: "array",
        items: { $ref: "#/components/schemas/Account" },
      },
      journeys: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
    [
      "object",
      "status",
      "blueprint",
      "build",
      "customers",
      "accounts",
      "journeys",
    ],
  ),
  ReferenceItem: object(
    {
      code: string("Reference code"),
      name: string("Display name"),
      status: string("Availability"),
    },
    ["code"],
  ),
  KeySecret: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      tenant_id: { $ref: "#/components/schemas/Identifier" },
      key: string("Secret API key; returned once and never retrievable"),
      scope: string("Granted key scope"),
      created_at: { $ref: "#/components/schemas/Timestamp" },
      expires: { $ref: "#/components/schemas/Timestamp" },
      note: string("Secret-handling instruction"),
    },
    ["id", "tenant_id", "key", "scope", "created_at", "expires"],
  ),
  Capability: object(
    {
      rail: string("Payment rail"),
      status: string("Capability state"),
      requirements: { type: "array", items: { type: "string" } },
      limit: { $ref: "#/components/schemas/DecimalAmount" },
    },
    ["rail", "status", "requirements", "limit"],
  ),
  AssociatedIndividual: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      name: string("Individual name"),
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "name", "created_at"],
  ),
  ApplicationDocument: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      type: string("Document type"),
      filename: { type: ["string", "null"] },
      content_type: string("MIME type"),
      content: string("Base64-encoded document content"),
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "type", "content_type", "content", "created_at"],
  ),
  WalletBalance: object(
    {
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      network: string("Blockchain network"),
      amount: { $ref: "#/components/schemas/DecimalAmount" },
    },
    ["currency", "network", "amount"],
  ),
  WalletSend: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      object: { type: "string", const: "wallet_send" },
      wallet: { $ref: "#/components/schemas/Identifier" },
      amount: {
        type: "object",
        additionalProperties: false,
        required: ["amount", "currency"],
        properties: {
          amount: { $ref: "#/components/schemas/DecimalAmount" },
          currency: { $ref: "#/components/schemas/CurrencyCode" },
        },
      },
      to: string("Destination address"),
      status: string("Send state"),
      approval: { type: "string" },
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "object", "wallet", "amount", "to", "status", "created_at"],
  ),
  DestinationVerification: openObject(
    {
      destination: { $ref: "#/components/schemas/Identifier" },
      match: string("Name-match result"),
      checked_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["destination", "match"],
  ),
  Rate: openObject(
    {
      from: { $ref: "#/components/schemas/CurrencyCode" },
      to: { $ref: "#/components/schemas/CurrencyCode" },
      rate: { $ref: "#/components/schemas/DecimalAmount" },
      spread_bps: { type: "integer" },
      liquidity: string("Reference liquidity classification"),
      as_of: { $ref: "#/components/schemas/Timestamp" },
    },
    ["from", "to", "rate"],
  ),
  CurrencyPair: openObject(
    {
      from: { $ref: "#/components/schemas/CurrencyCode" },
      to: { $ref: "#/components/schemas/CurrencyCode" },
      tradable: { type: "boolean" },
      liquidity: string("Reference liquidity classification"),
    },
    ["from", "to", "tradable"],
  ),
  Asset: openObject(
    {
      code: { $ref: "#/components/schemas/CurrencyCode" },
      kind: { type: "string", enum: ["fiat", "stablecoin"] },
    },
    ["kind"],
  ),
  Corridor: openObject(
    {
      pair: string("Currency pair"),
      from: { $ref: "#/components/schemas/CurrencyCode" },
      to: { $ref: "#/components/schemas/CurrencyCode" },
      spread_bps: { type: "integer" },
      liquidity: string("Reference liquidity classification"),
    },
    ["pair", "from", "to"],
  ),
  TransferLeg: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      rail: string("Payment rail"),
      status: string("Leg state"),
    },
    ["id", "status"],
  ),
  CardStatement: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      card: { $ref: "#/components/schemas/Identifier" },
      period: string("Statement month", { pattern: "^[0-9]{4}-[0-9]{2}$" }),
      transaction_count: { type: "integer", minimum: 0 },
    },
    ["id", "card", "period", "transaction_count"],
  ),
  PolicyRule: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      type: string("Rule type"),
    },
    ["id", "type"],
  ),
  OrganisationMember: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      email: string("Member email", { format: "email" }),
      role: string("Organisation role"),
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "email", "role"],
  ),
  LedgerBalance: object(
    {
      account: { $ref: "#/components/schemas/Identifier" },
      currency: { $ref: "#/components/schemas/CurrencyCode" },
      balance: { $ref: "#/components/schemas/DecimalAmount" },
    },
    ["account", "currency", "balance"],
  ),
  Statement: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      account: { $ref: "#/components/schemas/Identifier" },
      from: string("Inclusive statement date", { format: "date" }),
      to: string("Inclusive statement date", { format: "date" }),
      created_at: { $ref: "#/components/schemas/Timestamp" },
    },
    ["id", "created_at"],
  ),
  RailCalendarDay: object(
    {
      date: string("Calendar date", { format: "date" }),
      weekend: { type: "boolean" },
      holiday: { type: "boolean" },
      business_day: { type: "boolean" },
    },
    ["date", "weekend", "holiday", "business_day"],
  ),
  WebhookDelivery: openObject(
    {
      id: { $ref: "#/components/schemas/Identifier" },
      webhook: { $ref: "#/components/schemas/Identifier" },
      status: string("Delivery state"),
      response_code: { type: ["integer", "null"] },
      attempted_at: {
        anyOf: [{ $ref: "#/components/schemas/Timestamp" }, { type: "null" }],
      },
    },
    ["id", "webhook", "status"],
  ),
  SandboxScenario: openObject(
    {
      id: string("Scenario identifier"),
      name: string("Scenario name"),
      description: string("Scenario purpose"),
    },
    ["id", "name"],
  ),
  DeleteResult: openObject({
    id: { $ref: "#/components/schemas/Identifier" },
    object: string("Deleted resource kind"),
    deleted: { type: "boolean" },
    revoked: { anyOf: [{ type: "boolean" }, { type: "integer", minimum: 0 }] },
    deleted_at: {
      anyOf: [{ $ref: "#/components/schemas/Timestamp" }, { type: "null" }],
    },
  }),
};

export const FAMILY_SCHEMA = {
  "Auth & API keys": "KeyPrincipal",
  Customers: "Customer",
  "Onboarding applications": "Application",
  Accounts: "Account",
  "Receiving details": "ReceivingDetail",
  Wallets: "Wallet",
  Recipients: "Recipient",
  Destinations: "Destination",
  "Quotes & exchange": "Quote",
  "Stablecoin FX": "FxResource",
  Transfers: "Transfer",
  Cards: "Card",
  Authorisations: "Authorisation",
  Disputes: "Dispute",
  "Savings vaults": "Vault",
  "Credit lines": "CreditLine",
  Policies: "Policy",
  "Approval chains": "Approval",
  Organisations: "Organisation",
  "Ledger & statements": "LedgerEntry",
  Fees: "FeeConfig",
  "Rails registry": "Rail",
  "QR & payment links": "PaymentLink",
  "Bills & subscriptions": "Subscription",
  Webhooks: "Webhook",
  Events: "Event",
  Sandbox: "SandboxRun",
  "Reference data": "ReferenceItem",
};

export const BODYLESS_OPERATIONS = new Set([
  "deleteKeys",
  "deleteKeysId",
  "deleteCustomersId",
  "deleteApplicationsIdIndividualsIid",
  "deleteApplicationsIdDocumentsDid",
  "deleteAccountsId",
  "deleteRecipientsId",
  "deleteDestinationsId",
  "postApplicationsIdSubmit",
  "postTransfersIdCancel",
  "postTransfersIdSettle",
  "postCardsIdUnfreeze",
  "postCardsIdPin",
  "postCardsIdReveal",
  "postAuthorisationsIdApprove",
  "deleteVaultsId",
  "deletePoliciesId",
  "deletePoliciesIdRulesRid",
  "deleteOrgsIdMembersMid",
  "deleteWebhooksId",
  "postWebhooksDeliveriesDidReplay",
  "postFxRfqIdAccept",
  "postFxIntentsIdCancel",
  "postFxNet",
  "postFxLpIdWithdraw",
  "postBuilderProjectsIdProvision",
]);

/** Operations that intentionally fail closed until an operator supplies the
 * corresponding regulated/provider adapter. They are routed and documented,
 * but must not advertise a fabricated success response. */
export const ADAPTER_REQUIRED_OPERATIONS = new Set([
  "postCardsIdPin",
  "postCardsIdReveal",
]);

export const CREATED_OPERATIONS = new Set([
  "postAuthSignup",
  "postKeys",
  "postCustomers",
  "postApplications",
  "postApplicationsIdIndividuals",
  "postApplicationsIdDocuments",
  "postAccounts",
  "postAccountsIdDetails",
  "postWallets",
  "postRecipients",
  "postRecipientsIdDestinations",
  "postQuotes",
  "postFxRfq",
  "postFxIntents",
  "postFxLp",
  "postTransfers",
  "postCards",
  "postCardsIdAuthorisations",
  "postDisputes",
  "postVaults",
  "postCredit",
  "postPolicies",
  "postPoliciesIdRules",
  "postApprovalchains",
  "postOrgs",
  "postOrgsIdMembers",
  "postStatements",
  "postLinks",
  "postMandates",
  "postSubscriptions",
  "postWebhooks",
  "postSandboxPayments",
  "postSandboxOnboarding",
  "postBuilderProjects",
]);

export function schemaForFamily(family) {
  const name = FAMILY_SCHEMA[family];
  if (!name) throw new Error(`No reusable schema for family: ${family}`);
  return name;
}
