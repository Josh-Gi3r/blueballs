# Governance

Blueballs is an open-source financial infrastructure project. Governance is deliberately conservative where changes can affect money, authorisation, settlement, compatibility or security.

## Roles

### Maintainers
Maintainers merge changes, cut releases, manage security disclosures and are accountable for preserving the public contracts and invariants of the project.

### Contributors
Anyone may propose changes through pull requests and issues. Contribution does not imply authority to change a public contract or financial invariant.

## Decision model

Routine bug fixes, documentation and backwards-compatible implementation work use normal pull-request review.

An RFC is required before implementation when a proposal materially changes any of the following:

- public API semantics or versioning;
- ledger/accounting semantics;
- authentication, authorisation or policy boundaries;
- transaction or settlement state machines;
- liquidity, routing, pricing or principal-risk semantics;
- adapter/capability contracts;
- persistence guarantees;
- smart-contract trust or upgrade assumptions;
- release/security guarantees.

RFCs live in `docs/rfcs/`. Accepted RFCs describe a decision, not an aspiration. Reversing an accepted decision requires a superseding RFC.

## Compatibility

Backwards compatibility is the default. Breaking changes require an explicit migration/deprecation plan and a version boundary. Undocumented breaking behaviour is a defect.

## Security

Security reports follow `SECURITY.md`, not public issues. A security fix may bypass the public RFC process until disclosure is safe.

## Financial correctness

Changes affecting balances, reservations, settlement, pricing or permissions require tests that demonstrate the relevant invariants. Reviewers should prefer failing closed over inferred success.

## Releases

A release is an auditable mapping from source commit to artifacts. Release notes
must identify breaking changes, migrations, incomplete production-checklist
items, adapter requirements and security-relevant changes.
