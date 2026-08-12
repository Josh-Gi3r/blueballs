# Repository engineering standard

Blueballs is financial infrastructure. Repository hygiene is part of correctness because downstream operators must be able to identify authoritative contracts, reproduce builds and review changes.

## Sources of truth

- `README.md`: orientation, status and quickstart.
- `spec/`: normative product/protocol behaviour.
- versioned OpenAPI files: machine-readable HTTP contracts.
- `docs/`: explanatory architecture, guides, operational standards and RFCs.
- `SECURITY.md`: vulnerability reporting and security assumptions.
- `CHANGELOG.md`: released externally observable changes.

Planning documents are not normative contracts. If a plan conflicts with `spec/` or a released OpenAPI contract, the contract wins.

## Change discipline

All material changes use pull requests. Sensitive surfaces are CODEOWNED. CI must be green before merge. A reviewer must be able to understand the behavioural impact from the PR without reconstructing intent from commit history.

## Generated artifacts

Generated artifacts are either reproducibly generated and checked for drift in CI or excluded from source control. Generated files must identify their generator where practical.

## Dependencies

Dependencies are lockfile-pinned at installation time, updated through reviewed automation and included in dependency inventory/SBOM evidence. Avoid adding a dependency for functionality that is small, security-sensitive or already provided by the platform.

## Secrets and data

No production secrets, credentials, private keys or customer data are committed. Examples use obviously non-production values. Logs, fixtures and snapshots are treated as possible data-exfiltration surfaces.

## Tests

Tests should prove externally relevant behaviour and invariants, not merely execute lines. Financially sensitive modules require negative/failure-path tests. Deterministic reference environments are preferred so failures can be reproduced locally and in CI.

## Documentation drift

Examples and commands should be executable where feasible. Behavioural documentation changes in the same PR as implementation. Stale architectural documents should be superseded or removed rather than left as competing truths.
