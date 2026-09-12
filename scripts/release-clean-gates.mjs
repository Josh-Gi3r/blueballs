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

// 1. Remove the duplicate object key while keeping the normalized pair as the
// final override after caller input.
replaceOnce(
  "apps/api/src/routes/fx-swap.js",
  `    const value = {\n      pair,\n      ...DEFAULT_APPETITE,\n      ...body,\n      pair,\n      currency: from,\n    };`,
  `    const value = {\n      ...DEFAULT_APPETITE,\n      ...body,\n      pair,\n      currency: from,\n    };`,
);

// 2. Existing released banking migrations already use stable hyphenated names.
// Keep those immutable identifiers valid rather than renaming migration history.
replaceOnce(
  "packages/sqlite-compat/src/migrations.js",
  `const MIGRATION_NAME = /^[a-z][a-z0-9_]{0,95}$/;`,
  `const MIGRATION_NAME = /^[a-z][a-z0-9_-]{0,95}$/;`,
);
replaceOnce(
  "packages/sqlite-compat/src/migrations.js",
  `        \`migration \${migration.version} needs a stable lowercase snake_case name\`,`,
  `        \`migration \${migration.version} needs a stable lowercase name using letters, digits, _ or -\`,`,
);

const migrationTestPath = "packages/sqlite-compat/test/migrations.test.js";
let migrationTests = fs.readFileSync(migrationTestPath, "utf8");
assert.ok(
  !migrationTests.includes(
    "released migration names may preserve stable lowercase slug identifiers",
  ),
  "migration compatibility regression test already exists",
);
migrationTests = `${migrationTests.trimEnd()}\n\ntest("released migration names may preserve stable lowercase slug identifiers", (t) => {\n  const database = withDatabase(t);\n  migrate(database, "banking-test", [\n    { version: 1, name: "initial-banking-schema", up() {} },\n  ]);\n  assert.deepEqual(\n    appliedMigrations(database, "banking-test").map((row) => row.name),\n    ["initial-banking-schema"],\n  );\n});\n`;
fs.writeFileSync(migrationTestPath, migrationTests);
console.log(`patched ${migrationTestPath}`);

// 3. Canonical FX has three ownership classes: public runtime routes, the
// builder-catalogue subset, and private/operator callbacks.
replaceOnce(
  "spec/runtime-ownership.mjs",
  ` * Keep the public/private distinction machine-readable: public FX prefixes must\n * be represented in the 181-operation catalogue, while private prefixes are\n * routed to the FX node without being advertised as builder-facing operations.`,
  ` * Keep the ownership distinctions machine-readable: public FX prefixes route\n * to the canonical FX node, catalogue prefixes are the subset advertised in the\n * 181-operation builder catalogue, and operator-only prefixes stay private.`,
);
replaceOnce(
  "spec/runtime-ownership.mjs",
  `export const FX_NODE_PRIVATE_PATH_PREFIXES = Object.freeze([\n  "/v2/fx/ops",\n]);`,
  `export const FX_NODE_CATALOGUE_PATH_PREFIXES = Object.freeze([\n  "/v2/fx/depth",\n]);\n\nexport const FX_NODE_PRIVATE_PATH_PREFIXES = Object.freeze([\n  "/v2/fx/ops",\n]);`,
);

replaceOnce(
  "scripts/check-runtime-ownership.mjs",
  `  FX_NODE_ALL_PATH_PREFIXES,\n  FX_NODE_PATH_PREFIXES,\n  FX_NODE_PRIVATE_PATH_PREFIXES,`,
  `  FX_NODE_ALL_PATH_PREFIXES,\n  FX_NODE_CATALOGUE_PATH_PREFIXES,\n  FX_NODE_PATH_PREFIXES,\n  FX_NODE_PRIVATE_PATH_PREFIXES,`,
);
replaceOnce(
  "scripts/check-runtime-ownership.mjs",
  `for (const prefix of FX_NODE_PATH_PREFIXES) {\n  assert.ok(\n    cataloguedPaths.some(\n      (path) => path === prefix || path.startsWith(\`\${prefix}/\`),\n    ),\n    \`Public FX prefix \${prefix} has no catalogue operation\`,\n  );\n}`,
  `for (const prefix of FX_NODE_CATALOGUE_PATH_PREFIXES) {\n  assert.ok(\n    FX_NODE_PATH_PREFIXES.includes(prefix),\n    \`Catalogue FX prefix \${prefix} must also be a public FX prefix\`,\n  );\n  assert.ok(\n    cataloguedPaths.some(\n      (path) => path === prefix || path.startsWith(\`\${prefix}/\`),\n    ),\n    \`Catalogue FX prefix \${prefix} has no public catalogue operation\`,\n  );\n}\n\nfor (const prefix of FX_NODE_PATH_PREFIXES.filter(\n  (candidate) => !FX_NODE_CATALOGUE_PATH_PREFIXES.includes(candidate),\n)) {\n  assert.equal(runtimeForPath(\`\${prefix}/probe\`), "fx");\n}`,
);
replaceOnce(
  "scripts/check-runtime-ownership.mjs",
  `  \`runtime ownership: \${routedToBanking.length} banking catalogue operations · \${routedToFx.length} public catalogue operations routed to canonical FX · \${FX_NODE_PATH_PREFIXES.length} public FX path families · \${FX_NODE_PRIVATE_PATH_PREFIXES.length} operator-only FX path families\`,`,
  `  \`runtime ownership: \${routedToBanking.length} banking catalogue operations · \${routedToFx.length} catalogue operations routed to canonical FX · \${FX_NODE_CATALOGUE_PATH_PREFIXES.length} catalogue FX path families · \${FX_NODE_PATH_PREFIXES.length} public FX path families · \${FX_NODE_PRIVATE_PATH_PREFIXES.length} operator-only FX path families\`,`,
);

