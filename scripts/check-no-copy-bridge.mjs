#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/SiteRoot.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  source,
  /LegacyCopyBridge|createTreeWalker|characterData:true/,
);
console.log("copy ownership: no DOM text-rewrite bridge remains");
