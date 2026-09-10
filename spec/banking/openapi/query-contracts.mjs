/** Operation-accurate query parameter contracts for the banking API.
 *
 * Query behavior is public API surface. A handler must not silently accept a
 * filter that OpenAPI does not describe, and unknown parameters are rejected at
 * the runtime boundary rather than ignored.
 */
import { PAGINATED_RESPONSE_OPERATIONS } from "./production-response-contracts.mjs";

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

export const PAGINATION_PARAMETERS = Object.freeze({
  limit: integer("Maximum number of rows", {
    minimum: 1,
    maximum: 100,
    default: 25,
  }),
  starting_after: string("Return rows after this resource id"),
  ending_before: string("Return rows immediately before this resource id"),
});

const CUSTOM = Object.freeze({
  getCards: {
    customer: string("Filter cards by customer id"),
    account: string("Filter cards by funding account id"),
    status: string("Filter cards by lifecycle status"),
  },
  getAuthorisations: {
    card: string("Filter authorisations by card id"),
    status: string("Filter authorisations by decision/settlement state"),
  },
  getDisputes: {
    card: string("Filter disputes by card id"),
    status: string("Filter disputes by dispute state"),
  },
  getApprovals: {
    status: string("Approval status; use all to include terminal records"),
  },
  getLedger: {
    account: string("Filter ledger rows by account id"),
  },
  getLedgerBalances: {
    account: string("Filter balance rows by account id"),
  },
  getRailsIdCalendar: {
    days: integer("Number of calendar days to return", {
      minimum: 1,
      maximum: 90,
      default: 30,
    }),
  },
  getRates: {
    from: string("Optional source currency filter", {
      pattern: "^[A-Za-z0-9]{3,12}$",
    }),
    to: string("Optional destination currency filter", {
      pattern: "^[A-Za-z0-9]{3,12}$",
    }),
  },
  getFxDepth: {
    pair: string("Optional exact stablecoin pair", {
      pattern: "^[A-Za-z0-9]{3,12}/[A-Za-z0-9]{3,12}$",
    }),
  },
  getFxPrice: {
    from: string("Source stablecoin", {
      pattern: "^[A-Za-z0-9]{3,12}$",
    }),
    to: string("Destination stablecoin", {
      pattern: "^[A-Za-z0-9]{3,12}$",
    }),
    size: string("Optional quote size as an exact decimal string", {
      pattern: "^[0-9]+(?:\\.[0-9]+)?$",
    }),
  },
  // These compatibility collections predate cursor pagination. Their limit is
  // still documented and validated rather than pretending it is a cursor API.
  getRamps: {
    limit: integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  },
  getFxRfq: {
    limit: integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  },
  getFxIntents: {
    limit: integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  },
  getFxFills: {
    limit: integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  },
  getFxLpEarnings: {
    limit: integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  },
});

export function queryParametersFor(operationId) {
  return Object.freeze({
    ...(PAGINATED_RESPONSE_OPERATIONS.has(operationId)
      ? PAGINATION_PARAMETERS
      : {}),
    ...(CUSTOM[operationId] ?? {}),
  });
}

export const CUSTOM_QUERY_OPERATIONS = Object.freeze(Object.keys(CUSTOM));
