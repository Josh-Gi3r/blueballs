# Blueballs FX Node

Self-hostable reference runtime for the Blueballs FX engine.

## Local sandbox

```bash
cd apps/fx-node
FX_NODE_API_KEY=bb_test_change_me npm start
```

Defaults:

- host: `127.0.0.1`
- port: `8788`
- mode: `sandbox`
- execution adapter: **not configured**

Sandbox mode is intentionally permissive for maker signature/policy admission so developers can exercise the market locally. It is never a silent production fallback.

If `FX_NODE_MODE` is anything other than `sandbox`, startup fails until a real production bootstrap with signature, policy and execution adapters is configured.

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

Authenticated example:

```bash
curl \
  -H 'Authorization: Bearer bb_test_change_me' \
  'http://localhost:8788/v2/fx/depth?inputAsset=0x...&outputAsset=0x...'
```

## Execution semantics

`POST /v2/fx/quotes/:quoteId/execute` fails with `EXECUTION_UNAVAILABLE` unless an execution adapter is configured.

The runtime never invents a transaction hash. Before an outbound execution attempt, Blueballs commits the route to its non-releasable submission state with an idempotency key. If the external call becomes ambiguous, the route remains submitted and requires reconciliation rather than releasing possibly-spent liquidity.

## Data

The sandbox persists market/fiat state and firm quotes separately:

- `FX_NODE_DB`
- `FX_NODE_QUOTE_DB`

The Docker image defaults both into `/data`.
