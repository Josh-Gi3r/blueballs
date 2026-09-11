#!/usr/bin/env node
/** Keep production provider intent, outcome, deterministic fixtures and docs in lockstep. */
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
const fakeAdapter = readFileSync(
  "apps/api/test/helpers/fake-provider.js",
  "utf8",
);
const conformance = readFileSync(
  "apps/api/test/provider-conformance.test.js",
  "utf8",
);
const docs = readFileSync("docs/PROVIDER-GATEWAY.md", "utf8");
const conformanceDocs = readFileSync("docs/PROVIDER-CONFORMANCE.md", "utf8");

const queued = new Set(
  [
    ...intentSource.matchAll(
      /capability:\s*["']([^"']+)["'][\s\S]{0,160}?action:\s*["']([^"']+)["']/g,
    ),
  ].map((match) => `${match[1]}:${match[2]}`),
);
const handled = new Set(
  [
    ...outcomeSource.matchAll(
      /registerProviderOutcomeHandler\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g,
    ),
  ].map((match) => `${match[1]}:${match[2]}`),
);
const declared = new Set(PROVIDER_CAPABILITY_KEYS);

const diff = (left, right) =>
  [...left].filter((value) => !right.has(value)).sort();
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
    problems.push(`provider capability missing from gateway docs: ${key}`);
  }
  if (!conformanceDocs.includes(`\`${capability}\``)) {
    problems.push(`provider capability missing from conformance docs: ${key}`);
  }
  if (!fakeAdapter.includes(`case "${key}"`)) {
    problems.push(`provider capability missing deterministic fake adapter: ${key}`);
  }
}
for (const type of PROVIDER_INBOUND_EVENTS) {
  if (!inboundSource.includes(`"${type}"`))
    problems.push(`declared inbound provider event missing from runtime: ${type}`);
  if (!docs.includes(`\`${type}\``) && !conformanceDocs.includes(`\`${type}\``))
    problems.push(`inbound provider event missing from docs: ${type}`);
}

if (!conformance.includes("PROVIDER_CAPABILITIES")) {
  problems.push("provider conformance test does not iterate the declared capability contract");
}
if (!inboundSource.includes("verifyProviderInboundBody")) {
  problems.push("provider inbound settlement is not protected by dedicated signed evidence");
}
if (!conformanceDocs.includes("BANK_PROVIDER_INBOUND_SECRET")) {
  problems.push("provider inbound signing secret is missing from conformance docs");
}

if (problems.length) {
  console.error("Provider capability contract drift:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `provider capability contract matches runtime and deterministic fixtures: ${declared.size} outbound capabilities · ${PROVIDER_INBOUND_EVENTS.length} inbound event types`,
);
