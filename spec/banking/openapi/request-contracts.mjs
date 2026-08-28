/** Operation-accurate request contracts for the banking API.
 *
 * Family response schemas describe resources. Request payloads describe actions,
 * and cannot safely be inferred from a resource: drawing credit needs `amount`,
 * for example, not the `limit` required to create the credit line.
 */

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const string = (description, extra = {}) => ({
  type: "string",
  description,
  ...extra,
});
const integer = (description, extra = {}) => ({
  type: "integer",
  description,
  ...extra,
});
const boolean = (description) => ({ type: "boolean", description });
const array = (items, description) => ({
  type: "array",
  items,
  ...(description ? { description } : {}),
});
const obj = (properties = {}, required = [], additionalProperties = false) => ({
  type: "object",
  additionalProperties,
  properties,
  ...(required.length ? { required } : {}),
});
const contract = (schema, required = true) => ({ schema, required });

const id = ref("Identifier");
const amount = ref("DecimalAmount");
const currency = ref("CurrencyCode");
const clientReference = string(
  "Caller-supplied idempotent business reference",
  { maxLength: 200 },
);
const email = string("Email metadata; never the tenant identity", {
  format: "email",
});
const timestamp = ref("Timestamp");
const money = obj({ amount, currency }, ["amount", "currency"]);
const openDetails = obj({}, [], true);
const merchant = obj({
  name: string("Merchant display name"),
  mcc: string("Four-digit merchant category code", { pattern: "^[0-9]{4}$" }),
  city: string("Merchant city"),
  country: string("ISO 3166-1 alpha-2 country", { pattern: "^[A-Z]{2}$" }),
});
const spendLimits = obj({
  per_authorization: money,
  daily: money,
  monthly: money,
});
const merchantCategories = obj({
  blocked: array(string("Blocked MCC", { pattern: "^[0-9]{4}$" })),
  allowed: array(string("Allowed MCC", { pattern: "^[0-9]{4}$" })),
});
const amountOnly = obj({ amount }, ["amount"]);
const target = obj(
  {
    type: { type: "string", enum: ["wallet", "card"] },
    id,
  },
  ["type", "id"],
);
const fxPair = string("Configured asset pair, for example USDC/EURC", {
  pattern: "^[A-Z0-9]{3,12}/[A-Z0-9]{3,12}$",
});

