#!/usr/bin/env node
/** Fail when route code reads query parameters that the executable OpenAPI
 * contract does not declare, or when a custom query contract has no live route. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES } from "../src/endpoints.ts";
import {
  CUSTOM_QUERY_OPERATIONS,
  queryParametersFor,
} from "../spec/banking/openapi/query-contracts.mjs";

const routeDir = "apps/api/src/routes";
const files = [
  ...readdirSync(routeDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(routeDir, name)),
  "apps/api/src/server.js",
];

const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const catalogue = new Set(
  FAMILIES.flatMap(({ endpoints }) =>
    endpoints.map(({ verb, path }) => opId(verb, path)),
  ),
);
const failures = [];
const runtimeCustom = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const registrations = [
    ...source.matchAll(/route\(\s*["']([A-Z]+)["']\s*,\s*["']([^"']+)["']/g),
  ];
  for (let index = 0; index < registrations.length; index++) {
    const registration = registrations[index];
    const [, verb, path] = registration;
    const operationId = opId(verb, path);
    const block = source.slice(
      registration.index,
      registrations[index + 1]?.index ?? source.length,
    );
    const reads = new Set(
      [...block.matchAll(/\.searchParams\.get\(\s*["']([^"']+)["']\s*\)/g)].map(
        (match) => match[1],
      ),
    );
    const documented = queryParametersFor(operationId);
    for (const name of reads) {
      if (!(name in documented)) {
        failures.push(
          `${verb} ${path}: runtime reads undocumented query parameter ${name}`,
        );
      }
    }
    runtimeCustom.set(operationId, reads);
  }
}

for (const operationId of CUSTOM_QUERY_OPERATIONS) {
  if (!catalogue.has(operationId)) {
    failures.push(`${operationId}: custom query contract exists for no catalogue operation`);
    continue;
  }
  const documented = queryParametersFor(operationId);
  const runtimeReads = runtimeCustom.get(operationId) ?? new Set();
  // Pagination parameters may be consumed indirectly by paginate(). Everything
  // else in a custom contract should be visible in that operation's route code.
  for (const name of Object.keys(documented)) {
    if (["limit", "starting_after", "ending_before"].includes(name)) continue;
    if (!runtimeReads.has(name)) {
      failures.push(
        `${operationId}: documents custom query parameter ${name} but runtime does not read it`,
      );
    }
  }
}

if (failures.length) {
  console.error(`query-contract drift (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `query contracts: ${CUSTOM_QUERY_OPERATIONS.length} custom-filter operations plus shared cursor pagination match runtime`,
);
