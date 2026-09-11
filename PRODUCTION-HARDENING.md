# Engineering Assurance

Blueballs is engineered as production-grade open-source financial infrastructure. This document defines the invariants and executable assurance model behind that standard.

## Core financial invariant

Every local financial command is one logical unit of work:

```text
request
  → authenticated principal / authorization
  → domain state transition
  → ledger postings
  → durable events and outboxes
  → idempotency result
  → audit and correlation evidence
  → provider intent, when applicable
  → commit
```

The command commits completely or rolls back completely. External side effects use durable job identity and explicit reconciliation rather than being treated as part of a local rollback.

## Financial correctness

Blueballs implements and tests the following controls:

- exact decimal/atomic money conversion without floating-point authoritative accounting;
- balanced double-entry posting;
- customer-account overdraft protection at the ledger boundary;
- serialized command execution for the current SQLite-backed authoritative shard;
- atomic persistence of domain state, ledger, events/outboxes, idempotency and audit evidence;
- concurrent double-spend and higher-contention exact-balance tests;
- restart tests across representative financial command boundaries;
- Cloudflare Durable Object eviction tests across account, vault, transfer, card and wallet families;
- append-only versioned application migrations with rollback/retry tests;
- backup/restore proof that re-derives exact money from restored postings.

## Banking contract assurance

The banking surface is generated and tested as one contract system:

- 181 catalogued operations;
- route/access ownership reconciliation;
- request-body and query validation;
- successful response validation against the same source contracts used for OpenAPI;
- documented example validation;
- lifecycle coverage through real HTTP calls;
- explicit runtime-mode classification;
- permission-domain classification and drift checks;
- RFC 9457 error-contract coverage;
- generated TypeScript/OpenAPI compatibility proof;
- machine-readable operation coverage written to `artifacts/api-operation-coverage.json`.

The API suite fails when a success-capable operation does not produce a schema-valid successful lifecycle response.

## Identity and authorization

- Tenant identity is a stable opaque principal rather than contact metadata.
- Secondary API keys can be restricted by domain/read/write permission.
- Restricted credentials cannot delegate authority they do not hold.
- Operator state is isolated behind an independent operator credential.
- Named-human assertions can be supplied by institution-owned IAM/BFF infrastructure.
- Human assertions are HMAC-signed and bound to the machine credential, HTTP method, route, query and body.
- Step-up and multi-approver workflows preserve distinct actor evidence.
- Authentication, authorization and lifecycle preflight execute before idempotent replay is returned.

## Provider orchestration

Blueballs ships a provider-neutral production protocol for payments, receiving details, card issuance, identity and custody.

The provider layer includes:

- durable operation outbox;
- stable external idempotency IDs;
- leases and retry schedules;
- attempt history;
- capability-specific result/finality validation;
- explicit pending, ambiguous, failed and manual-review states;
- reconciliation cases tied back to original commands/resources;
- AES-256-GCM payload sealing with key IDs and key rotation support;
- provider-result conformance fixtures and drift gates;
- safe-refund rules based on explicit funds state;
- production success handlers that update canonical state and ledger evidence atomically.

Provider transport evidence and business evidence must agree before a financial outcome becomes final.

## Provider-originated money

Inbound account credits and custody deposits use a separate settlement-evidence boundary:

- private operator route;
- dedicated timestamped HMAC signature;
- final provider state requirement;
- tenant/resource ownership checks;
- currency checks;
- event-ID replay protection;
- provider-reference settlement deduplication;
- ledger posting, durable evidence and customer event committed in one command.

## Webhook delivery

Webhook delivery is durable and at-least-once:

- delivery intent is committed with the originating event;
- stable delivery IDs support receiver deduplication;
- leases and retries survive process restarts;
- Cloudflare alarms resume work after Durable Object eviction;
- signing secrets are encrypted before durable persistence;
- egress is HTTPS-only, exact-host allowlisted, redirect-free and concurrency-bounded.

## FX assurance

The canonical FX stack combines:

- participant/account attribution and transaction policy;
- short-lived policy authorizations invalidated by participant or policy changes;
- exact rational pricing and integer atomic-unit amounts;
- private signed orders and multiple institutional source classes;
- policy-first liquidity eligibility;
- multi-source exact-output optimization;
- idempotent reservation/release;
- route state that becomes non-releasable at submission;
- explicit confirmation/failure reconciliation;
- fiat evidence and finality state separate from token execution;
- adapter-driven production runtime composition;
- optional `AtomicRouter` settlement for token legs.

The production FX node loads an institution-supplied runtime adapter and validates the complete market/quote/fiat/execution contract before serving traffic.

## Solidity kernel

The FX contracts cover:

- EIP-712 taker and maker authority;
- ERC-1271 smart-wallet signatures through `SignatureChecker`;
- nonce replay protection;
- institution policy authorization and epoch invalidation;
- maker cancellation and partial-fill accounting;
- cumulative exact rounding across partial fills;
- segregated vault liabilities;
- solvency checks and surplus-only rescue;
- bounded withdrawal-delay incident controls;
- atomic route execution protected by reentrancy guards.

The Foundry gate includes formatting, build, unit tests, fuzzing and vault invariants.

## Runtime and operations

Blueballs supports Node/SQLite and Cloudflare Worker/Durable Object compositions with shared banking semantics.

Operational tooling includes:

- liveness, readiness and operator metrics;
- command/audit/provider/webhook backlog visibility;
- versioned migrations;
- verified SQLite backup and restore;
- active/passive single-writer HA reference architecture;
- RPO/RTO and DR runbooks;
- provider/encryption/credential rotation procedures;
- deterministic restart/chaos suite;
- disposable banking + FX load proof;
- tracked-secret and dependency scanning;
- CycloneDX dependency inventory;
- reference-container vulnerability scanning.

## Release authority

Verification is reproducible from the repository rather than dependent on a hosted CI vendor.

Standard engineering gate:

```bash
pnpm verify
```

Full clean-checkout release gate:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The full profile executes the complete repository gate and additional security, dependency, restart/chaos, load and container checks. It writes evidence under `artifacts/`, including:

- exact commit and Git tree;
- pinned runtime/toolchain identity;
- lockfile SHA-256;
- API operation coverage;
- load report;
- CycloneDX dependency inventory and digest;
- per-gate exit results;
- clean-checkout state before and after verification.

## 1.0 acceptance model

The release profile is designed to prove the following invariants for the exact candidate checkout:

```text
181 banking operations classified and contract-tested
success-capable operations exercised with schema-valid responses
adapter-backed operations retain explicit provider/finality contracts
zero observed cross-tenant data exposure in the isolation suite
zero partial local commits across tested financial commands
zero undocumented or unowned public routes
zero OpenAPI request/response drift
zero generated SDK drift
exact-money restore proof passes
restart and Durable Object eviction proof passes
Foundry unit/fuzz/invariant gate passes
load acceptance criteria pass
secret/dependency/container security gates pass
release checkout remains clean
```

This keeps the engineering claim tied to executable evidence, while institutions remain free to compose their own providers, infrastructure, IAM and jurisdiction-specific operating policy around the Blueballs core.
