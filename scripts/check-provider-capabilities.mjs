#!/usr/bin/env node
/** Keep production provider intent, outcome and documentation surfaces in lockstep. */
import { readFileSync } from "node:fs";
import {
  PROVIDER_CAPABILITY_KEYS,
  PROVIDER_INBOUND_EVENTS,
} from "../spec/provider-capabilities.mjs";

const intentSource = readFileSync(
  "apps/api/src/production-provider-intents.js",
  "utf8",
);
const outcomeSource = readFileSync(
  "apps/api/src/production-provider-outcomes.js",
  "utf8",
);
const inboundSource = readFileSync("apps/api/src/provider-inbound.js", "utf8");
const docs = readFileSync("docs/PROVIDER-GATEWAY.md", "utf8");

const queued = new Set(
  [...intentSource.matchAll(/capability:\s*["']([^"']+)["'][\s\S]{0,160}?action:\s*["']([^"']+)["']/g)].map(
    (match) => `${match[1]}:${match[2]}`,
  ),
);
const handled = new Set(
  [...outcomeSource.matchAll(/registerProviderOutcomeHandler\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g)].map(
    (match) => `${match[1]}:${match[2]}`,
  ),
);
const declared = new Set(PROVIDER_CAPABILITY_KEYS);

const diff = (left, right) => [...left].filter((value) => !right.has(value)).sort();
const problems = [];
for (const value of diff(declared, queued))
  problems.push(`declared provider capability is never queued: ${value}`);
for (const value of diff(queued, declared))
  problems.push(`provider intent uses undeclared capability: ${value}`);
for (const value of diff(declared, handled))
  problems.push(`declared provider capability has no outcome handler: ${value}`);
for (const value of diff(handled, declared))
  problems.push(`provider outcome handler is undeclared: ${value}`);

for (const key of declared) {
  const [capability, action] = key.split(":");
  if (!docs.includes(`\`${capability}\``) || !docs.includes(`\`${action}\``)) {
    problems.push(`provider capability missing from docs: ${key}`);
  }
}
for (const type of PROVIDER_INBOUND_EVENTS) {
  if (!inboundSource.includes(`"${type}"`))
    problems.push(`declared inbound provider event missing from runtime: ${type}`);
  if (!docs.includes(`\`${type}\``))
    problems.push(`inbound provider event missing from docs: ${type}`);
}

if (problems.length) {
  console.error("Provider capability contract drift:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `provider capability contract matches runtime: ${declared.size} outbound capabilities · ${PROVIDER_INBOUND_EVENTS.length} inbound event types`,
);
