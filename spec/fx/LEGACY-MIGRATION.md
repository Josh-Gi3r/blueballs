# Blueballs FX - Legacy Migration

## Decision

The canonical FX architecture is:

```text
apps/fx-node
packages/fx-contracts
packages/fx-market
packages/fx-pricing
packages/fx-liquidity
packages/fx-policy
packages/fx-fiat
packages/fx-sdk
packages/fx-simulator
```

Older FX demonstrations inside `apps/api/src/routes/` are frozen compatibility surfaces. They must not define new FX economics, policy, risk, settlement or website behaviour.

## Legacy files

```text
apps/api/src/routes/fx.js
apps/api/src/routes/fx-swap.js
apps/api/src/routes/fx-lp.js
apps/api/src/pricing.js
apps/api/src/assets.js
```

Those files were built before the modular institutional FX stack. They use different assumptions, including a monolithic in-process model and historical pricing behaviour.

## What remains supported

The general banking API can continue serving its historical demonstration endpoints for existing local examples while migration is completed.

They are **not**:

- the source of truth for `/fx`;
- the canonical OpenAPI FX contract;
- covered by the modular FX claim set;
- a production integration path;
- permitted to receive new FX features.

## Migration path

### Stage 1 - frozen compatibility

Current state.

- keep endpoints available;
- document them as legacy;
- route all new UI and SDK work to `apps/fx-node`;
- do not copy pricing or source logic between systems.

### Stage 2 - compatibility facade

Where backwards compatibility is useful, replace each historical implementation with a thin client to the canonical FX node.

The facade must translate only:

- request field names;
- asset identifiers;
- response shape;
- authentication context.

It must not independently calculate rates, capacity, policy or settlement.

### Stage 3 - removal

Remove legacy endpoints in the next breaking API version after:

- usage is measured;
- migration examples are published;
- the deprecation window is complete;
- `src/endpoints.ts` and public documentation are versioned accordingly.

## Endpoint guidance

Use the canonical node for new work:

```text
POST /v2/fx/reference/trades/preview
POST /v2/fx/reference/trades
GET  /v2/fx/reference/trades/:tradeId
POST /v2/fx/quotes
GET  /v2/fx/quotes/:quoteId
GET  /v2/fx/routes/:routeId
```

Historical endpoints such as `/v2/fx/quote`, `/v2/fx/route`, `/v2/fx/intents` and `/v2/ramps/*` must be treated as compatibility demonstrations only.

## Non-negotiable rule

No public claim may combine numbers or state from the legacy API with the canonical FX runtime as though they came from one transaction.
