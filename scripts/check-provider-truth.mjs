#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providers = readFileSync(new URL("../src/ecosystem/providers.ts", import.meta.url), "utf8");
for (const id of ["dakota", "bridge"]) {
  assert.match(providers, new RegExp(`id: "${id}"[\\s\\S]{0,1000}technicalStatus: "Included descriptor"`));
  const descriptor = JSON.parse(readFileSync(new URL(`../docs/partners/descriptors/${id}.json`, import.meta.url), "utf8"));
  assert.equal(descriptor.relationship, "none-claimed");
  assert.equal(descriptor.technicalMaturity, "included-not-connected");
  assert.equal(descriptor.implemented, false);
  assert.equal(descriptor.networkCalls, 0);
  assert.ok(descriptor.sources.every((source) => source.startsWith("https://")));
}
assert.doesNotMatch(providers, /relationshipStatus:\s*"partner/i);
console.log("provider truth: Dakota and Bridge are included descriptors, not connections or relationships");
