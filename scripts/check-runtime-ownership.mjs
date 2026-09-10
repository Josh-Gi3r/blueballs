#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAMILIES } from "../src/endpoints.ts";
import {
  FX_NODE_PATH_PREFIXES,
  runtimeForPath,
} from "../spec/runtime-ownership.mjs";

const workerSource = readFileSync("workers/site/index.js", "utf8");
const fxSource = readFileSync("apps/fx-node/src/server.js", "utf8");

assert.match(
  workerSource,
  /import\s*\{[^}]*runtimeForPath[^}]*\}\s*from\s*["']\.\.\/\.\.\/spec\/runtime-ownership\.mjs["']/,
  "Site Worker must import runtimeForPath from the shared ownership contract",
);
assert.doesNotMatch(
  workerSource,
  /const\s+FX_NODE_PATHS\s*=/,
  "Site Worker must not maintain a second handwritten FX routing table",
);
assert.match(
  workerSource,
  /runtimeForPath\(url\.pathname\)\s*===\s*["']fx["']/,
  "Site Worker must route FX requests using runtimeForPath(url.pathname)",
);

const fxRouteLiterals = new Set(
  [...fxSource.matchAll(/["'`](\/v2\/fx\/[^"'`]+)["'`]/g)].map(
    (match) => match[1],
  ),
);

for (const prefix of FX_NODE_PATH_PREFIXES) {
  assert.ok(
    [...fxRouteLiterals].some(
      (path) => path === prefix || path.startsWith(`${prefix}/`),
    ),
    `Runtime ownership claims ${prefix} for FX but the FX node has no matching route literal`,
  );
}

for (const path of fxRouteLiterals) {
  assert.equal(
    runtimeForPath(path),
    "fx",
    `FX node route ${path} is not covered by the public edge ownership contract`,
  );
}

const catalogued = FAMILIES.flatMap(({ name: family, endpoints }) =>
  endpoints.map((endpoint) => ({ family, ...endpoint })),
);
const routedToFx = catalogued.filter(
  ({ path }) => runtimeForPath(path) === "fx",
);
const routedToBanking = catalogued.filter(
  ({ path }) => runtimeForPath(path) === "banking",
);

assert.equal(
  routedToFx.length + routedToBanking.length,
  catalogued.length,
  "Every catalogued /v2 operation must resolve to banking or canonical FX",
);

console.log(
  `runtime ownership: ${routedToBanking.length} banking catalogue operations · ${routedToFx.length} catalogue operations routed to canonical FX · ${FX_NODE_PATH_PREFIXES.length} FX path families`,
);
