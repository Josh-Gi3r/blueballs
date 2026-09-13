#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  const index = source.indexOf(from);
  assert.notEqual(index, -1, `${path}: expected source fragment missing`);
  assert.equal(
    source.indexOf(from, index + from.length),
    -1,
    `${path}: expected source fragment is not unique`,
  );
  fs.writeFileSync(path, source.slice(0, index) + to + source.slice(index + from.length));
  console.log(`patched ${path}`);
}

// Persistent resources are JSON-shaped, but tracked child objects can be Proxies.
// structuredClone rejects Proxies, so snapshots and assignments must recursively
// unwrap tracked values before they enter the durable cache or rollback journal.
replaceOnce(
  "apps/api/src/lib.js",
  `function unwrap(value) {\n  return value !== null && typeof value === "object" && value[RAW] !== undefined\n    ? value[RAW]\n    : value;\n}\n\nfunction snapshotOnce(store, map, id, root = MISSING) {`,
  `function unwrap(value) {\n  return value !== null && typeof value === "object" && value[RAW] !== undefined\n    ? value[RAW]\n    : value;\n}\n\nfunction clonePersistentValue(value, seen = new Map()) {\n  const raw = unwrap(value);\n  if (raw === null || typeof raw !== "object") return raw;\n  if (raw instanceof Date) return new Date(raw);\n  if (Buffer.isBuffer(raw)) return Buffer.from(raw);\n  if (seen.has(raw)) return seen.get(raw);\n\n  if (!Array.isArray(raw)) {\n    const prototype = Object.getPrototypeOf(raw);\n    if (prototype !== Object.prototype && prototype !== null) {\n      return structuredClone(raw);\n    }\n  }\n\n  const copy = Array.isArray(raw) ? [] : {};\n  seen.set(raw, copy);\n  for (const [key, nested] of Object.entries(raw)) {\n    copy[key] = clonePersistentValue(nested, seen);\n  }\n  return copy;\n}\n\nfunction snapshotOnce(store, map, id, root = MISSING) {`,
);
replaceOnce(
  "apps/api/src/lib.js",
  `    rows.set(id, root === MISSING ? MISSING : structuredClone(root));`,
  `    rows.set(id, root === MISSING ? MISSING : clonePersistentValue(root));`,
);
replaceOnce(
  "apps/api/src/lib.js",
  `      const ok = Reflect.set(target, prop, unwrap(next), receiver);`,
  `      const ok = Reflect.set(target, prop, clonePersistentValue(next), receiver);`,
);
replaceOnce(
  "apps/api/src/lib.js",
  `  set(id, value) {\n    const row = unwrap(value);`,
  `  set(id, value) {\n    const row = clonePersistentValue(value);`,
);

// This is an atomicity test, not a schema-extension test. Use an existing migrated
// collection so isolated databases preserve the migration-authoritative boundary.
replaceOnce(
  "apps/api/test/request-atomicity.test.js",
  `const { collection, db, emit, inRequestScope, post } = await import("../src/lib.js");\nconst commands = collection("request_atomicity_commands");`,
  `const { db, emit, inRequestScope, post } = await import("../src/lib.js");\nconst commands = db.quotes;`,
);

// Statements deliberately serialize omitted date bounds as null. Publish that
// nullable shape instead of turning valid responses into contract-violation 500s.
replaceOnce(
  "spec/banking/openapi/contracts.mjs",
  `      from: string("Inclusive statement date", { format: "date" }),\n      to: string("Inclusive statement date", { format: "date" }),`,
  `      from: {\n        anyOf: [\n          string("Inclusive statement date", { format: "date" }),\n          { type: "null" },\n        ],\n      },\n      to: {\n        anyOf: [\n          string("Inclusive statement date", { format: "date" }),\n          { type: "null" },\n        ],\n      },`,
);

// Builder responses already expose plan/resources/updated_at. Keep the published
// schema aligned with the stable runtime shape rather than rejecting those fields.
replaceOnce(
  "spec/banking/openapi/contracts.mjs",
  `      environment: { type: ["object", "null"], additionalProperties: true },\n      customers: {`,
  `      environment: { type: ["object", "null"], additionalProperties: true },\n      plan: { type: "object", additionalProperties: true },\n      resources: { type: "object", additionalProperties: true },\n      updated_at: { $ref: "#/components/schemas/Timestamp" },\n      customers: {`,
);
replaceOnce(
  "spec/banking/openapi/contracts.mjs",
  `      "environment",\n      "customers",`,
  `      "environment",\n      "plan",\n      "resources",\n      "updated_at",\n      "customers",`,
);

// This test checks the operator boundary. Use the current production appetite
// contract rather than the superseded max_notional field.
const routeAccessPath = "apps/api/test/route-access.test.js";
let routeAccess = fs.readFileSync(routeAccessPath, "utf8");
const stale = `body: { pair: "USDC/EURC", max_notional: "1000.00" }`;
const count = routeAccess.split(stale).length - 1;
assert.equal(count, 2, `expected two stale appetite fixtures, found ${count}`);
routeAccess = routeAccess.split(stale).join(
  `body: { pair: "USDC/EURC", max_position: "1000.00" }`,
);
fs.writeFileSync(routeAccessPath, routeAccess);
console.log(`patched ${routeAccessPath}`);

console.log("API runtime hardening edits applied");
