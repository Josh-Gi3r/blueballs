# Roadmap

Blueballs is a reference stack you can fork, run and extend today. This page
says what is in it, where it grows next, and which contributions move it
furthest.

Direction is set by the principles in [`VISION.md`](VISION.md): the stack grows
through coherent product workflows and stable extension contracts—not by
accumulating disconnected routes.

## In the box today

**Banking foundation.** 181 access-classified operations across onboarding,
customers, accounts, receiving details, wallets, recipients, transfers, cards,
authorisations, disputes, savings vaults, credit lines, policies, approval
chains, organisations, ledger, statements, fees, rails, payment links, bills,
webhooks and events. Every operation has a machine-readable contract and the
generated OpenAPI is checked against the router.

**A ledger that holds.** Money crosses boundaries as decimal strings and lives
as integer minor units; floats are rejected at the door. Balances are derived by
summing the ledger and are never stored, so nothing can disagree with the books.
The posting function enforces both invariants itself: every transaction balances
to zero, and no customer account is left overdrawn.

**Tenant isolation by construction.** A stable tenant principal owns keys,
resources, events and idempotency state. Cross-tenant reads resolve as not
found, and the release gate proves it against a running instance on every run.

**Canonical FX foundation.** Policy, exact rational pricing, liquidity
selection, reservation, mixed-finality settlement state and an optional Solidity
kernel with unit, fuzz and invariant coverage. Execution fails closed when no
adapter is configured — it never invents a transaction hash.

**Sandbox Builder.** Describe a financial product, get a structured blueprint, a
tenant-isolated environment with test customers and multi-currency accounts, and
a payment you can settle through the protected ledger.

**Two runtimes, one codebase.** Node with SQLite and Cloudflare Workers with
Durable Object SQLite, from the same domain code.

**A complete local suite.** `pnpm verify` runs the build, types, formatting,
JavaScript checks, test suites, Foundry contracts, catalogue and OpenAPI drift,
contract lint and tenant-isolation probes against a scratch instance.

## Where it grows next

**Provider adapters.** The stack is provider-neutral by design and the
adapter contract is written down in
[`docs/ADAPTER-STANDARD.md`](docs/ADAPTER-STANDARD.md) and
[`spec/fx/ADAPTERS.md`](spec/fx/ADAPTERS.md). Reference adapters ship with the
stack; deployments connect the identity, rails, issuing, custody and liquidity
providers they choose. A first community adapter against a real provider is the
single most valuable contribution the repository can receive.

**Rail calendars.** The registry models weekends and cutoffs and publishes a
business-day calendar per rail. Holidays, per-jurisdiction calendars and cutoff
enforcement are the natural next layer, along with the returns and reversals the
transfer state machine already reserves states for.

**Statements and reporting.** Statements exist; period reporting, exports and
reconciliation views are where a real operator spends their day.

**Persistence topology.** Both runtimes are single-node by design, which is the
right default for a reference stack. Clustered and multi-region deployment
patterns are documented deployment work today and could become supported
reference topologies.

**Independent review.** The Solidity kernel has unit, fuzz, invariant and local
Anvil coverage. An external audit is required before taking the on-chain path to
production.

## Where help is most useful

| Area | Why it matters |
| --- | --- |
| A provider adapter | Turns a reference implementation into a connected one |
| A currency, rail or corridor | The registries are small, explicit and easy to extend |
| A product journey in the sandbox | The builder is only as good as the journeys it can express |
| A failure-path test | Financially sensitive code earns its confidence from negative tests |
| Documentation you wished existed | You are the last person who will ever read this repository for the first time |

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) — it carries the engineering
ground rules and the gate a pull request is expected to pass.

## Scope

Blueballs is MIT-licensed software, not a licensed bank, sponsor-bank
relationship, insured account, custody service or compliance programme. A
deployment supplies its own licensing, providers, security operations and
customer protection. See [`SECURITY.md`](SECURITY.md) before running it beyond
local evaluation.
