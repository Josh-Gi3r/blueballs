import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const siteRoot = readFileSync(
  new URL("../../src/SiteRoot.tsx", import.meta.url),
  "utf8",
);
const brand = readFileSync(new URL("../../src/Brand.tsx", import.meta.url), "utf8");
const headerCss = readFileSync(
  new URL("../../src/header-stability.css", import.meta.url),
  "utf8",
);
const main = readFileSync(new URL("../../src/main.tsx", import.meta.url), "utf8");

test("Cards and Providers in the main shell use the shared browser router", () => {
  assert.match(
    app,
    /const selectDirectory = \(nextPath: "\/cards" \| "\/ecosystem"\) => \{[\s\S]*?go\(nextPath\);[\s\S]*?\};/,
  );
  assert.match(app, /selectDirectory\("\/cards"\)/);
  assert.match(app, /selectDirectory\("\/ecosystem"\)/);
});

test("Cards and Providers keep one stable order in the directory shell", () => {
  assert.match(
    siteRoot,
    /\["Developers", "\/developers"\],[\s\S]*?\["Cards", "\/cards"\],[\s\S]*?\["Providers", "\/ecosystem"\]/,
  );
  assert.match(
    siteRoot,
    /onClick=\{\(\) => go\(path\)\}/,
    "directory navigation must route every item through the same go() function",
  );
});

test("the shared brand is brand-only and cannot consume nav width with product links", () => {
  assert.match(brand, /href="\/home"/);
  assert.doesNotMatch(brand, /href="\/blueprint"/);
  assert.doesNotMatch(brand, /href="\/proof"/);
  assert.doesNotMatch(brand, /bb-brand-cluster/);
});

test("desktop headers cannot wrap and collapse deliberately before space gets tight", () => {
  assert.match(main, /import "\.\/header-stability\.css"/);
  assert.match(headerCss, /@media \(min-width: 1241px\)/);
  assert.match(
    headerCss,
    /\.bb-site-header \{[\s\S]*?flex-wrap: nowrap !important;/,
  );
  assert.match(
    headerCss,
    /\.bb-site-nav-desktop \{[\s\S]*?flex-wrap: nowrap !important;/,
  );
  assert.match(headerCss, /@media \(max-width: 1240px\)/);
  assert.match(
    headerCss,
    /\.bb-site-nav-desktop,[\s\S]*?\.bb-site-cta \{[\s\S]*?display: none !important;/,
  );
  assert.match(
    headerCss,
    /\.bb-mobile-menu-button \{[\s\S]*?display: inline-flex;/,
  );
});
