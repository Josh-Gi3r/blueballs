#!/usr/bin/env node
import { FAMILIES } from "../src/endpoints.ts";
import { SANDBOX_ONLY_OPERATIONS } from "../spec/banking/operation-modes.mjs";

const catalogue = new Set(
  FAMILIES.flatMap((family) =>
    family.endpoints.map((endpoint) => `${endpoint.verb} ${endpoint.path}`),
  ),
);
const failures = [];
for (const operation of SANDBOX_ONLY_OPERATIONS) {
  if (!catalogue.has(operation)) failures.push(`${operation}: not in catalogue`);
}

if (failures.length) {
  console.error(`operation-mode contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `operation modes: ${SANDBOX_ONLY_OPERATIONS.size} sandbox-only catalogue operations fail closed in production`,
);
