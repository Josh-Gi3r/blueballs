# Production Hardening

Blueballs targets production-grade open-source financial infrastructure.

A deployment still supplies its licences, regulated providers, credentials,
jurisdiction-specific controls, human IAM and operating organisation, but the
Blueballs core must not require a fork to repair basic correctness, accounting,
tenancy, contracts, retry safety, reconciliation or observability.

This document is the release gate for that standard. A checked engineering item
means the capability/gate exists in the repository; it does **not** mean a release
candidate has passed that gate. Release evidence is tracked separately below.

## Production invariant

For every financial command, the following state belongs to one logical unit of
work:

```text
request
  -> authenticated principal / authorization
  -> domain state transition
  -> ledger postings
  -> durable event / webhook outbox
  -> idempotency result
  -> audit / correlation evidence
  -> provider outbox evidence, when applicable
  -> local commit
```

A local financial command commits the complete state transition or none of it.
External side effects are never treated as rolled back merely because local state
rolled back; ambiguous provider submission remains explicit reconciliation state.

## P0 — release blockers

### Financial transaction atomicity and restart safety

- [x] Stage banking resource mutations, ledger rows, events/outboxes and
  idempotency in one request unit of work.
- [x] Commit staged database state inside one SQLite transaction.
- [x] Trigger non-durable event subscribers only after commit.
- [x] Add regression coverage for failure after money/event staging.
- [x] Serialize request units while the shared mutable cache is the storage view,
  preventing overlapping writes and dirty reads.
- [x] Add concurrent double-spend and higher-contention exact-balance tests.
- [x] Add Node restart probes across financial command boundaries plus durable
  webhook/provider/recovery state.
- [x] Add Durable Object eviction probes across representative account, vault,
  transfer, card-authorisation and wallet financial families.
- [ ] Retain a green execution report for the complete restart/eviction suite on
  the release commit.

### Release verification and CI

The repository-local `pnpm verify` command is the exact-checkout release proof.
GitHub Actions is an independent hosted gate. A release requires both.

- [x] Keep the complete cross-surface gate in `pnpm verify`.
- [x] Make targeted production deploy commands run release verification before
  publishing.
- [x] Gate persistence schema, API contracts, runtime ownership, provider
  capabilities, key permissions and public examples against drift.
- [x] Define `.github/workflows/production-gate.yml` for build/contracts, banking
  API proof, Workers, FX/SDK, Foundry, container/Compose, Trivy, dependency/
  secret checks and CodeQL.
- [x] Make local builds fail if the hosted production workflow is removed or
  materially weakened.
- [ ] Require the `Production gate` status check on protected `main`.
- [ ] Require CODEOWNERS/maintainer review for ledger, authentication, policy,
  provider/FX execution, migrations and public-contract changes.
- [ ] Produce a clean-checkout verification report for the final release commit.

Branch protection/review enforcement are repository-admin settings and cannot be
substituted with source files.

### Executable API contract

- [x] Exercise all 181 catalogued banking operations for route/access/runtime
  reachability.
- [x] Validate request bodies and query parameters at the HTTP boundary against
  the production contracts used to generate OpenAPI.
- [x] Validate successful runtime responses against those production schemas.
- [x] Validate documented success examples during builds.
- [x] Generate `artifacts/api-operation-coverage.json` from real HTTP calls.
- [x] Add explicit broad lifecycle suites for non-FX and FX catalogue families.
- [x] Cover the synchronous RFC 9457 error classes currently emitted by the
  banking request path: 400, 401, 403, 404, 409, 413, 422, 429 and 503.
- [x] Keep provider transport/finality errors in the durable provider state
  machine instead of fabricating request-time `502` behavior for asynchronous
  provider work.
- [ ] Retain a release artifact proving every success-capable operation returned
  a schema-valid 2xx response and every adapter-required operation failed closed
  by contract.

### Clean-checkout release proof

These remain evidence gates until executed on the exact candidate SHA:

- [ ] `pnpm install --frozen-lockfile` succeeds on pinned Node 24.15.x.
- [ ] `pnpm verify` succeeds from a clean checkout.
- [ ] Reference container builds and its high/critical vulnerability scan passes.
- [ ] Compose topology validates.
- [ ] Foundry unit, fuzz and invariant suites pass.
- [ ] Generated contracts/OpenAPI/SDK artifacts have no source drift.
- [ ] Hosted `Production gate` is green for the same SHA.

## P1 — production core hardening

### Concurrency, persistence and scale

- [x] Define the current banking model explicitly: one serialized unit of work per
  authoritative SQLite-backed shard while the mutable cache exists.
- [x] Prevent concurrent requests from observing another command's staged cache
  mutations.
- [x] Introduce append-only versioned application-data migrations.
- [x] Fail closed when an older binary encounters a newer schema.
- [x] Gate durable collection names against the schema registry.
- [x] Prove failed data-transforming migrations roll back and can restart/retry
  without double-applying data.
- [x] Define the scale-out path to institution/tenant sharding, principal routing,
  inter-shard settlement orchestration and eventual MVCC/OCC prerequisites in
  [`docs/SCALING.md`](docs/SCALING.md).

### Authentication, human IAM and authorization

- [x] Expose the authenticated key/tenant context to trusted internal consumers
  without deriving tenancy from an arbitrary key-list row.
- [x] Add domain-scoped read/write permissions for secondary API keys.
- [x] Prevent restricted credentials from granting permissions they do not hold.
- [x] Gate every TENANT/GLOBAL_READ catalogue route to one permission domain.
- [x] Record tenant, actor, authorization scope and command correlation in
  structured audit evidence.
