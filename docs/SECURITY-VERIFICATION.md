# Security verification

Security checks are release controls, not evidence that Blueballs or a deployment
has completed an independent security audit.

## Local / release-machine checks

From a clean checkout with the pinned Node/pnpm versions:

```bash
pnpm install --frozen-lockfile
pnpm security:release
pnpm sbom
```

`security:release` runs the tracked high-signal credential scan, rejects high or
critical production dependency advisories and runs repository lint rules.

On a release machine with Docker:

```bash
pnpm security:container
```

This builds `Dockerfile.reference` and scans the resulting image with a pinned
Trivy image. High/critical findings with available fixes fail the gate. The
scanner result must be retained with the release evidence rather than inferred
from a prior build.

## Hosted analysis

`.github/workflows/production-gate.yml` repeats the secret/dependency checks,
builds/scans the reference container and runs GitHub CodeQL over the JavaScript /
TypeScript code. The final `Production gate` depends on the security job.

Hosted CodeQL is supplemental to the exact-checkout `pnpm verify` evidence; neither
replaces the other.

## Solidity

The FX contracts use the Foundry `ci` target for formatting, build, unit tests,
fuzzing and invariants. A production smart-contract deployment still requires an
independent review appropriate to the deployed bytecode, signer/key policy and
chain environment.

## Secrets

The local scanner intentionally targets high-signal credential formats and
tracked non-template `.env` files. It is not a substitute for GitHub secret
scanning, cloud secret-manager policy or organisation-wide leak detection.
Production deployments should enable the hosting provider's repository and
runtime secret scanning as well.

## SBOM and dependency inventory

`pnpm sbom` produces the repository dependency inventory used in release
evidence. Pin release tooling and archive the lockfile/SBOM with the commit.
Dependency risk assessment must also consider provider SDKs/infrastructure that
live outside this provider-neutral repository.

## Required external review before a 1.0 production certification claim

The repository may not self-certify an independent audit. Before a public 1.0
production certification claim, retain external review evidence covering at
least:

- banking API authentication/authorization and tenant isolation;
- financial transaction/ledger/idempotency invariants;
- provider/webhook SSRF, signing, replay and ambiguity handling;
- identity/customer-data exposure and encryption boundaries;
- deployment configuration and secret management;
- canonical FX policy/reservation/settlement design;
- Solidity contracts and deployment roles where used;
- penetration testing of the actual deployed institution surface.

Findings that can affect funds, tenant boundaries, authorization or finality are
release blockers until fixed and regression-tested.
