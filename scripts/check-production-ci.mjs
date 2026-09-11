#!/usr/bin/env node
/**
 * Fail locally if the hosted production gate is missing or materially weakened.
 *
 * Hosted CI is one release control, not the release authority by itself. The
 * exact release checkout must still pass `pnpm verify`, but deleting this file
 * must never silently remove pull-request/main protection evidence.
 */
import { existsSync, readFileSync } from "node:fs";

const workflowPath = ".github/workflows/production-gate.yml";
const failures = [];

if (!existsSync(workflowPath)) {
  failures.push(`${workflowPath} is missing`);
} else {
  const source = readFileSync(workflowPath, "utf8");
  const required = [
    ["push trigger", /^\s*push:\s*$/m],
    ["pull_request trigger", /^\s*pull_request:\s*$/m],
    ["manual trigger", /^\s*workflow_dispatch:\s*$/m],
    ["pinned Node runtime", /node-version:\s*24\.15\.0/],
    ["frozen dependency install", /pnpm install --frozen-lockfile/],
    ["banking API proof", /pnpm test:api/],
    ["Worker runtime proof", /pnpm test:workers/],
    ["FX proof", /pnpm test:fx/],
    ["Solidity fuzz\/invariant gate", /make -C packages\/fx-contracts ci/],
    ["reference container build", /docker build[^\n]*Dockerfile\.reference/],
    ["Compose validation", /docker compose[^\n]*compose\.reference\.yml[^\n]*config/],
    ["container vulnerability scan", /aquasec\/trivy:[^\s]+ image[\s\S]*--severity HIGH,CRITICAL/],
    ["tracked secret scan", /node scripts\/scan-secrets\.mjs/],
    ["production dependency audit", /pnpm audit --prod --audit-level high/],
    ["CodeQL initialization", /github\/codeql-action\/init@v3/],
    ["CodeQL analysis", /github\/codeql-action\/analyze@v3/],
    ["final production gate", /name:\s*Production gate/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(source)) failures.push(`${workflowPath}: missing ${label}`);
  }

  if (
    !/needs:\s*\[[^\]]*banking_api[^\]]*workers[^\]]*fx[^\]]*contracts[^\]]*container[^\]]*security[^\]]*\]/s.test(
      source,
    )
  ) {
    failures.push(
      `${workflowPath}: final gate does not depend on every production test/security family`,
    );
  }
}

const hardening = readFileSync("PRODUCTION-HARDENING.md", "utf8");
if (/deliberately does not depend on hosted GitHub Actions/i.test(hardening)) {
  failures.push(
    "PRODUCTION-HARDENING.md incorrectly says hosted GitHub Actions are not required",
  );
}

if (failures.length) {
  console.error(`production CI contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  "production CI contract: hosted build, runtime, container and security gates present and locally enforced",
);
