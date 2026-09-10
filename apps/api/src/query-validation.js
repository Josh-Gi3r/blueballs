/** Executable query-parameter validation for the banking API. */
import { ApiError } from "./lib.js";
import { PRODUCTION_SCHEMAS } from "../../../spec/banking/openapi/production-contracts.mjs";
import { queryParametersFor } from "../../../spec/banking/openapi/query-contracts.mjs";
import { schemaErrors } from "./json-schema-lite.js";

const operationId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

function parsedValue(raw, schema) {
  if (schema.type === "integer") {
    if (!/^-?\d+$/.test(raw)) return raw;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : raw;
  }
  if (schema.type === "number") {
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return raw;
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  return raw;
}

export function validateQueryParameters(method, pattern, url) {
  const id = operationId(method, pattern);
  const contract = queryParametersFor(id);
  const allowed = new Set(Object.keys(contract));
  const seen = new Map();

  for (const [name, raw] of url.searchParams.entries()) {
    if (!allowed.has(name)) {
      throw new ApiError(
        "validation-error",
        400,
        `Unknown query parameter ${name} for ${method} ${pattern}`,
        [{ field: name, message: "query parameter is not documented for this operation", code: "unknown_parameter" }],
      );
    }
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) {
      throw new ApiError(
        "validation-error",
        400,
        `Query parameter ${name} must be supplied at most once`,
        [{ field: name, message: "duplicate query parameter", code: "duplicate_parameter" }],
      );
    }
    if (raw.length === 0) {
      throw new ApiError(
        "validation-error",
        400,
        `Query parameter ${name} must not be empty`,
        [{ field: name, message: "query parameter must not be empty", code: "empty_parameter" }],
      );
    }
    const schema = contract[name].schema;
    const value = parsedValue(raw, schema);
    const errors = schemaErrors(value, schema, PRODUCTION_SCHEMAS);
    if (errors.length) {
      throw new ApiError(
        "validation-error",
        400,
        `Query parameter ${name} does not match the contract`,
        errors.slice(0, 10).map((message) => ({
          field: name,
          message,
          code: "schema_violation",
        })),
      );
    }
  }

  for (const [name, definition] of Object.entries(contract)) {
    if (definition.required && !seen.has(name)) {
      throw new ApiError(
        "validation-error",
        400,
        `Missing required query parameter ${name}`,
        [{ field: name, message: "query parameter is required", code: "missing" }],
      );
    }
  }

  if (seen.has("starting_after") && seen.has("ending_before")) {
    throw new ApiError(
      "validation-error",
      400,
      "Use starting_after or ending_before, not both",
    );
  }

  if (id === "getRates" && seen.has("from") !== seen.has("to")) {
    throw new ApiError(
      "validation-error",
      400,
      "from and to must be supplied together when filtering rates",
    );
  }

  return url;
}
