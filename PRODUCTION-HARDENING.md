# Production Hardening

Blueballs targets production-grade open-source financial infrastructure.

A deployment still supplies its licences, regulated providers, credentials,
jurisdiction-specific controls and operating organisation, but the Blueballs core
must not require a fork to repair basic correctness, accounting, tenancy,
contracts, retry safety or observability.

This document is the release gate for that standard.

## Production invariant

For every financial command, the following state belongs to one logical unit of
work:

```text
request
  -> authenticated principal
  -> domain state transition
  -> ledger postings
  -> durable event/outbox record
  -> idempotency result
  -> provider submission evidence, when applicable
```

A command either commits the complete state transition or commits none of it.
External side effects are never treated as rolled back merely because local
state rolled back; ambiguous provider submission remains an explicit
reconciliation state.

## P0 — release blockers

### Financial transaction atomicity

- [x] Stage banking resource mutations, ledger rows, events and idempotency in
  one request unit of work.
- [x] Commit staged database state inside one SQLite transaction.
- [x] Trigger event subscribers only after commit.
- [x] Add regression coverage for a failure after money and event staging.
- [ ] Prove the same invariant under Durable Object SQLite.
- [ ] Prove concurrent requests cannot observe uncommitted state or lose a
  committed update.
- [ ] Add crash probes at every money-moving lifecycle boundary.

### Continuous integration

- [x] Add GitHub Actions jobs for banking/OpenAPI, Workers, FX, Solidity and
  container builds.
- [ ] Confirm Actions are enabled and runs are being created for `main` and pull
  requests.
- [ ] Protect `main` and require the aggregate Production gate.
- [ ] Require review for changes to ledger, authentication, policy, FX execution
  and public contracts.

### Executable API contract

- [ ] Exercise all 181 catalogued banking operations against a clean runtime.
- [ ] Validate every successful response against the generated OpenAPI schema.
- [ ] Validate representative 400, 401, 403, 404, 409, 422, 429 and 503 problem
  responses.
- [ ] Fail CI for a documented operation that is not executable in its declared
  mode, except explicitly adapter-required fail-closed operations.
- [ ] Generate a machine-readable coverage artefact naming every operation and
  its proof.

### Clean-clone release proof

- [ ] `pnpm install --frozen-lockfile` succeeds on the pinned Node 24 runtime.
- [ ] `pnpm verify` succeeds from a clean checkout.
- [ ] Both reference Docker images build.
- [ ] Compose topology validates.
- [ ] Foundry unit, fuzz and invariant suites pass.
- [ ] Generated contracts and SDK artefacts have no source drift.

## P1 — production core hardening

### Concurrency and persistence

- [x] Define and implement the banking concurrency model explicitly: the current
  single-database runtime serializes complete request units of work.
- [x] Eliminate shared mutable cache visibility between overlapping requests in
  the single-process/Durable Object runtime by serializing request scopes.
- [x] Prevent concurrent debits from validating against the same uncommitted
  balance; a dedicated double-spend regression test is part of the banking suite.
- [ ] Introduce versioned schema migrations for every persistent table/resource.
- [ ] Test forward migration, restart during migration and rollback procedure.

### Authentication and authorization

- [ ] Add explicit authenticated principal introspection for trusted internal
  service bindings.
- [ ] Replace API-key-as-actor assumptions with named actors, roles and scoped
  permissions while preserving machine credentials.
- [ ] Record actor, credential, tenant and authorization decision in the audit
  trail for sensitive operations.
- [ ] Define step-up and dual-control requirements for privileged operations.

### Provider and adapter standard

- [ ] Give every provider boundary a versioned interface contract.
- [ ] Add adapter conformance suites for identity, accounts, card issuing,
  payment rails, custody, liquidity, FX execution and reconciliation.
- [ ] Require deterministic sandbox/fake adapters for every contract.
- [ ] Treat provider timeouts, duplicate callbacks and ambiguous submission as
  first-class tested states.

### Edge routing

- [ ] Generate Banking-vs-FX runtime ownership from machine-readable API
  metadata instead of a handwritten path list.
- [ ] Test every public `/v2` path through the production edge router.
- [ ] Fail CI when an operation routes to a runtime that does not own it.

### Operational correctness

- [ ] Introduce stable correlation IDs across request, command, ledger
  transaction, event, provider attempt and reconciliation case.
- [ ] Add structured audit records separate from customer-facing events.
- [ ] Add health, readiness and dependency status suitable for orchestration.
- [ ] Add production metrics for balances, posting failures, stale workflows,
  provider latency, reconciliation backlog and idempotency replays.

## P2 — production operations

- [ ] Reference HA topology for a non-Durable-Object deployment.
- [ ] Backup and point-in-time recovery procedures with restore tests.
- [ ] Disaster-recovery exercise and documented RPO/RTO targets.
- [ ] Secret rotation and signing-key rotation runbooks.
- [ ] Dependency and container vulnerability scanning.
- [ ] SAST and secret scanning.
- [ ] Load, soak and chaos testing for payment and FX workflows.
- [ ] External application and smart-contract security review before a 1.0
  production certification claim.

## Definition of done for 1.0

Blueballs 1.0 may be described as production-grade only when the release commit
has machine-verifiable evidence for all of the following:

```text
181 / 181 banking operations contract-tested
0 cross-tenant data leaks in the isolation suite
0 partial local commits across tested financial commands
0 undocumented runtime routes
0 documented-but-missing routes
0 OpenAPI drift
0 generated SDK drift
0 unreviewed failing security or invariant tests
all required CI checks green on the release commit
```

Adapter-required operations may fail closed by design when no provider is
configured, but that behavior itself must be contract-tested and documented.

## Release evidence

Every release should publish or retain:

- commit SHA;
- CI run URL / check results;
- API operation coverage report;
- OpenAPI artefacts;
- SDK package proof;
- contract test summary;
- container image digests;
- dependency inventory/SBOM;
- migration version;
- known production limitations and required external adapters.

A screenshot, successful frontend build or static OpenAPI file is never evidence
that a financial workflow works.
