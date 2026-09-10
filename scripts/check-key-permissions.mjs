#!/usr/bin/env node
/** Every authenticated tenant operation must have an explicit least-privilege permission. */
import { FAMILIES } from "../src/endpoints.ts";
import {
  KEY_PERMISSION_DOMAINS,
  KEY_PERMISSIONS,
} from "../spec/banking/key-permission-catalog.mjs";

const DOMAIN_RULES = [
  [/^\/v2\/keys(?:\/|$)/, "keys"],
  [/^\/v2\/(?:customers|applications)(?:\/|$)/, "identity"],
  [/^\/v2\/(?:accounts|details)(?:\/|$)/, "accounts"],
  [/^\/v2\/wallets(?:\/|$)/, "wallets"],
  [/^\/v2\/(?:recipients|destinations|transfers|qr|links|mandates|subscriptions)(?:\/|$)/, "payments"],
  [/^\/v2\/(?:fx|ramps)(?:\/|$)/, "fx"],
  [/^\/v2\/(?:cards|authorisations|disputes)(?:\/|$)/, "cards"],
  [/^\/v2\/(?:vaults|credit)(?:\/|$)/, "lending"],
  [/^\/v2\/(?:policies|approval-chains|approvals|orgs)(?:\/|$)/, "controls"],
  [/^\/v2\/(?:ledger|statements|fees)(?:\/|$)/, "ledger"],
  [/^\/v2\/(?:webhooks|events)(?:\/|$)/, "webhooks"],
  [/^\/v2\/(?:builder|sandbox)(?:\/|$)/, "sandbox"],
];

const failures = [];
const seenDomains = new Set();
for (const family of FAMILIES) {
  for (const endpoint of family.endpoints) {
    if (!["TENANT", "GLOBAL_READ"].includes(endpoint.access)) continue;
    const matches = DOMAIN_RULES.filter(([rule]) => rule.test(endpoint.path));
    if (matches.length !== 1) {
      failures.push(
        `${endpoint.verb} ${endpoint.path}: expected exactly one permission domain, got ${matches.length}`,
      );
      continue;
    }
    const domain = matches[0][1];
    seenDomains.add(domain);
    const permission = `${domain}:${endpoint.verb === "GET" ? "read" : "write"}`;
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
