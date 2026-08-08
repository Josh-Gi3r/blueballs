# Blueballs FX — Runnable Node API

Status: FX-7 engineering specification.

## Rules

1. A firm quote reserves executable capacity. If capacity cannot be reserved, no firm quote is returned.
2. Indicative pricing is explicitly labelled and cannot be executed.
3. `execute` does not mean settled. It means the approved execution payload has been handed to the configured execution adapter and accepted for submission.
4. Submitted token routes become terminal only from settlement/reconciliation evidence.
5. Submitted fiat legs become terminal only through their declared finality/verifier state machine.
6. API responses expose provenance, source composition and finality; they never collapse a mixed fiat route into the word `atomic`.
7. Private maker orders are owner/operator data. Public depth is aggregate only.
8. All mutating/operator endpoints require API authentication in the reference runtime.

## Canonical surface

### Market

- `POST /v2/fx/orders`
- `GET /v2/fx/orders?maker=...`
- `POST /v2/fx/orders/:orderHash/cancel`
- `GET /v2/fx/depth?inputAsset=...&outputAsset=...`

### Firm quotes and routes

- `POST /v2/fx/quotes`
- `GET /v2/fx/quotes/:quoteId`
- `POST /v2/fx/quotes/:quoteId/execute`
- `GET /v2/fx/routes/:routeId`

For FX-7, a `QuoteCoordinator` interface owns source discovery/reservation. A minimal private-market coordinator ships as the reference implementation; richer deployments may compose `@blueballs/fx-liquidity` sources without changing the HTTP contract.

### Fiat settlement

- `POST /v2/fx/fiat/intents`
- `GET /v2/fx/fiat/intents/:intentId`
- `POST /v2/fx/fiat/intents/:intentId/reserve`
- `POST /v2/fx/fiat/intents/:intentId/submit`
- `POST /v2/fx/fiat/attestations`
- `POST /v2/fx/fiat/intents/:intentId/settle`

### Operations/reconciliation

Operator-only callbacks are deliberately separate from customer execution:

- `POST /v2/fx/ops/routes/:routeId/confirmed`
- `POST /v2/fx/ops/routes/:routeId/failed`

## Firm quote request

```json
{
  "inputAsset": "USDC",
  "outputAsset": "EURC",
  "exactOutput": "100000000",
  "expiresInMs": 15000
}
```

## Firm quote response

```json
{
  "id": "quote_...",
  "state": "RESERVED",
  "inputAsset": "USDC",
  "outputAsset": "EURC",
  "maxInput": "...",
  "output": "100000000",
  "expiresAt": 0,
  "sources": [],
  "finality": {
    "atomic": true,
    "class": "ATOMIC"
  }
}
```

The source list may contain `PRIVATE_MARKET`, `ISSUER`, `INSTITUTIONAL_LP`, `NEOBANK`, `BANK_TREASURY`, or `BANK_PRINCIPAL`. The API does not privilege one source class by name.

## Execution adapter

```text
submit(quote) -> {
  submissionRef,
  acceptedAt,
  network?,
  metadata?
}
```

The reference runtime treats absence/failure of this adapter as `EXECUTION_UNAVAILABLE`. It never fabricates a transaction hash.

## Authentication

Reference node:

```text
Authorization: Bearer <api-key>
```

Health may be public. Aggregate depth may be configured public or authenticated. Every mutation is authenticated.

Production deployments may replace this with their normal gateway/IAM without changing domain behavior.

## Errors

Stable machine-readable codes include:

- `AUTH_REQUIRED`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `INSUFFICIENT_LIQUIDITY`
- `POLICY_AUTHORIZATION_INVALID`
- `QUOTE_EXPIRED`
- `EXECUTION_UNAVAILABLE`
- `SETTLEMENT_STATE_ERROR`
- `PAYMENT_REPLAY`
- `RISK_LIMIT`

HTTP status is transport metadata; the code is the durable API contract.
