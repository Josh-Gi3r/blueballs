#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  crawlerDocument,
  pageMetadata,
  sitemapXml,
} from "../workers/site/crawler-pages.js";
import { canonicalRedirectUrl } from "../workers/site/canonical-url.js";

const worker = readFileSync(
  new URL("../workers/site/index.js", import.meta.url),
  "utf8",
);
const preview = readFileSync(
  new URL("./dev-cloudflare.mjs", import.meta.url),
  "utf8",
);
const router = readFileSync(new URL("../src/router.ts", import.meta.url), "utf8");
const brand = readFileSync(new URL("../src/Brand.tsx", import.meta.url), "utf8");
const siteRoot = readFileSync(
  new URL("../src/SiteRoot.tsx", import.meta.url),
  "utf8",
);
const cardsPage = readFileSync(
  new URL("../src/CardsPage.tsx", import.meta.url),
  "utf8",
);
const cardsVisualPage = readFileSync(
  new URL("../src/cards/CardsVisualPage.tsx", import.meta.url),
  "utf8",
);

assert.match(
  worker,
  /KNOWN_PAGES[\s\S]*"\/cards"/,
  "/cards must be an allowed HTML route",
);
assert.match(
  worker,
  /KNOWN_PAGES[\s\S]*"\/sandbox"/,
  "/sandbox must be an allowed HTML route",
);
assert.match(
  worker,
  /fonts\.googleapis\.com/,
  "CSP must allow the site's loaded webfonts",
);
assert.match(worker, /fonts\.gstatic\.com/, "CSP must allow font file origin");
assert.match(worker, /content-security-policy/, "the site must emit a CSP");
assert.match(
  worker,
  /x-content-type-options/,
  "the site must disable MIME sniffing",
);
assert.match(worker, /referrer-policy/, "the site must set a referrer policy");
assert.match(
  worker,
  /permissions-policy/,
  "the site must set a permissions policy",
);

// Cross-shell navigation is one location contract: both SiteRoot and page-level
// route consumers observe the same History API transition through usePath().
assert.match(
  router,
  /history\.pushState\([\s\S]*dispatchEvent\(new PopStateEvent\("popstate"\)\)/,
  "client navigation must broadcast popstate after pushState",
);
assert.match(
  siteRoot,
  /const \[path, navigate\] = usePath\(\)/,
  "SiteRoot must use the shared browser-location router",
);
assert.match(
  siteRoot,
  /if \(path === "\/cards"\)[\s\S]{0,120}<DirectoryShell page="cards" navigate=\{navigate\} \/>/,
  "SiteRoot must own the canonical /cards page",
);
assert.match(
  siteRoot,
  /if \(path === "\/ecosystem"\)[\s\S]{0,120}<DirectoryShell page="ecosystem" navigate=\{navigate\} \/>/,
  "SiteRoot must own the canonical /ecosystem page",
);
assert.match(
  siteRoot,
  /\["Stablecoin FX", "\/fx"\][\s\S]{0,180}\["Developers", "\/developers"\][\s\S]{0,180}\["Cards", "\/cards"\][\s\S]{0,180}\["Providers", "\/ecosystem"\]/,
  "directory pages must keep the same primary menu sequence as the main site",
);
assert.match(
  brand,
  /href="\/home"/,
  "interior brand links must return to the canonical site home",
);

// Keep one public Cards implementation and one loaded Cards stylesheet.
assert.match(
  cardsPage,
  /import CardsVisualPage from "\.\/cards\/CardsVisualPage"/,
  "CardsPage must delegate to the canonical CardsVisualPage",
);
assert.match(
  cardsVisualPage,
  /import "\.\/cards-visual-page\.css"/,
  "the canonical Cards page must load its canonical stylesheet",
);
for (const stalePath of [
  "../src/CardsPage.css",
  "../src/cards/hero-explorer.css",
  "../src/cards/workbench.css",
]) {
  assert.equal(
    existsSync(new URL(stalePath, import.meta.url)),
    false,
    `${stalePath} must stay retired`,
  );
}

assert.equal(
  pageMetadata("/cards").title,
  "Card programme research — Blueballs",
);
assert.match(crawlerDocument("/cards"), /not the Blueballs Cards API/i);
assert.match(crawlerDocument("/cards"), /Not connected/);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/cards<\/loc>/);
assert.equal(
  pageMetadata("/sandbox").title,
  "Build a fintech sandbox — Blueballs",
);
assert.match(crawlerDocument("/sandbox"), /protected double-entry ledger/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/sandbox<\/loc>/);
assert.equal(
  canonicalRedirectUrl("http://blueballs.tech/sandbox", "blueballs.tech", true),
  null,
  "local Wrangler preview must not redirect to itself",
);
assert.equal(
  canonicalRedirectUrl("http://blueballs.tech/v2", "blueballs.tech", true),
  null,
  "loopback preview must remain reachable over HTTP",
);
assert.equal(
  canonicalRedirectUrl("http://blueballs.tech/sandbox", "blueballs.tech"),
  "https://blueballs.tech/sandbox",
);
assert.equal(
  canonicalRedirectUrl(
    "https://www.blueballs.tech/sandbox",
    "www.blueballs.tech",
  ),
  "https://blueballs.tech/sandbox",
);
assert.match(preview, /wrangler\.api\.jsonc/);
assert.match(preview, /wrangler\.fx\.jsonc/);
assert.match(preview, /LOCAL_DEV:true/);
console.log(
  "site route contract: shared navigation is synchronized and Cards has one canonical public implementation",
);
