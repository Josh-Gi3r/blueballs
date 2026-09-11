# Testing and Verification

Blueballs keeps verification in the repository so contributors and operators can
run the same correctness gates. Focused tests are useful during development; a
release candidate requires the complete exact-checkout gate plus hosted
`Production gate` evidence.

## Toolchain

- Node.js 24.15 or newer within the pinned 24.x line
- pnpm from the root `packageManager` field
- Foundry for Solidity tests and controlled EVM proof
- Docker with Compose for reference-image / topology verification
- Wrangler / Cloudflare Vitest for Worker and Durable Object checks

Install exactly from the lockfile:

```bash
pnpm install --frozen-lockfile
```

## Complete repository gate

```bash
pnpm verify
```

The root gate covers, directly or through the component suites:

- banking HTTP workflows, tenant-negative cases, exact money, idempotency,
  double-entry rollback and concurrency/double-spend invariants;
- all 181 public banking catalogue operations for route/access coverage, with
  successful schema-valid lifecycle evidence required for every success-capable
  operation and deliberate fail-closed evidence for adapter-required operations;
- request, query, success-response and documented-example validation against the
  same contracts that generate banking OpenAPI;
- command/request/audit/ledger/event correlation;
- restart persistence, financial restart boundaries and consistent banking
  snapshot/restore;
- versioned migration ordering, atomic rollback and interruption/restart retry;
- provider gateway finality, encryption, conformance fixtures, inbound HMAC
  settlement evidence and reconciliation behavior;
- webhook durable outbox/restart behavior and encrypted signing-secret storage;
- all canonical FX package/node suites and exact-money compatibility paths;
- Durable Object transaction rollback plus financial state across object
  eviction;
- all 181 public `/v2` catalogue paths against the shared production edge runtime
  ownership contract;
- ESLint, formatting, catalogue/schema/permission/runtime-ownership drift gates;
- OpenAPI lint, generated TypeScript SDK declarations and FX SDK tarball boundary;
- Foundry format, build, unit, fuzz and invariant checks;
- Compose configuration validity.

A Docker image build, container CVE scan and hosted CodeQL run need their
respective release-machine/host environments and are enforced by the hosted
production workflow. They are not implied by a frontend build or Compose parse.

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
```

Use `pnpm run` to see the exact commands available at the current commit. Before
claiming a focused pass, state which surface was actually executed.

For Solidity only:

```bash
make -C packages/fx-contracts ci
```

For a manual banking journey:

```bash
pnpm dev
node examples/banking-quickstart.mjs http://localhost:5290
```

## API operation coverage artifact

`pnpm test:api` records successful real HTTP calls by operation ID and writes:

```text
artifacts/api-operation-coverage.json
```

The suite fails if any success-capable catalogue operation never produces a
schema-valid 2xx response. Adapter-required operations are classified explicitly
and must instead prove documented fail-closed behavior without their regulated
adapter.

Do not substitute router reachability for this artifact.

## Recovery and migration proof

Banking recovery is executable:

```bash
pnpm backup:banking -- --source <bank.sqlite> --destination <backup.sqlite>
pnpm restore:banking -- --backup <backup.sqlite> --destination <restored.sqlite>
```

The automated recovery test validates SQLite integrity, schema version and exact
ledger-derived money after restore. Migration tests additionally prove a failed
data-transforming migration rolls back completely and can be retried after a
process/database restart without double-applying rows.

## Load and chaos

Use the deterministic failure bundle:

```bash
pnpm stress:chaos
```

Use the disposable-environment load harness:

```bash
LOAD_MODE=both LOAD_DURATION_SECONDS=300 LOAD_CONCURRENCY=25 \
BANK_API_KEY=... BANK_ACCOUNT_ID=... pnpm stress:load
```

See [`docs/LOAD-CHAOS.md`](docs/LOAD-CHAOS.md) for acceptance criteria. Never run
the banking mutation harness against customer production data.

## Security verification

```bash
pnpm security:release
pnpm security:container   # Docker required
pnpm sbom
```

Hosted CI repeats dependency/secret checks, scans the reference image and runs
CodeQL. See [`docs/SECURITY-VERIFICATION.md`](docs/SECURITY-VERIFICATION.md).
Independent application/contract review remains mandatory before a public 1.0
production-certification claim.

## Release verification

A release candidate must satisfy all of the following:

1. exact checkout is clean and pinned to the intended commit;
2. `pnpm install --frozen-lockfile` succeeds;
3. `pnpm verify` succeeds and retained release proof names the commit;
4. generated contracts/SDK artifacts show no source drift;
5. reference image builds and Compose validates;
6. Foundry gate passes;
7. hosted `Production gate` for the exact commit is green;
8. API operation coverage artifact is retained;
9. security/SBOM evidence is retained;
10. `main` protection requires the production status check and review policy.

The tagged release procedure and artifact list live in [`RELEASE.md`](RELEASE.md).
