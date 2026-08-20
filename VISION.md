# Vision

Blueballs is open-source software for teams building a neobank, embedded-finance
product or stablecoin-enabled financial product. It should let a capable team
understand the system, run a complete reference stack, inspect every contract,
replace the reference adapters and build on a dependable foundation.

## The product

Blueballs has three connected surfaces:

1. **Banking foundation.** A tenant-isolated API for onboarding, accounts,
   double-entry ledgering, cards, transfers, savings, credit, business banking,
   webhooks and related product primitives.
2. **Canonical FX foundation.** A provider-neutral runtime for policy, exact
   pricing, liquidity selection, reservation, settlement state and optional
   on-chain enforcement.
3. **Product demonstrator.** A visual website that explains and demonstrates
   the software. Its pages are not consumer banking applications and do not
   imply that external providers are connected.

The API and FX contracts are the product boundary. The website and README make
that product legible to founders, engineers, operators and reviewers.

## Design principles

- **Forkable before fashionable.** A new team must be able to clone, run, test
  and extend the repository without private infrastructure.
- **Exact money and atomic books.** Money crosses boundaries as decimal strings
  or integer atomic units. Every ledger movement balances or rolls back.
- **Tenant isolation by construction.** A stable tenant principal owns keys,
  resources, events and idempotency state.
- **Policy before price.** FX liquidity is eligible only after institution
  authority, credentials, corridor rules and limits pass.
- **Reserve before firm.** A firm quote exists only after all selected capacity
  is reserved. Preview and execution are separate states.
- **Provider-neutral core.** Institutions choose their banks, identity vendors,
  rails, issuers, liquidity providers and custody stack through explicit
  adapters. A provider listing or descriptor is not a partnership.
- **Evidence over claims.** Public statements link to executable contracts,
  tests, captures or an explicit limitation.

## What Blueballs is not

Blueballs is not a licensed bank, sponsor-bank relationship, insured account,
compliance programme, custody service or production-ready provider bundle. It
does not turn a clone into a regulated financial institution. Deployers remain
responsible for jurisdiction, licensing, vendors, security, operations and
customer protection.

## Direction of travel

The reference stack should grow by deepening coherent product workflows,
extension contracts and reproducible evidence—not by accumulating disconnected
routes. New features belong in the canonical banking or FX architecture, with a
working example, public contract and failure-mode tests.
