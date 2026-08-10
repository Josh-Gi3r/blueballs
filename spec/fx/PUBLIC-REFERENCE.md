# Blueballs FX - Public Reference Distribution

Status: **release-candidate integration**

This document is the product and engineering contract for the public open-source FX reference.

The goal is not a landing page. A developer who has never met the contributors must be able to:

1. clone the repository;
2. start the site, banking API and canonical FX node with one command;
3. use one BRL to EUR customer exchange;
4. inspect the exact policy, source allocation, token route and settlement graph behind it;
5. reserve every selected source before the quote is called firm;
6. observe policy exclusions and hard treasury/principal limits;
7. distinguish live node behaviour from deterministic simulation;
8. locate implementation, API, source and tests for every public claim;
9. replace reference providers through documented adapters;
10. redistribute and modify the system under the MIT licence.

## Canonical architecture

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

Historical FX code under `apps/api` is a frozen compatibility surface. It must not define new economics, policy, risk, settlement or website claims. See `LEGACY-MIGRATION.md`.

## Connected public trade

The public product follows one request:

```text
customer asks for BRL → EUR
        ↓
attested BRL payment creates BRLX settlement capacity
        ↓
BRLX → EURC token FX uses the canonical multi-source market
        ↓
EURC is redeemed and EUR is delivered
```

The token corridor can combine:

```text
private customer liquidity
issuer
other institution
institutional LP
bank treasury
bank principal
```

The same runtime object drives:

- customer phone;
- institution source and policy view;
- developer request, response and evidence view;
- settlement route;
- quote and reconciliation identifiers.

## Reference runtime

`FX_NODE_MODE=reference-sandbox` composes:

```text
FxPolicyEngine
      ↓
FxMarketService + signed private orders
      ↓
ReferencePriceEngine + PrincipalRiskBook + PrincipalQuoteEngine
      ↓
planExactOutput + reservePlan
      ↓
private market / issuer / LP / institution / treasury / principal adapters
      ↓
IntegratedQuoteCoordinator
      ↓
ReferenceTradeCoordinator
      ↓
FX REST node + SDK + website
      ↓
FiatSettlementStore + SettlementGraph
```

Reference provider inventory is deterministic and replaceable. It exercises real policy, pricing, routing and reservation contracts without claiming to be a connected commercial provider.

## Preview and firm quote semantics

### Preview

```text
POST /v2/fx/reference/trades/preview
```

A preview:

- uses current policy-approved source capacity;
- calculates the full exact-input customer trade;
- exposes eligible and excluded sources;
- reserves nothing;
- is labelled `LIVE FX NODE PREVIEW`;
- has `evidence.reserved: false`.

### Firm sandbox trade

```text
POST /v2/fx/reference/trades
```

A trade may be called firm sandbox liquidity only when:

- the customer is policy-authorised;
- every selected source is policy-authorised;
- the planner finds a complete route;
- every selected source reserves capacity;
- principal balance-sheet deltas are reserved;
- quote and trade are durably recorded;
- expiry is explicit.

The result is labelled `FIRM RESERVED SANDBOX QUOTE` and includes `tradeId`, `quoteId` and `routeId`.

## Policy semantics

Policy decides who may enter the market before price competition.

The reference market demonstrates:

- participant status and type;
- KYC/KYB, sanctions and AML credential state;
- jurisdiction and corridor rules;
- account attribution;
- ticket limits;
- short-lived authorisation;
- participant and policy epochs;
- revocation before quote construction.

A cheaper raw source cannot bypass policy.

## Principal semantics

The bank-principal engine separates economic pricing from risk permission.

A principal quote can include:

```text
reference mid
base spread
volatility
size
corridor
rail
inventory adjustment
```

The risk book separately enforces hard per-asset limits and reserves quote deltas transactionally. A larger spread cannot override the hard limit.

## Execution semantics

The default reference runtime has no execution adapter.

```text
POST /v2/fx/reference/trades/:tradeId/execute
POST /v2/fx/quotes/:quoteId/execute
```

Both fail closed with `EXECUTION_UNAVAILABLE` until an operator supplies one.

Before an external attempt:

1. policy and reservations are revalidated;
2. the route becomes `SUBMITTED`;
3. it becomes non-releasable;
4. an ambiguous result remains submitted for reconciliation.

The runtime never invents a transaction hash or treats submission as settlement.

The controlled Anvil proof is separate evidence for the Solidity kernel. It is not silently substituted for an operational adapter.

## Settlement semantics

The public route includes:

```text
VERIFIED_FIAT_PAYMENT   ATTESTED_EXTERNAL
TOKEN_SWAP              ATOMIC
ISSUER_REDEEM           ASYNC_EXTERNAL
```

A route spanning these classes is `MIXED_FINALITY`. Only token fills in the same AtomicRouter transaction boundary may be described as atomic.

## Website contract

The `/fx` page shows the same trade through three views.

### Customer

- BRL amount;
- EUR amount;
- effective rate;
- live preview versus reserved quote;
- quote expiry;
- delivery boundary;
- honest execution availability.

### Institution

- eligible and excluded sources;
- selected allocation;
- policy reason;
- source capacity;
- treasury/principal behaviour;
- settlement edges and finality.

### Developer

- request;
- response;
- lifecycle identifiers;
- source map;
- OpenAPI;
- tests and controlled proof.

The page must not define FX rates, capacities or policy authority in React. Live product interactions read the FX node. The economic stress lab imports `packages/fx-simulator` directly and is labelled as simulation.

## Visual system

The page combines:

- four scalable 2400 × 1350 editorial SVGs for liquidity, policy, settlement and treasury stories;
- coded live source allocation;
- interactive policy and risk scenarios;
- customer phone states;
- code and evidence panels;
- desktop and mobile visual CI screenshots.

Editorial artwork explains the idea. Live UI demonstrates current behaviour. Source and tests provide evidence.

## Evidence labels

Public demonstrations identify themselves as:

- live local FX node;
- live unreserved preview;
- firm reserved sandbox quote;
- deterministic simulator;
- controlled EVM proof;
- external execution adapter not configured;
- internal engineering gate;
- independent audit status.

## Public packaging

The reference distribution includes or generates:

- one-command local stack;
- Docker Compose stack;
- OpenAPI 3.1 contract;
- typed JavaScript SDK;
- provider adapter guide;
- contract deployment guide;
- generated contract ABIs and checksums;
- CycloneDX dependency inventory;
- security policy, third-party notices and known limitations;
- release workflow and evidence bundle;
- build and visual artefacts.

## Release exit gate

A tag may be described as a Blueballs reference release only when:

- the website reads the integrated runtime;
- the full BRL to EUR trade and scenarios pass node integration tests;
- TypeScript and production site build are green;
- market, pricing, liquidity, policy, fiat, SDK, node and simulator suites are green;
- Solidity build, unit tests, fuzzing and invariants are green;
- controlled Anvil execution proof is green;
- Docker images and Compose configuration build;
- desktop and mobile screenshots are reviewed;
- SDK pack dry-run, ABI export and dependency inventory succeed;
- legacy FX status is explicit;
- known limitations and security status are published;
- release artefacts resolve to the exact reviewed commit.

Passing this gate does not mean regulator approval, independent audit, production provider certification or production-mainnet proof.
