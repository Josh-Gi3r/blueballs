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
  -> authorization decision
  -> domain state transition
  -> ledger postings
  -> durable event/outbox record
  -> idempotency result
  -> audit/correlation evidence
  -> provider submission evidence, when applicable
```

A command either commits the complete local state transition or commits none of
it. External side effects are never treated as rolled back merely because local
state rolled back; ambiguous provider submission remains an explicit
reconciliation state.

## P0 — release blockers

### Financial transaction atomicity

- [x] Stage banking resource mutations, ledger rows, events and idempotency in
  one request unit of work.
- [x] Commit staged database state inside one SQLite transaction.
- [x] Trigger event subscribers only after commit.
- [x] Add regression coverage for a failure after money and event staging.
- [x] Serialize request units while the shared in-memory cache remains the
  storage view, preventing overlapping writes and dirty reads.
- [x] Add a concurrent double-spend regression case.
- [ ] Complete crash probes at every money-moving lifecycle boundary.
- [ ] Complete Durable Object crash/eviction probes for each financial family,
  not only the shared transaction layer.

### Release verification and CI

The repository-local `pnpm verify` command is the canonical release test, and
GitHub Actions must run equivalent production gates on every pull request and
push to `main`. Hosted CI is not a substitute for a clean-checkout release proof;
both are required.

- [x] Keep the complete cross-surface gate in `pnpm verify`.
- [x] Make targeted production deploy commands run the same release verification
  before publishing.
- [x] Keep build-time drift gates for persistence schema, API contracts, runtime
  ownership, key permissions and public examples.
- [x] Define `.github/workflows/production-gate.yml` for build/contracts, banking
  API proof, Workers parity, FX/SDK, Solidity fuzz/invariants and container checks.
- [ ] Require the `Production gate` status check on protected `main`.
- [ ] Produce a clean-checkout verification report for the release commit.
- [ ] Require maintainer/CODEOWNERS review for changes to ledger,
  authentication, policy, FX execution, migrations and public contracts.

### Executable API contract

- [x] Exercise all 181 catalogued banking operations for route/access/runtime
  reachability.
- [x] Validate successful responses against the same production schemas used by
  generated OpenAPI during API integration tests.
- [x] Validate request bodies against the same production request contracts at
  the HTTP boundary.
- [x] Validate documented success examples against their schemas during builds.
- [x] Generate an operation-success coverage artifact from real HTTP test calls.
- [ ] Complete successful lifecycle coverage for every success-capable operation.
- [ ] Complete representative 400, 401, 403, 404, 409, 413, 422, 429, 502 and 503
  problem-response conformance tests.

### Clean-checkout release proof

- [ ] `pnpm install --frozen-lockfile` succeeds on the pinned Node 24 runtime.
- [ ] `pnpm verify` succeeds from a clean checkout.
- [ ] Reference container builds.
- [ ] Compose topology validates.
- [ ] Foundry unit, fuzz and invariant suites pass.
- [ ] Generated contracts and SDK artifacts have no source drift.

## P1 — production core hardening

### Concurrency and persistence

- [x] Define the current banking concurrency model explicitly: one serialized
  unit of work per SQLite-backed banking runtime while the mutable cache exists.
- [x] Prevent concurrent requests from observing another command's staged cache
  mutations.
- [x] Introduce append-only versioned application-data migrations.
- [x] Fail closed when an older binary encounters a newer schema.
- [x] Gate durable collection names against the versioned schema registry.
- [ ] Add migration restart/interruption tests for every future data-transforming
  migration.
- [ ] Define the scale-out path from serialized single-runtime execution to
  tenant sharding or optimistic concurrency without weakening invariants.

### Authentication and authorization

- [x] Expose the authenticated key/tenant context to trusted internal consumers
  through the normal authenticated key response rather than deriving tenancy
  from an arbitrary list row.
- [x] Add domain-scoped read/write permissions for secondary API keys.
- [x] Prevent restricted credentials from granting permissions they do not hold.
- [x] Gate every TENANT/GLOBAL_READ catalogue route to exactly one permission
  domain.
- [x] Record actor, credential, tenant, authorization context and command
  correlation in structured audit evidence.
- [ ] Add named human actors/session authentication for dashboard/operator use;
  API keys remain machine credentials.
- [ ] Define step-up and dual-control requirements for privileged operator and
  treasury actions.

### Provider and adapter standard

- [ ] Give every provider boundary a versioned interface contract.
- [ ] Add adapter conformance suites for identity, accounts, card issuing,
  payment rails, custody, liquidity, FX execution and reconciliation.
- [ ] Require deterministic sandbox/fake adapters for every contract.
- [ ] Treat provider timeouts, duplicate callbacks and ambiguous submission as
  first-class tested states.

### Edge routing

- [x] Define Banking-vs-FX runtime ownership in machine-readable metadata.
- [x] Fail builds when the edge routing list and runtime ownership metadata drift.
- [ ] Generate the edge routing table directly from the ownership contract so
  the Worker contains no duplicated list.
- [ ] Test every public `/v2` path through the production edge router.

### Operational correctness

- [x] Introduce stable command correlation across request, ledger transaction and
  event records.
- [x] Add structured audit records separate from customer-facing events.
- [x] Strip persistence-only ownership metadata from public responses and stored
  event/webhook payloads.
- [x] Persist webhook delivery intent in the financial transaction and retry it
  from a durable outbox with stable delivery IDs.
- [ ] Extend correlation through every external provider attempt and
  reconciliation case.
- [ ] Add health, readiness and dependency status suitable for orchestration.
- [ ] Add production metrics for balances, posting failures, stale workflows,
  provider latency, reconciliation backlog and idempotency replays.

## P2 — production operations

- [ ] Reference HA topology for a non-Durable-Object deployment.
- [ ] Backup and point-in-time recovery procedures with restore tests.
- [ ] Disaster-recovery exercise and documented RPO/RTO targets.
- [ ] Secret rotation and signing-key rotation runbooks.
- [ ] Dependency and container vulnerability scanning procedure that can run
  locally/on a release machine.
- [ ] SAST and secret scanning procedure that can run locally/on a release
  machine.
- [ ] Load, soak and chaos testing for payment and FX workflows.
- [ ] External application and smart-contract security review before a 1.0
  production certification claim.

## Definition of done for 1.0

Blueballs 1.0 may be described as production-grade only when the release commit
has retained machine-verifiable evidence for all of the following:

```text
181 / 181 banking operations classified and contract-tested
all success-capable operations exercised successfully
all adapter-required operations proven fail-closed without an adapter
0 cross-tenant data leaks in the isolation suite
0 partial local commits across tested financial commands
0 undocumented runtime routes
0 documented-but-missing routes
0 OpenAPI request/response drift
0 generated SDK drift
0 unreviewed failing security or invariant tests
Production gate is green and required on protected main
pnpm verify passes on the exact release checkout
release-machine Docker / Foundry / Compose proof retained
```

Adapter-required operations may fail closed by design when no provider is
configured, but that behavior itself must be contract-tested and documented.

## Release evidence

Every release should publish or retain:

- commit SHA;
- GitHub `Production gate` result for that exact commit;
- local `pnpm verify` report/output for that exact checkout;
- API operation coverage report;
- OpenAPI artifacts;
- SDK package proof;
- contract test summary;
- container image digest;
- dependency inventory/SBOM;
- migration version;
- known production limitations and required external adapters.

A screenshot, successful frontend build, hosted status badge or static OpenAPI
file is never evidence that a financial workflow works.
