# Changelog

Blueballs releases record meaningful expansion of the open financial operating system. Each entry should tell builders what new capability they can use, inspect or extend.

Tagged releases follow semantic versioning.

## [Unreleased]

This cycle takes Blueballs far beyond the initial public release: a harder banking core, a real provider orchestration boundary, institution-owned FX production composition, stronger settlement contracts, reusable financial-product Blueprints and public, source-linked release proof.

### Banking core

- **Atomic financial commands** now bind resource state, exact ledger postings, durable events/outboxes, idempotency and audit evidence into one local command boundary.
- **181-operation lifecycle coverage** is classified across permissions, runtime modes and production ownership.
- **Scoped machine credentials** support domain-level permissions without allowing restricted keys to delegate broader authority.
- **Named-human attribution** can bind external IAM identity to the exact credential, method, path, query and request body.
- **Production bootstrap and recovery** preserve tenant identity through credential rotation and recovery.
- **Operational health and metrics** expose readiness, backlog, reconciliation and financial-state signals without exposing customer secrets.
- **Restart, migration and Durable Object eviction proof** expands coverage across representative financial state transitions.

### Provider orchestration

- **Durable provider operations** add stable external idempotency, leases, retries, attempt history and explicit reconciliation.
- **Provider-backed payments, cards, receiving details, identity and custody** now share one capability-driven gateway contract.
- **Encrypted provider payloads** use AES-256-GCM envelopes with key IDs for rotation.
- **Signed provider-originated settlement** can credit account and custody state from final provider evidence with event and provider-reference replay protection.
- **Capability-specific finality contracts** keep transport success separate from financial finality.
- **Durable signed webhooks** retain stable delivery identity, encrypted signing material, bounded retries and exact HTTPS host allowlisting.

### Institution-owned FX

- **Production FX composition** now loads through `FX_NODE_PRODUCTION_ADAPTER`, keeping institution liquidity, banking and execution relationships outside the canonical kernel.
- **Runtime contract validation** proves the production adapter supplies the complete market, quote, fiat and execution boundary before traffic is served.
- **Policy-aware liquidity and exact pricing** expand across multi-source reservation, treasury/principal capacity and mixed-finality settlement.
- **The public FX experience** now functions as an interactive market and architecture lab for policy, liquidity, routing, execution and settlement.

### Atomic settlement contracts

- **AtomicRouter** coverage expands around institution-authorized taker intent, maker signatures, nonce replay protection and route-level max-input/min-output controls.
- **Vault and settlement invariants** cover solvency, surplus-only rescue, partial-fill accounting, cancellation and bounded withdrawal-delay incident controls.
- **Foundry assurance** combines unit, fuzz and invariant testing for the token settlement kernel.

### Product design, provider decisions and distribution

- **Deterministic infrastructure matching** turns a Builder Blueprint into an explainable provider shortlist based on capability fit, declared market coverage and explicit rail evidence. Commercial relationships do not affect ranking.
- **Persistent provider decisions** let builders shortlist and compare infrastructure, open official technical documentation, claim provider profiles and start a separate commercial provider route without turning the directory into pay-to-play.
- **Shareable Blueprints** serialize only public-safe product architecture into a fragment link, so another builder can inspect and fork markets, currencies, capabilities and rails without exposing sandbox customers, balances, transactions, credentials or tenant state.
- **The Blueprint Library** adds eight reusable product architectures across creator banking, freelancer finance, stablecoin treasury, remittance, cards, merchant settlement, community wallets and institution-owned FX.
- **Implementation briefs** convert a Blueprint and user-selected provider shortlist into concrete workstreams and a copyable public-safe handoff for a technical team or Blueballs implementation engagement.
- **Builder activation and demand signals** distinguish page intent from completed Blueprints, provisioned sandboxes, test payments, provider decisions, Blueprint distribution and implementation-intake starts using bounded first-party events.

### Release proof

- **Repository-local release authority** now runs from the exact candidate checkout rather than depending on a hosted CI vendor.
- **`pnpm verify:release`** combines build/types, banking and FX suites, Workers, OpenAPI/SDK contracts, Foundry, secrets/dependencies, SBOM, restart/chaos, disposable load proof and container scanning.
- **Exact-checkout evidence** records the commit, Git tree, toolchain, lockfile digest, API operation coverage and release-gate results.
- **Deployment parity guards** verify that the public site, banking API and FX runtime converge on the same source commit after promotion.
- **Public Proof** exposes live site/banking/FX source parity from `/api/health` alongside source-linked verification, release and deployment gates. The public claims are checked against the repository scripts as part of publication truth.

## [0.1.0] - 2026-08-28

**The first public Blueballs release.**

Blueballs opened with a complete product surface, a 181-operation banking contract, exact double-entry accounting, the Sandbox Builder, a canonical stablecoin FX stack, Solidity settlement contracts and Node/Cloudflare runtimes in one repository.

### Included

- product interfaces for accounts, cards, transfers and onboarding;
- tenant-isolated banking API with 181 documented operations;
- exact decimal accounting and double-entry ledger;
- Sandbox Builder and product journeys;
- canonical FX node, domain packages, SDK and market simulator;
- Solidity settlement contracts;
- Node.js, Docker and Cloudflare runtimes;
- OpenAPI contracts, executable examples and local verification commands.

[Unreleased]: https://github.com/Josh-Gi3r/blueballs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Josh-Gi3r/blueballs/releases/tag/v0.1.0
