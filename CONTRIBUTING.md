# Contributing

Blueballs welcomes focused contributions that make the financial core, integration surface and product experience stronger.

Before changing financial behaviour, read [VISION.md](VISION.md), [ARCHITECTURE.md](ARCHITECTURE.md), [spec/conventions.md](spec/conventions.md) and the relevant banking/FX specifications.

## Development setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Local services:

- website: `http://localhost:5280`;
- banking API: `http://localhost:5290/v2`;
- FX node: `http://localhost:8788`.

Run the standard gate before submitting a change:

```bash
pnpm verify
```

Focused and release commands are documented in [TESTING.md](TESTING.md).

## Engineering principles

1. Public API contracts, signed payloads and state machines are compatibility boundaries.
2. Monetary amounts use decimal strings, integer minor units or integer atomic units, never floating-point authoritative arithmetic.
3. Ledger movements balance and commit atomically.
4. Customer accounts cannot be overdrawn by a posting.
5. Tenant ownership applies to resources, events, provider jobs and idempotency state.
6. Authentication/authorization/lifecycle preflight runs before domain mutation and idempotent replay.
7. FX policy eligibility is evaluated before price and routing.
8. A firm quote reserves every selected source.
9. Submission and settlement remain distinct states; ambiguous external outcomes reconcile explicitly.
10. Provider-specific behaviour belongs behind an adapter.
11. Public product copy leads with implemented capabilities and architecture. Do not turn internal planning notes or engineering gap lists into product documentation.

## Branches and pull requests

`main` is the product source of truth. The repository is a monorepo: `src`, `apps`, `packages` and `workers` are directories, not frontend/backend branches.

Use short-lived branches with concise names:

```text
fix/transfer-cancellation
feat/provider-adapter
docs/sdk-quickstart
```

Keep each pull request focused on one outcome and explain:

- what changed and why;
- public API/persistence/migration impact;
- verification executed;
- compatibility considerations.

Do not include internal conversations, generated planning notes, tool logs, credentials, customer data or unrelated changes.

## Repository verification policy

Verification is repository-local:

```bash
pnpm verify
pnpm verify:release
```

Do not create or depend on GitHub Actions or `.github/workflows/**` unless the user request literally contains `ALLOW GITHUB ACTIONS FOR THIS TASK`.

## Changing financial behaviour

Changes to balances, ledgering, authorization, pricing, liquidity, settlement, provider finality or smart contracts require failure-path tests as well as success-path tests. Breaking public API changes require a version/migration boundary.

Canonical FX work belongs in `apps/fx-node`, `packages/fx-*` and `spec/fx`. Banking-compatible FX endpoints under `apps/api/src/routes` keep their compatibility contract but do not duplicate canonical FX policy/routing ownership.

## Provider integrations

Read [docs/PROVIDER-GATEWAY.md](docs/PROVIDER-GATEWAY.md), [docs/PROVIDER-CONFORMANCE.md](docs/PROVIDER-CONFORMANCE.md) and [spec/fx/ADAPTERS.md](spec/fx/ADAPTERS.md).

Provider credentials, private endpoints and commercial rules stay in deployment adapters/configuration rather than canonical banking or FX logic.

## Security reports

Do not disclose vulnerabilities or credentials in a public issue. Follow the private process in [SECURITY.md](SECURITY.md).
