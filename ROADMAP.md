# Roadmap

Blueballs is a complete open-source financial infrastructure stack that can be cloned, run, extended and composed with institution-owned providers today. The roadmap expands the platform from a strong core into an increasingly complete operating system for modern financial institutions.

Direction follows [`VISION.md`](VISION.md): new work should deepen coherent product workflows and stable extension contracts rather than accumulate disconnected features.

## In the box today

### Banking core

181 access-classified operations spanning onboarding, customers, accounts, receiving details, wallets, recipients, transfers, cards, authorisations, disputes, savings vaults, credit lines, policies, approval chains, organisations, ledger, statements, fees, rails, payment links, webhooks and events.

The banking core includes exact-money accounting, atomic command boundaries, tenant isolation, scoped credentials, signed human attribution, provider orchestration, encrypted durable payloads, inbound settlement evidence, reconciliation and operational metrics.

### Exact ledger

Money crosses public boundaries as decimal strings and lives as integer minor units. Balances are derived from postings. Every transaction balances exactly and customer accounts cannot be left overdrawn by a posting.

### Provider orchestration

Bank/payment rails, receiving details, cards, identity and custody connect through one versioned provider protocol with durable idempotency, leases, retries, finality rules and reconciliation.

### Canonical FX

Policy, exact rational pricing, private and institutional liquidity, route construction, reservation, treasury/principal risk, fiat evidence, execution and mixed-finality reconciliation live in one FX stack.

Production composition is adapter-driven through `FX_NODE_PRODUCTION_ADAPTER`, so institutions can connect their own liquidity venues, banking rails, custody and execution without forking canonical quote semantics.

### Atomic token settlement

The Solidity kernel provides segregated vault accounting, policy authorization, maker/taker signatures, cancellation, replay protection and an `AtomicRouter` for all-or-revert token routes. Foundry covers unit, fuzz and invariant testing.

### Product operating layer

The Sandbox Builder and interactive product interfaces make banking and FX architecture configurable and visible from the same repository.

### Runtime portability

Node/SQLite and Cloudflare Workers/Durable Objects share the same banking contracts and financial semantics.

### Release engineering

`pnpm verify:release` provides an exact-checkout assurance profile spanning banking lifecycles, FX, Workers, Foundry, migrations, restart/eviction, recovery, load/chaos, dependency inventory and container security scanning.

## Expansion tracks

### Provider ecosystem

Grow a rich ecosystem of deployment adapters for payment rails, identity, issuing, custody, fiat settlement and liquidity venues while preserving the provider-neutral core.

### Global rail intelligence

Expand rail calendars, holidays, cutoffs, returns, reversals and jurisdiction-aware routing so Blueballs can express more of the operating reality behind cross-border payments.

### Institution reporting

Deepen statements, regulatory/finance exports, provider reconciliation workspaces, treasury reporting and audit evidence for operator workflows.

### Multi-shard financial operation

Advance the documented authoritative-shard architecture into richer reference topologies for institution/tenant routing, active/passive failover and cross-shard settlement orchestration.

### Programmable treasury

Expand principal-risk controls, exposure policy, hedging interfaces, inventory optimization and route economics so treasury can become an active liquidity source rather than a passive balance.

### Agentic finance

Expose more of the banking and FX control plane through narrowly scoped machine authority, signed human attribution, approval policy and deterministic audit evidence for AI/agent workflows.

### Developer platform

Continue improving generated SDKs, adapter conformance kits, local product scaffolding, event tooling and observability so a team can move from clone to connected institution faster.

## High-value contributions

| Area | Why it matters |
| --- | --- |
| Provider adapter | Expands the institution/provider ecosystem without changing the core |
| Rail or corridor | Extends global payment and FX coverage |
| Product journey | Makes the Sandbox Builder useful for more financial business models |
| Failure-path test | Deepens confidence in a financial invariant |
| Operator tooling | Turns strong core infrastructure into faster day-to-day financial operations |
| Documentation | Makes a sophisticated stack easier to understand and adopt |

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the engineering rules and repository verification model.
