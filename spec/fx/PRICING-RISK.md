# Blueballs FX — Pricing, Risk & Liquidity Routing

Status: FX-4 implementation contract

This document defines how a Blueballs deployment turns policy-eligible liquidity into executable FX quotes.

It is intentionally separate from:
- KYC/KYB vendor logic;
- the private maker market;
- smart-contract settlement;
- fiat payment verification.

## 1. Core rule

**The pricing engine may price liquidity. It may not invent liquidity.**

An instant quote exists only when one or more policy-eligible sources can actually support the requested size under their current limits.

If the system cannot construct an executable route, the correct result is `NO_LIQUIDITY` or a non-instant/resting order. Never fabricate depth from a reference price.

## 2. Compliance boundary

FX-4 receives only sources that the institution's policy layer has authorized for the specific transaction context.

A cheap but ineligible source is not considered in optimization and must not appear in the quote as rejected-but-cheaper liquidity.

The route result records the policy authorization/provenance supplied by the caller so the final taker intent can bind it cryptographically.

## 3. Price direction

Canonical internal price is:

```text
quote units required per 1 base unit
```

For a request to buy `base` using `quote`, a lower executable price is better for the taker.

All monetary quantities use integer atomic units or exact decimal/rational representations. JavaScript floating point must never determine executable money amounts.

## 4. Reference observations

A reference source returns an observation such as:

```ts
interface ReferenceObservation {
  sourceId: string;
  base: string;
  quote: string;
  bid: DecimalString;
  ask: DecimalString;
  observedAt: number;
  receivedAt: number;
  status: "OK" | "DEGRADED";
}
```

The reference layer is market information, not executable liquidity.

Each deployment configures:
- maximum age;
- minimum source count;
- maximum bid/ask inversion;
- maximum deviation from consensus;
- whether a degraded single-source fallback is permitted;
- per-source enable/disable state.

## 5. Reference consensus

For each valid observation:

```text
mid = (bid + ask) / 2
```

The reference mid is the median of accepted source mids after stale/invalid observations are removed.

Median is the reference implementation because one erroneous source cannot drag the result arbitrarily when multiple valid sources exist.

After the first median is computed, observations outside the configured deviation band are excluded and consensus is recomputed.

The result contains provenance:

```ts
interface ReferenceConsensus {
  base: string;
  quote: string;
  mid: DecimalString;
  sourceIds: string[];
  rejected: Array<{ sourceId: string; reason: string }>;
  observedAt: number;
  confidence: "NORMAL" | "DEGRADED";
}
```

If minimum confidence cannot be established, principal pricing must fail closed.

Existing signed maker orders may still be executable if deployment policy explicitly permits execution without a live reference; this is a policy decision, not a hidden fallback.

## 6. Liquidity source contract

Executable liquidity sources implement a common conceptual contract:

```ts
interface LiquiditySource {
  id: string;
  class:
    | "PRIVATE_MARKET"
    | "ISSUER"
    | "INSTITUTIONAL_LP"
    | "NEOBANK"
    | "BANK_TREASURY"
    | "BANK_PRINCIPAL"
    | "FIAT";

  quoteExactOutput(request): ExecutableQuote | null;
  reserve(quote): Reservation;
  release(reservation): void;
}
```

FX-4 initially implements:
- private market liquidity;
- deterministic bank-principal liquidity;
- a generic adapter contract for external/issuer firm quotes.

Fiat is introduced in FX-6.

## 7. Executable quote

```ts
interface ExecutableQuote {
  sourceId: string;
  sourceClass: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: IntegerString;
  outputAmount: IntegerString;
  expiresAt: number;
  reservationRequired: boolean;
  provenance: object;
}
```

A reference rate alone can never satisfy this interface.

## 8. Bank-principal source

The bank may deliberately warehouse FX exposure when natural/third-party liquidity is insufficient.

Principal liquidity is governed by hard risk limits and explicit pricing components.

### 8.1 Hard eligibility

A principal quote is unavailable if any hard condition fails, including:
- corridor disabled;
- reference confidence insufficient;
- reference stale;
- requested ticket above max ticket;
- resulting currency exposure exceeds hard position limit;
- principal notional budget exhausted;
- configured trading/session restriction active.

Hard limits cannot be overcome by widening the spread.

### 8.2 Spread components

The reference principal model expresses the customer price as:

```text
totalSpreadBps =
    baseSpreadBps
  + volatilityBufferBps
  + sizeBps
  + corridorRiskBps
  + railCostBps
  + inventoryAdjustmentBps
```

Every component and its configuration must be visible in quote provenance.

`inventoryAdjustmentBps` is signed but bounded. It may tighten a trade that reduces unwanted inventory or widen a trade that increases it. It may never reduce the final spread below configured `minimumSpreadBps`.

The reference implementation does not claim these coefficients are universal. They are deployment policy parameters and may later be replaced by a more advanced model behind the same interface.

### 8.3 Inventory skew

For each currency:

```text
normalizedPosition = clamp(netPosition / hardPositionLimit, -1, +1)
```

The inventory adjustment is proportional to how the proposed trade changes absolute risk.

