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
const routerCore = readFileSync(
  new URL("../src/router-core.ts", import.meta.url),
  "utf8",
);
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
  /KNOWN_PAGES[\s\S]*"\/blueprint"/,
  "/blueprint must be an allowed HTML route",
);
assert.match(
  worker,
  /KNOWN_PAGES[\s\S]*"\/proof"/,
  "/proof must be an allowed HTML route",
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

// Cross-shell navigation is one location contract: usePath delegates all writes
// to the executable router core, which pushes a real URL, broadcasts the change
// and resets scroll. Its behavior is covered by client-navigation.test.js.
assert.match(
  router,
  /navigatePath\(p,[\s\S]*pathname: window\.location\.pathname/,
  "usePath must delegate navigation to the shared router core",
);
assert.match(
  routerCore,
  /runtime\.pushState\(destination\);[\s\S]*runtime\.broadcastLocationChange\(\);[\s\S]*runtime\.scrollToTop\(\);/,
  "client navigation must push the URL, broadcast the location change and reset scroll",
);
assert.match(
  routerCore,
  /destination === "\/sandbox"[\s\S]*growthEvent = "builder_start"/,
  "Sandbox navigation must retain Builder attribution",
);
assert.match(
  routerCore,
  /destination === "\/contact"[\s\S]*growthEvent = "commercial_contact_view"/,
  "commercial navigation must retain source attribution",
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
  /if \(path === "\/blueprint"\)[\s\S]{0,120}<BlueprintPage onNavigate=\{navigate\} \/>/,
  "SiteRoot must own the canonical /blueprint page",
);
assert.match(
  siteRoot,
  /if \(path === "\/proof"\)[\s\S]{0,120}<ProofPage onNavigate=\{navigate\} \/>/,
  "SiteRoot must own the canonical /proof page",
);
assert.match(
  siteRoot,
  /if \(path === "\/contact"\)[\s\S]{0,120}<ContactPage onNavigate=\{navigate\} \/>/,
  "SiteRoot must own the commercial /contact page",
);
assert.match(
  siteRoot,
  /\["Stablecoin FX", "\/fx"\][\s\S]{0,180}\["Developers", "\/developers"\][\s\S]{0,180}\["Cards", "\/cards"\][\s\S]{0,180}\["Providers", "\/ecosystem"\]/,
  "directory pages must keep the same primary menu sequence as the main site",
);
assert.match(
  siteRoot,
  /\["Blueprints", "\/blueprint"\][\s\S]{0,120}\["Proof", "\/proof"\]/,
  "directory navigation must expose Blueprint and Proof surfaces",
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
  "The stablecoin card market, mapped — Blueballs",
);
assert.match(crawlerDocument("/cards"), /independent|research standard/i);
assert.match(crawlerDocument("/cards"), /relationship and technical status/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/cards<\/loc>/);
assert.equal(
  pageMetadata("/sandbox").title,
  "Build a fintech sandbox — Blueballs",
);
assert.match(crawlerDocument("/sandbox"), /protected-ledger payment journeys/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/sandbox<\/loc>/);
assert.equal(
  pageMetadata("/blueprint").title,
  "Financial product Blueprint library — Blueballs",
);
assert.match(crawlerDocument("/blueprint"), /Blueprint Library/i);
assert.match(crawlerDocument("/blueprint"), /Creator Bank Singapore/i);
assert.match(crawlerDocument("/blueprint"), /Institution-Owned FX Desk/i);
assert.match(crawlerDocument("/blueprint"), /public-safe/i);
assert.match(crawlerDocument("/blueprint"), /URL fragment/i);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/blueprint<\/loc>/);
assert.equal(
  pageMetadata("/proof").title,
  "Technical proof and deployment parity — Blueballs",
);
assert.match(crawlerDocument("/proof"), /Financial infrastructure should show its work/i);
assert.match(crawlerDocument("/proof"), /181-operation/i);
assert.match(crawlerDocument("/proof"), /BLUEBALLS_GIT_SHA/);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/proof<\/loc>/);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/contact<\/loc>/);
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
  "site route contract: executable client navigation stays synchronized, Cards has one canonical market-intelligence surface, Blueprints and Proof are public/crawlable product surfaces, and /contact is a first-class build route",
);
