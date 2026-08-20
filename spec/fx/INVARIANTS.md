# Blueballs FX — Financial Invariants

Status: **FX-10 release-hardening baseline**

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

## Institution policy execution authority

A valid maker signature and a valid taker signature are necessary but **not sufficient** for settlement.

Every successful token route must also carry a non-zero institution `policyAuthorizationHash` that is live in the on-chain `PolicyAuthorizationRegistry` at execution time.

A policy authorization must fail settlement when any of the following is true:
- it was never granted;
- it has expired;
- it has been individually revoked;
- its epoch is below the institution's current minimum policy epoch.

Revocation or epoch invalidation must block a still-cryptographically-valid signed route without consuming the taker nonce or partially settling maker fills.

## Atomic-route property

For an atomic token route containing multiple settlement legs, either all legs succeed or none of their state changes survive.

A failure in leg N must not leave earlier legs economically final.

## Reservation safety

Off-chain reservations must not create financial authority. They exist only to reduce contention.

Loss/corruption of reservation state must not enable settlement beyond signed amounts, collateral or institution policy authority.

## Policy-before-execution

Every route selected by the canonical Blueballs coordinator must be evaluated against current institutional policy before reservation and re-evaluated immediately before submission.

A liquidity source that is ineligible for a transaction must never be selected by the canonical matcher/router.

The on-chain policy registry is a separate final guard. Compromise or bypass of the canonical off-chain coordinator must not allow an expired/revoked policy authorization to settle merely because customer/counterparty signatures remain valid.

## Policy scope integrity

A policy authorisation must be bound to enough context that it cannot be reused to authorise a materially different trade. The off-chain authorization decision binds at least:
- institution/deployment policy version/snapshot
- participant/subject epoch
- action
- corridor/assets
- amount or amount ceiling
- attributed settlement account where required
- expiry

The taker EIP-712 intent cryptographically binds the opaque policy authorization hash to the economic route envelope.

## Policy privacy

No KYC/KYB document or customer PII is required on-chain. The on-chain registry stores only opaque authorization hashes and minimal expiry/epoch/revocation state.

## Fiat attestation uniqueness

A unique off-chain fiat payment ID accepted as settlement evidence may not be consumed twice.

## Fiat attestation binding

A fiat settlement attestation must not be valid for a different:
- intent
- currency
- amount
- recipient/payee
- payer
- verifier/payment ID

## Fiat freshness

Expired/stale fiat settlement evidence must be rejected according to configured policy.

## Fiat finality honesty

An external fiat leg must not be described as atomic merely because a token leg in the same route is atomic.

A multi-leg route may report `atomic=true` only when all legs share the same atomic settlement boundary. Otherwise its external/asynchronous finality must remain explicit.

## Pricing determinism

For a given immutable set of recorded pricing/risk inputs and configuration, the quoted result must be reproducible.

The MVP pricing engine must not rely on nondeterministic opaque model output.

## Reference-data freshness

A quote must not use a reference source beyond its configured freshness threshold without entering a documented degraded/blocked state.

Bank-principal liquidity must fail closed when the required trustworthy reference price is unavailable.

## Principal exposure bound

For each institution-configured principal limit:

`abs(resulting_exposure) <= configured_limit`

Concurrent quote executions must not bypass the limit.

Hard principal limits cannot be overridden by widening customer spread.

## Liquidity-capacity bound

No liquidity source may be allocated beyond its currently executable capacity under concurrent requests.

A firm quote represents actual reserved executable capacity, not merely indicative depth.

## Ledger conservation

Every internally accounted financial movement must post balanced entries.

If entries do not balance, the movement does not post.

## Settlement reconciliation

For every successful settlement there must be a deterministic reconciliation path from:

quote -> route -> policy decision -> signed authority -> institution policy authorization -> settlement -> ledger/accounting effects -> final status

## Submission ambiguity safety

Once an external execution may have been submitted, the system must not automatically release/reuse the reserved liquidity merely because the caller cannot determine the outcome.

Ambiguous submissions remain `SUBMITTED` and require reconciliation.

## Idempotency

Retries of externally idempotent operations must not create duplicate orders, settlements, fiat claims, risk reservations or ledger/accounting postings.

## Failure honesty

The system must distinguish at least:
- no eligible liquidity
- insufficient capacity
- policy rejection
- policy authorization revoked/expired
- stale/unavailable reference price
- expired quote
- cancelled order
- insufficient collateral
- principal limit reached
- fiat verification pending
- fiat verification failed
- external submission outcome unknown
- on-chain settlement reverted

These states must not be collapsed into a generic success or silently substituted route without policy/pricing re-evaluation.

## Test requirement

Each invariant must have at least one executable test. Financial invariants should preferentially also have property/fuzz tests capable of generating adversarial operation sequences.

The aggregate release gate must run the contract/fuzz suite, controlled RPC proof and all off-chain subsystem suites before an FX backend release candidate is declared.
