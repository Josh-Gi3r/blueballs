#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";

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

// 5. Replace the corrupt Cards social asset with a deterministic route-specific
// 1200×630 PNG generated entirely from code. This makes the image reproducible,
// dependency-free, and structurally verifiable instead of accepting damaged bytes.
const cardsPath = "workers/site/social-assets/cards.js";
const WIDTH = 1200;
const HEIGHT = 630;
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 4;
  pixels[offset] = r;
  pixels[offset + 1] = g;
  pixels[offset + 2] = b;
  pixels[offset + 3] = a;
}
function fillRect(x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(xx, yy, ...color);
    }
  }
}
function strokeRect(x, y, width, height, thickness, color) {
  fillRect(x, y, width, thickness, color);
  fillRect(x, y + height - thickness, width, thickness, color);
  fillRect(x, y, thickness, height, color);
  fillRect(x + width - thickness, y, thickness, height, color);
}
function drawCard(x, y, width, height, fill, accent) {
  fillRect(x + 18, y + 18, width, height, [2, 8, 14, 105]);
  fillRect(x, y, width, height, fill);
  strokeRect(x, y, width, height, 4, accent);
  fillRect(x + 34, y + 42, 72, 54, accent);
  fillRect(x + 34, y + 122, width - 68, 8, [238, 244, 248, 220]);
  fillRect(x + 34, y + 150, Math.floor(width * 0.55), 8, [126, 148, 164, 220]);
  fillRect(x + 34, y + height - 56, 90, 10, accent);
  fillRect(x + width - 126, y + height - 56, 92, 10, [238, 244, 248, 185]);
}

for (let y = 0; y < HEIGHT; y += 1) {
  const mix = y / HEIGHT;
  const r = Math.round(5 + 4 * mix);
  const g = Math.round(15 + 10 * mix);
  const b = Math.round(26 + 17 * mix);
  fillRect(0, y, WIDTH, 1, [r, g, b, 255]);
}
for (let x = 0; x < WIDTH; x += 60) {
  fillRect(x, 0, 1, HEIGHT, [24, 48, 67, 90]);
}
for (let y = 0; y < HEIGHT; y += 60) {
  fillRect(0, y, WIDTH, 1, [24, 48, 67, 90]);
}
fillRect(0, 0, 14, HEIGHT, [40, 203, 177, 255]);
fillRect(14, 0, 5, HEIGHT, [58, 125, 255, 255]);

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
};
function drawText(text, x, y, scale, color, spacing = 2) {
  let cursor = x;
  for (const char of text) {
    if (char === " ") {
      cursor += scale * 4;
      continue;
    }
    const glyph = FONT[char];
    assert.ok(glyph, `missing pixel glyph: ${char}`);
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] === "1") {
          fillRect(cursor + gx * scale, y + gy * scale, scale, scale, color);
        }
      }
    }
    cursor += (5 + spacing) * scale;
  }
}

drawText("BLUEBALLS", 86, 116, 8, [129, 151, 168, 255], 1);
drawText("CARDS", 82, 230, 18, [242, 247, 250, 255], 1);
fillRect(86, 392, 330, 8, [40, 203, 177, 255]);
fillRect(86, 426, 245, 8, [58, 125, 255, 255]);
fillRect(86, 490, 190, 5, [92, 115, 133, 255]);
fillRect(86, 512, 270, 5, [92, 115, 133, 255]);

drawCard(690, 112, 360, 225, [17, 39, 57, 255], [40, 203, 177, 255]);
drawCard(744, 188, 360, 225, [19, 33, 63, 255], [58, 125, 255, 255]);
drawCard(798, 264, 320, 205, [27, 31, 48, 255], [191, 106, 255, 255]);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  const rowOffset = y * (WIDTH * 4 + 1);
  raw[rowOffset] = 0;
  pixels.copy(raw, rowOffset + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND"),
]);

assert.equal(png.readUInt32BE(16), WIDTH);
assert.equal(png.readUInt32BE(20), HEIGHT);
const encodedCard = png.toString("base64");
assert.equal(encodedCard.length % 4, 0);
assert.equal(Buffer.from(atob(encodedCard), "binary").length, png.length);
fs.writeFileSync(cardsPath, `export default ${JSON.stringify(encodedCard)};\n`);
console.log(`generated ${cardsPath}: ${png.length} PNG bytes`);

console.log("v0.2 release hardening edits applied");
