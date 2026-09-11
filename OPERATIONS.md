# Operations Guide

Blueballs core targets production-grade financial operation. A deployment still
supplies its licences, regulated providers, infrastructure security, jurisdictional
controls and operating organisation, but the core ships explicit readiness,
reconciliation, backup/restore and release-evidence contracts.

For the detailed production SRE/DR runbook, RPO/RTO targets, metrics and key
rotation procedures, see [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Local stack

```bash
pnpm install --frozen-lockfile
cp .env.example .env  # optional; defaults work without it
pnpm dev
```

| Service | Default | Health or entry point |
| --- | --- | --- |
| Site | `http://localhost:5280` | `/` |
| Banking API | `http://localhost:5290` | `/v2`, `/v2/_health`, `/v2/_ready` |
| Canonical FX node | `http://127.0.0.1:8788` | `/health` |

The development launcher stops the other processes if one exits. Local/test
credentials are fixtures only; never reuse them outside an isolated sandbox.

## Banking runtime configuration

Start from [`.env.example`](.env.example). Important boundaries:

- `DB_PATH` chooses the Node banking SQLite file.
- `BANK_API_MODE=production` disables sandbox-only money/KYC/card shortcuts.
- `BANK_BOOTSTRAP_*` performs controlled first-tenant/key bootstrap on a fresh
  production database.
- `RATE_LIMIT_PER_MIN`, `SOURCE_RATE_LIMIT_PER_MIN` and
  `TENANT_RATE_LIMIT_PER_MIN` bound API traffic.
- `BODY_LIMIT_BYTES`, `CORS_ORIGINS` and `TRUST_PROXY` control request ingress.
- `OPERATOR_API_KEY_HASH` protects operator-class routes.
- `IDEMPOTENCY_TTL_MS` controls replay-record retention.
- `BANK_PROVIDER_GATEWAY_URL` + `BANK_PROVIDER_GATEWAY_TOKEN` configure the
  provider-neutral production adapter boundary.
- `BANK_PROVIDER_PAYLOAD_KEY(S)` encrypt durable provider payloads before they are
  persisted.
- `BANK_PROVIDER_INBOUND_SECRET` signs canonical provider-originated settled
  financial facts independently of the operator credential.
- `WEBHOOK_DELIVERY_MODE=disabled` is the safe default. `allowlist` additionally
  requires `WEBHOOK_ALLOWED_HOSTS`; redirects are never followed.

Production secrets belong in a deployment secret manager, not JSON, Compose,
browser bundles, source control or a committed `.env` file.

## Health, readiness and operational metrics

Use:

```text
GET /v2/_health       public liveness
GET /v2/_ready        public dependency readiness
GET /v2/_ops/metrics  operator-authenticated operational aggregates
```

In production, readiness fails closed if required provider transport, provider
payload encryption or signed provider-inbound authentication is missing.

The operator metrics surface includes aggregate resource/balance controls,
provider attempt/outbox/reconciliation state, webhook backlog, command failures
and idempotency replay counts. It never exposes provider payloads or customer
identity fields.

## Cloudflare reference deployment

The three configurations are deliberately separate:

- `wrangler.api.jsonc`: banking Worker and `BANK_API` SQLite Durable Object;
- `wrangler.fx.jsonc`: FX Worker and `FX_API` Durable Object;
- `wrangler.jsonc`: public site, assets, domain and service bindings.

Run the Cloudflare topology locally with:

```bash
pnpm preview:cloudflare
```

Validate bundles without deployment:

```bash
pnpm build
pnpm exec wrangler deploy --dry-run --config wrangler.api.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.fx.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.jsonc
```

### Deploy an exact release commit

```bash
git status --porcelain    # must be empty
git rev-parse HEAD        # release identity
pnpm verify               # complete local release proof
pnpm deploy:cloudflare
```

Targeted deploy commands use the same release verification guard. APIs should be
deployed before the public site so service bindings resolve. Record the deployed
SHA and retain the hosted Production Gate result for the same SHA.

Set Worker secrets out of band, for example:

```bash
pnpm exec wrangler secret put FX_API_KEY --config wrangler.fx.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_GATEWAY_TOKEN --config wrangler.api.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_PAYLOAD_KEY --config wrangler.api.jsonc
pnpm exec wrangler secret put BANK_PROVIDER_INBOUND_SECRET --config wrangler.api.jsonc
```

Durable Object class migrations and application-data banking migrations are two
different layers. Both are append-only. Never rewrite a deployed migration.

Logs are potentially sensitive. Do not log bodies, credentials, PAN data, KYC
documents or decrypted provider payloads; configure retention/access controls in
the owning infrastructure.

## Docker reference stack

```bash
docker compose -f compose.reference.yml up --build
docker compose -f compose.reference.yml ps
```

The Compose topology is a reference deployment, not a multi-writer HA design.
Do not place independent writable SQLite replicas behind a load balancer.

Stop without deleting data:

```bash
docker compose -f compose.reference.yml down
```

`down -v` deletes named volumes and is intentionally destructive.

## Verified Node/SQLite backup

Blueballs ships a consistent online SQLite snapshot command:

```bash
pnpm backup:banking -- --db /var/lib/blueballs/blueballs.sqlite \
  --out /backups/blueballs-$(date -u +%Y%m%dT%H%M%SZ).sqlite
```

It uses a WAL-safe SQLite snapshot, verifies `PRAGMA integrity_check`, and verifies
that the backup carries the current Blueballs banking migration version. A failed
verification removes the invalid snapshot rather than presenting it as a backup.

Backups must be encrypted and copied outside the primary failure domain.

## Verified restore

Fence/stop the target writer before restore:

```bash
pnpm restore:banking -- --backup /backups/blueballs-....sqlite \
  --db /var/lib/blueballs/blueballs.sqlite --force
```

The restore validates the source snapshot, copies to a temporary destination,
validates the copy again and atomically renames it into place.

After restore, do **not** immediately reopen traffic. Check `_ready`, release SHA,
schema version, aggregate balances and all provider/webhook reconciliation state.
External provider side effects that occurred after the snapshot are not rolled
back with SQLite and must be reconciled explicitly.

## Provider operations

Outbound production work uses a durable provider outbox with stable job-level
idempotency, attempt leases and explicit reconciliation. See:

- [`docs/PROVIDER-GATEWAY.md`](docs/PROVIDER-GATEWAY.md)
- [`docs/PROVIDER-CONFORMANCE.md`](docs/PROVIDER-CONFORMANCE.md)
- [`docs/PROVIDER-INBOUND.md`](docs/PROVIDER-INBOUND.md)

Provider-originated settled credits/deposits require both the private operator
credential and a dedicated HMAC signature. `event_id` is the durable financial
idempotency identity.

## Security/release gate

The hosted Production Gate includes:

- frozen dependency install;
- build/contracts/static drift gates;
- 181-operation banking proof;
- Cloudflare Worker runtime/eviction tests;
- FX packages/SDK;
- Foundry build/fuzz/invariants;
- container and Compose validation;
- tracked-secret scanning;
- high/critical production dependency audit;
- CodeQL JavaScript/TypeScript analysis.

Repository-local `pnpm verify` remains a separate required exact-checkout release
proof. Hosted CI does not replace local release evidence and vice versa.

## Deployment and rollback

1. Choose one clean candidate commit.
2. Run `pnpm install --frozen-lockfile` on Node 24.15.x.
3. Run `pnpm verify` and retain output.
4. Require the hosted `Production gate` to be green for the same SHA.
5. Retain API operation coverage, OpenAPI/SDK proof, SBOM, Foundry results,
   container digest and migration version.
6. Deploy to isolated preview/staging and exercise provider reconciliation and
   banking/FX smoke flows.
7. Promote the unchanged artifact.
8. If health/readiness, balances, ownership or provider finality invariants fail,
   stop traffic and follow the recovery/reconciliation runbook.

Never roll application code backward across an incompatible data migration
without a tested data plan. See [`RELEASE.md`](RELEASE.md) and
[`PRODUCTION-HARDENING.md`](PRODUCTION-HARDENING.md).
