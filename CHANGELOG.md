# Changelog

Notable Blueballs releases and platform upgrades are recorded here. Tagged releases follow semantic versioning.

## [Unreleased]

### Banking core

- completed atomic banking command boundaries across resource state, exact ledger postings, events/outboxes, idempotency and audit evidence;
- expanded concurrent-spend, restart, recovery, migration and Durable Object eviction coverage;
- added domain-scoped API-key permissions and request-bound named-human actor assertions;
- added production bootstrap/recovery controls and operational readiness/metrics endpoints;
- strengthened runtime-mode ownership and production lifecycle classification across the 181-operation catalogue.

### Provider orchestration

- added durable provider operations with stable idempotency, leases, retries, attempt history and explicit reconciliation;
- added provider-backed payments, cards, receiving details, identity, custody wallet provisioning and custody transfers;
- added AES-256-GCM payload sealing with key IDs and rotation support;
- added signed provider-originated account/custody settlement with replay and provider-reference deduplication;
- added capability-specific provider finality contracts and conformance fixtures;
- added durable signed webhook delivery with encrypted signing material and strict HTTPS egress controls.

### FX

- added adapter-driven `production` mode to the canonical FX node through `FX_NODE_PRODUCTION_ADAPTER`;
- added production runtime contract validation and conformance tests;
- expanded exact policy, pricing, multi-source reservation, treasury/principal risk and mixed-finality settlement flows;
- connected production composition documentation across the FX node and adapter specification;
- upgraded the public FX experience into an interactive market/architecture lab focused on policy, routing, execution and settlement capabilities.

### Contracts

- expanded `AtomicRouter`, settlement, vault, policy authorization, cancellation and smart-wallet signature coverage;
- added unit, fuzz and invariant assurance for solvency, partial fills, replay controls and withdrawal-delay boundaries.

### Release engineering

- consolidated release authority into reproducible repository-local verification;
- added clean-checkout `pnpm verify:release` with secret/dependency checks, CycloneDX inventory, restart/chaos, disposable banking + FX load proof and reference-container vulnerability scanning;
- added exact commit/tree/toolchain/lockfile evidence in `artifacts/verification-report.json`;
- added self-contained release load evidence and deployment parity guards;
- aligned README, architecture, security, operations, testing, governance and roadmap with the completed financial-infrastructure model.

## [0.1.0] - 2026-08-28

Initial public release of Blueballs.

### Included

- product interfaces for accounts, cards, transfers and onboarding;
- tenant-isolated banking API with 181 documented operations;
- exact decimal accounting and double-entry ledger;
- Sandbox Builder and product journeys;
- canonical FX node, domain packages, SDK and market simulator;
- Solidity settlement contracts;
- Node.js, Docker and Cloudflare runtimes;
- OpenAPI contracts, examples and local verification commands.

[Unreleased]: https://github.com/Josh-Gi3r/blueballs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Josh-Gi3r/blueballs/releases/tag/v0.1.0
