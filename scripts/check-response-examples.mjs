#!/usr/bin/env node
import { FAMILIES } from "../src/endpoints.ts";
import { ADAPTER_REQUIRED_OPERATIONS } from "../spec/banking/openapi/contracts.mjs";
import { responseContractFor } from "../spec/banking/openapi/production-response-contracts.mjs";
import { validateSchemaExample } from "../apps/api/src/response-validation.js";

const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const failures = [];
let checked = 0;
for (const family of FAMILIES) {
  for (const endpoint of family.endpoints) {
    const operationId = opId(endpoint.verb, endpoint.path);
    if (ADAPTER_REQUIRED_OPERATIONS.has(operationId)) continue;
    const contract = responseContractFor({
      operationId,
      verb: endpoint.verb,
      family: family.name,
    });
    const errors = validateSchemaExample(contract.schema, contract.example);
    checked += 1;
    if (errors.length) failures.push(`${operationId}: ${errors.slice(0, 5).join("; ")}`);
  }
}

if (failures.length) {
  console.error(`response examples violate their schemas (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`response examples: ${checked} schema-valid success examples`);
