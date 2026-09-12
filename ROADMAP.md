# Roadmap

Blueballs is expanding from a strong open financial core into a broader operating system for modern financial institutions.

The direction is deliberate: deepen one coherent system across banking, FX, providers, product design, settlement and operating proof. New work should make Blueballs more useful to builders, more extensible to providers and more compelling to institutions evaluating an owned financial stack.

## What is already here

### 181-operation banking core

Customers, onboarding, accounts, receiving details, wallets, recipients, transfers, cards, authorisations, disputes, savings vaults, credit lines, policies, approvals, organisations, ledger, statements, fees, rails, payment links, webhooks and events live behind one access-classified banking contract.

The core includes exact-money accounting, atomic command boundaries, tenant isolation, scoped credentials, signed human attribution, provider orchestration, encrypted durable payloads, inbound settlement evidence, reconciliation and operational metrics.

### Exact ledger and command model

Money crosses public boundaries as decimal strings and lives authoritatively as integer minor units. Balances are derived from postings. Financial commands commit domain state, ledger evidence, events, outboxes, idempotency and audit correlation as one local unit.

### Provider orchestration

Payment rails, receiving details, cards, identity and custody connect through one versioned provider protocol with durable idempotency, leases, retries, finality rules and reconciliation.

Blueballs keeps the financial semantics stable while institutions choose the providers and commercial relationships behind them.

### Institution-owned FX

Policy, exact rational pricing, private and institutional liquidity, route construction, reservation, treasury/principal risk, fiat evidence, execution and mixed-finality reconciliation live in one FX stack.

Production composition is adapter-driven through `FX_NODE_PRODUCTION_ADAPTER`, so institutions can connect their own liquidity, banking, custody and execution relationships without surrendering the canonical quote and policy model.

### Atomic token settlement

The Solidity kernel provides segregated vault accounting, policy authorization, maker/taker signatures, cancellation, replay protection and an `AtomicRouter` for all-or-revert token routes. Foundry covers unit, fuzz and invariant assurance.

### Product operating layer

The Sandbox Builder, Cards experience, Provider Directory and FX market interface turn infrastructure into something people can explore, compare, configure and understand.

That public layer is part of the platform, not decoration. It is where technical infrastructure becomes a product people can discover and share.

### Runtime portability and proof

Node/SQLite and Cloudflare Workers/Durable Objects share the same banking contracts and financial semantics.

`pnpm verify:release` provides exact-checkout proof across banking lifecycles, FX, Workers, Foundry, migrations, restart/eviction, recovery, load/chaos, dependency inventory and container security scanning.

## Expansion tracks

### Provider ecosystem

Turn Blueballs into the natural integration surface for banks, payment rails, identity providers, issuers, custodians, stablecoin infrastructure and liquidity venues.

Priorities include richer adapter kits, compatibility profiles, conformance tooling, provider submissions and clearer paths from directory listing to working integration.

### Global rail intelligence

Expand rail calendars, holidays, cutoffs, returns, reversals and jurisdiction-aware routing so Blueballs can express more of the real operating complexity behind global money movement.

### Cards intelligence

Grow the Cards surface beyond a product showcase into an increasingly useful market map for card architecture, funding models, custody, networks, geography, rewards and programme design.

The long-term opportunity is a research surface that helps builders understand the market and then design their own programme with Blueballs.

### FX market intelligence

Deepen the public FX experience into a more powerful market and architecture lab for stablecoins, tokenized money, liquidity sources, principal capacity, settlement routes and policy-aware execution.

The goal is to make institution-owned FX legible before a team writes a single production adapter.

### Multi-shard financial operation

Advance the authoritative-shard architecture into richer reference topologies for institution/tenant routing, active/passive failover and cross-shard settlement orchestration while preserving one authoritative writer for every financial command.

### Programmable treasury

Expand principal-risk controls, exposure policy, hedging interfaces, inventory optimization and route economics so treasury can become an active liquidity source rather than a passive balance.

### Programmable money

Extend the monetary engine around reserve-backed instruments, settlement receipts, tokenized deposits and institution-defined money primitives while preserving explicit backing and coverage accounting.

### Agentic finance

Expose more of the banking and FX control plane through narrowly scoped machine authority, signed human attribution, approval policy and deterministic audit evidence.

Agents should be able to help operate a financial institution without becoming an unbounded root user.

### Developer platform

Keep improving generated SDKs, adapter conformance kits, local scaffolding, event tooling, observability and deployment composition so a team can move from clone to connected institution faster.

### Commercial ecosystem

Make the open-source platform easier to adopt through design partnerships, implementation services, provider integrations, deployment support and a growing ecosystem of companies building on the same public contracts.

Open source is the distribution model. A stronger ecosystem makes the core more valuable to every participant.

## High-value contributions

| Area | Why it matters |
| --- | --- |
| Provider adapter | Expands the ecosystem without changing the core |
| Rail or corridor | Extends global payment and FX coverage |
| Product journey | Makes the Builder useful for more financial business models |
| Cards/provider data | Strengthens Blueballs as a market intelligence surface |
| Failure-path test | Deepens confidence in a financial invariant |
| Treasury or FX primitive | Makes institution-owned markets more powerful |
| Operator tooling | Turns strong infrastructure into faster day-to-day operations |
| Documentation and examples | Makes sophisticated capabilities easier to discover and adopt |

Start with [CONTRIBUTING.md](CONTRIBUTING.md), then pick a surface that makes the whole system more useful.

**The roadmap is not a list of missing pieces. It is the expansion path from open financial core to open financial operating system.**
