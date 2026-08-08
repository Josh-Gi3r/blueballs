# Blueballs FX — Threat Model

Status: **FX-10 release-hardening baseline**

The threat model assumes off-chain services can fail, become stale, be compromised or behave maliciously. The on-chain financial kernel must constrain the damage they can cause.

## Assets to protect

- participant collateral
- institution treasury/principal balances
- maker signed authority
- taker signed authority
- institution policy authority
- fiat settlement claims
- participant identity/privacy
- order confidentiality
- pricing integrity
- policy decisions
- reconciliation history

## Adversaries

### Malicious matcher
May:
- reorder liquidity unfairly
- withhold eligible liquidity
- propose stale/cancelled orders
- submit the same order concurrently
- attempt self-trades
- fabricate reservations

Must not be able to:
- forge maker signatures
- exceed maker signed amount
- execute cancelled/invalidated orders
- exceed taker max input
- violate taker min output
- steal output by changing recipient
- spend collateral that does not exist
- settle a route whose institution policy authorization is expired/revoked/invalidated

### Malicious / compromised execution coordinator
May:
- submit arbitrary payloads
- retain a previously valid signed route and attempt to broadcast it after compliance status changes
- bypass the canonical off-chain revalidation path

Contracts must reject anything outside maker authority, taker authority, institution policy authority and settlement invariants.

**Red-team finding FX-10:** customer/maker signatures alone were insufficient because any submitter could previously replay a still-valid signed route after the off-chain institution revoked eligibility. The kernel now requires the taker intent's `policyAuthorizationHash` to be live in `PolicyAuthorizationRegistry` at execution time. The institution can revoke an individual authorization or advance a minimum epoch to invalidate a class of older authorizations. A compromised executor therefore cannot settle a route merely because its maker/taker signatures remain cryptographically valid.

### Malicious administrator / policy authority
The institution policy authority can grant/revoke execution authorization. This is intentionally a powerful compliance control and must be operated through production-grade institutional key custody, access control, audit and change management.

The financial kernel still minimizes unilateral asset-moving authority. Policy authorization cannot itself move collateral; it only permits an otherwise valid signed route to execute. Administrative recovery cannot consume accounted participant funds.

### Compromised pricing source
May publish erroneous or malicious reference data.

Mitigations:
- source freshness
- multi-source support
- configurable deviation/circuit-breaker policy
- recorded price provenance
- deterministic quote reconstruction

### Malicious liquidity provider
May:
- cancel frequently
- quote toxic prices
- attempt to over-allocate liquidity
- intentionally fail settlement
- attempt self-trading
- provide stale fiat capacity

Mitigations include reservations, policy/risk classification, cancellation semantics, capacity accounting and provider-level limits.

### Malicious taker
May:
- race the same quote
- replay intent
- manipulate partial fills
- exploit token behaviour
- attempt to receive output without valid input

Nonce/replay controls, institution policy authorization and atomic settlement must prevent unauthorized/double execution.

### Compromised fiat attestor
May attest to payments that did not happen or alter payment data.

The architecture treats each verifier as an explicit trust domain. Institution policy determines which verifiers are accepted, for what rails/currencies/ticket sizes. Attestations are bound to exact intent/payment context and are uniquely consumable.

### Fiat payer attempting replay
May reuse a valid payment receipt/attestation against multiple token releases.

A payment ID/nullifier must be consumed once only.

### Fiat reversal / return risk
Some fiat rails are not economically final when the first success event occurs.

The adapter must expose settlement-finality semantics rather than representing every "paid" state as equivalent. Institution policy determines when token-side settlement can become final.

### Chain reorganisation / finality uncertainty
Indexer and coordinator must distinguish submitted, included and finalised states according to chain policy.

### Malicious / unusual token
Examples:
- fee-on-transfer
- rebasing
- callback/reentrancy behaviour
- blacklistable token
- non-standard return values

MVP should prefer an allowlist of explicitly supported token behaviours. Unsupported token semantics must fail closed.

## Privacy threats

### Public order leakage
Publishing per-order data can expose customer size, timing and flow information.

Default: private L3 order data. Any public/participant-visible depth is aggregated and deployment-configurable.

### On-chain identity linkage
Customer PII must never be written to public chain state.

Institutions map addresses/keys to identity off-chain. The policy registry stores only opaque authorization hashes, expiry/epoch and revocation state, not KYC documents or PII.

### Cross-provider data leakage
Partner adapters receive only the data necessary for their function. Blueballs canonical IDs should avoid leaking unrelated internal identity data.

## Compliance threats

### Policy bypass
A route may be economically executable and cryptographically signed but institutionally prohibited.

Canonical quote/execution flows evaluate policy before matching/reservation and immediately before submission. The on-chain Router independently requires a live institution policy authorization before settlement. Therefore direct low-level submission cannot bypass a policy revocation merely by presenting old valid maker/taker signatures.

### Stale compliance decision
Participant status may change after an order or taker intent is signed.

Mitigations operate at multiple layers:
- participant/credential changes invalidate off-chain authorization epochs;
- maker liquidity is revalidated before reservation;
- reserved routes are revalidated before submission;
- `PolicyAuthorizationRegistry` enforces on-chain expiry/revocation/minimum epoch at execution.

Once an external transaction has actually been submitted, off-chain history is not rewritten; the route stays in reconciliation while future liquidity/authorizations are blocked.

### Counterparty substitution
A route must not replace an approved liquidity source with an ineligible one without re-running policy and quote evaluation.

## Operational threats

- matcher outage
- pricing outage
- database loss
- duplicate workers
- delayed webhooks
- process restart during settlement
- inconsistent cache between nodes
- failed fiat provider callback
- blockchain RPC outage
- ambiguous outbound submission

The system must be restart-safe and idempotent. Authoritative settlement/reconciliation state must be reconstructable from durable records plus chain/attestation evidence. Once the runtime commits a route to `SUBMITTED`, ambiguous adapter outcomes do not automatically release its liquidity; they require reconciliation.

## Economic threats

- one-way corridor flow
- stale reference pricing
- LP adverse selection
- principal exposure runaway
- liquidity withdrawal during quote window
- quote sniping
- manipulation through tiny orders
- fake depth / non-executable liquidity

Quotes must be based on executable/reservable liquidity, not advertised capacity alone. Bank-principal exposure is hard-limited independently from spread.

## Security posture for MVP

The MVP intentionally avoids:
- cross-chain settlement
- arbitrary unsupported tokens
- permissionless anonymous makers
- governance-controlled upgrade complexity
- opaque pricing models
- unsecured credit inside settlement

Reducing feature surface is a security control.

## Remaining external assurance boundary

The internal red-team and CI gates are not an independent security audit. Before anyone represents the stack as production-audited financial infrastructure, the contracts and the cross-layer operational design require independent external review. Blueballs must distinguish "reference implementation with passing internal gates" from "externally audited production deployment."
