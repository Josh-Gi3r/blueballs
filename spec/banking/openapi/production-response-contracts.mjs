/** Final operation-level response contracts consumed by OpenAPI and runtime validation. */
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  responseContractFor as effectiveResponseContractFor,
} from "./effective-response-contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const T = "2026-09-10T00:00:00.000Z";

const keyPrincipal = {
  id: "key_example",
  tenant_id: "ten_example",
  email: "builder@example.test",
  scope: "sandbox",
  permissions: ["*"],
  created_at: T,
  expires: "2026-09-11T00:00:00.000Z",
};

const receivingDetail = {
  id: "adt_example",
  account: "acc_example",
  rail: "sepa",
  currency: "EUR",
  status: "active",
  type: "iban",
  iban: "DE02120300000000202051",
  bic: "BLBLDEB2",
  created_at: T,
};

const OVERRIDES = {
  postAuthSignup: {
    description: "Sandbox key issued once",
    schema: ref("KeySecret"),
    example: {
      ...keyPrincipal,
      key: "bb_sandbox_returned_once",
      note: "This is the only time the key is shown.",
    },
  },
  postKeys: {
    description: "API key issued once",
    schema: ref("KeySecret"),
    example: {
      ...keyPrincipal,
      permissions: ["identity:read"],
      key: "bb_sandbox_returned_once",
      note: "This is the only time the key is shown.",
    },
  },
  getKeys: {
    description: "Paginated auth & api keys collection",
    schema: {
      type: "object",
      additionalProperties: true,
      required: ["data"],
      properties: {
        object: { type: "string", const: "list" },
        data: { type: "array", items: ref("KeyPrincipal") },
        has_more: { type: "boolean" },
        next_cursor: { type: ["string", "null"] },
      },
    },
    example: {
      object: "list",
      data: [keyPrincipal],
      current: {
        key_id: keyPrincipal.id,
        tenant_id: keyPrincipal.tenant_id,
        scope: keyPrincipal.scope,
        permissions: ["*"],
      },
      has_more: false,
      next_cursor: null,
    },
  },
  getKeysId: {
    description: "API key principal",
    schema: ref("KeyPrincipal"),
    example: keyPrincipal,
  },
  postAccountsIdDetails: {
    description: "Receiving details issued for an account rail",
    schema: ref("ReceivingDetail"),
    example: receivingDetail,
  },
  getDetailsId: {
    description: "Receiving details",
    schema: ref("ReceivingDetail"),
    example: receivingDetail,
  },
  getAccountsIdDetails: {
    description: "Paginated receiving details collection",
    schema: {
      type: "object",
      additionalProperties: true,
      required: ["data"],
      properties: {
        object: { type: "string", const: "list" },
        data: { type: "array", items: ref("ReceivingDetail") },
        has_more: { type: "boolean" },
        next_cursor: { type: ["string", "null"] },
      },
    },
    example: {
      object: "list",
      data: [receivingDetail],
      has_more: false,
      next_cursor: receivingDetail.id,
    },
  },
  postApplicationsIdAttestation: {
    description: "Application attestation",
    schema: ref("Attestation"),
    example: {
      id: "att_example",
      statement: "I confirm the information is accurate",
      agreed: true,
      agreed_at: T,
    },
  },
  postApprovalchains: {
    description: "Approval chain",
    schema: ref("ApprovalChain"),
    example: {
      id: "apc_example",
      name: "Two-person treasury approval",
      threshold: { amount: "1000.00", currency: "EUR" },
      approvers: ["key_one", "key_two"],
      steps: 2,
      resource: null,
      created_at: T,
    },
  },
  getApprovalchainsId: {
    description: "Approval chain",
    schema: ref("ApprovalChain"),
    example: {
      id: "apc_example",
      name: "Two-person treasury approval",
      threshold: { amount: "1000.00", currency: "EUR" },
      approvers: ["key_one", "key_two"],
      steps: 2,
      resource: null,
      created_at: T,
    },
  },
  deleteAccountsId: {
    description: "Closed account",
    schema: ref("Account"),
    example: {
      id: "acc_example",
      customer: "cus_example",
      currency: "EUR",
      type: "holding",
      status: "closed",
      balance: { amount: "0.00", currency: "EUR" },
      created_at: T,
    },
  },
  deleteVaultsId: {
    description: "Closed vault",
    schema: ref("Vault"),
    example: {
      id: "vlt_example",
      account: "acc_example",
      currency: "EUR",
      name: "Savings vault",
      rate: 0.03,
      status: "closed",
      balance: { amount: "0.00", currency: "EUR" },
      accrued_interest: { amount: "0.00", currency: "EUR" },
      created_at: T,
    },
  },
};

export function responseContractFor(input) {
  return OVERRIDES[input.operationId] ?? effectiveResponseContractFor(input);
}

export { PAGINATED_RESPONSE_OPERATIONS, RESPONSE_LIST_OPERATIONS };
