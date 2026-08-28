# Blueballs General Banking API

`apps/api` is the single-process reference API for the general banking stack: accounts, cards, transfers, identity workflows, products, ledger and supporting resources.

Run it from the repository root:

```bash
pnpm dev:api
```

It listens on `http://localhost:5290/v2` by default.

## FX deprecation boundary

The FX modules in this application are historical compatibility demonstrations:

```text
src/routes/fx.js
src/routes/fx-swap.js
src/routes/fx-lp.js
src/pricing.js
src/assets.js
```

They are frozen. Do not add new FX pricing, liquidity, policy, treasury or settlement behaviour here.

The canonical FX runtime is:

```text
apps/fx-node
packages/fx-*
```

The SDK calls `apps/fx-node` directly. The public `/fx` page is a labelled,
in-browser simulation and does not send trades to either runtime. Read
`spec/fx/LEGACY-MIGRATION.md` before changing a historical FX endpoint.

## Tenant and webhook boundary

Every signup creates a new opaque tenant principal. An email address is contact
metadata, not proof that two signups are the same account. Additional keys must
be created by an authenticated key and inherit that key's `tenant_id`.
Public sandbox keys expire after 24 hours by default; secondary keys require an
explicit lifetime no longer than seven days. An expired key is rejected and
removed at the authentication boundary.

Outbound webhooks are disabled by default, including on the shared reference
host. A self-hoster must set `WEBHOOK_DELIVERY_MODE=allowlist` and provide exact
HTTPS hostnames in `WEBHOOK_ALLOWED_HOSTS`. Redirects, HTTP targets and hosts
outside that list are rejected. Secrets are returned only when a webhook is
created.

The public reference deployment uses a fresh Durable Object namespace for the
tenant model. Pre-release sandbox rows are disposable and are not assigned to
tenants by guessing from duplicate email addresses.

## Deployment boundary

The Node reference uses SQLite; the Cloudflare reference uses Durable Object
SQLite and its native synchronous transaction boundary. Both are evaluation
deployments. A production deployment must replace or harden identity, banking
rails, key management, monitoring, backup, disaster recovery and operational
controls.
