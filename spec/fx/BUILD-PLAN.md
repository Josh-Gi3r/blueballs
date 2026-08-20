# Blueballs FX — Build Plan

Status: **FX-0 foundation draft**

This plan is evidence-gated. `DONE` means the milestone's executable evidence passes; it never means only that files exist.

## Governing rules

1. `spec/fx/` is the architecture contract. Changes are explicit and reviewed before implementation follows them.
2. Compliance precedes liquidity. Ineligible liquidity is excluded before price/matching.
3. Off-chain services may propose; on-chain contracts constrain financial authority.
4. No public claim is stronger than the tests proving it.
5. Every financial invariant gets executable tests, preferentially fuzz/property tests.
6. One owner per shared surface during parallel implementation.
7. Contracts/interfaces freeze before fan-out.
8. The polished visual FX experience is built after the core is confirmed. Diagnostic test tooling is allowed earlier.

## Progress metrics

Track four independent numbers:

- **implementation coverage**
- **financial invariants passing**
- **scenario suite passing**
- **documented public behaviour proven**

A single endpoint/task completion percentage is not sufficient.

---

## FX-0 — Specification freeze

### Deliverables
- `VISION.md` and `ARCHITECTURE.md` (the superseded 2026-08-06 scope is retained under `docs/history/`)
- `ARCHITECTURE.md`
- `INVARIANTS.md`
- `THREAT-MODEL.md`
- canonical EIP-712 data structures
- state machines
- API schemas
- fiat attestation schema
- policy authorisation schema
- licensing/provenance register

### Exit gate
A reviewer can answer unambiguously:
- who may provide liquidity
- how eligibility is determined
- what is signed
- what may be cancelled
- what moves on-chain
- what remains private
- what happens on every major failure path
- which components are trusted and how that trust is constrained

No contract implementation begins before the core financial schemas/invariants are frozen.

---

## FX-1 — On-chain kernel

### Components
- `FxVault.sol`
- `OrderCancellation.sol`
- `FxSettlement.sol`
- `AtomicRouter.sol`
- emergency withdrawal/recovery path
- contract event model

### Required behaviour
- segregated ledger collateral
- physical-assets >= liabilities enforcement
- safe surplus-only admin recovery
- EIP-712 maker orders
- EIP-712 taker intents
- maker partial fills
- order-hash cancellation
- maker epoch/nonce invalidation
- taker replay protection
- multi-maker atomic route
- explicit supported-token policy

### Exit evidence
Unit suite green and every FX-1 invariant represented by an executable test.

---

## FX-2 — Adversarial kernel proof

### Work
- property tests
- fuzz tests
- invariant tests
- concurrent/replay sequence generation
- unusual-token tests for supported/blocked behaviours

### Mandatory proofs
- no insolvency
- no admin invasion of liabilities
- no overfill
- no cancelled-order settlement
- no stale-epoch settlement
- no taker replay
- max-input respected
- min-output respected
- recipient integrity
- all-or-nothing multi-maker settlement
- emergency withdrawal works without off-chain services

### Exit gate
100% mandatory financial invariants passing under deterministic tests and agreed fuzz/invariant campaigns.

---

## FX-3 — Private market

### Packages/services
- `fx-types`
- `fx-orderbook`
- `fx-matcher`
- reservation engine
- durable order persistence

### Features
- signed order submit/validate/store
- maker order lifecycle
- own-order query
- strict documented matching policy
- partial matching
- reservation / reservation expiry
- concurrency safety
- self-trade prevention
- cancellation synchronization
- optional aggregate depth adapter

### Exit evidence
Two concurrent takers cannot allocate the same capacity; matcher restart preserves valid state; cancelled/stale orders cannot settle even if deliberately reintroduced into the matcher.

---

## FX-4 — Pricing, risk and liquidity

### Packages
- `fx-pricing`
- `fx-liquidity`
- `fx-router`

### Reference price layer
Provider-neutral adapters, freshness controls, provenance and optional multi-source deviation checks.

### Risk model
Per-deployment configuration for:
- corridor
- participant class
- ticket size
- max spread/margin rules
- principal exposure
- liquidity capacity
- stale-data threshold
- allowed settlement modes

### Liquidity classes
- natural flow
- customer/P2P maker
- professional LP
- issuer
- institution/neobank
- treasury
- principal

### Exit evidence
Given recorded immutable inputs/configuration, quote and route are reproducible. Concurrent executions cannot breach liquidity or principal limits.

