/** Final operation-level response contracts consumed by OpenAPI and runtime validation. */
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  responseContractFor as effectiveResponseContractFor,
} from "./effective-response-contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const T = "2026-09-10T00:00:00.000Z";

const OVERRIDES = {
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
