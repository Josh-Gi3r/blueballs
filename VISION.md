# Vision

Blueballs is the open-source operating system for teams building modern financial institutions: neobanks, embedded-finance products, stablecoin rails and institution-owned FX.

The goal is simple: one codebase should give a capable team the financial core, product surfaces, provider boundaries and release tooling needed to move from idea to a serious institution-grade stack without inheriting a black-box platform.

## The product

Blueballs has three connected surfaces:

1. **Banking core.** A tenant-isolated API for onboarding, accounts, exact double-entry ledgering, cards, transfers, custody, business banking, approvals, webhooks and provider orchestration.
2. **Canonical FX core.** A provider-neutral runtime for policy, exact pricing, private and institutional liquidity, route construction, reservation, treasury/principal risk, fiat evidence, execution and reconciliation.
3. **Product operating layer.** Interactive product interfaces and a Sandbox Builder that make the financial architecture understandable and configurable from the same repository.

The API, state machines and machine-readable contracts are the system boundary. The website and documentation make that system legible to founders, engineers, operators, institutions and reviewers.

## Design principles

- **Financial correctness first.** Exact money, balanced books and atomic local commands are core architecture, not application conventions.
- **Provider-neutral by design.** Banks, identity vendors, payment rails, issuers, liquidity venues and custodians connect through explicit versioned adapters.
- **Policy before price.** FX capacity competes only after participant, credential, corridor and exposure policy pass.
- **Reserve before firm.** A firm quote exists only after selected liquidity is reserved.
- **Finality is explicit.** Token, bank, provider and custody edges retain their real settlement state and converge through reconciliation.
- **Tenant isolation by construction.** Stable tenant principals own credentials, resources, events, provider work and idempotency state.
- **Portable infrastructure.** The same core runs locally on Node/SQLite and at the edge on Cloudflare Durable Objects, with clear scale-out contracts.
- **Open contracts, replaceable infrastructure.** Institutions can inspect every state machine and swap deployment adapters without forking the core product semantics.
- **Executable assurance.** API contracts, migrations, restart/eviction, recovery, load, security and smart-contract invariants are part of the repository release gate.
- **Public product quality.** Source, documentation, examples, comments and commit history should communicate the strength of the system as clearly as the code itself.

## What Blueballs should feel like

A team cloning Blueballs should discover a coherent financial system rather than a collection of disconnected examples:

```text
product experience
      ↓
banking + FX contracts
      ↓
ledger / policy / routing / settlement
      ↓
durable provider adapters
      ↓
institution-owned infrastructure
```

Every new capability should extend that system coherently, with a public contract, deterministic verification and clear ownership.

## Institution-owned deployment

Blueballs supplies the financial software core and provider contracts. Institutions bring the licensed relationships, infrastructure credentials and jurisdiction-specific operating policy appropriate to the products they launch.

That separation is a feature: the open-source core remains reusable while the institution keeps control of its banking relationships, providers, data and deployment.

## Direction

Blueballs should keep expanding toward a complete, composable financial institution platform: stronger product building, richer provider adapters, multi-shard operation, deeper programmable treasury and increasingly unified banking + FX workflows, while preserving the exact-money, isolation and finality invariants that make the core trustworthy.
