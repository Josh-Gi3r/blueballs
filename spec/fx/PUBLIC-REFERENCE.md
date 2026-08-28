# Blueballs FX public reference

The public reference distribution connects the website, FX runtime, domain
packages, OpenAPI contract and JavaScript SDK around one inspectable BRL-to-EUR
trade.

## Canonical implementation

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
spec/fx
```

Older FX routes under `apps/api` remain compatibility examples. New pricing,
liquidity, policy, risk and settlement behavior belongs in the canonical
implementation above.

## Reference trade

```text
BRL payment
    → attested internal BRL deposit claim
    → policy-approved BRL-claim/EURC route
    → EURC issuer redemption
    → EUR
```

The route can select approved capacity from private makers, an issuer, another
institution, an institutional liquidity provider, treasury and principal. The
customer receives one quote while operators can inspect source eligibility,
allocation, policy, identifiers and settlement state.

## Runtime

`FX_NODE_MODE=reference-sandbox` composes:

```text
policy
  → private market and reference liquidity
  → reference pricing and principal risk
  → exact-output route construction
  → all-source reservation
  → trade and settlement coordination
  → REST API and SDK
```

The inventory is deterministic and replaceable. It exercises the same domain
contracts used by a provider adapter without claiming a commercial connection.

## Preview

```text
POST /v2/fx/reference/trades/preview
```

A preview reads current policy-approved capacity and returns eligible and
excluded sources, but reserves nothing. Its response reports
`evidence.reserved: false`.

## Firm sandbox trade

```text
POST /v2/fx/reference/trades
```

A firm sandbox trade is created only when:

- the customer and every selected source are policy-authorized;
- a complete route exists;
- every selected source reserves capacity;
- principal balance-sheet deltas are reserved;
- the trade and quote are stored with an explicit expiry.

The response includes `tradeId`, `quoteId` and `routeId`.

## Execution

```text
POST /v2/fx/reference/trades/:tradeId/execute
POST /v2/fx/quotes/:quoteId/execute
```

The default runtime has no execution adapter and returns
`EXECUTION_UNAVAILABLE`. It never invents a transaction identifier or treats an
outbound submission as final settlement.

Before an adapter is called, the runtime revalidates policy and reservations and
records the route as `SUBMITTED`. An ambiguous external result remains submitted
for reconciliation and cannot silently release its liquidity.

## Policy and pricing

Policy evaluates participant state, credentials, jurisdiction, corridor,
account attribution, ticket size and short-lived authorization before price
selection. An economically better source cannot bypass policy.

Reference pricing checks freshness, source count and deviation. Principal
pricing then applies deterministic spread components and hard risk limits.
Identical inputs and configuration produce the same result.

## Settlement and finality

The reference route is `MIXED_FINALITY`:

```text
VERIFIED_FIAT_PAYMENT   ATTESTED_EXTERNAL
TOKEN_SWAP              ATOMIC
ISSUER_REDEEM           ASYNC_EXTERNAL
```

Only token legs executed inside the same Solidity router transaction are
described as atomic. Fiat attestations bind payment identity, amount, currency,
payer, payee, intent and time; a consumed payment identifier cannot be reused.

## Public and private data

Public route views expose amounts, source classes, allocation, price components,
policy outcome, finality and lifecycle identifiers. They do not expose maker
identities, signed payloads, credentials, private orders or institution risk
records.

## Website boundary

The `/fx` website is a deterministic browser simulation for explaining the
system. It does not create node reservations or execute trades. Runtime behavior
is available from `apps/fx-node`, its OpenAPI document and the SDK.

## Provider boundary

Reference adapters are local fixtures. Production adapters must authenticate
providers, map canonical states without inventing finality, handle idempotency
and timeout ambiguity, verify callbacks and support reconciliation. See
[ADAPTERS.md](ADAPTERS.md).

## Production boundary

The public distribution is not a licensed institution, regulated service,
connected provider network or production certification. Deployment requirements
are listed in [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md) and
[THREAT-MODEL.md](THREAT-MODEL.md).
