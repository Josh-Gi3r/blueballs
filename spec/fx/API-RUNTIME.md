# Blueballs FX - Runnable Node API

Status: **FX-7 plus public-reference integration**

## Rules

1. A firm quote reserves executable capacity. If every selected leg cannot reserve, no firm quote is returned.
2. A preview is explicitly unreserved and cannot be executed as though it were firm.
3. `execute` means the reserved route was committed to submission and handed to the configured adapter. It does not mean settled.
4. Submitted routes become terminal only from reconciliation evidence.
5. Submitted fiat legs become terminal only through their declared verifier and finality state machine.
6. Responses expose source composition, policy state and finality. A mixed fiat route is never collapsed into the word `atomic`.
7. Private maker orders are owner/operator data. Public depth and source allocation do not expose signed payloads or maker identity.
8. All financial and operator endpoints require API authentication in the reference runtime.
9. The default runtime has no execution adapter and fails closed.

## Authentication

```text
Authorization: Bearer <api-key>
```

`GET /health` and `GET /openapi.yaml` are public. Aggregate depth can be configured public or authenticated. Every mutation is authenticated.

## Public customer trade

The connected reference product exposes one BRL to EUR request over the BRLX/EURC token corridor.

### Preview without reservation

```text
POST /v2/fx/reference/trades/preview
```

```json
{
  "inputAmount": "50000.00",
  "from": "BRL",
  "to": "EUR"
}
```

The response includes current policy-approved sources and the mixed-finality settlement route, but:

```json
{
  "state": "PREVIEW",
  "evidence": {
    "reserved": false,
    "label": "LIVE FX NODE PREVIEW"
  }
}
```

### Reserve the trade

```text
POST /v2/fx/reference/trades
```

```json
{
  "inputAmount": "50000.00",
  "expiresInMs": 60000
}
```

The response includes:

```text
tradeId
quoteId
routeId
customer amounts
selected sources
eligible and excluded source status
token corridor amounts
settlement edges and finality
customer policy authority
expiry and lifecycle state
```

A successful response is `RESERVED` only after every selected source and principal risk delta reserves.

### Retrieve, release and execute

```text
GET    /v2/fx/reference/trades/:tradeId
DELETE /v2/fx/reference/trades/:tradeId
POST   /v2/fx/reference/trades/:tradeId/execute
```

Only a still-reserved trade can be released. A submitted trade requires reconciliation.

Execution returns `EXECUTION_UNAVAILABLE` when no adapter is configured.

## Reference runtime and market

```text
GET  /v2/fx/reference/status
GET  /v2/fx/reference/policy
GET  /v2/fx/reference/market
GET  /v2/fx/reference/scenario
POST /v2/fx/reference/scenario
GET  /v2/fx/reference/liquidity
GET  /v2/fx/reference/settlement-route
```

Reference scenarios:

```text
balanced
lp_offline
issuer_policy_blocked
treasury_near_limit
principal_limit
reference_outage
```

These scenarios mutate the local reference market. They are separate from the larger deterministic simulator.

## Private market

```text
POST /v2/fx/orders
GET  /v2/fx/orders?maker=...
POST /v2/fx/orders/:orderHash/cancel
GET  /v2/fx/depth?inputAsset=...&outputAsset=...
```

Order admission validates syntax, maker signature and institution policy before storing the signed order.

## Exact-output token quotes

```text
POST /v2/fx/quotes
GET  /v2/fx/quotes/:quoteId
POST /v2/fx/quotes/:quoteId/execute
GET  /v2/fx/routes/:routeId
```

Request:

```json
{
  "inputAsset": "0x...",
  "outputAsset": "0x...",
  "exactOutput": "100000000",
  "expiresInMs": 15000,
  "participantId": "sandbox-customer",
  "accountRef": "sandbox-customer:wallet"
}
```

Response:

```json
{
  "id": "quote_...",
  "routeId": "route_...",
  "state": "RESERVED",
  "inputAsset": "0x...",
  "outputAsset": "0x...",
  "maxInput": "...",
  "output": "100000000",
  "expiresAt": 0,
  "sources": [],
  "finality": {
    "atomic": true,
    "class": "ATOMIC",
    "condition": "token route executed through the Blueballs AtomicRouter"
  }
}
```

Source classes can include:

```text
PRIVATE_MARKET
ISSUER
INSTITUTIONAL_LP
NEOBANK
BANK_TREASURY
BANK_PRINCIPAL
```

The API does not privilege a source class by name. Eligibility, exact economics and capacity determine the plan.

## Fiat settlement

```text
POST /v2/fx/fiat/intents
GET  /v2/fx/fiat/intents/:intentId
POST /v2/fx/fiat/intents/:intentId/reserve
POST /v2/fx/fiat/intents/:intentId/submit
POST /v2/fx/fiat/attestations
POST /v2/fx/fiat/intents/:intentId/settle
```

Fiat intents preserve explicit states such as:

```text
CREATED
RESERVED
SUBMITTED
PAYMENT_OBSERVED
VERIFIED
SETTLED
FAILED
MANUAL_REVIEW
```

## Operations and reconciliation

```text
POST /v2/fx/ops/quotes/:quoteId/confirmed
POST /v2/fx/ops/quotes/:quoteId/failed
```

Callbacks use canonical event IDs and are idempotent. Confirmation must match the reserved route. Failure releases only capacity that is safe to release.

## Execution adapter

```js
submit(privateQuote, { submissionRef })
```

Allowed results:

```text
ACCEPTED
REJECTED
UNKNOWN
```

The route becomes `SUBMITTED` before the outbound call. A thrown or unknown result remains submitted for reconciliation.

See `ADAPTERS.md`.

## CORS

The reference node allows only explicitly configured browser origins:

```text
FX_NODE_CORS_ORIGINS
```

The local site origins are supplied by default. Unknown origins fail preflight.

## Errors

Stable machine-readable codes include:

```text
AUTH_REQUIRED
ORIGIN_NOT_ALLOWED
VALIDATION_ERROR
NOT_FOUND
NO_LIQUIDITY
INSUFFICIENT_LIQUIDITY
POLICY_REJECTED
POLICY_AUTHORIZATION_INVALID
QUOTE_EXPIRED
EXECUTION_UNAVAILABLE
EXECUTION_REJECTED
PAYMENT_REPLAY
RISK_LIMIT
```

HTTP status is transport metadata. Product behaviour should use the durable error code.

The complete machine-readable contract is `apps/fx-node/openapi.yaml` and is served at `/openapi.yaml`.
