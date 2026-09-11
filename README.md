<h1 align="center">
  <img src="public/blueballs-mark.svg" alt="" width="22" />
  Blueballs
</h1>

<p align="center">
  <strong>Open-source infrastructure for building and operating a modern financial institution.</strong>
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

Blueballs is an MIT-licensed, self-hostable financial-infrastructure stack for
building neobanks and embedded-finance products. It combines product interfaces,
a tenant-isolated banking API, a double-entry ledger, a product builder and a
provider-neutral foreign-exchange runtime in one repository.

The engineering target is production-grade core infrastructure: financial state
must be exact, atomic, retry-safe, tenant-isolated, observable and contract-tested.
The current pre-1.0 line is being hardened against that standard; remaining
release evidence and external gates are tracked in
[PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md).

A deploying institution still owns what cannot safely or legally be universal:
licences, regulated providers, credentials, jurisdiction-specific policy,
human IAM, customer protections and deployment operations. Banks, identity
providers, card issuers, payment rails, custody systems and liquidity venues
connect through versioned deployment-owned adapters; inclusion in the provider
directory never implies a partnership or live integration.

Blueballs deliberately keeps executable reference/simulation operations in the
same catalogue. `BANK_API_MODE=production` fails closed before any operation that
would otherwise pretend an unconnected processor, mandate engine, lending/savings
policy, document store or historical FX compatibility workflow is production.
The machine-readable boundary lives in
[`spec/banking/operation-modes.mjs`](spec/banking/operation-modes.mjs) and is
explained in [`docs/OPERATION-MODES.md`](docs/OPERATION-MODES.md).

## What is included

- Product interfaces for accounts, cards, transfers, onboarding and financial
  operations.
- A banking API with 181 documented operations and exact decimal accounting.
- A double-entry ledger whose balances are derived from postings.
- Atomic financial command boundaries covering resource state, ledger, events,
  outboxes, idempotency and audit correlation.
- Durable provider and webhook outboxes with retry/reconciliation semantics.
- Provider-neutral production adapters for payments, card issuance, receiving
  details, identity and custody, plus signed provider-originated settlement
  facts.
- Scoped machine credentials plus signed named-human attribution from an
  institution-owned IAM/session gateway.
- A sandbox builder for creating and testing tenant-isolated product models.
- A canonical FX runtime for policy, pricing, liquidity selection, reservation
  and settlement state.
- Optional Solidity contracts for token backing, authorization, cancellation and
  atomic settlement.
- A dependency-free JavaScript FX SDK and OpenAPI contracts.
- Node.js/SQLite and Cloudflare Workers/Durable Objects runtimes.
- Production health/readiness/metrics, verified SQLite backup/restore tooling,
  migration/restart/eviction tests and release/security gates.

## Explore the product

