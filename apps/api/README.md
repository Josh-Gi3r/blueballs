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

The product page and SDK call `apps/fx-node` directly. Read `spec/fx/LEGACY-MIGRATION.md` before changing a historical FX endpoint.

## Deployment boundary

This API uses SQLite and in-process reference state. It is suitable for local development and single-process evaluation. A production deployment must replace or harden persistence, identity providers, banking rails, key management, monitoring and operational controls.
