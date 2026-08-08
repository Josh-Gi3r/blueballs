# Blueballs FX — Threat Model

Status: **FX-0 foundation draft**

The threat model assumes off-chain services can fail, become stale, be compromised or behave maliciously. The on-chain financial kernel must constrain the damage they can cause.

## Assets to protect

- participant collateral
- institution treasury/principal balances
- maker signed authority
- taker signed authority
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

### Malicious / compromised execution coordinator
May submit arbitrary payloads.

Contracts must reject anything outside cryptographic authority and settlement invariants.

### Malicious administrator
May control deployment administration, supported-token lists or service configuration.

The financial kernel must minimize unilateral asset-moving authority. Administrative recovery cannot consume accounted participant funds.

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

Nonce/replay controls and atomic settlement must prevent double execution.

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

Institutions may map addresses/keys to identity off-chain. Address rotation or account abstraction may be used, but privacy claims must not imply anonymity from the institution/regulator.

### Cross-provider data leakage
Partner adapters receive only the data necessary for their function. Blueballs canonical IDs should avoid leaking unrelated internal identity data.

## Compliance threats

### Policy bypass
A route may be economically executable but institutionally prohibited.

Canonical quote/execution flows must evaluate policy before matching/settlement. Direct low-level contract interaction cannot be marketed as institution-compliant merely because contracts permit it.

### Stale compliance decision
Participant status may change after an order is signed.

Design must define whether policy authorisation is checked at quote, reservation and/or settlement time, with explicit expiries.

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

The system must be restart-safe and idempotent. Authoritative settlement/reconciliation state must be reconstructable from durable records plus chain/attestation evidence.

## Economic threats

- one-way corridor flow
- stale reference pricing
- LP adverse selection
- principal exposure runaway
- liquidity withdrawal during quote window
- quote sniping
- manipulation through tiny orders
- fake depth / non-executable liquidity

Quotes must be based on executable/reservable liquidity, not advertised capacity alone.

## Security posture for MVP

The MVP intentionally avoids:
- cross-chain settlement
- arbitrary unsupported tokens
- permissionless anonymous makers
- governance-controlled upgrade complexity
- opaque pricing models
- unsecured credit inside settlement

Reducing feature surface is a security control.