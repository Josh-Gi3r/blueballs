# Contributing to Blueballs

Blueballs is building the open financial operating system for modern financial institutions. Contributions should make the system more capable, more inspectable or easier to adopt.

Before changing financial behaviour, read [VISION.md](VISION.md), [ARCHITECTURE.md](ARCHITECTURE.md), [spec/conventions.md](spec/conventions.md) and the relevant banking or FX specification.

## Start building

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Local services:

- website: `http://localhost:5280`;
- banking API: `http://localhost:5290/v2`;
- FX node: `http://localhost:8788`.

Run the standard repository proof before submitting a change:

```bash
pnpm verify
```

Focused and release commands are documented in [TESTING.md](TESTING.md).

## Build one coherent financial system

Blueballs is a monorepo because the product, banking core, FX market, provider boundaries, settlement contracts and public interfaces are meant to evolve together.

Engineering principles:

1. Public API contracts, signed payloads and state machines are compatibility boundaries.
2. Monetary amounts use decimal strings, integer minor units or integer atomic units, never floating-point authoritative arithmetic.
3. Ledger movements balance and commit atomically.
4. Customer accounts cannot be overdrawn by a posting.
5. Tenant ownership applies to resources, events, provider jobs and idempotency state.
6. Authentication, authorization and lifecycle preflight run before domain mutation and idempotent replay.
7. FX policy eligibility is evaluated before price and routing.
8. A firm quote reserves every selected source.
9. Submission and settlement remain distinct states; ambiguous external outcomes reconcile explicitly.
10. Provider-specific behaviour belongs behind an adapter.
11. Public product copy should make implemented capabilities easy to discover, understand and share.

## High-value contribution paths

Some of the most valuable ways to move Blueballs forward are:

- connect a new payment, card, identity, custody or liquidity provider through an adapter;
- add a rail, corridor or settlement model;
- extend institution-owned FX, treasury or programmable-money primitives;
- add failure-path proof around a financial invariant;
- expand Cards, Provider or FX intelligence surfaces;
- improve operator tooling and reconciliation;
- create a sharper product journey in the Sandbox Builder;
- make a sophisticated capability easier to understand through examples or documentation.

## Branches and pull requests

`main` is the product source of truth. `src`, `apps`, `packages` and `workers` are parts of the same system, not separate frontend/backend products.

Use short-lived branches with concise names:

```text
fix/transfer-finality
feat/provider-adapter
docs/fx-market-guide
```

Keep each pull request focused on one outcome and explain:

- the capability gained or invariant strengthened;
- why it matters to builders or operators;
- public API, persistence, migration or compatibility impact;
- verification executed.

## Write public history like product history

README copy, docs, release notes, PRs and commits are part of Blueballs' public product surface.

Lead with the resulting capability rather than the internal struggle that produced it.

Prefer:

- `Harden provider settlement finality`
- `Unify Cards navigation across public surfaces`
- `Prove credential recovery preserves tenant identity`
- `Expand institution-owned FX production composition`

Avoid titles that make the public history read like an internal scratchpad, such as `trying to fix`, `temporary workaround`, `remove broken`, `incomplete` or `hopefully`.

Strong language still has to be true. Do not claim partnerships, certifications, external audits, production customers or live provider connections that do not exist.

The full repository voice standard is in [AGENTS.md](AGENTS.md).

## Repository verification

Verification is repository-local:

```bash
pnpm verify
pnpm verify:release
```

Do not create or depend on GitHub Actions or `.github/workflows/**` unless the user request literally contains `ALLOW GITHUB ACTIONS FOR THIS TASK`.

## Changing financial behaviour

Changes to balances, ledgering, authorization, pricing, liquidity, settlement, provider finality or smart contracts require failure-path proof as well as success-path proof. Breaking public API changes require an explicit version or migration boundary.

Canonical FX work belongs in `apps/fx-node`, `packages/fx-*` and `spec/fx`. Banking-compatible FX endpoints under `apps/api/src/routes` keep their compatibility contract without duplicating canonical policy or routing ownership.

## Provider integrations

Read [docs/PROVIDER-GATEWAY.md](docs/PROVIDER-GATEWAY.md), [docs/PROVIDER-CONFORMANCE.md](docs/PROVIDER-CONFORMANCE.md) and [spec/fx/ADAPTERS.md](spec/fx/ADAPTERS.md).

Provider credentials, private endpoints and commercial rules stay in deployment adapters and configuration rather than canonical banking or FX logic.

## Security reports

Do not disclose vulnerabilities or credentials in a public issue. Follow the private process in [SECURITY.md](SECURITY.md).

## Build something people will use

The best Blueballs contributions do more than add code. They make the open financial stack more useful to the next builder, provider or institution that discovers it.
