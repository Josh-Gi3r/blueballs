# Changelog

All notable changes to the Blueballs reference distribution are documented here.

The project follows semantic versioning for tagged reference releases. A reference release is not a claim of production certification.

## [Unreleased]

### Added

- connected BRL to EUR public reference trade;
- live customer, institution and developer FX views driven by the canonical node;
- backend market scenarios for source outage, policy revocation, treasury capacity, principal limits and reference-price failure;
- high-resolution editorial SVGs and live coded schematics;
- public trade OpenAPI and typed SDK methods;
- adapter guide, known-limitations document, deployment guide and security policy;
- reproducible release, ABI export and dependency-inventory tooling.

### Changed

- `/fx` no longer defines rates, capacities or policy authority in React;
- the canonical reference node now connects the fiat-facing BRL/EUR product to the BRLX/EURC multi-source token corridor;
- legacy FX routes in `apps/api` are frozen as compatibility demonstrations.

## [0.1.0] - Reference release candidate

### Banking

- 144 catalogued general banking endpoints respond;
- multi-currency accounts, cards, transfers, onboarding, products and ledger reference behaviour;
- product UI, journey demonstrations and executable API documentation.

### FX

- policy engine with participants, credentials, account attribution and short-lived authorisations;
- private signed-order market with reservations and reconciliation;
- exact rational pricing and reference-price consensus;
- principal quote engine and hard risk book;
- cross-source exact-output route optimiser and rollback-safe reservation coordinator;
- fiat intent, attestation and mixed-finality settlement state;
- Solidity Vault, maker settlement, cancellation registry, policy registry and AtomicRouter;
- standalone FX node, JavaScript SDK and deterministic simulator;
- unit, integration, fuzz, invariant, controlled-Anvil and Docker release gates.
