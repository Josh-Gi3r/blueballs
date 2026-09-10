/** Effective operation-level response contracts used by published OpenAPI and runtime validation. */
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  responseContractFor as legacyResponseContractFor,
} from "./response-contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const LIST_OVERRIDES = {
  getCountries: "Country",
  getCurrencies: "CurrencyReference",
  getNetworks: "Network",
};

const EXAMPLE_OVERRIDES = {
  postAuthSignup: {
    id: "key_example",
    tenant_id: "ten_example",
    email: "builder@example.test",
    scope: "sandbox",
    created_at: "2026-09-10T00:00:00.000Z",
    expires: "2026-09-11T00:00:00.000Z",
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
    created_at: "2026-09-10T00:00:00.000Z",
  },
  getLinksId: {
    id: "lnk_example",
    object: "payment_link",
    url: "https://blueballs.tech/pay/lnk_example",
    amount: "29.00",
    currency: "EUR",
    status: "active",
    expires_at: "2026-09-17T00:00:00.000Z",
    created_at: "2026-09-10T00:00:00.000Z",
  },
  postWebhooksDeliveriesDidReplay: {
    id: "whd_example",
    webhook: "whk_example",
    event_id: "evt_example",
    event_type: "transfer.created",
    status: "pending",
    attempt_count: 0,
    response_code: null,
    attempted_at: null,
    next_attempt_at: "2026-09-10T00:00:00.000Z",
  },
};

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
    };
  }
  return EXAMPLE_OVERRIDES[input.operationId]
    ? { ...base, example: EXAMPLE_OVERRIDES[input.operationId] }
    : base;
}

export { PAGINATED_RESPONSE_OPERATIONS, RESPONSE_LIST_OPERATIONS };
