/** Runtime success-response contract validation used by the release/test gate. */
import { FAMILIES } from "../../../src/endpoints.ts";
import { ADAPTER_REQUIRED_OPERATIONS } from "../../../spec/banking/openapi/contracts.mjs";
import { PRODUCTION_SCHEMAS } from "../../../spec/banking/openapi/production-contracts.mjs";
import { responseContractFor } from "../../../spec/banking/openapi/production-response-contracts.mjs";

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

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validateFormat(value, format) {
  if (format === "date-time") return Number.isFinite(Date.parse(value));
  if (format === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try { new URL(value); return true; } catch { return false; }
  }
  if (format === "uri-reference") return typeof value === "string" && value.length > 0;
  return true;
}

function dereference(schema) {
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) throw new Error(`Unsupported response schema ref ${schema.$ref}`);
  const name = schema.$ref.slice(prefix.length);
  const resolved = PRODUCTION_SCHEMAS[name];
  if (!resolved) throw new Error(`Unknown response schema ${name}`);
  return resolved;
}

function errorsFor(value, inputSchema, path = "$") {
  const schema = dereference(inputSchema);
  if (!schema) return [`${path}: missing schema`];

  if (schema.anyOf) {
    const alternatives = schema.anyOf.map((candidate) => errorsFor(value, candidate, path));
    return alternatives.some((errors) => errors.length === 0)
      ? []
      : [`${path}: did not match any allowed schema`];
  }

  if (schema.const !== undefined && value !== schema.const)
    return [`${path}: expected constant ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`];
  if (schema.enum && !schema.enum.includes(value))
    return [`${path}: expected one of ${schema.enum.map(String).join(", ")}, got ${JSON.stringify(value)}`];

  const allowedTypes = schema.type === undefined
    ? null
    : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (allowedTypes && !allowedTypes.some((type) => typeMatches(value, type))) {
    return [`${path}: expected ${allowedTypes.join("|")}, got ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}`];
  }

  if (value === null) return [];
  const errors = [];

  if (typeof value === "string") {
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${path}: value does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    if (schema.format && !validateFormat(value, schema.format)) errors.push(`${path}: invalid ${schema.format}`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${path}: must be > ${schema.exclusiveMinimum}`);
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...errorsFor(item, schema.items, `${path}[${index}]`)));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push(`${path}.${required}: required property missing`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) errors.push(...errorsFor(child, properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: undocumented property`);
    }
  }

  return errors;
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
  const errors = errorsFor(clean, contract.schema);
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
  return errorsFor(value, schema);
}
