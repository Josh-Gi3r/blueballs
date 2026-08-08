# Blueballs FX — Financial Invariants

Status: **FX-0 foundation draft**

These invariants are release gates. An implementation is not considered correct merely because endpoints respond or happy-path swaps succeed.

## Vault solvency

For every supported token at every externally observable state:

`physical_balance(token) >= total_accounted_liabilities(token)`

No code path may create ledger credit unsupported by physical assets.

## Administrative recovery

Administrative rescue/recovery may transfer only provable surplus:

`surplus = physical_balance - total_accounted_liabilities`

Accounted participant funds are never rescuable by an administrator.

## Withdrawal safety

A participant may never withdraw more than its accounted free balance.

Emergency withdrawal paths must not depend on the matcher, pricing service or route coordinator being online.

## Maker authorisation

No maker fill may execute without a valid maker authorisation for that exact economic order domain.

The signed domain must prevent cross-chain / cross-contract replay.

## Cancellation finality

If an order is cancelled on-chain before settlement, it can never execute afterward.

If a maker invalidates all epochs/nonces below `N`, any maker authorisation from an earlier epoch can never execute afterward.

Off-chain cancellation state alone is never sufficient for final financial revocation.

## Partial-fill bound

For every maker order:

`sum(all successful fills) <= signed maker amount`

Concurrent settlement attempts must not permit cumulative overfill.

## Taker max-input bound

A successful route may never debit more than the taker's signed `maxInput`.

## Taker min-output bound

A successful route may never deliver less than the taker's signed `minOutput`.

## Taker recipient integrity

Settlement output may only be delivered to the recipient authorised by the taker intent, unless the intent explicitly authorises another deterministic destination rule.

## Taker replay protection

A successfully consumed taker nonce/intent may never be successfully consumed again.

## Atomic-route property

For an atomic token route containing multiple settlement legs, either all legs succeed or none of their state changes survive.

A failure in leg N must not leave earlier legs economically final.

## Reservation safety

Off-chain reservations must not create financial authority. They exist only to reduce contention.

Loss/corruption of reservation state must not enable settlement beyond signed amounts or collateral.

## Policy-before-execution

Every route submitted by the canonical Blueballs coordinator must carry evidence that the route was evaluated against current institutional policy before submission.

A liquidity source that is ineligible for a transaction must never be selected by the canonical matcher/router.

## Policy scope integrity

A policy authorisation must be bound to enough context that it cannot be reused to authorise a materially different trade. At minimum the design must consider binding to:
- institution/deployment
- customer/subject
- corridor/assets
- amount or amount ceiling
- liquidity-source class / counterparty where required
- expiry
- quote or intent identifier

## Fiat attestation uniqueness

A unique off-chain fiat payment ID accepted as settlement evidence may not be consumed twice.

## Fiat attestation binding

A fiat settlement attestation must not be valid for a different:
- intent
- currency
- amount
- recipient/payee
- rail where rail is material

## Fiat freshness

Expired/stale fiat settlement evidence must be rejected according to configured policy.

## Pricing determinism

For a given immutable set of recorded pricing/risk inputs and configuration, the quoted result must be reproducible.

The MVP pricing engine must not rely on nondeterministic opaque model output.

## Reference-data freshness

A quote must not use a reference source beyond its configured freshness threshold without entering a documented degraded/blocked state.

## Principal exposure bound

For each institution-configured principal limit:

`resulting_exposure <= configured_limit`

Concurrent quote executions must not bypass the limit.

## Liquidity-capacity bound

No liquidity source may be allocated beyond its currently executable capacity under concurrent requests.

## Ledger conservation

Every internally accounted financial movement must post balanced double-entry entries.

If entries do not balance, the movement does not post.

## Settlement reconciliation

For every successful settlement there must be a deterministic reconciliation path from:

quote -> route -> policy decision -> signed authority -> settlement -> ledger entries -> final status

## Idempotency

Retries of externally idempotent operations must not create duplicate orders, settlements, fiat claims or ledger postings.

## Failure honesty

The system must distinguish at least:
- no eligible liquidity
- insufficient capacity
- policy rejection
- stale price
- expired quote
- cancelled order
- insufficient collateral
- principal limit reached
- fiat verification pending
- fiat verification failed
- on-chain settlement reverted

These states must not be collapsed into a generic success or silently substituted route without policy/pricing re-evaluation.

## Test requirement

Each invariant must have at least one executable test. Financial invariants should preferentially also have property/fuzz tests capable of generating adversarial operation sequences.