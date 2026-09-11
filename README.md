<h1 align="center">
  <img src="public/blueballs-mark.svg" alt="" width="22" />
  Blueballs
</h1>

<p align="center">
  <strong>The open-source operating system for modern financial institutions.</strong>
</p>

<p align="center">
  <a href="https://blueballs.tech">Website</a> ·
  <a href="https://blueballs.tech/products">Products</a> ·
  <a href="https://blueballs.tech/fx">FX</a> ·
  <a href="https://blueballs.tech/cards">Cards</a> ·
  <a href="https://blueballs.tech/sandbox">Sandbox</a> ·
  <a href="https://blueballs.tech/developers">API</a>
</p>

<p align="center">
  <img src="docs/assets/readme/home-hero.png" alt="Blueballs city cover reading Build the financial institution your market needs" width="100%" />
</p>

Blueballs is an MIT-licensed, self-hostable financial-infrastructure stack for building neobanks, embedded-finance products and institution-owned money movement. It combines product interfaces, a 181-operation banking API, exact double-entry accounting, provider orchestration, product configuration, policy-aware FX, optional atomic token settlement and deployment tooling in one repository.

The architecture starts from financial invariants rather than UI flows: exact money, atomic local commands, retry-safe external effects, tenant isolation, explicit finality, durable reconciliation and machine-verifiable contracts.

## What ships in Blueballs

- **181-operation banking API** covering customers, accounts, transfers, cards, onboarding, receiving details, business operations, custody, approvals, webhooks and platform controls.
- **Exact double-entry ledger** with balances derived from postings and customer overdraft protection enforced at the posting boundary.
- **Atomic financial commands** spanning resource state, ledger postings, durable events/outboxes, idempotency and audit correlation.
- **Provider orchestration layer** with durable jobs, leases, stable external idempotency, retries, explicit ambiguity and reconciliation.
- **Provider-backed payments, cards, receiving details, identity and custody** through a versioned capability contract.
- **Signed provider-originated settlement** for inbound account credits and custody deposits, with transport replay and provider-reference deduplication.
- **Encrypted durable provider/webhook payloads** using AES-256-GCM keyrings and rotation IDs.
- **Scoped machine credentials and named-human attribution** with request-bound signed actor assertions for IAM/BFF integrations.
- **Policy-aware FX engine** for private orders, institutional liquidity, treasury/principal capacity, exact pricing, route construction and reservation.
- **Adapter-driven production FX runtime** for institution-owned liquidity, fiat evidence and execution providers.
- **Blueballs AtomicRouter contracts** for institution-authorized signed taker intent, maker-signed liquidity, cancellation, segregated vault accounting and atomic token settlement.
- **Reference monetary engine** for reserve-backed instruments, settlement receipts and coverage accounting.
- **Sandbox Builder and product interfaces** for designing and exercising tenant-isolated financial products.
- **Node.js/SQLite and Cloudflare Workers/Durable Objects runtimes** using the same banking contracts.
- **OpenAPI, SDK and conformance contracts** generated and checked against runtime behaviour.
- **Release engineering toolkit** covering restart/eviction, migrations, backup/restore, load/chaos, dependency inventory, container scanning and exact-checkout evidence.

## Explore the product

