#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const tracked = execFileSync("git", ["ls-files", "src", "workers/site", "index.html"], {
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
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cards = readFileSync(new URL("../src/cards/CardsVisualPage.tsx", import.meta.url), "utf8");
const ecosystem = readFileSync(new URL("../src/EcosystemPage.tsx", import.meta.url), "utf8");
const fxA = readFileSync(new URL("../src/fx/FinalFxSectionsA.tsx", import.meta.url), "utf8");
const fxC = readFileSync(new URL("../src/fx/FinalFxSectionsC.tsx", import.meta.url), "utf8");
const crawler = readFileSync(new URL("../workers/site/crawler-pages.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../workers/site/index.js", import.meta.url), "utf8");

assert.match(publicSource, /github\.com\/Josh-Gi3r\/blueballs/, "the site must link the source repository");
assert.match(readme, /open-source operating system for modern financial institutions/i);
assert.match(readme, /adapter-driven production FX runtime/i);
assert.match(app, /operating system for modern financial institutions/i);
assert.match(app, /durable provider orchestration/i);
assert.match(cards, /SOURCED CARD INTELLIGENCE · AS-OF DATA/);
assert.match(cards, /institution-owned Blueballs stack/i);
assert.match(ecosystem, /Compose the infrastructure behind your product/i);
assert.match(ecosystem, /provider-neutral/i);
assert.match(fxA, /FX INFRASTRUCTURE · INTERACTIVE MARKET LAB/);
assert.match(fxC, /ADAPTER-DRIVEN RUNTIME COMPOSITION/);
assert.match(crawler, /181-operation banking API/);
assert.match(crawler, /institution-owned stack/);

// These phrases belonged to earlier prototype/disclaimer positioning and should
// never return to public product copy. Accurate sandbox labels remain allowed;
// the banned set targets language that makes implemented capabilities sound fake
// or fragmented.
for (const stale of [
  /WEBSITE SIMULATION/i,
  /NO MONEY MOVES/i,
  /Review implementation status/i,
  /NOT CONNECTED/i,
  /open-source software for building a neobank/i,
  /PROVIDER\s+NOT INCLUDED/i,
  /LIVE MARKET\s+NOT INCLUDED/i,
  /LENDER\s+NOT INCLUDED/i,
]) {
  assert.doesNotMatch(publicSource, stale, `public copy regressed to stale framing: ${stale}`);
}

// Public browsing must not mint a tenant/key as a side effect. Credential
// provisioning is explicit in the developer/sandbox surfaces.
assert.doesNotMatch(app, /ensureKey\(/, "marketing/product browsing must not auto-provision sandbox credentials");
assert.match(publicSource, /TAB-SCOPED SESSION/i, "browser key storage must be described accurately");

assert.match(
  worker,
  /url\.pathname === "\/bulletin"[\s\S]*Response\.redirect\(new URL\("\/developers"[\s\S]*301/,
);
assert.doesNotMatch(worker.match(/KNOWN_PAGES[\s\S]*?\]\);/)?.[0] ?? "", /"\/bulletin"/);

console.log(
  "page truth: platform positioning, provider neutrality, explicit credentialing and canonical FX/Cards framing are enforced",
);
