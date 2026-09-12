# Governance

Blueballs is an open-source financial infrastructure project with a public product surface. Governance exists to preserve the financial invariants and public contracts while allowing the platform to move quickly.

## Roles

### Maintainers

Maintainers merge changes, cut releases, manage security disclosures and protect the financial, compatibility and product standards of Blueballs.

### Contributors

Anyone may propose changes through pull requests and issues. Changes to money, authorization, settlement, provider finality or compatibility carry a higher proof burden than presentation-only work.

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

Backwards compatibility is the default. Breaking changes require an explicit version or migration boundary. Undocumented breaking behaviour is a defect.

## Financial correctness

Changes affecting balances, reservations, settlement, pricing, provider finality or permissions require executable proof for the relevant invariant. Authoritative money remains exact and ambiguous external outcomes remain explicit.

## Public product standard

The repository is part of Blueballs' distribution and commercial surface.

README copy, examples, docs, product pages, changelogs, release notes, PR titles and commit messages should make implemented capabilities easy to understand and compelling to explore.

Public material should:

- lead with the outcome Blueballs enables;
- explain the architecture that makes it possible;
- surface proof where a technical buyer can inspect it;
- frame institution-owned providers and deployment choices as control;
- make the next action obvious: run, inspect, fork, integrate or contribute.

Do not turn public product material into internal planning notes, gap lists, self-defeating disclaimers, post-mortem language or tool transcripts.

Strong positioning must remain factual. Claims about partnerships, audits, certifications, customers, connected providers or live market data require real evidence.

The detailed writing standard is maintained in [AGENTS.md](AGENTS.md).

## Security

Security reports follow [SECURITY.md](SECURITY.md) through the private disclosure path. Security fixes may bypass the public RFC process until disclosure is safe.

## Repository verification

Blueballs uses repository-local verification as release authority:

```bash
pnpm verify
pnpm verify:release
```

Do not add or depend on GitHub Actions unless the user request literally contains `ALLOW GITHUB ACTIONS FOR THIS TASK`.

The strongest release proof should be surfaced publicly as product evidence, while the underlying verification remains reproducible from the exact checkout.

## Releases

A release maps one exact source commit to reproducible evidence and a clear product milestone.

Release notes should communicate what the platform can now do, why it matters and where the proof lives. They should not read like a backlog export.

The release process is defined in [RELEASE.md](RELEASE.md).

## Direction

Blueballs should move quickly without fragmenting the system. New work should deepen the same core model across banking, FX, providers, settlement, product interfaces and operating proof.

The goal is a repository that technical teams respect, builders want to fork, providers want to integrate with and institutions want to build on.
