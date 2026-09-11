# Blueballs General Banking API

`apps/api` is the banking-core runtime for accounts, transfers, identity,
provider-backed external operations, cards/custody, policy/approvals, ledger,
events, audit and supporting resources. The same domain/runtime code runs on the
Node/SQLite and Cloudflare Durable Object storage adapters.

The repository also keeps executable sandbox/reference product operations in the
catalogue. Production mode rejects those explicitly rather than pretending a
sandbox state transition reached a real bank, processor or regulated product.
See [`../../docs/OPERATION-MODES.md`](../../docs/OPERATION-MODES.md).

Run the local sandbox from the repository root:

```bash
pnpm dev:api
```

It listens on `http://localhost:5290/v2` by default.

## Financial command boundary

State-changing requests execute inside one serialized banking unit of work for
the current SQLite-backed shard. Business resource state, double-entry ledger
postings, events/durable outboxes, idempotency and audit correlation commit
together or roll back together.

Money is accepted as exact decimal strings and converted to integer minor units.
Customer ledger accounts cannot fall below zero through a posting; system/
clearing accounts are explicit. External side effects are never treated as part
of a rollbackable local database transaction: provider work is queued durably and
ambiguous external outcomes remain reconciliation state.

The current single-writer model is intentional. Scale by authoritative
institution/tenant shards, not by adding unsynchronised writers to one banking
database. See [`../../docs/SCALING.md`](../../docs/SCALING.md).

## Tenant, credentials and human IAM

Every sandbox signup creates a new opaque tenant principal. An email address is
contact metadata, not proof that two signups are the same account. Additional API
keys inherit the caller's tenant and may be narrowed by domain/read-write
permissions; a restricted key cannot mint permissions it does not hold.

Production does not allow public signup. A fresh production database requires an
explicit bootstrap admin secret from deployment secret storage. If every
credential is later revoked, Blueballs refuses to create a new tenant implicitly;
recovery requires an explicit existing `BANK_BOOTSTRAP_TENANT_ID` and new recovery
secret.

API keys are machine credentials. A deployment-owned OIDC/SAML/passkey gateway
may attach a short-lived HMAC-signed named-human assertion so audit evidence can
record the human subject and step-up assurance without exposing the backend API
credential to the browser. See [`../../docs/IAM.md`](../../docs/IAM.md).

## Production provider boundary

External banking effects use the provider-neutral durable gateway protocol:

- bank/payment transfer submission and reconciliation;
- receiving-detail/instrument provisioning;
- identity verification submission;
- card issuance;
- custody wallet provisioning and custody transfer;
- signed provider-originated settled bank/custody credits.

A production command that requires an adapter fails closed when the configured
provider gateway/encryption dependency is unavailable. Provider payloads are
encrypted with AES-256-GCM before they are persisted in the durable outbox.
Timeouts, contradictory evidence and process/lease ambiguity reconcile under the
same stable provider operation ID instead of blindly resubmitting.

Provider-originated customer-money credits require the private operator boundary
**and** a separate timestamped HMAC signature. Canonical settled-event types
credit money only when `provider_state=settled`.

See [`../../docs/PROVIDER-GATEWAY.md`](../../docs/PROVIDER-GATEWAY.md),
[`../../docs/PROVIDER-CONFORMANCE.md`](../../docs/PROVIDER-CONFORMANCE.md) and
[`../../docs/PROVIDER-INBOUND.md`](../../docs/PROVIDER-INBOUND.md).

## Webhook boundary

Outbound webhooks are disabled by default, including on the shared reference
host. A self-hoster must set `WEBHOOK_DELIVERY_MODE=allowlist` and exact HTTPS
hosts in `WEBHOOK_ALLOWED_HOSTS`. HTTP, credentials/fragments, redirects and
non-allowlisted hosts are rejected.

Delivery intent is stored in the same command as the originating event. Delivery
is at-least-once with a stable delivery ID, leases, retries and receiver-side
deduplication. Webhook signing secrets are returned only at target creation and
are sealed before persistence using the production encryption keyring.

## FX ownership boundary

The FX modules inside the banking application are historical compatibility/
reference surfaces:

```text
src/routes/fx.js
src/routes/fx-swap.js
src/routes/fx-lp.js
src/pricing.js
src/assets.js
```

Do not add production FX pricing, liquidity, policy, treasury or settlement
behavior there. Production FX ownership is:

```text
apps/fx-node
packages/fx-*
```

The Site Worker imports one machine-readable runtime-ownership contract to route
public `/v2` paths between Banking and canonical FX. Build/tests fail when that
ownership drifts.

## Persistence and recovery

Banking application data uses append-only versioned migrations. An older binary
fails closed against a newer schema. Migration tests prove atomic rollback and
restart/retry behavior for data-transforming migrations.

Node banking snapshots use a consistent SQLite backup path with integrity/schema
validation; restore tests verify exact ledger-derived money. A periodic snapshot
is not zero-data-loss PITR. Production committed-ledger durability, HA, RPO/RTO
and DR requirements are defined in
[`../../docs/PRODUCTION-OPERATIONS.md`](../../docs/PRODUCTION-OPERATIONS.md).

Cloudflare uses the same banking domain model over Durable Object SQLite and
alarms for provider/webhook work. Worker tests deliberately evict the banking
object and reconstruct representative financial families from durable state.

## Health and operational evidence

Infrastructure endpoints outside the 181-operation product catalogue are:

- `GET /v2/_health` — liveness/source/schema identity;
- `GET /v2/_ready` — production dependency readiness;
- `GET /v2/_ops/metrics` — operator-authenticated aggregate operational metrics.

The API integration suite validates requests and successful responses against the
same contracts that generate OpenAPI and writes a machine-readable operation
coverage artifact. The complete production release/evidence bar lives in
[`../../PRODUCTION-HARDENING.md`](../../PRODUCTION-HARDENING.md).