| Banking products | Stablecoin FX |
| --- | --- |
| [![Banking product catalogue](docs/assets/readme/products.png)](https://blueballs.tech/products) | [![Stablecoin FX market](docs/assets/readme/fx.png)](https://blueballs.tech/fx) |
| Card programmes | Developer API |
| [![Card programme builder](docs/assets/readme/cards.png)](https://blueballs.tech/cards) | [![Banking API documentation](docs/assets/readme/developers.png)](https://blueballs.tech/developers) |

[![Sandbox Builder](docs/assets/readme/sandbox.png)](https://blueballs.tech/sandbox)

## Quickstart

Requirements:

- Node.js 24.15 or newer within the 24.x release line
- pnpm 11.21 or newer

```bash
git clone https://github.com/Josh-Gi3r/blueballs.git
cd blueballs
pnpm install --frozen-lockfile
pnpm dev
```

The development stack starts:

| Service | Address |
| --- | --- |
| Website | `http://localhost:5280` |
| Banking API | `http://localhost:5290/v2` |
| FX node | `http://localhost:8788` |

Open `http://localhost:5280/sandbox` to build a product environment, or run the complete banking example:

```bash
node examples/banking-quickstart.mjs http://localhost:5290
```

Individual services are available through `pnpm dev:site`, `pnpm dev:api` and `pnpm dev:fx`.

## Architecture

```text
blueballs/
├─ src/                 product website and interactive interfaces
├─ apps/api/            banking API, ledger and provider orchestration
├─ apps/fx-node/        canonical FX runtime
├─ packages/fx-*/       policy, pricing, liquidity, fiat, monetary, SDK and contracts
├─ workers/             Cloudflare Worker / Durable Object runtimes
├─ spec/                machine-readable banking and FX contracts
├─ docs/                deployment, integration and operations guides
└─ examples/            executable integrations
```

Blueballs is one coherent monorepo. Banking, FX, contracts, product interfaces and edge runtimes share machine-readable ownership and compatibility contracts rather than maintaining independent copies of financial semantics.

### Banking command model

```text
request
  → authenticated principal / authorization
  → domain transition
  → ledger postings
  → event + durable outboxes
  → idempotency result
  → audit/correlation evidence
  → commit
```

Every local financial command commits as one SQLite transaction. External effects begin from durable provider intents and complete through explicit provider evidence and reconciliation.

### Production provider composition

Banking integrations speak one provider-neutral gateway protocol. Payment rails, card processors, identity systems, receiving-account providers and custodians can be swapped without changing customer-facing banking contracts.

FX production composition is equally adapter-driven:

```bash
FX_NODE_MODE=production \
FX_NODE_PRODUCTION_ADAPTER=@institution/blueballs-fx-runtime \
FX_NODE_API_KEY='32-or-more-characters' \
node apps/fx-node/src/cli.js
```

The deployment adapter supplies live market/liquidity, quote lifecycle, fiat evidence and execution while Blueballs retains the canonical policy, routing and finality contract.

## Financial invariants

- Monetary API values cross boundaries as decimal strings and authoritative calculations use integer minor or atomic units.
- Ledger transactions must balance exactly.
- Customer account postings cannot leave the account below zero.
- Tenant resources, events and idempotency records are scoped to a stable tenant principal.
- Restricted API keys cannot mint credentials with greater authority than they hold.
- Signed human attribution is bound to the exact credential, method, path, query and body.
- External provider work is durable before submission and uses a stable job ID across retries/reconciliation.
- Provider transport evidence and business finality must agree before money becomes final.
- Inbound provider settlements require independent signed evidence and replay protection.
- FX liquidity passes policy before competing on price.
- A firm FX quote exists only after selected capacity is reserved.
- Submitted FX routes remain in explicit settlement/reconciliation state until final evidence arrives.
- Token atomicity is scoped to the actual AtomicRouter transaction; external fiat/provider edges retain their own finality.

## Verification

Blueballs keeps the release authority in the repository so any institution can reproduce it from an exact checkout.

Standard engineering gate:

```bash
pnpm verify
```

Full clean-checkout release gate:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The full profile exercises build/types, lint/format, all banking API lifecycle coverage, FX suites, Cloudflare runtime/eviction tests, OpenAPI/SDK contracts, Foundry fuzz/invariants, Compose, secret/dependency checks, CycloneDX inventory, restart/chaos, disposable banking+FX load proof and reference-container vulnerability scanning. It writes machine-readable evidence under `artifacts/` tied to the exact commit and lockfile.

Focused commands include:

```bash
pnpm test:api
pnpm test:fx
pnpm test:workers
pnpm stress:chaos
pnpm stress:release
pnpm security:release
pnpm security:container
pnpm sbom
```

## Documentation

| Document | Purpose |
| --- | --- |
| [VISION.md](VISION.md) | Product direction |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, ownership and extension points |
| [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) | Engineering assurance and release invariants |
| [docs/OPERATION-MODES.md](docs/OPERATION-MODES.md) | Banking runtime modes |
| [docs/IAM.md](docs/IAM.md) | Machine credentials, human assertions, step-up and approvals |
| [docs/SCALING.md](docs/SCALING.md) | Single-writer shards and scale-out architecture |
| [SANDBOX.md](SANDBOX.md) | Sandbox Builder |
| [apps/api/README.md](apps/api/README.md) | Banking runtime |
| [apps/fx-node/README.md](apps/fx-node/README.md) | FX runtime and production composition |
| [packages/fx-sdk/README.md](packages/fx-sdk/README.md) | JavaScript FX SDK |
| [docs/PROVIDER-GATEWAY.md](docs/PROVIDER-GATEWAY.md) | Banking provider protocol |
| [docs/PROVIDER-CONFORMANCE.md](docs/PROVIDER-CONFORMANCE.md) | Provider adapter conformance |
| [docs/PROVIDER-INBOUND.md](docs/PROVIDER-INBOUND.md) | Provider-originated settlement |
| [spec/fx/ADAPTERS.md](spec/fx/ADAPTERS.md) | FX production adapter contracts |
| [OPERATIONS.md](OPERATIONS.md) | Deployment and operations entry point |
| [docs/PRODUCTION-OPERATIONS.md](docs/PRODUCTION-OPERATIONS.md) | HA, RPO/RTO and rotation standards |
| [docs/LOAD-CHAOS.md](docs/LOAD-CHAOS.md) | Load, soak, restart and chaos procedures |
| [docs/SECURITY-VERIFICATION.md](docs/SECURITY-VERIFICATION.md) | Security verification profile |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow |
| [SECURITY.md](SECURITY.md) | Security policy and reporting |

## Build your institution on your infrastructure

Blueballs provides the financial core, contracts and integration boundaries; institutions plug in their own licensed relationships, credentials and jurisdiction-specific operating policy without forking the core architecture.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
