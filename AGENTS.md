# Blueballs repository operating rules

Blueballs is a public open-source financial product, a technical proof surface and a commercial discovery engine. The repository is part of the product. Every change should make the software stronger and make Blueballs easier to understand, remember, share, fork and buy into.

## The public standard

Blueballs should read like the category-defining open-source operating system for modern financial institutions.

Public copy should be:

- confident, ambitious and technically literate;
- capability-led rather than development-history-led;
- specific enough that a CTO can verify the claim in source;
- clear enough that a founder, bank, PSP, issuer or fintech operator can understand why it matters;
- memorable enough to be quoted, shared and discussed.

The repository is not an internal engineering notebook. Do not turn README copy, product docs, changelogs, PR titles or commit history into a running list of doubts, gaps, mistakes, caveats or implementation anxiety.

## Narrative hierarchy

When writing public material, use this order:

1. **Lead with the outcome.** What can someone build, own or operate with Blueballs?
2. **Show the capability.** Name the architecture, product surface or financial primitive that makes it possible.
3. **Prove it.** Point to code, contracts, tests, examples, generated OpenAPI or deterministic verification.
4. **Open the door.** Make the next action obvious: run it, inspect it, fork it, integrate a provider, build a product or contribute.

Do not lead with limitations when the same truth can be expressed positively and precisely.

Prefer:

- `Bring your own provider` over `provider not included`.
- `Adapter-ready production boundary` over `no live integration`.
- `Reference market` over `fake market` or `not live market`.
- `Institution-owned deployment` over defensive disclaimers about licensing relationships.
- `Converge provider finality semantics` over `fix incorrect provider failure behaviour` when the former accurately describes the result.

Never hide a material fact, but frame facts around the product that exists now rather than the defect that existed before the change.

## README, docs and product pages

README copy, product pages, architecture docs, examples, changelogs and release notes are marketing surfaces as well as engineering documentation.

- Open with the strongest implemented idea.
- Use short sections, strong nouns and concrete proof points.
- Explain why a capability matters commercially or operationally, not only how it is implemented.
- Keep Blueballs positioned as one coherent system: banking + FX + product + providers + settlement + verification.
- Treat the Sandbox, Cards, Provider Directory and FX experience as products, not documentation sidecars.
- Make open source feel like leverage: users can inspect, fork, adapt and own the stack.
- Make institution-owned providers and jurisdiction-specific policy sound like control, not absence.

Do not publish self-defeating gap lists, speculative weaknesses, internal planning language, post-mortem prose, tool logs or conversations.

## Commit and PR language

Commit history is public product history. Titles should describe the capability gained, invariant strengthened or surface improved.

Prefer verbs such as:

- Build
- Add
- Prove
- Harden
- Enforce
- Converge
- Unify
- Expand
- Ship
- Complete
- Align
- Protect

Avoid unnecessarily weak framing such as:

- `trying to fix...`
- `temporary workaround...`
- `remove broken...`
- `stop advertising...`
- `incomplete...`
- `hopefully...`

A bug fix can still be described accurately through the stronger resulting state. PR bodies should explain outcome, capability, proof and compatibility impact.

## Factual boundary

Marketing strength comes from proof, not invention.

Never claim a partnership, certification, external audit, regulatory approval, live provider connection, production customer, market-data source or deployment relationship that does not exist.

Use explicit status language where useful:

- compatible;
- adapter-ready;
- reference implementation;
- institution-supplied provider;
- independently researched provider;
- production boundary;
- sandbox/reference runtime.

Blueballs is designed to be a serious open-source starting point that institutions can inspect, adapt, audit, integrate and deploy on their own infrastructure. It does not need to pretend every future institution will run the repository unchanged.

## Verification

- Verification is repository-local and deterministic.
- `pnpm verify` is the standard engineering gate.
- `pnpm verify:release` is the full clean-checkout release gate.
- Do not create, enable or depend on GitHub Actions or `.github/workflows/**` unless the user prompt literally contains: `ALLOW GITHUB ACTIONS FOR THIS TASK`.
- Do not substitute hosted status badges for executable repository evidence.

Verification results are themselves a product asset. When publishing releases or technical material, surface the strongest reproducible proof clearly.

## Financial changes

Changes that affect money, authorization, policy, reservations, settlement, custody, provider finality, tenancy, migrations or public contracts must preserve the existing invariants and add regression coverage for the changed boundary.

Authoritative money uses exact integer/minor/atomic-unit arithmetic. External side effects use durable idempotent state machines with explicit reconciliation for ambiguous outcomes.

## Architecture

Keep the provider-neutral kernel provider-neutral. Institution-specific providers, credentials, policies and commercial assumptions belong in adapters/configuration rather than canonical banking, FX pricing or routing code.

`main` is the product source of truth. Prefer focused, testable changes that move one coherent financial system forward without creating parallel implementations of the same contract.