replaceOnce(
  "workers/site/edge-routing.test.js",
  `  FX_NODE_PATH_PREFIXES,\n  FX_NODE_PRIVATE_PATH_PREFIXES,`,
  `  FX_NODE_CATALOGUE_PATH_PREFIXES,\n  FX_NODE_PATH_PREFIXES,\n  FX_NODE_PRIVATE_PATH_PREFIXES,`,
);
replaceOnce(
  "workers/site/edge-routing.test.js",
  `test("every public FX edge prefix is represented by the public catalogue", () => {\n  const concrete = FAMILIES.flatMap((family) => family.endpoints).map((endpoint) =>\n    concretePath(endpoint.path),\n  );\n  for (const prefix of FX_NODE_PATH_PREFIXES) {\n    assert.ok(\n      concrete.some((path) => path === prefix || path.startsWith(\`\${prefix}/\`)),\n      \`\${prefix} is publicly owned by FX but has no public catalogue operation\`,\n    );\n  }\n});`,
  `test("catalogue FX edge prefixes are the public FX subset represented by the builder catalogue", () => {\n  const concrete = FAMILIES.flatMap((family) => family.endpoints).map((endpoint) =>\n    concretePath(endpoint.path),\n  );\n\n  assert.deepEqual(FX_NODE_CATALOGUE_PATH_PREFIXES, ["/v2/fx/depth"]);\n  for (const prefix of FX_NODE_CATALOGUE_PATH_PREFIXES) {\n    assert.ok(FX_NODE_PATH_PREFIXES.includes(prefix));\n    assert.ok(\n      concrete.some((path) => path === prefix || path.startsWith(\`\${prefix}/\`)),\n      \`\${prefix} is catalogue-owned by FX but has no public catalogue operation\`,\n    );\n  }\n\n  assert.equal(runtimeForPath("/v2/fx/reference/status"), "fx");\n  assert.equal(\n    concrete.some((path) => path.startsWith("/v2/fx/reference")),\n    false,\n    "reference FX routes are public runtime routes, not builder catalogue operations",\n  );\n});`,
);

// 4. Keep the truth assertion aligned with the current README language while
// preserving the actual production-adapter architecture requirement.
replaceOnce(
  "scripts/check-page-truth.mjs",
  `/adapter-driven production FX runtime/i,`,
  `/production deployments[\\s\\S]{0,320}FX runtime adapter/i,`,
);

// 5. Repair the single corrupted generated cards social image. A candidate is
// accepted only if deleting exactly one base64 character yields a complete PNG
// with valid CRCs and the required 1200x630 dimensions.
const cardsPath = "workers/site/social-assets/cards.js";
const cardsSource = fs.readFileSync(cardsPath, "utf8");
const cardsMatch = cardsSource.match(/^export default "([A-Za-z0-9+/=_-]+)";\s*$/s);
assert.ok(cardsMatch, "cards social asset wrapper is not canonical");
const encoded = cardsMatch[1];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function validPng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return false;

  let offset = 8;
  let width = null;
  let height = null;
  let first = true;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    if (next > buffer.length) return false;

    const type = buffer.subarray(typeStart, dataStart).toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if (
      buffer.readUInt32BE(crcOffset) !==
      crc32(buffer.subarray(typeStart, crcOffset))
    ) {
      return false;
    }

    if (first) {
      if (type !== "IHDR" || length !== 13) return false;
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      first = false;
    }
    offset = next;
    if (type === "IEND") {
      return (
        length === 0 &&
        offset === buffer.length &&
        width === 1200 &&
        height === 630
      );
    }
  }
  return false;
}

const repaired = [];
for (let index = 0; index < encoded.length; index += 1) {
  const candidate = encoded.slice(0, index) + encoded.slice(index + 1);
  if (candidate.length % 4 !== 0) continue;
  try {
    atob(candidate);
  } catch {
    continue;
  }
  if (validPng(Buffer.from(candidate, "base64"))) {
    repaired.push({ index, removed: encoded[index], candidate });
  }
}
assert.equal(
  repaired.length,
  1,
  `expected one canonical cards PNG repair, found ${repaired.length}`,
);
fs.writeFileSync(
  cardsPath,
  `export default ${JSON.stringify(repaired[0].candidate)};\n`,
);
console.log(
  `repaired ${cardsPath} at base64 index ${repaired[0].index}; removed ${JSON.stringify(repaired[0].removed)}`,
);

console.log("v0.2 release hardening edits applied");
