#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const router = read("../src/router.ts");
const siteRoot = read("../src/SiteRoot.tsx");
const cardsPage = read("../src/CardsPage.tsx");
const cardsVisual = read("../src/cards/CardsVisualPage.tsx");

assert.match(
  router,
  /history\.pushState\([\s\S]*dispatchEvent\(new PopStateEvent\("popstate"\)\)/,
);
assert.match(siteRoot, /const \[path, navigate\] = usePath\(\)/);
assert.match(
  siteRoot,
  /if \(path === "\/cards"\)[\s\S]{0,120}<DirectoryShell page="cards" navigate=\{navigate\} \/>/,
);
assert.match(
  cardsPage,
  /import CardsVisualPage from "\.\/cards\/CardsVisualPage"/,
);
assert.match(cardsVisual, /import "\.\/cards-visual-page\.css"/);
for (const stalePath of [
  "../src/CardsPage.css",
  "../src/cards/hero-explorer.css",
  "../src/cards/workbench.css",
]) {
  assert.equal(existsSync(new URL(stalePath, import.meta.url)), false);
}

console.log("cards navigation source contract: ok");
