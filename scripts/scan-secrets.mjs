#!/usr/bin/env node
/** Lightweight deterministic repository secret scan.
 *
 * This complements, not replaces, host-side secret scanning. It intentionally
 * uses high-signal credential formats to avoid turning the release gate into a
 * false-positive lottery.
 */
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const textExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".toml",
  ".env",
  ".sh",
]);
const specialText = new Set([
  "Dockerfile",
  "Makefile",
  ".npmrc",
  ".gitignore",
]);
const allowedEnvNames = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);
const patterns = [
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["Stripe live secret", /sk_live_[A-Za-z0-9]{20,}/],
  ["OpenAI project/user secret", /sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{20,}/],
];

const problems = [];
for (const path of tracked) {
  if (path === "scripts/scan-secrets.mjs") continue;
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name) && !allowedEnvNames.has(name)) {
    problems.push(`${path}: tracked environment file is not an approved template`);
  }
  if (!textExtensions.has(extname(path)) && !specialText.has(name)) {
    continue;
  }
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    if (pattern.test(source)) problems.push(`${path}: possible ${label}`);
  }
}

if (problems.length) {
  console.error(`tracked secret scan failed (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `tracked secret scan: ${tracked.length} files inspected, no high-signal credentials found`,
);
