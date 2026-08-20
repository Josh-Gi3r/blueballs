#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const tracked = execFileSync("git", ["ls-files", "src", "workers/site"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const publicSource = tracked.map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const worker = readFileSync(new URL("../workers/site/index.js", import.meta.url), "utf8");

assert.doesNotMatch(publicSource, /github\.com\/Josh-Gi3r\/blueballs/, "live site must not advertise an inaccessible repository");
assert.doesNotMatch(readme, /page calls the running FX node directly/i);
assert.match(readme, /labelled, deterministic browser\s+simulation/i);
assert.match(worker, /url\.pathname === "\/bulletin"[\s\S]*Response\.redirect\(new URL\("\/developers"[\s\S]*301/);
assert.doesNotMatch(worker.match(/KNOWN_PAGES[\s\S]*?\]\);/)?.[0] ?? "", /"\/bulletin"/);
console.log("page truth: private source is not advertised, FX is labelled simulation, /bulletin is a 301");
