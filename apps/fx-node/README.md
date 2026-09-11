# Blueballs FX Node

`apps/fx-node` is the canonical Blueballs FX runtime: a self-hostable control plane for policy-aware pricing, liquidity selection, reservation, execution and settlement orchestration.

It composes institution policy, signed private liquidity, reference pricing, principal risk, multi-source route construction, fiat settlement state and optional atomic token execution behind one API surface.

## Run it

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:fx
```

The full stack starts with:

```bash
pnpm dev
```

Default local configuration:

```text
host             127.0.0.1
port             8788
mode             reference-sandbox
API key          bb_test_local_fx
data directory   ./blueballs-fx-data
```

Three runtime compositions are supported:

```text
reference-sandbox   complete deterministic multi-source market and monetary lab
private-sandbox     compact private-order market for integration development
production          institution-supplied adapters for live policy, liquidity, fiat and execution
```

## Production composition

Production mode loads one deployment adapter module and keeps the Blueballs API/state-machine contract unchanged.

```bash
FX_NODE_MODE=production \
FX_NODE_PRODUCTION_ADAPTER=./deployment/fx-runtime.mjs \
FX_NODE_API_KEY='replace-with-a-strong-production-key' \
node apps/fx-node/src/cli.js
```

The adapter exports a factory:

```js
export async function createBlueballsFxProductionRuntime({ env }) {
  return {
    market,            // discovery, signed orders, route lookup
    quotes,            // reserve, submit, confirm, fail
    fiat,              // intent, evidence and settlement lifecycle
    executionAdapter,  // provider / venue / AtomicRouter submission
    publicDepth: false,
    async close() {},
  };
}
```

Blueballs validates the adapter contract at startup. Production API keys require at least 32 characters, browser CORS defaults to closed, and execution is routed through the supplied adapter rather than changing the FX kernel.

See [`spec/fx/ADAPTERS.md`](../../spec/fx/ADAPTERS.md) for the complete provider contract.

## One trade object, end to end

The reference runtime demonstrates a mixed-finality customer route:

```text
BRL payment evidence
    → internal BRL deposit claim
    → policy-approved multi-source FX into EURC
    → issuer redemption
    → EUR payout
```

The same trade object carries:

- customer amount and rate;
- quote and route identifiers;
- eligible and excluded liquidity sources;
- selected source allocation;
- policy authorization evidence;
- quote expiry and reservation state;
- token and fiat settlement edges;
- execution and reconciliation state.

### Preview

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades/preview \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00"}'
```

Preview reads current eligible capacity without reserving it.

### Reserve

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00","expiresInMs":60000}'
```

A firm quote is returned only after every selected leg and principal-risk allocation is reserved. The response includes `tradeId`, `quoteId` and `routeId`.

Retrieve or release it:

```bash
curl -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/trades/trade_...

curl -X DELETE \
  -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/trades/trade_...
```

Submitted routes enter reconciliation rather than being released back into liquidity.

## Market scenarios

The reference market can exercise liquidity and policy conditions without changing application code:

```text
balanced
lp_offline
issuer_policy_blocked
treasury_near_limit
principal_limit
reference_outage
```

Inspect or switch the scenario:

```text
GET  /v2/fx/reference/scenario
POST /v2/fx/reference/scenario
```

## Runtime inspection

```text
GET  /v2/fx/reference/status
GET  /v2/fx/reference/policy
GET  /v2/fx/reference/market
GET  /v2/fx/reference/scenario
POST /v2/fx/reference/scenario
GET  /v2/fx/reference/liquidity
GET  /v2/fx/reference/settlement-route
GET  /openapi.yaml
```

## Monetary engine

The reference composition includes reserve-backed instrument and purpose-bound settlement-receipt models. Reserve assets, outstanding supply, receipts and FX risk capital remain separate accounting categories.

```text
GET  /v2/fx/reference/monetary/health
GET  /v2/fx/reference/monetary/instruments
POST /v2/fx/reference/monetary/remittance/preview
POST /v2/fx/reference/monetary/reserves
POST /v2/fx/reference/monetary/reserves/:depositId/settle
POST /v2/fx/reference/monetary/instruments/:code/mint
POST /v2/fx/reference/monetary/instruments/:code/redeem
POST /v2/fx/reference/monetary/receipts
POST /v2/fx/reference/monetary/receipts/:receiptId/consume
POST /v2/fx/reference/monetary/risk-capital
GET  /v2/fx/reference/monetary/events
```

Pricing and coverage calculations use exact integer arithmetic.

## Token quote API

Builders can use the exact-output token API directly:

```text
POST /v2/fx/quotes
GET  /v2/fx/quotes/:quoteId
POST /v2/fx/quotes/:quoteId/execute
GET  /v2/fx/routes/:routeId
```

A quote becomes firm after selected capacity is reserved. Immediately before execution Blueballs revalidates policy and reservations, marks the route submitted, and preserves ambiguous external outcomes for reconciliation.

## Atomic token settlement

`packages/fx-contracts` provides the Blueballs `AtomicRouter`, maker settlement, vault, policy-authorization and cancellation contracts. The router binds taker authority, maker-signed economics and institution policy in one atomic token transaction.

The same FX lifecycle can also submit to institutional venues or internal settlement adapters. Provider-native confirmation remains part of the canonical route state.

## Fiat and finality

Blueballs models fiat as evidence-backed settlement edges rather than collapsing external payment finality into token finality. A route can combine:

```text
VERIFIED_FIAT_PAYMENT   ATTESTED_EXTERNAL
TOKEN_SWAP              ATOMIC
ISSUER_REDEEM           ASYNC_EXTERNAL
```

Each edge keeps its own finality class while the trade remains one coordinated lifecycle.

## Docker

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx .
docker run --rm \
  -p 8788:8788 \
  -v blueballs-fx-data:/data \
  -e FX_NODE_API_KEY=bb_test_change_me \
  blueballs-fx
```

Or run the site, banking API and reference FX composition together:

```bash
docker compose -f compose.reference.yml up --build
```

## Persistence

The reference composition persists independent SQLite stores for policy, market state, liquidity, principal risk, quotes, trades, fiat settlement and monetary-engine evidence. Set `FX_NODE_DATA_DIR` to choose the directory.

Production deployments can supply their own storage/provider implementations through the same adapter boundary without changing public quote semantics.
