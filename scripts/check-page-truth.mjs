#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
const contact = readFileSync(
  new URL("../src/ContactPage.tsx", import.meta.url),
  "utf8",
);
const crawler = readFileSync(
  new URL("../workers/site/crawler-pages.js", import.meta.url),
  "utf8",
);
const worker = readFileSync(
  new URL("../workers/site/index.js", import.meta.url),
  "utf8",
);
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(
  publicSource,
  /github\.com\/Josh-Gi3r\/blueballs/,
  "the site must link the source repository",
);

assert.match(
  readme,
  /Own the financial stack/i,
  "README must lead with institution ownership rather than starter-template positioning",
);
assert.match(
  readme,
  /Build and operate your own FX market/i,
  "README must surface the institution-owned FX position",
);
assert.match(
  readme,
  /adapter-driven production FX runtime/i,
  "README must surface production FX composition",
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
  contact,
  /Take Blueballs from open source to your market\./,
  "the public contact route must convert design-partner and implementation interest",
);
assert.match(contact, /DESIGN PARTNER/);
assert.match(contact, /IMPLEMENTATION/);
assert.match(contact, /PROVIDERS/);
assert.match(
  crawler,
  /Build and operate your own FX market\./,
  "crawler content must carry the flagship FX position",
);
assert.match(crawler, /Take Blueballs from open source to your market\./);

for (const metadata of [
  /property="og:title"/,
  /property="og:image"/,
  /name="twitter:card" content="summary_large_image"/,
]) {
  assert.match(index, metadata, `share metadata missing: ${metadata}`);
}
assert.match(worker, /property="og:title"/);
assert.match(worker, /name="twitter:title"/);

assert.match(
  worker,
  /url\.pathname === "\/bulletin"[\s\S]*Response\.redirect\(new URL\("\/developers"[\s\S]*301/,
);
assert.doesNotMatch(
  worker.match(/KNOWN_PAGES[\s\S]*?\]\);/)?.[0] ?? "",
  /"\/bulletin"/,
);

const proofContract = execFileSync(
  process.execPath,
  ["scripts/check-proof-page.mjs"],
  { cwd: root, encoding: "utf8" },
);
assert.match(proofContract, /proof page contract:/i);

console.log(
  "page truth: source is linked, ownership/FX positioning is current, build-with-us conversion exists, public proof matches repository gates, share metadata is present, /bulletin is a 301",
);
