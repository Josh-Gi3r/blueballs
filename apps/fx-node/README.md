# Blueballs FX Node

Self-hostable reference runtime for the Blueballs FX engine.

## Canonical local mode

```bash
cd apps/fx-node
FX_NODE_API_KEY=bb_test_change_me npm start
```

The default mode is `reference-sandbox`. It composes the real modular packages:

- policy and participant authorisation;
- signed private-market liquidity;
- reference-price consensus;
- bank-principal pricing and hard risk reservations;
- issuer, LP, neobank and treasury reference adapters;
- exact-output multi-source routing;
- all-leg reservation before a firm quote is returned;
- fiat intents and mixed-finality settlement graph;
- durable quote, route and reconciliation states.

Defaults:

- host: `127.0.0.1`
- port: `8788`
- mode: `reference-sandbox`
- data directory: `./blueballs-fx-data`
- execution adapter: **not configured**

The reference provider inventory is local and replaceable. It exists so developers can exercise real policy, pricing, routing and reservation behaviour without a commercial integration.

Sandbox signature verification accepts syntactically valid maker signatures. Policy admission is **not bypassed** in the canonical reference mode: seeded participants, credentials, account attribution and short-lived authorisations flow through `FxPolicyEngine`.

A smaller historical private-order-only sandbox remains available through:

```bash
FX_NODE_MODE=private-sandbox npm start
```

No production mode silently falls back to either sandbox.

## One-command repository demo

From repository root:

```bash
pnpm install
pnpm dev
```

This starts:

- site: `http://localhost:5280`
- banking API: `http://localhost:5290/v2`
- FX node: `http://localhost:8788`

The site receives the local sandbox FX URL and key automatically.

## Inspect the reference runtime

```bash
curl \
  -H 'Authorization: Bearer bb_test_change_me' \
  http://localhost:8788/v2/fx/reference/status
```

Other inspection endpoints:

```text
GET /v2/fx/reference/policy
GET /v2/fx/reference/liquidity?inputAsset=...&outputAsset=...&exactOutput=...
GET /v2/fx/reference/settlement-route
```

## Firm multi-source quote

The seeded token corridor is USDC → EURC:

```text
USDC  0x0000000000000000000000000000000000000011
EURC  0x0000000000000000000000000000000000000022
```

Example:

```bash
curl -X POST http://localhost:8788/v2/fx/quotes \
  -H 'Authorization: Bearer bb_test_change_me' \
  -H 'content-type: application/json' \
  -d '{
    "inputAsset":"0x0000000000000000000000000000000000000011",
    "outputAsset":"0x0000000000000000000000000000000000000022",
    "exactOutput":"450000000000",
    "expiresInMs":30000
  }'
```

The reference inventory is sized so this request spans:

- private signed customer liquidity;
- issuer liquidity;
- another neobank;
- an institutional LP;
- bank treasury;
- bank principal.

A quote is returned only after every selected source reserves its capacity. Principal risk is reserved at the same time.

## Execution semantics

`POST /v2/fx/quotes/:quoteId/execute` fails with `EXECUTION_UNAVAILABLE` unless an execution adapter is configured.

The runtime never invents a transaction hash. Before an outbound execution attempt, Blueballs revalidates the route and commits it to its non-releasable submission state with an idempotency key. If the external call becomes ambiguous, the route remains submitted and requires reconciliation rather than releasing possibly-spent liquidity.

## Fiat route semantics

The seeded reference graph demonstrates:

```text
BRL through an attested PIX payment
    → BRLX
    → atomic BRLX/EURC token FX
    → EURC issuer redemption
    → EUR
```

The overall route is classified `MIXED_FINALITY`. The token leg can be atomic; the external payment and issuer redemption are not made atomic by association.

## Docker

From repository root:

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx .
docker run --rm \
  -p 8788:8788 \
  -v blueballs-fx-data:/data \
  -e FX_NODE_API_KEY=bb_test_change_me \
  blueballs-fx
```

Health:

```bash
curl http://localhost:8788/health
```

## Data

The canonical reference runtime persists separate stores for:

- policy;
- private market;
- reference liquidity;
- principal risk;
- integrated quotes;
- fiat settlement.

Set `FX_NODE_DATA_DIR` to choose the directory.

## Production boundary

This reference runtime is software, not licensed financial activity. A production composition must supply:

- real maker signature verification and key custody;
- production identity/compliance providers;
- real issuer, LP, bank-rail and treasury adapters;
- a contract or institutional execution adapter;
- production database/HA strategy;
- monitoring and reconciliation operations;
- independent security review.

See `spec/fx/PUBLIC-REFERENCE.md` for the public-distribution contract.
