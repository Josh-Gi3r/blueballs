# Blueballs FX Node

`apps/fx-node` is the canonical self-hostable runtime for Blueballs FX.

It composes institution policy, signed private liquidity, reference pricing, principal risk, multi-source route construction, source reservation, fiat settlement state and the public BRL to EUR reference trade.

It also includes a reference Monetary Engine for reserve-backed sandbox instruments
and purpose-bound settlement receipts. Its BRL to EUR preview delegates to the same
pricing, liquidity and reservation pipeline as the canonical reference trade. The
published three-source price is explicitly a valuation fixture, not an external
oracle or executable quote. These are simulations, not production assets, deposits,
price feeds or claims on Blueballs.

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
    → an internal BRL deposit claim (not a public token)
    → policy-approved, multi-source BRL-claim/EURC FX
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

## Monetary Engine reference

The reference runtime configures two currency-labelled illustrative instruments:

- `USD`, a reference USD-backed stablecoin model;
- `EUR`, a reference EUR tokenized bank-deposit model.

These are instrument identifiers inside the sandbox, not token tickers or claims that
Blueballs issues dollars or euros.

Reserve assets, outstanding supply, active settlement receipts and FX risk capital
are separate accounting categories. Risk capital is visible in health output but
is never counted as issuance reserve. Pending deposits cannot support minting.

Public, non-mutating evidence:

```text
GET  /v2/fx/reference/monetary/health
GET  /v2/fx/reference/monetary/instruments
POST /v2/fx/reference/monetary/remittance/preview
```

The compatibility preview accepts BRL atomic units and returns the canonical BRL to
EUR trade preview. Its `pricing.reference` object identifies deterministic fixtures
as `REFERENCE_FIXTURE`, `VALUATION_CONTROL_ONLY` and non-executable. Its client price
is calculated from policy-approved liquidity; a firm price exists only after every
selected source reserves capacity through the trade endpoint. One basis point is
`0.01%`; source and aggregate spread comparisons use exact integer arithmetic.

Operator-authenticated state transitions:

```text
POST /v2/fx/reference/monetary/reserves
POST /v2/fx/reference/monetary/reserves/:depositId/settle
POST /v2/fx/reference/monetary/instruments/:code/mint
POST /v2/fx/reference/monetary/instruments/:code/redeem
POST /v2/fx/reference/monetary/receipts
POST /v2/fx/reference/monetary/receipts/:receiptId/consume
POST /v2/fx/reference/monetary/risk-capital
GET  /v2/fx/reference/monetary/events
```

A settlement receipt is explicitly non-transferable, purpose-bound and expiring.
It locks settled reserve until it is consumed once or expires; it is not presented
as a stablecoin or general-purpose money.

## Token quote API

The underlying exact-output token API remains available for builders who already know the token pair and desired output:

```text
POST /v2/fx/quotes
GET  /v2/fx/quotes/:quoteId
POST /v2/fx/quotes/:quoteId/execute
GET  /v2/fx/routes/:routeId
```

The reference runtime includes a proof-token USDC/EURC corridor and an internal
BRL-deposit-claim/EURC corridor. The BRL claim is a sandbox ledger claim, not a
publicly issued token or an assertion that a BRL stablecoin exists.

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
- monetary instruments, reserves, supply, receipts, risk capital and event evidence.

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

See `spec/fx/PUBLIC-REFERENCE.md` for the reference contract and `spec/fx/PRODUCTION-CHECKLIST.md` for what a production deployment connects.
