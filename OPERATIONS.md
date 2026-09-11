# Operations Guide

Blueballs ships explicit readiness, reconciliation, backup/restore, migration, load and release-evidence contracts for production financial operation.

For detailed SRE/DR procedures, RPO/RTO targets, metrics and key rotation, see [`docs/OPERATIONS.md`](docs/OPERATIONS.md) and [`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md).

## Local stack

```bash
pnpm install --frozen-lockfile
cp .env.example .env  # optional
pnpm dev
```

| Service | Default | Health / entry point |
| --- | --- | --- |
| Site | `http://localhost:5280` | `/` |
| Banking API | `http://localhost:5290` | `/v2`, `/v2/_health`, `/v2/_ready` |
| FX node | `http://127.0.0.1:8788` | `/health` |

The development launcher stops sibling processes if one exits.

## Banking runtime configuration

Start from [`.env.example`](.env.example).

Key controls:

- `DB_PATH` chooses the Node banking SQLite file.
- `BANK_API_MODE` selects the banking operating contract.
- `BANK_BOOTSTRAP_*` performs controlled first-tenant/admin bootstrap and credential recovery.
- source/tenant rate-limit variables bound API traffic.
- `BODY_LIMIT_BYTES`, `CORS_ORIGINS` and `TRUST_PROXY` control request ingress.
- `OPERATOR_API_KEY_HASH` protects operator-class routes.
- `BANK_TRUSTED_ACTOR_SECRET` authenticates named-human IAM assertions.
- `BANK_PROVIDER_GATEWAY_URL` + `BANK_PROVIDER_GATEWAY_TOKEN` configure banking provider orchestration.
- `BANK_PROVIDER_PAYLOAD_KEY(S)` encrypt durable provider and webhook secret envelopes.
- `BANK_PROVIDER_INBOUND_SECRET` authenticates provider-originated settled facts.
- `WEBHOOK_DELIVERY_MODE=allowlist` enables exact-host HTTPS webhook egress.

Production secrets belong in deployment secret storage rather than source control or browser bundles.

## FX production runtime

The canonical FX node supports adapter-driven production composition:

```bash
FX_NODE_MODE=production \
FX_NODE_PRODUCTION_ADAPTER=@institution/blueballs-fx-runtime \
FX_NODE_API_KEY='32-or-more-characters' \
node apps/fx-node/src/cli.js
```

The adapter supplies institution-owned market/liquidity, quote lifecycle, fiat evidence and execution while Blueballs preserves canonical API and finality semantics.

See [`spec/fx/ADAPTERS.md`](spec/fx/ADAPTERS.md).

## Health, readiness and metrics

```text
GET /v2/_health       public liveness/source/schema identity
GET /v2/_ready        dependency readiness
GET /v2/_ops/metrics  operator-authenticated operational aggregates
```

Metrics include aggregate balances, command/audit failures, idempotent replays, provider latency/backlog, webhook backlog and reconciliation age/count without exposing customer/provider payload data.

## Cloudflare deployment

Blueballs separates site, banking and FX configurations:

- `wrangler.api.jsonc`: banking Worker + `BANK_API` SQLite Durable Object;
- `wrangler.fx.jsonc`: FX Worker + `FX_API` Durable Object;
- `wrangler.jsonc`: public site, static assets and service bindings.

Local topology:

```bash
pnpm preview:cloudflare
```

Bundle validation:

```bash
pnpm build
pnpm exec wrangler deploy --dry-run --config wrangler.api.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.fx.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.jsonc
```

### Deploy an exact release commit

```bash
git status --porcelain    # must be empty
git rev-parse HEAD
pnpm verify:release
pnpm deploy:cloudflare
```

APIs should be deployed before the public site so service bindings resolve. Record the deployed SHA together with the release evidence generated under `artifacts/`.

Worker secrets are set out of band, for example:

```bash
pnpm exec wrangler secret put FX_API_KEY --config wrangler.fx.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_GATEWAY_TOKEN --config wrangler.api.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_PAYLOAD_KEY --config wrangler.api.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_INBOUND_SECRET --config wrangler.api.jsonc
```

Durable Object class migrations and application-data migrations are separate append-only layers. Never rewrite a deployed migration.

## Docker reference stack

```bash
docker compose -f compose.reference.yml up --build
docker compose -f compose.reference.yml ps
```

Stop while preserving named volumes:

```bash
docker compose -f compose.reference.yml down
```

`down -v` deletes named volumes.

## Verified banking backup

```bash
pnpm backup:banking -- --source /var/lib/blueballs/blueballs.sqlite \
  --destination /backups/blueballs-$(date -u +%Y%m%dT%H%M%SZ).sqlite
```

The backup path creates a consistent SQLite snapshot and validates integrity and banking migration version.

## Verified restore

Fence the target writer, then:

```bash
pnpm restore:banking -- --backup /backups/blueballs-....sqlite \
  --destination /var/lib/blueballs/blueballs.sqlite
```

The restore validates the source, copies to a temporary target, validates the restored database and atomically installs it.

Before traffic resumes, verify readiness, source commit, migration version, aggregate balances and outstanding provider/webhook reconciliation state.

## Provider operations

Outbound external work uses the durable provider outbox with stable job-level idempotency, attempt leases and explicit reconciliation.

See:

- [`docs/PROVIDER-GATEWAY.md`](docs/PROVIDER-GATEWAY.md)
- [`docs/PROVIDER-CONFORMANCE.md`](docs/PROVIDER-CONFORMANCE.md)
- [`docs/PROVIDER-INBOUND.md`](docs/PROVIDER-INBOUND.md)

Provider-originated settled credits/deposits use independent signed evidence in addition to operator authentication.

## Release assurance

Standard engineering verification:

```bash
pnpm verify
```

Full clean-checkout release verification:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The full profile covers build/contracts, 181-operation banking lifecycle proof, Cloudflare runtime/eviction, FX packages and production adapter contract, Foundry fuzz/invariants, tracked-secret/dependency checks, CycloneDX inventory, restart/chaos, disposable load proof, Compose and reference-container vulnerability scanning.

Release evidence includes:

- exact commit and Git tree;
- Node/pnpm identity and lockfile digest;
- API operation coverage;
- load report;
- dependency inventory;
- security/container gate status;
- clean-checkout state before and after verification.

## Deployment and rollback

1. Select one clean candidate commit.
2. Install with the pinned Node/pnpm toolchain and frozen lockfile.
3. Run `pnpm verify:release` and archive `artifacts/`.
4. Deploy the unchanged artifact to preview/staging.
5. Exercise provider reconciliation and banking/FX smoke flows.
6. Promote the same artifact.
7. If readiness, balances, ownership or provider-finality invariants fail, fence traffic and follow the recovery/reconciliation runbook.

Never roll application code backward across an incompatible data migration without a tested data plan.

See [`RELEASE.md`](RELEASE.md) and [`PRODUCTION-HARDENING.md`](PRODUCTION-HARDENING.md).
