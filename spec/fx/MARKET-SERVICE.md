# Blueballs FX — Private Market Service

Status: FX-3 implementation contract

This document defines the behavior of the off-chain FX market service. It is deliberately separate from pricing, compliance-vendor integrations, and on-chain settlement.

## 1. Purpose

The market service stores and matches signed maker liquidity for a neobank or financial institution.

It is not a public DEX order book. It is a private institutional market operating inside the deployment's policy perimeter.

A submitted order is not executable liquidity merely because its signature is valid. Before it may enter the executable book, the policy layer must mark the maker, assets, corridor, wallet/account, limits, and order context eligible.

**Compliance precedes liquidity.**

## 2. Trust boundary

The market service may:

- accept and persist signed maker orders;
- reject orders that fail structural or policy checks;
- rank eligible orders deterministically;
- reserve available quantities for a quote/route;
- release expired/failed reservations;
- construct maker-fill payloads for `AtomicRouter`;
- expose the maker's own orders;
- expose configurable aggregated depth without participant identity.

The market service may not:

- forge maker authority;
- bypass on-chain cancellation or epoch invalidation;
- alter a maker's signed price, tokens, recipient, validity, epoch, or salt;
- exceed signed maker quantity;
- exceed the taker's signed max-input/min-output envelope;
- treat policy-ineligible liquidity as executable;
- declare settlement final before chain finality/reconciliation confirms it.

The on-chain kernel remains the final authority for signatures, cancellation, fill limits, replay protection, collateral movement, and atomicity.

## 3. Canonical stored maker order

The service persists the exact signed payload plus service metadata.

```ts
interface StoredMakerOrder {
  orderHash: `0x${string}`;
  order: MakerOrder;          // exact EIP-712 payload
  signature: `0x${string}`;  // exact submitted signature

  policyAuthorizationId: string;
  policySnapshotHash: `0x${string}`;

  receivedAt: string;
  sequence: bigint;           // monotonic service sequence used for time priority

  state:
    | "OPEN"
    | "PARTIALLY_FILLED"
    | "RESERVED"
    | "FILLED"
    | "CANCELLED"
    | "EXPIRED"
    | "POLICY_BLOCKED"
    | "SETTLEMENT_FAILED";

  confirmedFilledSell: bigint;
  reservedSell: bigint;
}
```

`sequence` is assigned transactionally at admission. Wall-clock timestamps never decide equal-price priority.

## 4. Admission

Order admission is transactional.

The service must verify before `OPEN`:

1. schema and numeric validity;
2. supported assets/corridor;
3. maker signature preflight;
4. validity window is non-empty and not already expired;
5. policy authorization is current and binds the maker/order context;
6. the order hash is not already admitted;
7. known on-chain cancellation/epoch state does not already invalidate it.

The service may additionally check available Vault collateral as an operational preflight, but Vault collateral at admission is never a guarantee of future executability. Settlement is authoritative.

## 5. Privacy and market data

Three surfaces are distinct.

### Private L3

Only the matching service can inspect full individual eligible orders across participants.

### Maker-private

A maker can inspect its own orders, fills, reservations, cancellations, and failures.

### Aggregated depth

A deployment may expose price-level aggregate size without maker identity or per-order detail.

Aggregated depth is derived market data, not settlement authority.

No endpoint may reveal another participant's identity, individual order size, signed payload, account, or policy metadata unless explicitly authorized by deployment policy.

## 6. Deterministic ranking

For a taker buying `outputToken` with `inputToken`, eligible maker orders are ranked by:

1. best executable maker price;
2. earliest admission `sequence` at the same price;
3. `orderHash` as a deterministic final tie-breaker.

No hidden maker class, commercial relationship, or operator preference may silently jump this ranking. If a deployment intentionally applies venue tiers or routing preferences, those rules belong to the pricing/risk/policy layer and must be observable in route provenance.

## 7. Available quantity

For each order:

```text
availableSell = signedSell
              - confirmedOnChainFilledSell
              - activeReservedSell
```

The service must never produce a negative available quantity.

Local state is reconciled against on-chain fill/cancellation state. If local and chain state disagree, the conservative executable quantity is used and the order is quarantined for reconciliation where necessary.

## 8. Reservations

A quote/route reservation prevents concurrent takers from being promised the same maker quantity.

```ts
interface Reservation {
  reservationId: string;
  routeId: string;
  orderHash: `0x${string}`;
  makerSellAmount: bigint;
  createdAt: string;
  expiresAt: string;
  state: "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED";
}
```

Reservation creation and `reservedSell` mutation must occur in one database transaction.

