# Blueballs repository operating rules

Blueballs is a public product repository. Engineering changes must improve both the implementation and the clarity of the product surface.

## Verification

- Verification is repository-local and deterministic.
- `pnpm verify` is the standard engineering gate.
- `pnpm verify:release` is the full clean-checkout release gate.
- Do not create, enable or depend on GitHub Actions or `.github/workflows/**` unless the user prompt literally contains: `ALLOW GITHUB ACTIONS FOR THIS TASK`.
- Do not substitute hosted status badges for executable repository evidence.

## Financial changes

Changes that affect money, authorization, policy, reservations, settlement, custody, provider finality, tenancy, migrations or public contracts must preserve the existing invariants and add regression coverage for the changed boundary.

Authoritative money uses exact integer/minor/atomic-unit arithmetic. External side effects use durable idempotent state machines with explicit reconciliation for ambiguous outcomes.

## Public product surface

README copy, product pages, documentation, examples, comments, changelogs and commit messages are part of the Blueballs product.

- Lead with capabilities and architecture, not internal development history.
- Keep public copy concise, confident and technically precise.
- Do not publish self-defeating gap lists, speculative weaknesses or post-mortem language in product documentation.
- When a capability needs improvement, improve the code/tests first and document the resulting contract positively.
- Never claim a partnership, certification, external audit or live provider connection that does not exist.

## Architecture

Keep the provider-neutral kernel provider-neutral. Institution-specific providers, credentials, policies and commercial assumptions belong in adapters/configuration rather than canonical banking, FX pricing or routing code.

`main` is the product source of truth. Prefer small, testable changes that move the complete system forward without creating parallel implementations of the same contract.
