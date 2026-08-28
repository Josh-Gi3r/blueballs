# Contributing

Blueballs welcomes focused contributions that improve the reference platform
without weakening its financial or security boundaries.

Before changing financial behavior, read [VISION.md](VISION.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [spec/conventions.md](spec/conventions.md)
and the relevant specification under `spec/fx/`.

## Development setup

```bash
pnpm install
pnpm dev
```

The local services run at:

- website: `http://localhost:5280`;
- banking API: `http://localhost:5290/v2`;
- FX node: `http://localhost:8788`.

Run the complete local check before submitting a change:

```bash
pnpm verify
```

Focused commands are documented in [TESTING.md](TESTING.md).

## Engineering principles

1. Public API contracts, signed payloads and state machines are compatibility
   boundaries.
2. Monetary amounts use decimal strings, integer minor units or integer atomic
   units—never floating-point arithmetic.
3. Ledger movements must balance and commit atomically.
4. Customer accounts cannot be overdrawn by a posting.
5. Tenant ownership applies to resources, events and idempotency state.
6. FX policy eligibility is evaluated before price and routing.
7. A firm quote must reserve every selected source.
8. Submission is not settlement; ambiguous external outcomes require
   reconciliation.
9. Provider-specific behavior belongs behind an adapter.
10. Public product claims must match the implemented behavior and clearly state
    reference or simulation boundaries.

## Branches and pull requests

`main` is the only long-lived branch. The repository is a monorepo: `src`,
`apps`, `packages` and `workers` are directories, not frontend or backend
branches.

Create a short-lived branch with a concise, descriptive name such as:

```text
fix/transfer-cancellation
feat/provider-adapter
docs/sdk-quickstart
```

Keep each pull request focused on one outcome. Explain:

- what changed and why;
- any public API, persistence or migration impact;
- the tests you ran;
- any behavior intentionally left unchanged.

Do not include internal conversations, generated planning notes, tool logs,
credentials, customer data or unrelated changes. Delete the branch after it is
merged.

## Changing financial behavior

Changes to balances, ledgering, authorization, pricing, liquidity, settlement
or smart contracts require failure-path tests as well as successful-path tests.
Breaking public API changes require a version boundary and migration plan.

Canonical FX work belongs in `apps/fx-node`, `packages/fx-*` and `spec/fx`.
The older FX routes under `apps/api/src/routes` are compatibility surfaces; read
[spec/fx/LEGACY-MIGRATION.md](spec/fx/LEGACY-MIGRATION.md) before changing them.

## Provider integrations

Read [docs/ADAPTER-STANDARD.md](docs/ADAPTER-STANDARD.md) and
[spec/fx/ADAPTERS.md](spec/fx/ADAPTERS.md). Do not place provider credentials,
private endpoints or provider-specific commercial rules in the canonical
reference configuration.

## Security reports

Do not disclose vulnerabilities or credentials in a public issue. Follow the
private process in [SECURITY.md](SECURITY.md).
