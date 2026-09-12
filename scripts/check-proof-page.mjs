#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const proof = read("../src/proof/proof-data.ts");
const verify = read("./verify.mjs");
const release = read("./release-proof.mjs");
const deploy = read("./deploy-cloudflare.mjs");
const proofPage = read("../src/proof/ProofPage.tsx");
const packageManifest = read("../package.json");

assert.match(
  verify,
  /ops === 181/,
  "the banking verification gate must still require 181 OpenAPI operations",
);
assert.match(
  proof,
  /all 181 operations/i,
  "the public Proof copy must stay aligned with the banking operation gate",
);
assert.match(
  verify,
  /all 9 package suites passed/,
  "the FX verification gate must still cover nine package suites",
);
assert.match(
  proof,
  /All nine FX package suites/i,
  "the public Proof copy must stay aligned with the FX package gate",
);
assert.match(
  verify,
  /Foundry contract gate/,
  "the repository gate must retain the Foundry contract gate",
);
assert.match(proof, /Foundry format, build, fuzz and invariant tests/i);
assert.match(
  verify,
  /Durable Object eviction/,
  "the Worker verification gate must retain Durable Object eviction coverage",
);
assert.match(proof, /Durable Object eviction behaviour/i);

assert.match(
  packageManifest,
  /"security:dependencies": "pnpm audit --audit-level high"/,
  "release dependency auditing must cover the full dependency graph",
);
assert.doesNotMatch(
  packageManifest,
  /"security:dependencies": "[^"]*--prod[^"]*"/,
  "build and development tooling must not be excluded from release dependency auditing",
);

for (const gate of [
  "tracked secrets and full dependency audit",
  "CycloneDX dependency inventory",
  "financial restart and chaos suite",
  "disposable banking and FX load proof",
  "reference container security scan",
]) {
  assert.match(release, new RegExp(gate, "i"), `release gate missing: ${gate}`);
}
for (const claim of [
  "Tracked-secret and full dependency audit",
  "CycloneDX dependency inventory",
  "Restart and chaos suite",
  "Disposable banking and FX load proof",
  "Reference-container security scan",
  "Exact-checkout evidence",
]) {
  assert.match(proof, new RegExp(claim, "i"), `Proof page missing: ${claim}`);
}

assert.match(
  deploy,
  /run\("pnpm", \["verify:release"\]\)/,
  "deploy must retain the full release proof precondition",
);
assert.match(
  deploy,
  /HEAD to equal origin\/main/,
  "deploy must remain bound to published main",
);
assert.match(
  deploy,
  /verifyLiveParity/,
  "deploy must retain live post-promotion parity verification",
);
assert.match(
  deploy,
  /BLUEBALLS_GIT_SHA/,
  "deploy must retain exact source-SHA injection",
);
assert.match(proof, /Full release proof before deploy/i);
assert.match(proof, /Post-deploy convergence check/i);
assert.match(proof, /Source SHA attached to every service/i);

assert.match(
  proofPage,
  /fetch\("\/api\/health"/,
  "the Proof page must read live deployment parity from /api/health",
);
assert.match(
  proofPage,
  /deployment_consistent/,
  "the Proof page must render deployment consistency from the live health contract",
);
assert.doesNotMatch(
  proofPage,
  /externally audited|certified|production certified/i,
  "the public Proof page must not invent third-party assurance",
);

console.log(
  "proof page contract: public verification claims match repository gates, all dependencies are audited, and live parity comes from /api/health",
);
