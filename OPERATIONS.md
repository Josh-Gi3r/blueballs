# Operations Guide

This guide operates the reference stack. Production deployment requires an
institution-specific security, availability, compliance and recovery design.

## Local stack

```bash
pnpm install --frozen-lockfile
cp .env.example .env  # optional; defaults work without it
pnpm dev
```

| Service | Default | Health or entry point |
| --- | --- | --- |
| Site | `http://localhost:5280` | `/` |
| Banking API | `http://localhost:5290` | `/v2` |
| Canonical FX node | `http://127.0.0.1:8788` | `/health` |

The development launcher stops the other processes if one exits. The local FX
credential is a browser-safe test value; never reuse it outside the reference
sandbox.

## Configuration

Start from [`.env.example`](.env.example). Important boundaries:

- `DB_PATH` chooses the Node banking SQLite file.
- `RATE_LIMIT_PER_MIN`, `SOURCE_RATE_LIMIT_PER_MIN` and
  `TENANT_RATE_LIMIT_PER_MIN` bound API traffic.
- `BODY_LIMIT_BYTES`, `CORS_ORIGINS` and `TRUST_PROXY` control request ingress.
- `OPERATOR_API_KEY_HASH` protects operator-class banking routes.
- `IDEMPOTENCY_TTL_MS` controls replay-record retention.
- `WEBHOOK_DELIVERY_MODE=disabled` is the safe default. `allowlist` additionally
  requires `WEBHOOK_ALLOWED_HOSTS`; only exact HTTPS hosts are accepted.
- `FX_NODE_MODE`, `FX_NODE_HOST`, `FX_NODE_PORT`, `FX_NODE_API_KEY`,
  `FX_NODE_DATA_DIR` and `FX_NODE_CORS_ORIGINS` configure the canonical FX node.
- `FX_NODE_API_KEY` protects FX scenario, reservation, release and execution
  mutations in the Node reference. The Cloudflare equivalent is the secret
  `FX_API_KEY`. Never put a production value in a `VITE_*` variable.

Secrets belong in the deployment secret store, not JSON configuration, Compose
files, browser bundles or source control.

The full local launcher deliberately passes its test-only `FX_NODE_API_KEY` to
the Vite demonstrator. That convenience is acceptable only for the isolated
reference sandbox; a real operator credential must never be browser-readable.
`pnpm dev` loads a root `.env` when present. Commands that start an individual
Node service do not; export the variables first or invoke Node with
`--env-file=.env`.

## Cloudflare reference deployment

The three configurations are deliberately separate:

- `wrangler.api.jsonc`: banking Worker and `BANK_API` Durable Object;
- `wrangler.fx.jsonc`: FX Worker and `FX_API` Durable Object;
- `wrangler.jsonc`: public site, assets, domain and service bindings.

Validate bundles without deployment:

```bash
pnpm build
pnpm exec wrangler deploy --dry-run --config wrangler.api.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.fx.jsonc
pnpm exec wrangler deploy --dry-run --config wrangler.jsonc
```

Set Worker secrets out of band, for example:

```bash
pnpm exec wrangler secret put FX_API_KEY --config wrangler.fx.jsonc
```

Deploy APIs before the site so its service bindings resolve. Durable Object
migrations are append-only: add a new migration tag for a schema/class change;
never rewrite an already deployed migration. The current hosted banking sandbox
uses disposable reference data, so a deliberate namespace/schema cutover is
preferable to inventing tenant ownership for legacy rows.

Logs are enabled in all three Wrangler configurations. Treat logs as potentially
sensitive: avoid request bodies, credentials and customer data, and set
retention/access controls in the owning Cloudflare account.

## Docker reference stack

```bash
docker compose -f compose.reference.yml up --build
docker compose -f compose.reference.yml ps
```

The Compose file builds one reference image and runs the site, banking API and
FX node. FX state persists in the `fx-data` volume. Banking persistence must be
explicitly mounted and backed up before any non-disposable use; the supplied
Compose topology is an evaluation stack, not an HA deployment.

Stop without deleting data:

```bash
docker compose -f compose.reference.yml down
```

`down -v` deletes the named FX volume and is intentionally destructive.

## Backup and recovery

For Node references, stop writers or use a SQLite-consistent backup mechanism,
then back up the banking database and the complete `FX_NODE_DATA_DIR`. Restore
into a new environment, start the same source commit and verify accounts,
balanced ledger entries, FX policy, reservations and settlement state before
routing traffic.

For Durable Objects, define an account-level export/backup and restore exercise
before production use. This repository does not claim cross-region HA or provide
a one-command production recovery workflow.

## Deployment and rollback

1. Choose one clean candidate commit and run [`TESTING.md`](TESTING.md).
2. Build both Docker images and run the Compose health checks on a machine with
   a Docker daemon.
3. Review generated OpenAPI, SDK package, SBOM, screenshots and limitations.
4. Deploy to an isolated preview and exercise the banking quickstart plus FX
   preview/operator boundaries.
5. Promote the unchanged artefact. If health, ownership, balances or reservation
   invariants fail, stop traffic and restore the previous artefact and its
   compatible data snapshot.

Never roll application code backward across an incompatible data migration
without a tested data rollback. See [`RELEASE.md`](RELEASE.md) for tagging and
release evidence.