A reservation is not a financial lock and cannot override the chain. A maker may still withdraw collateral or invalidate an order. Therefore every execution still relies on the atomic on-chain checks.

Reservations have short explicit TTLs and are idempotently releasable.

## 9. Route construction

Input:

- taker asset pair;
- desired output or maximum input target;
- policy-eligible liquidity universe;
- quote/risk constraints supplied by the pricing/risk layer.

Output:

- ordered `MakerFill[]` compatible with `AtomicRouter`;
- exact expected total input/output;
- reservation identifiers;
- route provenance explaining which eligible liquidity was selected and why.

The market service does not invent a rate. It consumes eligible signed maker prices and constraints supplied by the pricing/risk layer.

## 10. Settlement lifecycle

```text
OPEN / PARTIALLY_FILLED
        |
        v
     RESERVED
        |
        +---- route abandoned/TTL ----> OPEN or PARTIALLY_FILLED
        |
        v
  SUBMITTED_ON_CHAIN
        |
        +---- reverted ----> release reservation, reconcile order state
        |
        v
  CHAIN_CONFIRMED
        |
        v
confirmed fill update
        |
        +---- remaining > 0 ----> PARTIALLY_FILLED
        |
        +---- remaining = 0 ----> FILLED
```

The service must never permanently decrement confirmed maker quantity from transaction submission alone. Only confirmed on-chain fill state can do that.

## 11. Cancellation

API cancellation performs two distinct actions:

1. remove/block the order from off-chain matching immediately;
2. require maker-side cryptographic cancellation/epoch invalidation when durable revocation is requested.

The service must represent these separately. `offChainHidden=true` is not equivalent to `onChainInvalidated=true`.

A maker order reported as durably cancelled must be verifiably invalid at the on-chain cancellation layer.

## 12. Policy changes after admission

Policy eligibility is continuously revocable.

If a maker or order becomes blocked:

- it is removed from executable matching immediately;
- new reservations are prohibited;
- active non-submitted reservations are released;
- already-submitted atomic settlements are handled according to transaction/finality state;
- the reason is retained in audit history.

The service never rewrites the signed order. It changes only its eligibility state.

## 13. Concurrency requirements

The following must hold under simultaneous requests:

- the same maker quantity cannot be reserved twice;
- admission sequence numbers are unique and monotonic;
- cancellation cannot race into a new reservation after the blocking state commits;
- reservation expiry is idempotent;
- settlement confirmation is idempotent by transaction hash/log identity;
- duplicate webhooks/events cannot double-apply fills.

The persistence implementation must provide transactional isolation sufficient to enforce these properties.

## 14. Persistence

FX-3 is durable by default. An in-memory order book is permitted only in tests.

The reference implementation should use the same self-hostable philosophy as Blueballs: a local database with strong transactional semantics, trivial bootstrap, and no mandatory managed vendor.

Initial reference target: SQLite for the single-node developer/reference deployment, with the storage interface designed so production deployments can provide PostgreSQL or another transactional backend.

SQLite is a reference deployment choice, not part of the protocol contract.

## 15. Required audit/event history

At minimum retain append-only events for:

- order admitted;
- admission rejected;
- policy blocked/unblocked;
- reservation created/released/expired/consumed;
- cancellation observed;
- epoch invalidation observed;
- settlement submitted;
- settlement reverted;
- settlement confirmed;
- reconciliation correction/quarantine.

Sensitive identity data does not belong in generic market events; use participant references governed by the policy/identity layer.

## 16. FX-3 acceptance tests

FX-3 is not complete until automated tests prove at least:

1. price priority;
2. time/sequence priority at equal price;
3. deterministic tie-breaking;
4. partial reservation across multiple makers;
5. no double reservation under concurrent requests;
6. reservation expiry restores liquidity exactly once;
7. cancellation blocks new matching immediately;
8. policy block removes liquidity immediately;
9. chain-confirmed partial fill reduces available quantity correctly;
10. duplicate settlement events are idempotent;
11. failed settlement releases reservations without inventing fills;
12. service restart preserves orders/reservations/audit state;
13. maker-private endpoints cannot read another maker's L3 orders;
14. aggregate depth contains no maker identity/per-order payload;
15. generated `MakerFill[]` reproduces the exact stored signed orders without mutation.

## 17. Explicitly not FX-3

FX-3 does not implement:

- reference-price sourcing;
- bank principal pricing;
- issuer pricing;
- spread/skew models;
- KYC vendor integrations;
- fiat attestations;
- cross-chain routing;
- public L3 order books;
- batch auctions/netting;
- virtual/shared collateral.

Those belong to later milestones. FX-3 proves that eligible signed liquidity can be stored, reserved, matched, and handed safely to the already-tested atomic kernel.
