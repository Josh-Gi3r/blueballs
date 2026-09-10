#!/usr/bin/env node
/** Run the repository verification suite and persist machine-readable evidence.
 *
 * This is deliberately local and provider-neutral; Blueballs does not require a
 * hosted CI service to prove a release. `--require-clean` upgrades the run from a
 * development verification to release evidence for an exact commit.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const requireClean = process.argv.includes("--require-clean");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
}

function value(command, args) {
  const result = run(command, args);
  return result.status === 0 ? result.stdout.trim() : null;
}

const startedAt = new Date().toISOString();
const commit = value("git", ["rev-parse", "HEAD"]);
const branch = value("git", ["branch", "--show-current"]);
const dirtyBefore = value("git", ["status", "--porcelain"]) || "";
const pnpmVersion = value("pnpm", ["--version"]);

let preconditionFailure = null;
if (!commit) preconditionFailure = "Unable to resolve git HEAD";
if (requireClean && dirtyBefore) {
  preconditionFailure = "Release verification requires a clean git checkout";
}

let verification = { status: preconditionFailure ? 1 : null, stdout: "", stderr: "" };
if (!preconditionFailure) {
  verification = run(process.execPath, ["scripts/verify.mjs"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(verification.stdout || "");
  process.stderr.write(verification.stderr || "");
} else {
  console.error(preconditionFailure);
}

const dirtyAfter = value("git", ["status", "--porcelain"]) || "";
const operationCoveragePath = resolve(ROOT, "artifacts/api-operation-coverage.json");
let operationCoverage = null;
try {
  operationCoverage = JSON.parse(readFileSync(operationCoveragePath, "utf8"));
} catch {
  // The API suite may have failed before it could write coverage. The report
  // records null rather than fabricating evidence.
}

const report = {
  schema_version: 1,
  kind: requireClean ? "release_verification" : "development_verification",
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  commit,
  branch,
  clean_before: dirtyBefore.length === 0,
  clean_after: dirtyAfter.length === 0,
  node: process.version,
  pnpm: pnpmVersion,
  verification_exit_code: verification.status ?? 1,
  passed: !preconditionFailure && verification.status === 0,
  precondition_failure: preconditionFailure,
  api_operation_coverage: operationCoverage,
};

mkdirSync(resolve(ROOT, "artifacts"), { recursive: true });
const reportPath = resolve(ROOT, "artifacts/verification-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\nVerification evidence: ${reportPath}`);

if (preconditionFailure || verification.status !== 0) process.exit(1);
