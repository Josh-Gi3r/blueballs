#!/usr/bin/env node
/** Fail when persisted banking collections drift from the versioned schema. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BANKING_COLLECTION_TABLES } from "../apps/api/src/schema.js";

const SRC = "apps/api/src";
const files = [
  ...readdirSync(SRC)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(SRC, name)),
  ...readdirSync(join(SRC, "routes"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(SRC, "routes", name)),
];

const referenced = new Set();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bcollection\(\s*["']([^"']+)["']\s*\)/g)) {
    referenced.add(match[1]);
  }
  for (const match of source.matchAll(/\bnew\s+PersistentMap\(\s*["']([^"']+)["']\s*\)/g)) {
    referenced.add(match[1]);
  }

  // auditRecords is intentionally not a PersistentMap: the runtime exposes an
  // append-only adapter with no update/delete API. Still treat that dedicated
  // adapter as a concrete schema reference so the registry gate remains exact.
  if (/\bnew\s+PersistentAuditLog\(\s*\)/.test(source)) {
    referenced.add("auditRecords");
  }
}

const declared = new Set(BANKING_COLLECTION_TABLES);
const missingFromSchema = [...referenced].filter((name) => !declared.has(name)).sort();
const unusedInRuntime = [...declared].filter((name) => !referenced.has(name)).sort();

if (missingFromSchema.length || unusedInRuntime.length) {
  if (missingFromSchema.length) {
    console.error("Persisted collections missing from versioned schema:");
    for (const name of missingFromSchema) console.error(`  ${name}`);
  }
  if (unusedInRuntime.length) {
    console.error("Versioned schema collections not referenced by runtime:");
    for (const name of unusedInRuntime) console.error(`  ${name}`);
  }
  process.exit(1);
}

console.log(
  `banking schema registry matches runtime: ${declared.size} durable JSON collections + ledger/events`,
);
