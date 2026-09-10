/** Runtime success-response contract validation used by the release/test gate. */
import { FAMILIES } from "../../../src/endpoints.ts";
import { ADAPTER_REQUIRED_OPERATIONS } from "../../../spec/banking/openapi/contracts.mjs";
import { PRODUCTION_SCHEMAS } from "../../../spec/banking/openapi/production-contracts.mjs";
import { responseContractFor } from "../../../spec/banking/openapi/production-response-contracts.mjs";
import { schemaErrors } from "./json-schema-lite.js";

const operationId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const catalogue = new Map();
for (const family of FAMILIES) {
  for (const endpoint of family.endpoints) {
    catalogue.set(`${endpoint.verb} ${endpoint.path}`, {
      ...endpoint,
      family: family.name,
      operationId: operationId(endpoint.verb, endpoint.path),
    });
  }
}

export function publicResponse(value) {
  if (Array.isArray(value)) return value.map(publicResponse);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "owner")
      .map(([key, child]) => [key, publicResponse(child)]),
  );
}

export function validateSuccessfulResponse(method, pattern, value) {
  const endpoint = catalogue.get(`${method} ${pattern}`);
  const clean = publicResponse(value);
  if (!endpoint || ADAPTER_REQUIRED_OPERATIONS.has(endpoint.operationId)) return clean;
  const contract = responseContractFor({
    operationId: endpoint.operationId,
    verb: endpoint.verb,
    family: endpoint.family,
  });
  const errors = schemaErrors(clean, contract.schema, PRODUCTION_SCHEMAS);
  if (errors.length) {
    const error = new Error(
      `Response contract violation for ${method} ${pattern} (${endpoint.operationId}): ${errors.slice(0, 8).join("; ")}`,
    );
    error.code = "RESPONSE_CONTRACT_VIOLATION";
    error.contractErrors = errors;
    throw error;
  }
  return clean;
}

export function validateSchemaExample(schema, value) {
  return schemaErrors(value, schema, PRODUCTION_SCHEMAS);
}
