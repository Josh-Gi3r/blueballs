#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/cards/data.ts", import.meta.url), "utf8");
const programmeIds = [...source.matchAll(/\{id:"([^"]+)"/g)].map((match) => match[1]);
const provenanceBlock = source.match(/const CARD_PROVENANCE:[\s\S]*?\n};/)?.[0] ?? "";
const provenanceIds = [...provenanceBlock.matchAll(/^\s*(?:"([^"]+)"|([a-z][a-z0-9-]*)):\s*\{/gm)].map((match) => match[1] ?? match[2]);

assert.equal(programmeIds.length, 41, "card programme count changed; review provenance intentionally");
assert.deepEqual(new Set(provenanceIds), new Set(programmeIds), "every programme needs exactly one provenance record");
for (const id of programmeIds) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = provenanceBlock.match(new RegExp(`(?:"${escaped}"|${escaped}):\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  assert.match(row, /sourceUrl:\s*"https:\/\//, `${id}: sourceUrl must be HTTPS`);
  assert.match(row, /asOf:\s*"\d{4}-\d{2}-\d{2}"/, `${id}: asOf must be YYYY-MM-DD`);
  assert.match(row, /jurisdiction:\s*"[^"]+"/, `${id}: jurisdiction is required`);
  assert.match(row, /confidence:\s*"(?:high|medium|low)"/, `${id}: confidence is required`);
}
console.log(`card provenance: ${programmeIds.length}/${programmeIds.length} programmes have source, date, jurisdiction and confidence`);
