#!/usr/bin/env node
/** Every authenticated tenant operation must have an explicit least-privilege permission. */
import { FAMILIES } from "../src/endpoints.ts";
import {
  KEY_PERMISSION_DOMAINS,
  KEY_PERMISSIONS,
  PERMISSION_ROUTE_RULES,
  permissionDomainForRoute,
  permissionForRoute,
} from "../spec/banking/key-permission-catalog.mjs";

const failures = [];
const seenDomains = new Set();
for (const family of FAMILIES) {
  for (const endpoint of family.endpoints) {
    if (!["TENANT", "GLOBAL_READ"].includes(endpoint.access)) continue;
    const matches = PERMISSION_ROUTE_RULES.filter(([rule]) =>
      rule.test(endpoint.path),
    );
    if (matches.length !== 1) {
      failures.push(
        `${endpoint.verb} ${endpoint.path}: expected exactly one permission domain, got ${matches.length}`,
      );
      continue;
    }
    const domain = permissionDomainForRoute(endpoint.path);
    const permission = permissionForRoute(endpoint.verb, endpoint.path);
    seenDomains.add(domain);
    if (!KEY_PERMISSIONS.includes(permission)) {
      failures.push(`${endpoint.verb} ${endpoint.path}: unknown permission ${permission}`);
    }
  }
}

for (const domain of KEY_PERMISSION_DOMAINS) {
  if (!seenDomains.has(domain)) failures.push(`permission domain ${domain} is unused`);
}

if (failures.length) {
  console.error(`key permission coverage failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `key permissions cover every TENANT/GLOBAL_READ catalogue operation across ${seenDomains.size} domains`,
);
