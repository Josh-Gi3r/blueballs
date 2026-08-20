# Blueballs FX — Scope

Status: **FX-0 foundation draft**

Blueballs FX is an MIT-licensed, self-hostable FX infrastructure layer for neobanks and financial products. It combines private/off-chain liquidity, pricing, matching and policy with cryptographically authorised, atomic on-chain settlement.

The goal is not to create another permissionless DEX or generic P2P exchange. The goal is to give financial institutions a programmable FX market they can operate inside their own compliance perimeter, with multiple approved liquidity sources and a settlement kernel they can independently audit.

## Core thesis

**Compliance precedes liquidity.**

A liquidity source that is not authorised for the institution, customer, corridor, asset, ticket size or jurisdiction is not executable liquidity and must never reach matching or settlement.

The system therefore evaluates FX in this order:

1. identity and participant status
2. institutional policy and eligibility
3. executable liquidity
4. price and route selection
5. cryptographic authorisation
6. atomic settlement
7. audit and reconciliation

Atomic settlement does not make a trade compliant. Blueballs FX is designed so the trade is policy-approved before settlement is attempted.

## What Blueballs FX owns

### Compliance and policy framework
Blueballs owns the provider-neutral authorisation model used by the FX engine. External systems may perform KYC, KYB, sanctions screening, transaction monitoring and other checks, but Blueballs consumes those decisions through canonical interfaces and determines whether a participant and route are eligible.

### Private liquidity and matching
The order book and matching plane are off-chain. Individual orders, identities, customer activity and risk data do not need to be publicly visible on-chain.

### Pricing and risk
The pricing engine combines reference pricing, executable liquidity, corridor conditions, institution-configured risk limits, liquidity-provider economics and principal appetite.

### Liquidity abstraction
The same execution framework can accept authorised liquidity from:
- natural opposing customer flow
- approved customer/P2P makers
- professional LPs
- stablecoin issuers
- other neobanks / institutions
- bank treasury
- bank principal
- verified fiat settlement providers

### On-chain financial kernel
The on-chain kernel exists to enforce financial authority and atomicity, not to run the full market. It owns:
- collateral / vault accounting
- maker authorisation
- partial-fill accounting
- cancellation and nonce invalidation
- taker intent bounds
- replay protection
- atomic multi-maker settlement
- emergency user withdrawal

### Fiat settlement abstraction
Fiat itself remains off-chain. Blueballs FX supports fiat legs through verified settlement attestations and provider-neutral adapters such as:
- internal bank ledger attestations
- issuer mint / redeem
- open-banking verification
- TEE or zk-based payment verification
- external adapters such as Peer

## What Blueballs FX does not own

Blueballs does not attempt to replace:
- KYC/KYB vendors
- sanctions databases
- bank licences
- card networks
- domestic payment schemes
- stablecoin issuers
- regulated fiat custody
- correspondent accounts

Those are partner / adapter surfaces.

## Canonical actors

- **Institution** — the neobank or financial operator running the deployment
- **Customer** — end user or business requesting FX
- **Maker** — authorised participant offering signed liquidity
- **Liquidity Provider** — professional or programmatic maker
- **Issuer** — stablecoin / tokenised-money issuer capable of mint/redeem liquidity
- **Treasury** — institution-owned balance sheet liquidity
- **Principal** — institution acting as liquidity provider of last resort under explicit risk limits
- **Fiat Settlement Provider** — entity able to send/receive off-chain fiat and produce acceptable settlement evidence
- **Matcher** — off-chain service responsible for reservations and price-time matching
- **Pricing/Risk Engine** — service calculating executable prices and institution risk
- **Execution Coordinator** — converts an approved route into settlement payloads
- **Verifier** — validates fiat or policy attestations
- **Indexer/Reconciler** — authoritative operational view of fills, balances and settlement state

## Asset and settlement edge types

The routing graph may contain:

- `TOKEN_SWAP`
- `ISSUER_MINT`
- `ISSUER_REDEEM`
- `VERIFIED_FIAT_PAYMENT`
- `BANK_RAIL`
- `INTERNAL_LEDGER`

This allows routes such as:

`MYR fiat -> verified payment -> USDC -> atomic FX -> EURC -> issuer redeem -> EUR fiat`

or:

`MYR fiat -> issuer mint -> MYRX -> atomic FX -> EURC -> issuer redeem -> EUR fiat`

## MVP scope

The first working release must support:

1. stablecoin/token maker liquidity
2. private off-chain order storage and matching
3. policy-gated liquidity eligibility
4. atomic multi-maker on-chain settlement
5. cryptographic maker cancellation and nonce invalidation
6. institution-configured principal liquidity
7. executable quote API
8. deterministic audit / reconciliation trail
9. one generic fiat-attestation interface with at least one local simulator adapter
10. full invariant and scenario test harness

## Explicitly deferred

These are not required for the first confirmed release:

- cross-chain FX
- public L3 order book
- anonymous permissionless liquidity
- governance token
- liquidity mining
- advanced netting
- batch auctions
- shared/virtual collateral across unrelated orders
- production integrations for every fiat rail
- polished public visualisation

## Definition of done

Blueballs FX is not done when endpoints exist. It is done when all four are true:

1. **Implementation coverage:** all scoped components exist and run
2. **Financial invariants:** all defined invariants pass under unit, fuzz and property testing
3. **Scenario suite:** market and failure scenarios pass end-to-end
4. **Documented behaviour:** every public claim is traceable to executable code and tests

Only after those four gates pass do we build the polished public FX visual laboratory.