# Blueballs Banking Core

`apps/api` is the Blueballs banking runtime for customers, accounts, transfers, identity, cards, custody, approvals, provider orchestration, ledger, events, audit and institution operations. The same domain contracts run on Node/SQLite and Cloudflare Durable Object storage.

The API exposes 181 catalogued banking operations with exact-money accounting, tenant isolation, durable provider state and executable OpenAPI contracts.

## Run it

```bash
pnpm dev:api
```

Default local address:

```text
http://localhost:5290/v2
```

## Financial command boundary

State-changing requests execute inside one serialized banking unit of work for the current SQLite-backed shard:

```text
request
  → authentication / authorization
  → lifecycle preflight
  → domain mutation
  → double-entry postings
  → durable event/outboxes
  → idempotency result
  → audit correlation
  → commit
```

Business state, ledger postings, events/outboxes, idempotency and audit evidence commit together or roll back together.

Money enters as exact decimal strings and is represented as integer minor units. Ledger transactions balance exactly and customer accounts cannot be overdrawn by a posting.

## Tenant and credential model

Every institution/customer environment is anchored to an opaque tenant principal. Contact metadata never determines tenancy.

Additional API keys inherit the tenant and can be narrowed by domain/read-write permission. Restricted credentials cannot mint broader authority.

Production bootstrap uses a deployment secret and stable tenant identity. Credential recovery is explicit and tenant-safe.

## Named-human IAM attribution

Blueballs machine credentials integrate cleanly with institution-owned OIDC/SAML/passkey gateways. A gateway can attach a short-lived signed human assertion containing the named subject and assurance level.

The signature binds the actor to:

- authenticated machine credential;
- method and route;
- canonical query;
- canonical JSON body;
- timestamp.

This preserves named-person audit evidence without moving browser/session authentication into the banking kernel. See [`../../docs/IAM.md`](../../docs/IAM.md).

## Provider orchestration

External banking effects use one provider-neutral durable protocol:

- payment transfer submission and reconciliation;
- receiving-detail provisioning;
- identity verification;
- card issuance;
- custody wallet provisioning;
- custody transfer;
- provider-originated settled bank/custody credits.

Provider operations are committed durably before network submission. Stable job IDs become external idempotency identities; retries, lease recovery, contradictory evidence and ambiguous outcomes all converge into the same reconciliation record.

Provider payloads are sealed with AES-256-GCM before durable persistence and carry a key ID for rotation.

Inbound settlement uses a second, independent control plane: operator authentication plus a dedicated timestamped HMAC signature. Event identity and provider settlement reference both participate in replay protection.

See [`../../docs/PROVIDER-GATEWAY.md`](../../docs/PROVIDER-GATEWAY.md), [`../../docs/PROVIDER-CONFORMANCE.md`](../../docs/PROVIDER-CONFORMANCE.md) and [`../../docs/PROVIDER-INBOUND.md`](../../docs/PROVIDER-INBOUND.md).

## Webhooks

Webhook delivery is durable, signed and at-least-once. Delivery intent commits with the originating financial event and survives restart/Worker eviction.

Egress policy is HTTPS-only, exact-host allowlisted, redirect-free and concurrency-bounded. Signing secrets are encrypted before target/outbox persistence.

## Runtime modes

The banking catalogue contains both product-building operations and production banking operations. `BANK_API_MODE` selects the operating contract while [`spec/banking/operation-modes.mjs`](../../spec/banking/operation-modes.mjs) keeps that classification machine-readable and testable.

Production integrations enter through the provider protocol and canonical FX runtime rather than duplicating provider-specific behaviour inside route handlers.

## FX ownership

Banking-compatible FX routes remain available in the banking catalogue. Canonical policy, pricing, liquidity, reservation, treasury and settlement development lives in:

```text
apps/fx-node
packages/fx-*
```

The Site Worker imports shared runtime-ownership metadata to route public `/v2` traffic between Banking and FX. Drift checks cover the complete banking catalogue.

## Persistence and recovery

Banking application data uses append-only versioned migrations with atomic rollback/retry proof for data-transforming migrations.

Node snapshots use consistent SQLite backup with integrity/schema validation; restore tests verify exact ledger-derived money.

Cloudflare uses the same banking domain/runtime model over Durable Object SQLite and alarms. Eviction tests recreate representative financial families from durable state.

See [`../../docs/SCALING.md`](../../docs/SCALING.md) and [`../../docs/PRODUCTION-OPERATIONS.md`](../../docs/PRODUCTION-OPERATIONS.md).

## Health and operational visibility

Infrastructure endpoints include:

- `GET /v2/_health` — liveness, source and schema identity;
- `GET /v2/_ready` — dependency readiness;
- `GET /v2/_ops/metrics` — operator-authenticated aggregate operational metrics.

Metrics expose aggregate balances, command/audit failures, idempotent replays, provider latency/backlog, webhook backlog and reconciliation age/count without exposing customer/provider payload data.

## Verification

```bash
pnpm test:api
pnpm verify
pnpm verify:release
```

The API suite records successful real HTTP calls by operation ID, validates them against the same contracts that generate OpenAPI and writes `artifacts/api-operation-coverage.json`.

The engineering assurance model lives in [`../../PRODUCTION-HARDENING.md`](../../PRODUCTION-HARDENING.md).
