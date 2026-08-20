#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crawlerDocument, pageMetadata, sitemapXml } from "../workers/site/crawler-pages.js";

const worker = readFileSync(new URL("../workers/site/index.js", import.meta.url), "utf8");
assert.match(worker, /KNOWN_PAGES[\s\S]*"\/cards"/, "/cards must be an allowed HTML route");
assert.match(worker, /fonts\.googleapis\.com/, "CSP must allow the site's loaded webfonts");
assert.match(worker, /fonts\.gstatic\.com/, "CSP must allow font file origin");
assert.match(worker, /content-security-policy/, "the site must emit a CSP");
assert.match(worker, /x-content-type-options/, "the site must disable MIME sniffing");
assert.match(worker, /referrer-policy/, "the site must set a referrer policy");
assert.match(worker, /permissions-policy/, "the site must set a permissions policy");
assert.equal(pageMetadata("/cards").title, "Card programme research — Blueballs");
assert.match(crawlerDocument("/cards"), /not the Blueballs Cards API/i);
assert.match(crawlerDocument("/cards"), /Not connected/);
assert.match(sitemapXml(), /<loc>https:\/\/blueballs\.tech\/cards<\/loc>/);
console.log("site route contract: /cards is allowlisted, titled, crawlable and present in the sitemap");
