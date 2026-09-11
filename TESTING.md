# Testing and Verification

Blueballs keeps its assurance model inside the repository so contributors, operators and institutions can reproduce the same gates from an exact checkout.

## Toolchain

- Node.js 24.15.x within the pinned 24.x line
- pnpm from the root `packageManager` field
- Foundry for Solidity unit, fuzz and invariant tests
- Docker + Compose for reference topology and image scanning
- Wrangler / Cloudflare Vitest for Worker and Durable Object runtime parity

Install exactly from the lockfile:

```bash
pnpm install --frozen-lockfile
```

## Standard engineering gate

```bash
pnpm verify
```

This gate covers:

- build and TypeScript compilation;
- syntax, ESLint and formatting;
- complete banking API test suite;
- all 181 public banking operations for route/access/lifecycle coverage;
- schema-valid success evidence for success-capable operations;
- exact-money, idempotency, double-entry rollback and concurrent-spend invariants;
- tenant isolation and resource lifecycle boundaries;
- command/request/audit/ledger/event correlation;
- provider finality, encryption, reconciliation and inbound signed settlement;
- webhook durable outbox/restart/encryption behavior;
- canonical FX package/node suites;
- production FX runtime adapter conformance;
- Cloudflare Worker/Durable Object transaction and eviction behavior;
- public edge runtime ownership for all banking catalogue paths;
- OpenAPI request/response/example drift gates;
- generated banking TypeScript declarations and FX SDK package boundary;
- Foundry format/build/unit/fuzz/invariant checks;
- Compose topology validation;
- live scratch-API tenant and money-movement checks.

## Full release gate

```bash
pnpm verify:release
```

The release profile requires a clean checkout and adds:

- tracked-secret scan;
- production dependency advisory audit;
- CycloneDX dependency inventory;
- financial restart/chaos suite;
- disposable banking + FX load proof;
- reference-container build and HIGH/CRITICAL vulnerability scan.

The release script records the exact commit, Git tree, runtime versions, lockfile digest, API operation coverage, load evidence, SBOM digest and per-gate results in `artifacts/verification-report.json`.

## Focused development commands

```bash
pnpm build
pnpm lint
pnpm test:api
pnpm test:workers
pnpm test:fx
pnpm build:openapi
pnpm lint:openapi
pnpm security:release
pnpm stress:chaos
pnpm stress:release
```

For Solidity only:

```bash
make -C packages/fx-contracts ci
```

For a manual banking journey:

```bash
pnpm dev
node examples/banking-quickstart.mjs http://localhost:5290
```

## API operation coverage

`pnpm test:api` records successful HTTP calls by operation ID and writes:

```text
artifacts/api-operation-coverage.json
```

The API suite is lifecycle-aware: a documented success-capable operation must actually return a schema-valid success during the integration suite rather than merely exist in the router.

## Restart, recovery and migrations

Banking recovery tooling is executable:

```bash
pnpm backup:banking -- --source <bank.sqlite> --destination <backup.sqlite>
pnpm restore:banking -- --backup <backup.sqlite> --destination <restored.sqlite>
```

Automated recovery tests validate SQLite integrity, schema version and exact ledger-derived money after restore. Migration tests prove failed data transforms roll back atomically and can be retried after restart without double-applying state.

The deterministic failure bundle is:

```bash
pnpm stress:chaos
```

It exercises banking restart boundaries, webhook durability, recovery, FX lifecycle behavior and Cloudflare Durable Object financial eviction.

## Load proof

For a self-contained release check:

```bash
pnpm stress:release
```

This command starts disposable banking and FX runtimes, provisions a funded banking account, drives concurrent banking and FX traffic, requires the configured error-rate threshold, and writes:

```text
artifacts/load-report.json
```

For custom soak profiles against a disposable environment:

```bash
LOAD_MODE=both \
LOAD_DURATION_SECONDS=300 \
LOAD_CONCURRENCY=25 \
BANK_API_KEY=... \
BANK_ACCOUNT_ID=... \
pnpm stress:load
```

See [`docs/LOAD-CHAOS.md`](docs/LOAD-CHAOS.md) for acceptance criteria.

## Security verification

```bash
pnpm security:release
pnpm security:container
pnpm sbom
```

`security:release` checks tracked credentials, production dependency advisories and lint rules. `security:container` builds the pinned reference image and scans it with the pinned Trivy container. `pnpm sbom` writes the CycloneDX inventory used in release evidence.

See [`docs/SECURITY-VERIFICATION.md`](docs/SECURITY-VERIFICATION.md).

## Release evidence

A full release verification produces or validates:

1. exact commit and Git tree;
2. clean checkout before and after the gate;
3. pinned Node/pnpm identity;
4. lockfile SHA-256;
5. banking operation coverage;
6. OpenAPI/SDK source synchronization;
7. Foundry unit/fuzz/invariant pass;
8. Cloudflare runtime/eviction pass;
9. recovery and migration pass;
10. security/dependency/container pass;
11. load/chaos pass;
12. CycloneDX inventory.

The tagged release procedure lives in [`RELEASE.md`](RELEASE.md).
