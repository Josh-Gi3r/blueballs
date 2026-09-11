# Governance

Blueballs is an open-source financial infrastructure project. Governance keeps public contracts stable while allowing the implementation to evolve quickly.

## Roles

### Maintainers

Maintainers merge changes, cut releases, manage security disclosures and preserve the financial invariants and public contracts of the project.

### Contributors

Anyone may propose changes through pull requests and issues. Changes to money, authorization, settlement or compatibility carry a higher proof burden than presentation-only work.

## Decision model

Routine fixes, documentation, provider implementations and backwards-compatible engineering use normal pull-request review.

An RFC is required when a proposal materially changes:

- public API semantics or versioning;
- ledger/accounting semantics;
- authentication, authorization or policy boundaries;
- transaction or settlement state machines;
- liquidity, routing, pricing or principal-risk semantics;
- adapter/capability contracts;
- persistence guarantees;
- smart-contract trust/upgrade assumptions;
- release/security guarantees.

RFCs live in `docs/rfcs/`. Accepted RFCs record a decision and its invariant. Reversing an accepted decision requires a superseding RFC.

## Compatibility

Backwards compatibility is the default. Breaking changes require an explicit version/migration boundary. Undocumented breaking behaviour is a defect.

## Financial correctness

Changes affecting balances, reservations, settlement, pricing, provider finality or permissions require executable proof for the relevant invariant. Authoritative money remains exact and ambiguous external outcomes remain explicit.

## Security

Security reports follow [`SECURITY.md`](SECURITY.md) through the private disclosure path. Security fixes may bypass the public RFC process until disclosure is safe.

## Repository verification

Blueballs uses repository-local verification as the release authority:

```bash
pnpm verify
pnpm verify:release
```

Do not add or depend on GitHub Actions unless the user request literally contains `ALLOW GITHUB ACTIONS FOR THIS TASK`.

## Releases

A release maps one exact source commit to reproducible evidence and artifacts. Release notes identify breaking changes, migrations, provider-contract changes and operator actions required by the upgrade.

The release process is defined in [`RELEASE.md`](RELEASE.md).

## Public product standard

The repository is also the public product surface. README copy, examples, comments, docs, changelogs and commit messages should describe Blueballs capabilities confidently and precisely. Engineering gaps are fixed in code and tests rather than turned into public product disclaimers. Claims about partnerships, audits, certifications or connected providers must remain factual.
