# Blueballs FX — State Machines

## Maker order lifecycle

```text
DRAFT
  -> SIGNED
  -> OPEN
  -> RESERVED (0..n concurrent reservations within remaining capacity)
  -> PARTIALLY_FILLED
  -> FILLED

OPEN / RESERVED / PARTIALLY_FILLED
  -> CANCELLED
  -> EXPIRED
  -> INVALIDATED_BY_EPOCH
```

Rules:
- off-chain order service status is operational metadata
- settlement contract fill/cancellation/epoch state is financial authority
- `CANCELLED`, `EXPIRED`, `INVALIDATED_BY_EPOCH`, `FILLED` are terminal for new settlement
- reservation is not financial finality

## Quote lifecycle

```text
REQUESTED
  -> POLICY_REJECTED
  -> NO_ELIGIBLE_LIQUIDITY
  -> QUOTED

QUOTED
  -> RESERVED
  -> EXPIRED
  -> SUPERSEDED

RESERVED
  -> EXECUTING
  -> RESERVATION_RELEASED
  -> EXPIRED

EXECUTING
  -> SETTLED
  -> REVERTED
  -> FINALITY_PENDING
```

A quote must be regenerated/re-evaluated when any material policy, price, capacity or settlement condition changes beyond allowed quote semantics.

## Policy decision lifecycle

```text
PENDING
  -> APPROVED
  -> REJECTED
  -> HOLD

APPROVED
  -> EXPIRED
  -> REVOKED
```

`APPROVED` is scoped, time-bounded authority; it is not a permanent statement that a participant is compliant for every transaction.

## Token settlement lifecycle

```text
ROUTE_BUILT
  -> AUTHORIZED
  -> SUBMITTED
  -> INCLUDED
  -> FINALITY_PENDING
  -> FINAL
```

Failure paths:

```text
ROUTE_BUILT -> REJECTED_POLICY
ROUTE_BUILT -> REJECTED_LIQUIDITY
AUTHORIZED -> EXPIRED
AUTHORIZED -> CANCELLED_COMPONENT
SUBMITTED -> REVERTED
INCLUDED -> REORGED
```

Operational systems must not label `SUBMITTED` or merely `INCLUDED` as final when deployment policy requires additional confirmations/finality.

## Fiat settlement lifecycle

Different rails have different finality semantics. The generic lifecycle is:

```text
CREATED
  -> PAYMENT_PENDING
  -> OBSERVED
  -> VERIFIED
  -> FINALITY_PENDING
  -> FINAL
```

Failure/exception paths:

```text
PAYMENT_PENDING -> EXPIRED
OBSERVED -> VERIFICATION_FAILED
VERIFIED -> REVERSED (only for rails where reversal remains possible)
FINALITY_PENDING -> RETURNED
```

Adapters must expose rail semantics rather than mapping all successful-looking provider events to `FINAL`.

## Fiat attestation lifecycle

```text
ISSUED
  -> VERIFIED
  -> CONSUMED
```

or:

```text
ISSUED
  -> REJECTED
  -> EXPIRED
```

A consumed payment/nullifier cannot be consumed again.

## Liquidity capacity lifecycle

For each source:

```text
AVAILABLE
  -> RESERVED
  -> CONSUMED
```

Reservations may:

```text
RESERVED -> RELEASED -> AVAILABLE
RESERVED -> EXPIRED -> AVAILABLE
```

Capacity accounting must be concurrency-safe. `available = total executable capacity - active reservations - completed consumption not yet replenished` according to source semantics.

## Principal exposure lifecycle

Institution principal liquidity tracks exposure independently from quote/order states:

```text
AVAILABLE_LIMIT
  -> RESERVED_EXPOSURE
  -> LIVE_EXPOSURE
  -> REDUCED / CLOSED
```

A quote that would cause resulting exposure above configured risk limits is not executable principal liquidity.

## Route lifecycle

A route is a versioned composition of settlement edges.

```text
CANDIDATE
  -> POLICY_APPROVED
  -> CAPACITY_RESERVED
  -> AUTHORIZED
  -> EXECUTING
  -> SETTLED
```

Any material substitution of provider/liquidity edge after policy approval requires policy and pricing re-evaluation.

## Reconciliation lifecycle

```text
EXPECTED
  -> OBSERVED
  -> MATCHED
```

Exceptions:

```text
EXPECTED -> MISSING
OBSERVED -> UNEXPECTED
OBSERVED -> AMOUNT_MISMATCH
OBSERVED -> COUNTERPARTY_MISMATCH
MATCHED -> REORGED/RETURNED (where underlying settlement can reverse)
```

No exception is silently auto-labelled reconciled.

## Customer-facing execution states

The canonical API must expose honest states rather than hide them behind generic failures:

- `quoted`
- `policy_hold`
- `policy_rejected`
- `no_eligible_liquidity`
- `insufficient_capacity`
- `principal_limit_reached`
- `price_stale`
- `quote_expired`
- `awaiting_fiat_payment`
- `fiat_verification_pending`
- `fiat_verification_failed`
- `settlement_pending`
- `settled`
- `settlement_reverted`
- `returned`
- `reversed`

The UI and partner integrations will later be built directly from these real state machines.