- [x] Keep human session authentication deployment-owned rather than embedding a
  second password/MFA system in the banking core.
- [x] Accept short-lived HMAC-signed named-human assertions from a trusted
  deployment IAM/session gateway; forged/partial/stale assertions fail closed.
- [x] Define human step-up and N-of-M/dual-control requirements in
  [`docs/IAM.md`](docs/IAM.md). Existing approval chains enforce distinct machine
  approver credentials; deployments centralizing users behind one gateway must
  enforce distinct IdP subjects before issuing approval commands.

### Provider and adapter standard

- [x] Define a provider-neutral gateway envelope with stable job-level
  idempotency, command correlation and bounded transport behavior.
- [x] Persist provider work in a durable outbox before the local command commits.
- [x] Treat timeout, lease expiry, redirects and contradictory transport evidence
  as ambiguous/reconciliation state rather than blind resubmission.
- [x] Apply capability-specific result/finality checks before provider outcomes
  make identity, receiving details, cards, transfers or custody final.
- [x] Encrypt provider outbox payloads with AES-256-GCM and key IDs before
  persistence; production fails closed without encryption material.
- [x] Require provider-originated settled account/custody events to pass both the
  private operator boundary and a separate timestamped HMAC signature.
- [x] Publish a versioned machine-readable capability contract and deterministic
  conformance adapter/fixtures for every currently declared production
  capability.
- [x] Gate provider intent, outcome handlers, docs and conformance fixtures
  against capability-contract drift.

### Webhook delivery

- [x] Persist webhook delivery intent inside the financial/event command.
- [x] Use stable logical delivery IDs, leases, at-least-once retries and
  `Retry-After` handling.
- [x] Resume durable webhook work after Node restart and Cloudflare alarms.
- [x] Seal webhook signing secrets before persistence using the production
  payload-encryption keyring; production fails closed without encryption.
- [x] Keep outbound delivery HTTPS-only, exact-host allowlisted, redirect-free and
  concurrency bounded.

### Edge routing

- [x] Define Banking-vs-FX runtime ownership in machine-readable metadata.
- [x] Make the Site Worker import the shared ownership function directly; there is
  no second handwritten FX path list.
- [x] Fail builds when ownership metadata and canonical FX routes drift.
- [x] Enumerate all 181 public catalogue paths in an edge-ownership test and prove
  every path resolves to Banking or FX plus credential forwarding has no hidden
  operator-key injection.
- [ ] Retain Cloudflare-runtime execution evidence for the complete public edge
  routing suite on the release candidate.

### Operational correctness

- [x] Introduce stable command correlation across request, ledger and events.
- [x] Add structured audit records separate from customer events.
- [x] Strip persistence-only ownership metadata from public responses and stored
  events/webhook payloads.
- [x] Persist provider attempts/reconciliation cases with original command and
  operation IDs.
- [x] Add liveness (`/v2/_health`), dependency readiness (`/v2/_ready`) and
  operator-authenticated operational metrics (`/v2/_ops/metrics`).
- [x] Report aggregate balances, command/audit failures, idempotency replays,
  provider latency/backlog, webhook backlog and reconciliation age/count without
  exposing customer/provider payload data.

## P2 — production operations

- [x] Define a non-Durable-Object active/passive single-writer HA reference and
  failover/fencing requirements.
- [x] Ship verified Node/SQLite snapshot and restore tooling plus automated
  exact-money restore tests.
- [x] Document continuous-PITR as deployment/storage-specific rather than
  misrepresenting periodic snapshots as zero-data-loss PITR.
- [x] Define DR exercises and explicit reference RPO/RTO objectives in
  [`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md).
- [x] Document provider payload, webhook, gateway, inbound-HMAC and API/operator
  credential rotation procedures.
- [x] Provide repeatable tracked-secret, production-dependency and container CVE
  scanning commands; hosted CI also runs CodeQL.
- [x] Provide load/soak and deterministic chaos/restart commands with financial
  acceptance criteria in [`docs/LOAD-CHAOS.md`](docs/LOAD-CHAOS.md).
- [ ] Execute and retain the release-candidate load/soak, recovery/DR and security
  reports against the intended deployment topology.
- [ ] Complete an independent external application and, where used, smart-contract
  security review before a public 1.0 production-certification claim.

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
0 unreviewed high/critical security or invariant failures
Production gate green and required on protected main
pnpm verify green on the exact release checkout
Docker / Trivy / Foundry / Compose proof retained
load/soak and restore/DR evidence retained for the production topology
external security review completed and release-blocking findings resolved
```

Adapter-required operations may fail closed by design when a regulated provider
is not configured, but that behavior itself must be contract-tested and
documented.

## Release evidence

Every production release should retain:

- exact commit SHA and signed/tagged release identity as applicable;
- GitHub `Production gate` result for that SHA;
- clean-checkout `pnpm verify` report;
- API operation coverage report;
- generated OpenAPI and SDK package proof;
- Foundry contract test summary;
- container image digest and vulnerability scan;
- dependency inventory/SBOM;
- banking migration version;
- load/soak configuration/results;
- backup/restore or DR exercise result;
- external review reference for a 1.0 production-certification claim;
- known deployment limitations and required external adapters.

A screenshot, successful frontend build, hosted status badge or static OpenAPI
file is never evidence that a financial workflow works.
