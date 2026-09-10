/** Operation-accurate query parameter contracts for the banking API.
 *
 * Query behavior is public API surface. A handler must not silently accept a
 * filter that OpenAPI does not describe, and unknown parameters are rejected at
 * the runtime boundary rather than ignored.
 */
import { PAGINATED_RESPONSE_OPERATIONS } from "./production-response-contracts.mjs";

const parameter = (schema, required = false) => ({ schema, required });
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
  limit: parameter(
    integer("Maximum number of rows", {
      minimum: 1,
      maximum: 100,
      default: 25,
    }),
  ),
  starting_after: parameter(string("Return rows after this resource id")),
  ending_before: parameter(string("Return rows immediately before this resource id")),
});

const CUSTOM = Object.freeze({
  getCards: {
    customer: parameter(string("Filter cards by customer id")),
    account: parameter(string("Filter cards by funding account id")),
    status: parameter(string("Filter cards by lifecycle status")),
  },
  getAuthorisations: {
    card: parameter(string("Filter authorisations by card id")),
    status: parameter(string("Filter authorisations by decision/settlement state")),
  },
  getDisputes: {
    card: parameter(string("Filter disputes by card id")),
    status: parameter(string("Filter disputes by dispute state")),
  },
  getApprovals: {
    status: parameter(string("Approval status; use all to include terminal records")),
  },
  getLedger: {
    account: parameter(string("Filter ledger rows by account id")),
  },
  getLedgerBalances: {
    account: parameter(string("Filter balance rows by account id")),
  },
  getRailsIdCalendar: {
    days: parameter(
      integer("Number of calendar days to return", {
        minimum: 1,
        maximum: 90,
        default: 30,
      }),
    ),
  },
  getRates: {
    from: parameter(
      string("Source currency filter. Must be supplied together with to.", {
        pattern: "^[A-Za-z0-9]{3,12}$",
      }),
    ),
    to: parameter(
      string("Destination currency filter. Must be supplied together with from.", {
        pattern: "^[A-Za-z0-9]{3,12}$",
      }),
    ),
  },
  getFxDepth: {
    pair: parameter(
      string("Optional exact stablecoin pair", {
        pattern: "^[A-Za-z0-9]{3,12}/[A-Za-z0-9]{3,12}$",
      }),
    ),
  },
  getFxPrice: {
    from: parameter(
      string("Source stablecoin", {
        pattern: "^[A-Za-z0-9]{3,12}$",
      }),
      true,
    ),
    to: parameter(
      string("Destination stablecoin", {
        pattern: "^[A-Za-z0-9]{3,12}$",
      }),
      true,
    ),
    size: parameter(
      string("Optional quote size as an exact decimal string", {
        pattern: "^[0-9]+(?:\\.[0-9]+)?$",
      }),
    ),
  },
  // These compatibility collections predate cursor pagination. Their limit is
  // still documented and validated rather than pretending it is a cursor API.
  getRamps: {
    limit: parameter(
      integer("Maximum number of rows", {
        minimum: 1,
        maximum: 100,
        default: 25,
      }),
    ),
  },
  getFxRfq: {
    limit: parameter(
      integer("Maximum number of rows", {
        minimum: 1,
        maximum: 100,
        default: 25,
      }),
    ),
  },
  getFxIntents: {
    limit: parameter(
      integer("Maximum number of rows", {
        minimum: 1,
        maximum: 100,
        default: 25,
      }),
    ),
  },
  getFxFills: {
    limit: parameter(
      integer("Maximum number of rows", {
        minimum: 1,
        maximum: 100,
        default: 25,
      }),
    ),
  },
  getFxLpEarnings: {
    limit: parameter(
      integer("Maximum number of rows", {
        minimum: 1,
        maximum: 100,
        default: 25,
      }),
    ),
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
