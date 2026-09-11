#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const tracked = execFileSync("git", ["ls-files", "src", "workers/site"], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n");
const publicSource = tracked
  .filter((file) => existsSync(join(root, file)))
  .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
  .join("\n");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const fxA = readFileSync(
  new URL("../src/fx/FinalFxSectionsA.tsx", import.meta.url),
  "utf8",
);
const fxC = readFileSync(
  new URL("../src/fx/FinalFxSectionsC.tsx", import.meta.url),
  "utf8",
);
const worker = readFileSync(
  new URL("../workers/site/index.js", import.meta.url),
  "utf8",
);

assert.match(
  publicSource,
  /github\.com\/Josh-Gi3r\/blueballs/,
  "the site must link the source repository",
);

assert.match(
  readme,
  /open-source operating system for modern financial institutions/i,
  "README must lead with the Blueballs institution-platform position",
);
assert.match(
  readme,
  /adapter-driven production FX runtime/i,
  "README must surface the production FX composition",
);
assert.match(
  fxA,
  /FX INFRASTRUCTURE · INTERACTIVE MARKET LAB/,
  "FX hero must present the product as an interactive market lab",
);
assert.match(
  fxC,
  /ADAPTER-DRIVEN RUNTIME COMPOSITION/,
  "FX inspector must surface the production runtime architecture",
);

for (const stale of [
  /WEBSITE SIMULATION/,
  /NO MONEY MOVES/,
  /Review implementation status/i,
  /NOT CONNECTED/,
]) {
  assert.doesNotMatch(
    `${fxA}\n${fxC}`,
    stale,
    `public FX product copy must not regress to stale disclaimer language: ${stale}`,
  );
}

assert.match(
  worker,
  /url\.pathname === "\/bulletin"[\s\S]*Response\.redirect\(new URL\("\/developers"[\s\S]*301/,
);
assert.doesNotMatch(
  worker.match(/KNOWN_PAGES[\s\S]*?\]\);/)?.[0] ?? "",
  /"\/bulletin"/,
);

console.log(
  "page truth: source is linked, Blueballs positioning is capability-led, FX architecture copy is current, /bulletin is a 301",
);