- trade reduces absolute exposure -> adjustment may be negative (tighter);
- trade increases absolute exposure -> adjustment is positive (wider).

The absolute adjustment is capped by `maxInventorySkewBps`.

No formula may quote through a hard exposure limit.

### 8.4 Size component

Size impact is not inferred from fake market depth.

For principal liquidity the deployment defines explicit notional bands, for example:

```text
0..25k      +0 bps
25k..100k   +3 bps
100k..500k  +8 bps
```

The reference implementation uses deterministic bands so a bank can audit exactly why a quote widened.

## 9. External/issuer firm quotes

An adapter may return a firm quote from an issuer, another neobank, professional LP, treasury system, or regulated provider.

The adapter must surface:
- exact input/output amounts;
- firm expiry;
- source identity/reference;
- reservation/quote identifier;
- any executable size constraints.

Blueballs does not normalize a non-firm indicative rate into executable liquidity.

## 10. Routing objective

For an exact-output request, among policy-eligible executable routes that satisfy all hard constraints:

1. minimize total input required;
2. if tied, prefer lower settlement/operational risk according to explicit deployment priority;
3. if still tied, use deterministic source ID ordering.

The objective is deterministic and explainable.

Commercial preferences or source-class preferences may be configured, but may not be hidden inside arbitrary code branches. They must appear in route provenance.

## 11. Combining sources

A route may combine sources when a single source cannot fill the requested output or when a combination is cheaper.

FX-4 reference combination order is an optimization problem over firm executable slices, not a fixed marketing ladder.

Examples:
- private maker A + private maker B;
- private market + bank principal residual;
- issuer + market;
- external LP + principal residual.

The resulting route must fit the AtomicRouter/taker-intent envelope for on-chain token legs.

A source that cannot settle atomically with the route is not silently mixed into an atomic token route. Mixed settlement graphs are introduced later.

## 12. Reservation semantics

Quotes exposed to a customer must not promise the same scarce liquidity to multiple takers.

Therefore:
- private-market route creation uses FX-3 transactional reservations;
- principal liquidity uses a transactional risk reservation;
- external sources use their firm-quote/reservation semantics;
- if any source reservation fails, all reservations already acquired for that quote are released.

A quote has one explicit TTL equal to or shorter than the earliest underlying source expiry.

## 13. Principal risk reservation

Principal reservations prevent concurrent quotes from independently passing the same exposure limit.

Risk state tracks at minimum:
- settled net position per asset;
- active reserved position per asset;
- hard position limit per asset;
- active principal quote reservations.

Risk checks use:

```text
projectedPosition = settledPosition + activeReservedDelta + proposedDelta
```

not settled position alone.

Reservation release/expiry is idempotent.

## 14. Quote result

A Blueballs FX quote contains:

```ts
interface FxQuote {
  quoteId: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: IntegerString;
  outputAmount: IntegerString;
  expiresAt: number;
  route: RouteLeg[];
  reference?: ReferenceConsensus;
  policyAuthorizationHash: Hex32;
  pricingBreakdown: object;
  state: "RESERVED";
}
```

The taker subsequently signs a TakerIntent with a max input/min output envelope derived from this quote.

## 15. Honest outcomes

Quote creation returns one of:

- `EXECUTABLE` — all underlying liquidity is reserved;
- `NO_LIQUIDITY` — insufficient eligible executable liquidity;
- `RISK_LIMIT` — bank principal could otherwise fill but a hard risk limit prevents it;
- `REFERENCE_UNAVAILABLE` — principal pricing cannot establish a trusted reference;
- `POLICY_BLOCKED` — transaction/source universe is not authorized;
- `MARKET_CLOSED` — deployment configured a trading/session restriction.

These are product states, not generic 500 errors.

## 16. FX-4 acceptance tests

FX-4 is not complete until tests prove at least:

1. stale reference sources are excluded;
2. outlier source cannot drag multi-source median beyond configured band;
3. insufficient reference confidence fails principal quote closed;
4. better executable source wins regardless of source class;
5. hard principal exposure limit cannot be crossed by a single quote;
6. two concurrent principal quotes cannot reserve the same remaining risk capacity;
7. inventory-increasing trade widens relative to risk-reducing trade under same config;
8. minimum spread cannot be crossed by negative inventory adjustment;
9. size band changes are deterministic at exact boundaries;
10. mixed market + principal route fills only the residual principal amount;
11. reservation failure rolls back every previously acquired source reservation;
12. quote TTL never exceeds earliest underlying reservation expiry;
13. quote/provenance explains every spread component and selected source;
14. exact integer amount math agrees with route inputs/outputs;
15. restart preserves principal risk reservations and prevents over-allocation.

## 17. Explicitly not FX-4

FX-4 does not yet implement:
- KYC vendor adapters;
- sanctions providers;
- fiat settlement attestations;
- issuer mint/redeem mechanics;
- cross-chain settlement;
- probabilistic/ML pricing;
- hidden internalization rules;
- virtual/shared collateral;
- batch auction netting.

The goal is a deterministic, auditable and actually executable pricing/risk core before adding more market sophistication.
