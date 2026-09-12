import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync(
  new URL("../../src/CanonicalHeader.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../../src/canonical-header.css", import.meta.url),
  "utf8",
);
const main = readFileSync(new URL("../../src/main.tsx", import.meta.url), "utf8");

const NAV_SEQUENCE = [
  ["Home", "/home"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Developers", "/developers"],
  ["Cards", "/cards"],
  ["Providers", "/ecosystem"],
  ["Blueprints", "/blueprint"],
  ["Proof", "/proof"],
  ["Build with us", "/contact"],
];

test("canonical public IA has one exact order", () => {
  let cursor = -1;
  for (const [label, path] of NAV_SEQUENCE) {
    const needle = `["${label}", "${path}"]`;
    const index = header.indexOf(needle);
    assert.ok(index > cursor, `${needle} must appear in canonical order`);
    cursor = index;
  }
  assert.match(header, /onClick=\{\(\) => go\("\/sandbox"\)\}/);
});

test("full product shells use the canonical header while contextual products keep theirs", () => {
  for (const path of [
    "/home",
    "/products",
    "/fx",
    "/developers",
    "/cards",
    "/ecosystem",
    "/proof",
    "/contact",
  ]) {
    assert.match(header, new RegExp(`"${path.replaceAll("/", "\\/")}"`));
  }

  const fullSet = header.match(/FULL_PUBLIC_HEADER_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(fullSet, /"\/blueprint"/);
  assert.doesNotMatch(fullSet, /"\/sandbox"/);
});

test("legacy full headers are removed from layout under the canonical frame", () => {
  assert.match(css, /\.bb-canonical-frame--full[\s\S]*\.bb-site-header/);
  assert.match(css, /\.bb-canonical-frame--full[\s\S]*\.proof-header/);
  assert.match(
    css,
    /\.bb-canonical-frame--contact \.bb-canonical-content > div > div > header/,
  );
});

test("desktop nav never wraps and mobile takeover happens at a deliberate breakpoint", () => {
  assert.match(css, /\.bb-canonical-nav \{[\s\S]*white-space: nowrap;/);
  assert.match(css, /@media \(max-width: 1280px\)/);
  assert.match(
    css,
    /\.bb-canonical-nav,[\s\S]*\.bb-canonical-cta \{[\s\S]*display: none;/,
  );
  assert.match(
    css,
    /\.bb-canonical-menu-button \{[\s\S]*display: inline-flex;/,
  );
});

test("the application root owns the canonical header exactly once", () => {
  assert.match(main, /import CanonicalHeader from "\.\/CanonicalHeader"/);
  assert.match(main, /<CanonicalHeader>[\s\S]*<SiteRoot \/>[\s\S]*<\/CanonicalHeader>/);
});
