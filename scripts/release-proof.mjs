#!/usr/bin/env node
/** Run Blueballs verification and retain machine-readable evidence for the exact checkout. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const requireClean = process.argv.includes("--require-clean");
const full = process.argv.includes("--full");

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

function sha256File(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function executeGate(name, command, args, options = {}) {
  console.log(`\n== ${name} ==`);
  const result = run(command, args, {
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    name,
    passed: result.status === 0,
    exit_code: result.status ?? 1,
  };
}

const startedAt = new Date().toISOString();
const commit = value("git", ["rev-parse", "HEAD"]);
const tree = value("git", ["rev-parse", "HEAD^{tree}"]);
const branch = value("git", ["branch", "--show-current"]);
const dirtyBefore = value("git", ["status", "--porcelain"]) || "";
const pnpmVersion = value("pnpm", ["--version"]);

let preconditionFailure = null;
if (!commit) preconditionFailure = "Unable to resolve git HEAD";
if (requireClean && dirtyBefore) {
  preconditionFailure = "Release verification requires a clean git checkout";
}

const releaseChecks = [];
let verification = {
  status: preconditionFailure ? 1 : null,
  stdout: "",
  stderr: "",
};
if (!preconditionFailure) {
  verification = run(process.execPath, ["scripts/verify.mjs"], {
    maxBuffer: 128 * 1024 * 1024,
  });
  process.stdout.write(verification.stdout || "");
  process.stderr.write(verification.stderr || "");

  if (verification.status === 0 && full) {
    releaseChecks.push(
      executeGate("tracked secrets and full dependency audit", "pnpm", [
        "security:release",
      ]),
    );
    if (releaseChecks.at(-1).passed) {
      releaseChecks.push(
        executeGate("CycloneDX dependency inventory", "pnpm", ["sbom"]),
      );
    }
    if (releaseChecks.every((check) => check.passed)) {
      releaseChecks.push(
        executeGate("financial restart and chaos suite", "pnpm", ["stress:chaos"]),
      );
    }
    if (releaseChecks.every((check) => check.passed)) {
      releaseChecks.push(
        executeGate("disposable banking and FX load proof", "pnpm", [
          "stress:release",
        ]),
      );
    }
    if (releaseChecks.every((check) => check.passed)) {
      releaseChecks.push(
        executeGate("reference container security scan", "pnpm", [
          "security:container",
        ]),
      );
    }
  }
} else {
  console.error(preconditionFailure);
}

const dirtyAfter = value("git", ["status", "--porcelain"]) || "";
if (requireClean && dirtyAfter && !preconditionFailure) {
  preconditionFailure =
    "Release verification changed tracked files; generated sources are not in sync";
}

const operationCoverage = readJson(
  resolve(ROOT, "artifacts/api-operation-coverage.json"),
);
const loadReport = readJson(resolve(ROOT, "artifacts/load-report.json"));
const sbomPath = resolve(ROOT, "artifacts/blueballs-sbom.cdx.json");
const fullChecksPassed = !full || releaseChecks.every((check) => check.passed);
const passed =
  !preconditionFailure &&
  verification.status === 0 &&
  fullChecksPassed &&
  (!requireClean || (dirtyBefore.length === 0 && dirtyAfter.length === 0));

const report = {
  schema_version: 2,
  kind: requireClean ? "release_verification" : "development_verification",
  profile: full ? "full" : "standard",
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  commit,
  tree,
  branch,
  clean_before: dirtyBefore.length === 0,
  clean_after: dirtyAfter.length === 0,
  node: process.version,
  pnpm: pnpmVersion,
  pnpm_lock_sha256: sha256File(resolve(ROOT, "pnpm-lock.yaml")),
  verification_exit_code: verification.status ?? 1,
  release_checks: releaseChecks,
  passed,
  precondition_failure: preconditionFailure,
  api_operation_coverage: operationCoverage,
  load_report: loadReport,
  sbom_sha256: sha256File(sbomPath),
};

mkdirSync(resolve(ROOT, "artifacts"), { recursive: true });
const reportPath = resolve(ROOT, "artifacts/verification-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\nVerification evidence: ${reportPath}`);
console.log(`Release profile: ${report.profile} · commit ${commit ?? "unknown"}`);

if (!passed) process.exit(1);
