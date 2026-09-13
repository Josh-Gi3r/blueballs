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
  fs.writeFileSync(
    path,
    source.slice(0, index) + to + source.slice(index + from.length),
  );
  console.log(`patched ${path}`);
}

replaceOnce(
  "spec/banking/key-permission-catalog.mjs",
  `  [/^\\/v2\\/(?:fx|ramps)(?:\\/|$)/, "fx"],`,
  `  [/^\\/v2\\/(?:fx|quotes|ramps)(?:\\/|$)/, "fx"],`,
);

replaceOnce(
  "apps/api/test/key-permissions.test.js",
  `import test from "node:test";\nimport { createApiFixture } from "./helpers/api-process.js";`,
  `import test from "node:test";\nimport { permissionForRoute } from "../../../spec/banking/key-permission-catalog.mjs";\nimport { createApiFixture } from "./helpers/api-process.js";`,
);

const testPath = "apps/api/test/key-permissions.test.js";
let tests = fs.readFileSync(testPath, "utf8");
assert.ok(
  !tests.includes("quote catalogue routes use the fx permission domain"),
  "quote permission regression test already exists",
);
tests = `${tests.trimEnd()}\n\ntest("quote catalogue routes use the fx permission domain", () => {\n  assert.equal(permissionForRoute("POST", "/v2/quotes"), "fx:write");\n  assert.equal(permissionForRoute("GET", "/v2/quotes/:id"), "fx:read");\n  assert.equal(permissionForRoute("POST", "/v2/quotes/:id/execute"), "fx:write");\n});\n`;
fs.writeFileSync(testPath, tests);
console.log(`patched ${testPath}`);

console.log("quote permission hardening edits applied");