---

## FX-5 — Compliance and policy plane

### Canonical objects
- `FxParticipant`
- `FxCredential`
- `FxPolicy`
- `FxAuthorization`
- `FxLiquidityPermission`

### Behaviour
External KYC/KYB/AML providers feed canonical status/claims. Institution policy determines whether each participant, counterparty class, corridor, asset, amount and route is executable.

### Exit evidence
An economically better but policy-ineligible route is never selected. Changing participant/policy status invalidates or blocks execution according to documented freshness/expiry rules.

---

## FX-6 — Fiat settlement graph

### Packages
- `fx-fiat`
- settlement graph support in `fx-router`

### Typed edges
- `TOKEN_SWAP`
- `ISSUER_MINT`
- `ISSUER_REDEEM`
- `VERIFIED_FIAT_PAYMENT`
- `BANK_RAIL`
- `INTERNAL_LEDGER`

### Generic verifier
Provider-neutral fiat settlement attestation validation.

MVP must include a local simulator/reference verifier so the entire path can be tested without a commercial dependency.

### Exit evidence
- valid simulated fiat proof can unlock the intended conditional route
- reused payment ID is rejected
- wrong amount/currency/payee/intent is rejected
- expired proof is rejected
- route audit shows exactly which verifier/trust domain was used

---

## FX-7 — API, SDK and node

### Runtime
- `apps/fx-node`
- FX REST/API surface
- WebSocket/SSE where useful
- `fx-sdk`
- webhooks/events
- self-host configuration

### Canonical API families
- quotes
- execute
- orders
- cancellation
- depth
- liquidity
- fills
- routes
- settlements
- fiat intents/attestations
- policy/eligibility inspection
- simulation/test controls

### Exit evidence
A clean local deployment can create participants, add policy-approved liquidity, request a quote, execute it, inspect the fill/settlement/reconciliation trail and restart without losing durable state.

---

## FX-8 — Economic and failure simulator

### Simulated population
Configurable currencies, banks, issuers, LPs and customers.

### Required scenarios
- balanced corridor
- heavily one-way corridor
- thin liquidity
- LP withdrawal
- issuer unavailable
- principal limit reached
- stale reference price
- market shock
- cancellation storm
- simultaneous takers
- fiat verification delay
- fiat proof replay
- chain congestion
- settlement revert

### Metrics
- fill rate
- spreads
- slippage
- route composition
- LP P&L
- principal exposure
- quote rejection rate
- settlement latency
- settlement failure rate
- reconciliation differences

### Exit gate
Scenario suite passes agreed safety/correctness conditions; economic results are reported rather than hidden behind a pass/fail where no objective threshold exists.

---

## FX-9 — Controlled live proof

Progressively enable tiny-value real-chain flows:

1. single maker token swap
2. multi-maker atomic swap
3. partial fills/cancellation
4. institution principal fallback
5. issuer leg
6. verified fiat leg

Limits rise only after the preceding class is stable and reconciles correctly.

---

## FX-10 — Red team / independent audit

Review:
- contract security
- admin authority
- matcher races
- pricing manipulation
- policy bypass
- fiat attestation abuse
- replay/nullifier handling
- reconciliation
- economic griefing

Critical findings reopen the owning milestone.

---

## FX-11 — Release candidate

Requirements:
- contracts confirmed
- matcher confirmed
- pricing/risk confirmed
- policy plane confirmed
- liquidity/routing confirmed
- fiat interface confirmed
- API/SDK confirmed
- indexer/reconciliation confirmed
- simulator confirmed
- all release-gate tests green
- licensing/provenance clean
- public documentation claims evidence-backed

Tag first confirmed release only after these gates.

---

## FX-12 — Public visual laboratory

Only after core confirmation.

Public experience should expose real behaviour through:
- **See it** — real route/liquidity/settlement visualisations
- **Try it** — real sandbox operations
- **Break it** — real failure simulations
- **Inspect it** — signatures, policy decisions, events, ledger, API responses
- **Read it** — plain-language architecture/docs
- **Take it** — source, deployment and tests

The polished page must emphasize the core differentiation:

> Blueballs FX is compliance-first institutional FX infrastructure. Banks decide who may trade, which liquidity is eligible and under what policy. Only approved routes reach price/matching, and approved exchanges settle atomically.

Do not market generic anonymous P2P as the product.
