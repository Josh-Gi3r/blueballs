#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const worker = readFileSync(
  new URL("../workers/site/index.js", import.meta.url),
  "utf8",
);

// An open-source project links its source. Every public surface — the React site
// and the crawler pages the worker serves — must reach the repository, so a
// visitor or a crawler is never told the source is anywhere but GitHub.
assert.match(
  publicSource,
  /github\.com\/Josh-Gi3r\/blueballs/,
  "the site must link the source repository",
);
assert.doesNotMatch(readme, /page calls the running FX node directly/i);
assert.match(readme, /browser-facing FX page is a deterministic\s+simulation/i);
assert.match(
  worker,
  /url\.pathname === "\/bulletin"[\s\S]*Response\.redirect\(new URL\("\/developers"[\s\S]*301/,
);
assert.doesNotMatch(
  worker.match(/KNOWN_PAGES[\s\S]*?\]\);/)?.[0] ?? "",
  /"\/bulletin"/,
);
console.log(
  "page truth: the source repository is linked, FX is labelled simulation, /bulletin is a 301",
);
