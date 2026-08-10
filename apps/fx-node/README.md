# Blueballs FX Node

`apps/fx-node` is the canonical self-hostable runtime for Blueballs FX.

It composes institution policy, signed private liquidity, reference pricing, principal risk, multi-source route construction, source reservation, fiat settlement state and the public BRL to EUR reference trade.

## Start the reference runtime

From the repository root:

```bash
pnpm install
pnpm dev:fx
```

Or start the full product:

```bash
pnpm dev
```

Defaults:

```text
host             127.0.0.1
port             8788
mode             reference-sandbox
API key          bb_test_local_fx
data directory   ./blueballs-fx-data
execution        not configured
```

Run directly:

```bash
cd apps/fx-node
FX_NODE_API_KEY=bb_test_change_me npm start
```

The reference inventory is local and replaceable. Policy admission is not bypassed: participants, credentials, account attribution, corridor rules, limits and authorisations flow through `FxPolicyEngine`.

A smaller historical private-order-only mode remains available for isolated market tests:

```bash
FX_NODE_MODE=private-sandbox npm start
```

No production mode silently falls back to either sandbox.

## One customer trade, one runtime object

The public reference trade is:

```text
BRL through an attested PIX-style payment
    → BRLX
    → policy-approved, multi-source BRLX/EURC token FX
    → EURC issuer redemption
    → EUR
```

The same trade object contains:

- customer amount and rate;
- quote and route identifiers;
- eligible and excluded sources;
- selected source allocation;
- token corridor amounts;
- mixed-finality settlement edges;
- policy-authorisation evidence;
- quote expiry and lifecycle state.

### Preview

Preview uses live policy-approved capacity but does not reserve it:

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades/preview \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00"}'
```

The response is labelled `LIVE FX NODE PREVIEW` and has `evidence.reserved: false`.

### Reserve

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00","expiresInMs":60000}'
```

A firm sandbox trade is returned only after all selected source capacity and principal risk have been reserved. The response includes `tradeId`, `quoteId` and `routeId`.

Retrieve or release it:

```bash
curl -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/trades/trade_...

curl -X DELETE \
  -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/trades/trade_...
```

A submitted route cannot be released. It must be reconciled.

## Reference market scenarios

Inspect the current market:

```bash
curl -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/scenario
```

Apply one backend scenario:

```bash
curl -X POST http://localhost:8788/v2/fx/reference/scenario \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"id":"issuer_policy_blocked"}'
```

Available scenarios:

```text
balanced
lp_offline
issuer_policy_blocked
treasury_near_limit
principal_limit
reference_outage
```

These mutate the reference runtime. They are distinct from the deterministic economic simulator exposed on the website.

## Runtime inspection

```text
GET  /v2/fx/reference/status
GET  /v2/fx/reference/policy
GET  /v2/fx/reference/market
GET  /v2/fx/reference/scenario
POST /v2/fx/reference/scenario
GET  /v2/fx/reference/liquidity
GET  /v2/fx/reference/settlement-route
```

The machine-readable contract is served without authentication:

```text
GET /openapi.yaml
```

## Token quote API

The underlying exact-output token API remains available for builders who already know the token pair and desired output:

```text
POST /v2/fx/quotes
GET  /v2/fx/quotes/:quoteId
POST /v2/fx/quotes/:quoteId/execute
GET  /v2/fx/routes/:routeId
```

The reference runtime includes proof-token corridors for USDC/EURC and BRLX/EURC.

## Execution semantics

The default runtime does not configure an execution adapter.

```text
POST /v2/fx/reference/trades/:tradeId/execute
POST /v2/fx/quotes/:quoteId/execute
```

Both fail closed with `EXECUTION_UNAVAILABLE` until an operator supplies an adapter. The node never invents a transaction hash or treats submission as settlement.

Before an outbound attempt:

1. live policy and reservations are revalidated;
2. the route becomes `SUBMITTED`;
3. it becomes non-releasable;
4. an ambiguous external result remains submitted for reconciliation.

The repository separately contains a controlled Anvil proof for the Solidity AtomicRouter. That proof demonstrates the contract kernel; it is not silently substituted for an operational execution adapter.

## Fiat and finality

The BRL to EUR route is `MIXED_FINALITY`:

```text
VERIFIED_FIAT_PAYMENT   ATTESTED_EXTERNAL
TOKEN_SWAP              ATOMIC
ISSUER_REDEEM           ASYNC_EXTERNAL
```

Only token edges in the same AtomicRouter transaction boundary may be called atomic.

## Docker

From the repository root:

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx .
docker run --rm \
  -p 8788:8788 \
  -v blueballs-fx-data:/data \
  -e FX_NODE_API_KEY=bb_test_change_me \
  blueballs-fx
```

Or run the full site, banking API and FX node:

```bash
docker compose -f compose.reference.yml up --build
```

## Persistence

The reference runtime persists separate SQLite stores for:

- policy;
- private market;
- reference liquidity;
- principal risk;
- integrated quotes;
- customer-facing trades;
- fiat settlement.

Set `FX_NODE_DATA_DIR` to choose the directory.

## Replacing reference providers

Read `spec/fx/ADAPTERS.md`. Production deployments must provide real:

- maker signature verification and key custody;
- identity and compliance facts;
- issuer, LP, institution and treasury adapters;
- bank-rail and payment-verification adapters;
- execution and reconciliation integration;
- production database and high-availability design;
- monitoring, operational controls and independent security review.

See `spec/fx/PUBLIC-REFERENCE.md` and `spec/fx/KNOWN-LIMITATIONS.md` for the complete boundary.