export const REQUEST_BODIES = {
  postAuthSignup: contract(obj({ email }, ["email"])),
  postKeys: contract(
    obj({
      scope: string("Requested key scope; cannot exceed the caller scope"),
      lifetime_hours: integer("Key lifetime in hours", {
        minimum: 1,
        maximum: 168,
        default: 24,
      }),
    }),
    false,
  ),

  postCustomers: contract(
    obj(
      {
        type: { type: "string", enum: ["individual", "business"] },
        name: string("Customer display or legal name"),
        email,
        client_reference_id: clientReference,
      },
      ["type", "name"],
    ),
  ),
  patchCustomersId: contract(
    obj({
      name: string("Updated customer name"),
      email,
      client_reference_id: clientReference,
    }),
  ),
  postCustomersIdVerify: contract(
    obj({
      decision: string("Sandbox verification decision", {
        example: "approved",
      }),
    }),
    false,
  ),

  postApplications: contract(
    obj(
      {
        type: { type: "string", enum: ["individual", "business"] },
        customer: id,
        client_reference_id: clientReference,
      },
      ["type"],
    ),
  ),
  patchApplicationsIdBusiness: contract(
    obj(
      {
        legal_name: string("Registered legal name"),
        country: string("Country of registration", { pattern: "^[A-Z]{2}$" }),
        registration_number: string("Company registration number"),
        website: string("Business website", { format: "uri" }),
      },
      [],
      true,
    ),
  ),
  patchApplicationsIdIndividual: contract(
    obj(
      {
        name: string("Legal name"),
        date_of_birth: string("ISO 8601 date", { format: "date" }),
        country: string("Country of residence", { pattern: "^[A-Z]{2}$" }),
        address: openDetails,
      },
      [],
      true,
    ),
  ),
  postApplicationsIdIndividuals: contract(
    obj(
      {
        name: string("Associated individual's legal name"),
        role: string("Role, for example beneficial_owner"),
        ownership_percent: { type: "number", minimum: 0, maximum: 100 },
        email,
      },
      ["name"],
      true,
    ),
  ),
  patchApplicationsIdIndividualsIid: contract(
    obj(
      {
        name: string("Updated legal name"),
        role: string("Updated role"),
        ownership_percent: { type: "number", minimum: 0, maximum: 100 },
        email,
      },
      [],
      true,
    ),
  ),
  postApplicationsIdDocuments: contract(
    obj(
      {
        type: string("Document type"),
        content: string("Base64-encoded sandbox document", {
          contentEncoding: "base64",
        }),
        filename: string("Original filename"),
        content_type: string("Media type", { example: "application/pdf" }),
      },
      ["type", "content"],
    ),
  ),
  postApplicationsIdAttestation: contract(
    obj(
      {
        statement: string("Statement being attested"),
        agreed: boolean("Must be true"),
      },
      ["statement", "agreed"],
    ),
  ),
  postApplicationsIdEdd: contract(
    obj(
      {
        source_of_funds: string("Source-of-funds explanation"),
        source_of_wealth: string("Source-of-wealth explanation"),
        decision: {
          type: "string",
          enum: ["approved", "declined", "withdrawn"],
        },
        notes: string("Compliance notes"),
      },
      [],
      true,
    ),
    false,
  ),

  postAccounts: contract(
    obj(
      {
        customer: id,
        currency,
        type: string("Account type", { example: "holding" }),
        client_reference_id: clientReference,
      },
      ["customer", "currency"],
    ),
  ),
  patchAccountsId: contract(
    obj({
      label: string("Account label"),
      client_reference_id: clientReference,
    }),
  ),
  postAccountsIdCredit: contract(amountOnly),
  postAccountsIdDetails: contract(
    obj({ rail: string("Configured receiving rail", { example: "ach" }) }, [
      "rail",
    ]),
  ),

  postWallets: contract(
    obj(
      {
        customer: id,
        currency,
        network: string("Blockchain network", { example: "base" }),
        client_reference_id: clientReference,
      },
      ["customer", "currency"],
    ),
  ),
  postWalletsIdCredit: contract(obj({ amount, currency }, ["amount"])),
  postWalletsIdSend: contract(
    obj(
      {
        amount,
        currency,
        to: string("Destination address or wallet identifier"),
      },
      ["amount", "currency", "to"],
    ),
  ),

  postRecipients: contract(
    obj(
      {
        name: string("Recipient name"),
        destination: openDetails,
        client_reference_id: clientReference,
      },
      ["name"],
    ),
  ),
  patchRecipientsId: contract(
    obj({
      name: string("Updated recipient name"),
      client_reference_id: clientReference,
    }),
  ),
  postRecipientsIdDestinations: contract(
    obj(
      {
        rail: string("Payment rail", { example: "ach" }),
        name: string("Account-holder name"),
        currency,
        account_number: string("Rail-specific account identifier"),
        routing_number: string("Rail-specific routing identifier"),
        iban: string("IBAN where applicable"),
        bic: string("BIC/SWIFT where applicable"),
      },
      ["rail", "name"],
      true,
    ),
  ),
  patchDestinationsId: contract(
    obj(
      {
        name: string("Updated account-holder name"),
        currency,
        account_number: string("Updated account identifier"),
        routing_number: string("Updated routing identifier"),
        iban: string("Updated IBAN"),
        bic: string("Updated BIC/SWIFT"),
      },
      [],
      true,
    ),
  ),
  postDestinationsIdVerify: contract(
    obj({ name: string("Name to compare with the destination") }, ["name"]),
  ),

  postQuotes: contract(
    obj({ from: currency, to: currency, amount }, ["from", "to", "amount"]),
  ),
  postQuotesIdExecute: contract(
    obj({ from_account: id, to_account: id }, ["from_account", "to_account"]),
  ),
  postFxQuote: contract(
    obj({ from: currency, to: currency, amount }, ["from", "to", "amount"]),
  ),
  postFxRoute: contract(
    obj({ from: currency, to: currency, amount }, ["from", "to", "amount"]),
  ),
  postRampsOn: contract(
    obj({ account: id, amount, to: currency }, ["account", "amount", "to"]),
  ),
  postRampsOff: contract(
    obj({ account: id, amount, from: currency }, ["account", "amount", "from"]),
  ),
  postFxRfq: contract(
    obj({ account: id, from: currency, to: currency, amount }, [
      "account",
      "from",
      "to",
      "amount",
    ]),
  ),
  postFxIntents: contract(
    obj(
      {
        account: id,
        from: currency,
        to: currency,
        amount,
        min_receive: amount,
        mode: { type: "string", enum: ["maker", "taker"], default: "taker" },
        signature: string("Optional signed-intent evidence"),
        ttl_seconds: integer("Intent lifetime", { minimum: 1, maximum: 86400 }),
      },
      ["account", "from", "to", "amount", "min_receive"],
    ),
  ),
  putFxAppetite: contract(
    obj(
      {
        pair: fxPair,
        max_notional: amount,
        max_inventory: amount,
        enabled: boolean("Whether the corridor backstop is enabled"),
      },
      ["pair"],
      true,
    ),
  ),
  postFxLp: contract(
    obj(
      {
        account: id,
        currency,
        amount,
        pair: fxPair,
        class: { type: "string", enum: ["bank", "member", "community"] },
      },
      ["account", "currency", "amount", "pair"],
    ),
  ),

  postTransfers: contract(
    obj(
      {
        from: id,
        amount,
        rail: string("Configured payment rail"),
        recipient: id,
        destination: id,
        client_reference_id: clientReference,
      },
      ["from", "amount", "rail"],
    ),
  ),

  postCards: contract(
    obj(
      {
        customer: id,
        account: id,
        type: { type: "string", enum: ["virtual", "physical"] },
        spend_limits: spendLimits,
        merchant_categories: merchantCategories,
        client_reference_id: clientReference,
      },
      ["customer", "account", "type"],
    ),
  ),
  postCardsIdFreeze: contract(
    obj({ reason: string("Reason recorded for the freeze") }),
    false,
  ),
  patchCardsIdControls: contract(
    obj({ spend_limits: spendLimits, merchant_categories: merchantCategories }),
  ),
  postAuthorisationsIdDecline: contract(
    obj({ reason: string("Decline reason") }),
    false,
  ),
  postCardsIdAuthorisations: contract(
    obj(
      {
        amount,
        currency,
        merchant,
        client_reference_id: clientReference,
      },
      ["amount", "merchant"],
    ),
  ),
  postDisputes: contract(
    obj(
      {
        authorisation: id,
        reason_code: string("Dispute reason code"),
        description: string("Dispute description"),
        client_reference_id: clientReference,
      },
      ["authorisation", "reason_code"],
    ),
  ),
  postDisputesIdEvidence: contract(
    obj(
      {
        description: string("Evidence description"),
        documents: array(id, "Previously uploaded document identifiers"),
      },
      ["description"],
    ),
  ),

  postVaults: contract(
    obj(
      {
        account: id,
        name: string("Vault name"),
        rate: { type: "number", minimum: 0 },
        client_reference_id: clientReference,
      },
      ["account"],
    ),
  ),
  postVaultsIdDeposit: contract(amountOnly),
  postVaultsIdWithdraw: contract(amountOnly),
  postCredit: contract(
    obj(
      {
        account: id,
        limit: amount,
        collateral: money,
        ltv_max: {
          type: "number",
          exclusiveMinimum: 0,
          maximum: 1,
          default: 0.8,
        },
        client_reference_id: clientReference,
      },
      ["account", "limit"],
    ),
  ),
  postCreditIdDraw: contract(amountOnly),
  postCreditIdRepay: contract(amountOnly),
  patchCreditIdCollateral: contract(
    obj({ amount, currency }, ["amount", "currency"]),
  ),

  postPolicies: contract(
    obj(
      {
        name: string("Policy name"),
        rules: array(
          obj(
            {
              type: { type: "string", const: "max_amount" },
              amount,
              currency,
            },
            ["type", "amount", "currency"],
          ),
        ),
        client_reference_id: clientReference,
      },
      ["name"],
    ),
  ),
  postPoliciesIdRules: contract(
    obj({ type: { type: "string", const: "max_amount" }, amount, currency }, [
      "type",
      "amount",
      "currency",
    ]),
  ),
  patchPoliciesIdRulesRid: contract(
    obj({ type: { type: "string", const: "max_amount" }, amount, currency }),
  ),
  postPoliciesIdAttach: contract(target),
  postPoliciesIdDetach: contract(target),
  postApprovalchains: contract(
    obj(
      {
        name: string("Approval-chain name"),
        threshold: money,
        approvers: array(id),
        steps: integer("Distinct approvals required", { minimum: 1 }),
        resource: target,
      },
      ["name", "threshold"],
    ),
  ),
  postApprovalsIdApprove: contract(
    obj({ comment: string("Approval comment") }),
    false,
  ),
  postApprovalsIdReject: contract(
    obj({ reason: string("Rejection reason") }),
    false,
  ),

  postOrgs: contract(
    obj(
      {
        name: string("Organisation name"),
        client_reference_id: clientReference,
      },
      ["name"],
    ),
  ),
  patchOrgsId: contract(
    obj({
      name: string("Updated organisation name"),
      client_reference_id: clientReference,
    }),
  ),
  postOrgsIdMembers: contract(
    obj(
      {
        email,
        role: {
          type: "string",
          enum: ["owner", "admin", "operator", "viewer"],
        },
      },
      ["email", "role"],
    ),
  ),

  postStatements: contract(
    obj(
      {
        account: id,
        format: { type: "string", enum: ["json", "csv"] },
        from: timestamp,
        to: timestamp,
      },
      ["account"],
    ),
  ),
  putFeesConfig: contract(obj({ payout_account: id }, ["payout_account"])),
  postQrDecode: contract(
    obj({ payload: string("EMVCo QR payload") }, ["payload"]),
  ),
  postQrGenerate: contract(
    obj(
      {
        merchant_name: string("Merchant name"),
        merchant_city: string("Merchant city"),
        country: string("ISO 3166-1 alpha-2 country", {
          pattern: "^[A-Z]{2}$",
        }),
        currency,
        amount,
        reference: string("Payment reference"),
        merchant_id: string("Merchant identifier"),
        mcc: string("Merchant category code", { pattern: "^[0-9]{4}$" }),
      },
      ["merchant_name", "merchant_city", "country", "currency"],
    ),
  ),
  postLinks: contract(
    obj(
      {
        currency,
        amount,
        description: string("Payment description"),
        reusable: boolean("Allow more than one use"),
        expires_in_seconds: integer("Link lifetime", {
          minimum: 1,
          maximum: 2592000,
        }),
        client_reference_id: clientReference,
      },
      ["currency"],
    ),
  ),
  postMandates: contract(
    obj(
      {
        customer: id,
        currency,
        scheme: string("Mandate scheme"),
        reference: string("Mandate reference"),
        max_amount: amount,
        client_reference_id: clientReference,
      },
      ["customer", "currency"],
    ),
  ),
  postSubscriptions: contract(
    obj(
      {
        customer: id,
        mandate: id,
        amount,
        currency,
        interval: { type: "string", enum: ["day", "week", "month", "year"] },
        interval_count: integer("Number of intervals between payments", {
          minimum: 1,
          maximum: 365,
        }),
        start_date: timestamp,
        client_reference_id: clientReference,
      },
      ["customer", "mandate", "amount", "currency", "interval"],
    ),
  ),

  postWebhooks: contract(
    obj(
      {
        url: string("HTTPS webhook target", { format: "uri" }),
        events: array(string("Event type or wildcard")),
        client_reference_id: clientReference,
      },
      ["url"],
    ),
  ),
  patchWebhooksId: contract(
    obj({
      url: string("Updated HTTPS target", { format: "uri" }),
      events: array(string("Event type or wildcard")),
      status: { type: "string", enum: ["enabled", "disabled"] },
    }),
  ),

  postSandboxPayments: contract(
    obj(
      {
        scenario: string("Payment scenario identifier"),
        amount,
        currency,
        account: id,
        simulation_id: id,
      },
      ["scenario", "amount", "currency"],
    ),
  ),
  postSandboxOnboarding: contract(
    obj(
      {
        scenario: string("Onboarding scenario identifier"),
        customer: id,
        simulation_id: id,
      },
      ["scenario"],
    ),
  ),
  postSandboxIdAdvance: contract(
    obj({
      outcome: { type: "string", enum: ["settle", "fail"] },
      decision: { type: "string", enum: ["approved", "declined", "withdrawn"] },
    }),
    false,
  ),
  postBuilderProjects: contract(
    obj(
      {
        name: string("Product name", { maxLength: 80 }),
        brief: string("Plain-language product brief", { maxLength: 2000 }),
        audience: string("Intended users", { maxLength: 240 }),
        markets: array(string("Market code", { example: "SG" })),
        currencies: array(currency),
        capabilities: array(
          string("Blueballs capability", { example: "accounts" }),
        ),
        rails: array(string("Configured sandbox rail", { example: "paynow" })),
        brand: obj({
          accent: string("Six-digit hexadecimal accent colour", {
            pattern: "^#[0-9A-Fa-f]{6}$",
          }),
          personality: string("Product personality", { maxLength: 120 }),
        }),
      },
      ["name", "brief", "audience"],
    ),
  ),
  patchBuilderProjectsId: contract(
    obj({
      name: string("Product name", { maxLength: 80 }),
      brief: string("Plain-language product brief", { maxLength: 2000 }),
      audience: string("Intended users", { maxLength: 240 }),
      markets: array(string("Market code")),
      currencies: array(currency),
      capabilities: array(string("Blueballs capability")),
      rails: array(string("Sandbox rail")),
      brand: obj({
        accent: string("Hex accent colour"),
        personality: string("Product personality"),
      }),
    }),
  ),
  postBuilderProjectsIdTestpayments: contract(
    obj(
      {
        from_account: id,
        amount,
        recipient: string("Test recipient name", { maxLength: 120 }),
        rail: string("Configured sandbox rail"),
      },
      ["from_account", "amount", "recipient"],
    ),
  ),
};
