#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  crawlerDocument,
  pageMetadata,
  sitemapXml,
} from "../workers/site/crawler-pages.js";
import { canonicalRedirectUrl } from "../workers/site/canonical-url.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const worker = read("../workers/site/index.js");
const preview = read("./dev-cloudflare.mjs");
const router = read("../src/router.ts");
const siteRoot = read("../src/SiteRoot.tsx");
const app = read("../src/App.tsx");
const chrome = read("../src/SiteChrome.tsx");
const brand = read("../src/Brand.tsx");
const cardsPage = read("../src/CardsPage.tsx");
const cardsVisualPage = read("../src/cards/CardsVisualPage.tsx");

assert.match(worker, /KNOWN_PAGES[\s\S]*"\/cards"/, "/cards must be an allowed HTML route");
assert.match(worker, /KNOWN_PAGES[\s\S]*"\/sandbox"/, "/sandbox must be an allowed HTML route");
assert.match(worker, /fonts\.googleapis\.com/, "CSP must allow the site's loaded webfonts");
assert.match(worker, /fonts\.gstatic\.com/, "CSP must allow font file origin");
assert.match(worker, /content-security-policy/, "the site must emit a CSP");
assert.match(worker, /x-content-type-options/, "the site must disable MIME sniffing");
assert.match(worker, /referrer-policy/, "the site must set a referrer policy");
assert.match(worker, /permissions-policy/, "the site must set a permissions policy");

// SiteRoot is the one location owner. Every public shell receives the same
// navigation callback instead of maintaining an independent route state.
assert.match(
  router,
  /history\.pushState\([\s\S]*dispatchEvent\(new PopStateEvent\("popstate"\)\)/,
  "client navigation must broadcast History API changes",
);
assert.match(siteRoot, /const \[path, navigate\] = usePath\(\)/, "SiteRoot must own browser location state");
assert.doesNotMatch(app, /usePath\(/, "App must not create a second router");
assert.match(
  siteRoot,
  /<App path=\{path\} navigate=\{navigate\} \/>/,
  "App must receive the top-level route contract",
);
assert.match(
  siteRoot,
  /<DirectoryShell page="cards" path=\{path\} navigate=\{navigate\} \/>/,
  "Cards must receive the top-level route contract",
);
assert.match(
  siteRoot,
  /<DirectoryShell page="ecosystem" path=\{path\} navigate=\{navigate\} \/>/,
  "Providers must receive the top-level route contract",
);

// One primary navigation definition renders across Home, product directories and
// mobile. This prevents the header changing order or behavior between shells.
assert.match(chrome, /export const PRIMARY_NAV/);
for (const path of [
  "/home",
  "/products",
  "/fx",
  "/developers",
  "/cards",
  "/ecosystem",
]) {
  assert.match(chrome, new RegExp(`"${path.replace("/", "\\/")}"`));
}
assert.match(app, /<PrimaryHeader path=\{path\} navigate=\{navigate\} \/>/);
assert.match(siteRoot, /<PrimaryHeader path=\{path\} navigate=\{navigate\} \/>/);
assert.match(brand, /href="\/home"/, "interior brand links must return to /home");

// Keep one public Cards implementation and one loaded Cards stylesheet.
assert.match(cardsPage, /import CardsVisualPage from "\.\/cards\/CardsVisualPage"/);
assert.match(cardsVisualPage, /import "\.\/cards-visual-page\.css"/);
for (const stalePath of [
  "../src/CardsPage.css",
  "../src/cards/hero-explorer.css",
  "../src/cards/workbench.css",
]) {
  assert.equal(existsSync(new URL(stalePath, import.meta.url)), false, `${stalePath} must stay retired`);
}

assert.equal(pageMetadata("/cards").title, "Card intelligence and programme architecture — Blueballs");
assert.match(crawlerDocument("/cards"), /institution-owned Blueballs stack/i);
assert.doesNotMatch(crawlerDocument("/cards"), /not connected|not the Blueballs Cards API/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/cards<\/loc>/);

assert.equal(pageMetadata("/sandbox").title, "Build a financial institution sandbox — Blueballs");
assert.match(crawlerDocument("/sandbox"), /protected double-entry ledger/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/sandbox<\/loc>/);

assert.equal(canonicalRedirectUrl("http://blueballs.tech/sandbox", "blueballs.tech", true), null);
assert.equal(canonicalRedirectUrl("http://blueballs.tech/v2", "blueballs.tech", true), null);
assert.equal(
  canonicalRedirectUrl("http://blueballs.tech/sandbox", "blueballs.tech"),
  "https://blueballs.tech/sandbox",
);
assert.equal(
  canonicalRedirectUrl("https://www.blueballs.tech/sandbox", "www.blueballs.tech"),
  "https://blueballs.tech/sandbox",
);
assert.match(preview, /wrangler\.api\.jsonc/);
assert.match(preview, /wrangler\.fx\.jsonc/);
assert.match(preview, /LOCAL_DEV:true/);

console.log(
  "site route contract: one top-level router, one primary chrome, one canonical Cards implementation",
);
