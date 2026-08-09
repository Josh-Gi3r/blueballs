# Blueballs FX — Public Reference Distribution

Status: **implementation in progress**

This document is the product and engineering contract for turning the modular FX release candidate into a public open-source reference distribution.

The goal is not another landing page. A developer who has never met the contributors must be able to:

1. clone the repository;
2. start the site, banking API and canonical FX node with one command;
3. request a policy-approved, multi-source sandbox quote;
4. inspect the exact route and source reservations behind it;
5. observe hard treasury/principal limits and policy exclusions;
6. inspect a mixed fiat/token settlement route without false atomicity claims;
7. follow submission, confirmation, failure and ambiguity states;
8. locate the implementation, specification and tests for every public claim;
9. replace the reference adapters with real providers;
10. redistribute and modify the system under the MIT licence.

## Canonical architecture

The modular FX stack is canonical:

- `apps/fx-node`
- `packages/fx-contracts`
- `packages/fx-market`
- `packages/fx-pricing`
- `packages/fx-liquidity`
- `packages/fx-policy`
- `packages/fx-fiat`
- `packages/fx-sdk`
- `packages/fx-simulator`
- `spec/fx`

The older monolithic FX routes inside `apps/api` are legacy compatibility surfaces. They must not define new FX economics, risk rules, policy rules or website claims. Their eventual destination is a facade over the canonical FX node or explicit deprecation.

## Reference runtime

`FX_NODE_MODE=reference-sandbox` is the canonical local mode.

It composes:

```text
FxPolicyEngine
      ↓
FxMarketService + signed private orders
      ↓
ReferencePriceEngine + PrincipalRiskBook + PrincipalQuoteEngine
      ↓
planExactOutput + reservePlan
      ↓
private market / issuer / LP / neobank / treasury / principal adapters
      ↓
IntegratedQuoteCoordinator
      ↓
FX REST node + SDK
      ↓
FiatSettlementStore + SettlementGraph
```

The reference provider inventory is deliberately local and replaceable. It exercises the real policy, pricing, routing and reservation contracts without claiming to be a connected commercial provider.

## Quote semantics

A public reference quote may be called **firm sandbox liquidity** only when:

- the customer is policy-authorised;
- every source is policy-authorised;
- the exact-output planner finds a complete route;
- every selected source reserves its capacity;
- principal balance-sheet deltas are reserved;
- the route and quote are durably recorded;
- the quote has an explicit expiry.

An indicative calculation that does not reserve capacity must never be labelled firm or reserved.

## Execution semantics

The default reference runtime has no execution adapter.

`POST /v2/fx/quotes/:quoteId/execute` must fail closed with `EXECUTION_UNAVAILABLE` until an operator supplies one.

Before any external execution call:

1. policy and reservations are revalidated;
2. the route becomes `SUBMITTED`;
3. the route becomes non-releasable;
4. an ambiguous external result remains submitted for reconciliation.

The runtime must never invent a transaction hash or treat submission as settlement.

## Settlement semantics

Token routes can be described as atomic only when executed through one AtomicRouter transaction boundary.

Fiat, issuer and bank-rail legs retain their real finality classes:

- `ATOMIC`
- `AUTHORITATIVE_LEDGER`
- `ATTESTED_EXTERNAL`
- `ASYNC_EXTERNAL`

A route spanning more than one class is not end-to-end atomic.

## Website contract

The FX page must show the same trade through three connected views:

### Customer

- amount paid;
- amount received;
- rate and cost;
- quote expiry;
- arrival expectation;
- review, confirmation, processing and receipt states.

### Institution

- eligible and excluded sources;
- selected source allocation;
- reference-price provenance;
- treasury/principal exposure and limits;
- settlement legs and current state;
- reconciliation outcome.

### Developer

- request;
- response;
- event;
- source file;
- test proving the behaviour.

The page must not create a second pricing, policy or settlement model in React. Live interactions read the FX node; hostile economic scenarios call `packages/fx-simulator` directly and are labelled as simulation.

## Visual system

Use both editorial artwork and coded schematics.

### Editorial artwork

High-resolution artwork explains scale and gives the page visual rhythm:

1. liquidity network;
2. policy filtering before price competition;
3. fiat/token route anatomy;
4. one-way demand and treasury pressure.

Large desktop artwork must be exported at a real display resolution, normally 2400–3200 pixels wide, then served as an appropriately compressed WebP/PNG. Tiny raster thumbnails must not be stretched across the page.

### Coded schematics

Interactive SVG/React diagrams prove behaviour with live values:

- source allocation;
- policy inclusion/exclusion;
- reference-price consensus;
- treasury exposure;
- route finality;
- quote and settlement state machines.

Editorial artwork is not a substitute for live evidence, and live diagrams are not a substitute for visual storytelling.

## Evidence labels

Every public demonstration must identify itself as one of:

- live FX node;
- firm reserved sandbox quote;
- deterministic simulator;
- controlled EVM proof;
- illustrative customer UI;
- editorial diagram;
- external adapter not configured;
- internal engineering gate;
- independent audit status.

## Public packaging exit gate

The distribution is ready for public release only when:

- one command starts the complete reference stack;
- one Docker Compose command starts the same stack;
- OpenAPI covers the canonical node;
- SDK and package documentation are publishable;
- contract ABIs and deployment instructions are exported;
- legacy FX surfaces are explicitly deprecated or delegated;
- the website reads the integrated runtime;
- all public claims link to implementation and evidence;
- the aggregate release gate is green on the exact release commit;
- security policy, third-party notices and known limitations are present;
- a reproducible versioned release is created.

Passing internal gates does not mean regulator approval, an independent audit or production-mainnet proof.
