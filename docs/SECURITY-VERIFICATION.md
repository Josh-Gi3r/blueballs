# Security Verification

Blueballs security verification is executable from the repository and tied to the exact source checkout being evaluated.

## Standard security gate

```bash
pnpm security:release
```

This runs:

- tracked high-signal credential scanning;
- production dependency advisory checks at HIGH/CRITICAL severity;
- repository lint rules.

## Container gate

```bash
pnpm security:container
```

The command builds `Dockerfile.reference` from the current checkout and scans the resulting image with the pinned Trivy container. HIGH/CRITICAL findings with available fixes fail the gate.

## Dependency inventory

```bash
pnpm sbom
```

This writes a CycloneDX inventory for the pnpm workspace and pinned Foundry dependencies to:

```text
artifacts/blueballs-sbom.cdx.json
```

The inventory embeds the current Git commit and can be archived with release evidence.

## Full release profile

```bash
pnpm verify:release
```

The full profile combines security checks with the financial/runtime assurance surface:

- banking API lifecycle and tenant-isolation proof;
- exact-money and transaction rollback invariants;
- provider finality/reconciliation conformance;
- signed inbound settlement replay protection;
- webhook egress and secret-envelope behaviour;
- trusted actor/request binding;
- Cloudflare Durable Object runtime and eviction tests;
- canonical FX node/package tests;
- production FX adapter contract tests;
- Foundry unit/fuzz/invariant tests;
- backup/restore and migration recovery;
- restart/chaos;
- disposable banking + FX load proof;
- reference-container security scan;
- CycloneDX inventory.

The resulting `artifacts/verification-report.json` records the exact commit, Git tree, runtime versions, lockfile digest, API operation coverage, load evidence, SBOM digest and per-gate status.

## Secrets and key material

The tracked-file scanner is intentionally high-signal. Runtime credentials belong in deployment secret storage rather than the repository.

Blueballs production cryptographic boundaries include independent material for:

- tenant/operator machine credentials;
- named-human actor assertions;
- provider gateway authentication;
- provider-originated settlement HMAC;
- AES-256-GCM provider/webhook payload encryption;
- external provider/venue signing keys where required by deployment adapters.

Rotation procedures are documented in [`PRODUCTION-OPERATIONS.md`](PRODUCTION-OPERATIONS.md).

## Solidity verification

```bash
make -C packages/fx-contracts ci
```

The Foundry target covers formatting, build, unit tests, fuzzing and invariants. The contract kernel is intentionally small and separates token backing/accounting, policy authorization, order cancellation, maker settlement and route execution.

## External review interoperability

The deterministic release artifacts, OpenAPI contracts, Solidity sources and threat-model documentation are designed to make third-party application, contract and penetration reviews reproducible. External reviewers can pin the same commit and run the same release profile before adding their own analysis.

See [`../SECURITY.md`](../SECURITY.md), [`../PRODUCTION-HARDENING.md`](../PRODUCTION-HARDENING.md) and [`../RELEASE.md`](../RELEASE.md).