| Banking products | Stablecoin FX |
| --- | --- |
| [![Banking product catalogue](docs/assets/readme/products.png)](https://blueballs.tech/products) | [![Stablecoin FX simulation](docs/assets/readme/fx.png)](https://blueballs.tech/fx) |
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

The development command starts:

| Service | Address |
| --- | --- |
| Website | `http://localhost:5280` |
| Banking API | `http://localhost:5290/v2` |
| FX node | `http://localhost:8788` |

Open `http://localhost:5280/sandbox` to create a product environment, or run
the complete banking example:

```bash
node examples/banking-quickstart.mjs http://localhost:5290
```

Individual services are available through `pnpm dev:site`, `pnpm dev:api` and
`pnpm dev:fx`.

## Architecture

```text
blueballs/
├─ src/                 website and product interfaces
├─ apps/api/            banking API and double-entry ledger
├─ apps/fx-node/        canonical FX runtime
├─ packages/fx-*/       FX domain packages, SDK and contracts
├─ workers/             Cloudflare Worker entry points
├─ spec/                banking and FX contracts
├─ docs/                integration and contributor guides
└─ examples/            executable examples
```

The repository is a monorepo. `src`, `apps`, `packages` and `workers` are
directories in the same product—not separate frontend and backend branches.
`main` is the only long-lived branch; contribution branches should be focused
and short-lived.

The browser-facing FX page is a deterministic simulation for understanding the
system. The separately runnable FX node owns server-side policy, pricing,
liquidity and reservation behavior. It fails closed when an execution adapter
has not been configured. A simulation on the public site is never evidence that
a production adapter is connected.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for data ownership, runtime topology and
extension boundaries, and [`docs/SCALING.md`](docs/SCALING.md) for the supported
single-writer shard and future tenant-sharding model.

## Financial and security boundaries

- Monetary amounts cross API boundaries as decimal strings and are represented
  internally as integer minor units or atomic units.
- Banking resource state, ledger postings, durable events/outboxes, idempotency
  and audit evidence are committed as one request unit of work.
- Ledger postings must balance, and customer accounts cannot be overdrawn by a
  posting.
- Tenant resources, events and idempotency records are isolated by a stable
  tenant principal.
- Production external effects use durable provider intents, stable job-level
  idempotency and explicit ambiguous/reconciliation states.
- Production provider and webhook signing payloads are encrypted before durable
  persistence; provider-originated settlement facts are independently signed.
- Human session authentication remains deployment-owned; optional signed actor
  assertions preserve named-person attribution without exposing backend machine
  credentials to browsers.
- FX liquidity is policy-checked before it can compete on price.
- A firm FX quote exists only after all selected capacity is reserved.
- Fiat submission and settlement remain distinct states.
- Provider credentials and production customer data never belong in the
  repository or browser bundle.

Blueballs is software, not itself a bank, sponsor-bank relationship, insured
account, custodian or regulatory licence. Production-grade core software does not
remove the deploying institution's obligation to supply and operate the regulated
relationships, controls, security policy and customer protections required for
its product and jurisdictions. See [SECURITY.md](SECURITY.md),
[PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) and the
[FX production checklist](spec/fx/PRODUCTION-CHECKLIST.md).

## Verification

A release requires **both** repository-local verification from the exact clean
checkout and the hosted Production Gate for the same commit. Neither substitutes
for the other.

```bash
pnpm verify
```

Focused commands include:

```bash
pnpm build
pnpm lint
pnpm test:api
pnpm test:fx
pnpm test:workers
pnpm stress:chaos
pnpm security:release
pnpm security:container   # Docker required
```

The hosted gate additionally builds/scans the reference container, validates the
Compose topology, exercises Cloudflare runtime/eviction tests, runs Foundry
fuzz/invariants and performs CodeQL. The banking suite emits a machine-readable
operation-coverage artifact and fails if a success-capable documented operation
never returns a schema-valid success during the integration suite.

A release is considered verified only when the exact release checkout passes the
local gate, the required hosted gate is green for that SHA, and the release
evidence described in [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) is
retained. A successful frontend build, static OpenAPI file or screenshot is not
financial-runtime evidence.

See [TESTING.md](TESTING.md), [`docs/LOAD-CHAOS.md`](docs/LOAD-CHAOS.md) and
[`docs/SECURITY-VERIFICATION.md`](docs/SECURITY-VERIFICATION.md) for the complete
verification model.

## Documentation

| Document | Purpose |
| --- | --- |
| [VISION.md](VISION.md) | Product direction and boundaries |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, ownership and extension points |
| [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) | Production release blockers and acceptance criteria |
| [docs/OPERATION-MODES.md](docs/OPERATION-MODES.md) | Production-safe vs sandbox/reference API boundary |
| [docs/IAM.md](docs/IAM.md) | Machine credentials, human IAM assertions, step-up and dual control |
| [docs/SCALING.md](docs/SCALING.md) | Single-writer shards, tenant routing and scale-out invariants |
| [SANDBOX.md](SANDBOX.md) | Sandbox Builder product and API |
| [apps/api/README.md](apps/api/README.md) | Banking runtime |
| [apps/fx-node/README.md](apps/fx-node/README.md) | FX runtime |
| [packages/fx-sdk/README.md](packages/fx-sdk/README.md) | JavaScript SDK |
| [docs/PROVIDER-GATEWAY.md](docs/PROVIDER-GATEWAY.md) | Production provider protocol |
| [docs/PROVIDER-CONFORMANCE.md](docs/PROVIDER-CONFORMANCE.md) | Adapter conformance standard |
| [docs/PROVIDER-INBOUND.md](docs/PROVIDER-INBOUND.md) | Signed inbound settlement facts |
| [docs/partners/README.md](docs/partners/README.md) | Provider directory standards |
| [OPERATIONS.md](OPERATIONS.md) | Deployment and operations entry point |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | SRE, monitoring, backup/restore and DR runbook |
| [docs/PRODUCTION-OPERATIONS.md](docs/PRODUCTION-OPERATIONS.md) | HA, RPO/RTO, DR and secret rotation standard |
| [docs/LOAD-CHAOS.md](docs/LOAD-CHAOS.md) | Load, soak, restart and chaos procedure |
| [docs/SECURITY-VERIFICATION.md](docs/SECURITY-VERIFICATION.md) | Local/hosted security verification and external review bar |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and production boundaries |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
changing public contracts, ledger behavior, policy, pricing or settlement state.

## License

[MIT](LICENSE). Third-party notices are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
