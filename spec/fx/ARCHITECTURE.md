# Blueballs FX — Architecture

## Architectural principle

**Off-chain decides what should happen. On-chain constrains what is allowed to happen.**

The system deliberately keeps identity, policy, market data and matching private while moving final financial authority into a minimal auditable settlement kernel.

## High-level system

```text
NEOBANK / BLUEBALLS
        |
        v
Identity + Policy Gateway
        |
        v
Pricing / Risk / Route Engine
        |
   +----+------------------+
   |                       |
Private Matcher        Fiat / Issuer /
Signed Liquidity       Bank Adapters
   |                       |
   +-----------+-----------+
               v
       Execution Coordinator
               |
               v
        ON-CHAIN KERNEL
   Vault + Cancellation
   Settlement + Atomic Router
               |
               v
Indexer / Audit / Reconciliation
```

## 1. Identity and Policy Gateway

This is a first-class FX component, not an optional middleware layer.

It consumes provider-neutral identity/compliance results and evaluates whether a participant and transaction are eligible.

Canonical policy questions include:
- Is the customer active and permitted to transact?
- Is the liquidity provider active and permitted?
- Is this counterparty class allowed for this institution?
- Is this corridor allowed?
- Are both assets allowed?
- Is the ticket within participant/institution limits?
- Is the jurisdiction combination allowed?
- Is the payment / wallet / account attributable to an authorised participant?
- Has any upstream compliance engine placed a hold or restriction on the transaction?

The matcher receives only liquidity already admitted into the eligible set for that quote request.

## 2. Private Order Service

Stores maker liquidity off-chain.

A maker order is signed by the maker and contains canonical economic and settlement terms. The service stores the signed payload but cannot manufacture a maker authorisation.

Responsibilities:
- order submission
- signature pre-validation
- maker ownership mapping
- order lifecycle
- cancellation synchronisation
- durable persistence
- query of own orders
- optional aggregate market-data generation

Individual maker identity and order-level data are private by default.

## 3. Matcher and Reservation Engine

The matcher operates on policy-approved orders.

Requirements:
- strict deterministic matching semantics
- price-time priority for comparable liquidity unless a deployment intentionally configures another disclosed execution policy
- partial fills
- reservations before settlement submission
- reservation expiry
- concurrency safety
- self-trade prevention
- deterministic route reconstruction for audit

The matcher is not financially trusted. A bad matcher may propose a bad route, but the on-chain settlement kernel must reject any route that exceeds signed authority.

## 4. Pricing and Risk Engine

Produces an executable quote, not merely a reference rate.

Inputs may include:
- reference mids from one or more adapters
- executable approved liquidity
- issuer mint/redeem rates
- bank treasury curves
- institution principal appetite
- LP prices
- corridor liquidity
- market-data freshness
- transaction size
- institution-configured spread / margin / exposure policies

Outputs include:
- executable input/output amounts
- route composition
- liquidity-source classes
- quote expiry
- max input / min output
- settlement mode
- risk metadata
- explainability metadata

Pricing does not depend on opaque AI decisions. Every price is deterministic
and reconstructable from recorded inputs.

## 5. Liquidity Registry

Canonical abstraction for authorised liquidity sources.

A liquidity source may represent:
- customer maker liquidity
- professional LP
- stablecoin issuer
- another institution
- treasury
- bank principal
- verified fiat capacity

Common metadata includes:
- provider ID
- provider class
- supported assets/currencies
- supported settlement modes
- ticket limits
- price / pricing function
- available capacity
- settlement SLA
- policy credentials
- jurisdiction metadata
- risk / exposure metadata

The route engine evaluates only sources admitted by the policy layer.

## 6. Execution Coordinator

Bridges off-chain route construction and settlement.

Responsibilities:
- lock/reserve selected liquidity
- create exact settlement payload
- collect taker authorisation
- submit settlement transaction
- observe finality
- release reservations on failure
- publish canonical result events
- drive reconciliation

The coordinator cannot exceed maker or taker signed bounds.

## 7. On-chain Vault

The Vault is intentionally small.

Responsibilities:
- token deposits
- ledger balances
- debits/credits initiated only through authorised settlement paths
- withdrawals
- emergency withdrawal path
- safe administrative recovery of genuine surplus only

Core solvency relation:

`physical token balance >= accounted liabilities`

Any external credit mechanism must itself prove/limit credit against unaccounted physical surplus. Solvency must not depend on a trusted caller promising that tokens were transferred first.

## 8. Cancellation / Nonce Registry

Maker authorisation must remain revocable even if the matcher is malicious or unavailable.

Supports:
- cancellation by order hash
- maker nonce/epoch invalidation

Example:

`invalidateBefore(145)`

makes authorisations from earlier epochs unusable at settlement.

## 9. Maker Settlement Engine

Validates signed maker orders and records fill state.

Checks include:
- EIP-712 signature
- maker identity/address
- order expiry
- cancellation
- nonce/epoch validity
- token pair
- fill amount
- cumulative partial-fill amount
- vault collateral availability
- authorised executor/route mechanics where applicable

Settlement owns financial fill truth. The off-chain order service is not authoritative for fill quantity.

## 10. Atomic Router

The taker signs an intent containing at minimum:
- input asset
- output asset
- max input
- min output
- recipient
- deadline
- nonce

The coordinator may construct a route across multiple approved maker orders, but execution must be all-or-nothing.

If any leg fails or the route violates signed taker bounds, the transaction reverts entirely.

## 11. Fiat Settlement Layer

Fiat remains off-chain and enters the route graph through attestations.

Canonical verifier interface accepts evidence and returns a normalized settlement result bound to an FX intent.

The attestation must bind at least:
- intent hash
- currency
- amount
- rail
- payer reference/hash
- payee reference/hash
- unique payment ID
- settled timestamp
- verifier identity
- expiry / freshness

The settlement system must prevent reuse of the same payment evidence.

Potential adapters:
- internal bank ledger
- issuer mint/redeem
- open banking
- TEE payment verification
- zkTLS / zero-knowledge payment verification
- external provider integrations

## 12. Settlement Graph

The route engine models value movement as typed edges:

- `TOKEN_SWAP`
- `ISSUER_MINT`
- `ISSUER_REDEEM`
- `VERIFIED_FIAT_PAYMENT`
- `BANK_RAIL`
- `INTERNAL_LEDGER`

A route is valid only when every edge is both executable and institution-policy approved.

## 13. Indexer / Audit / Reconciliation

Produces the canonical operational history by combining:
- quote inputs
- policy decisions
- signed orders
- reservations
- settlement transaction/events
- fiat attestations
- ledger movements
- finality

Every execution should be reconstructable after the fact without relying on ephemeral matcher state.

## Trust boundaries

### Financially trusted
The settlement contracts enforce financial authority and atomicity.

### Operationally trusted but financially constrained
- matcher
- pricing engine
- route engine
- execution coordinator

They may fail or behave incorrectly, but must not be able to exceed signed/contractual authority.

### Institution trust domain
- KYC/KYB
- sanctions decisions
- risk policy
- allowed counterparties/corridors
- bank principal limits

### External trust / adapter domain
- fiat attestors
- stablecoin issuers
- payment rails
- external liquidity providers

Each must be explicit in route provenance.
