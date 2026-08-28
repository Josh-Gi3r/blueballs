<h1 align="center">
  <img src="public/blueballs-mark.svg" alt="" width="22" />
  Blueballs
</h1>

<p align="center">
  <strong>Open-source software for building a neobank.</strong>
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

Blueballs is an MIT-licensed reference platform for designing and running a
neobank or embedded-finance product. It combines a product interface, a
tenant-isolated banking API, a double-entry ledger, a sandbox builder and a
provider-neutral foreign-exchange runtime in one self-hostable repository.

The project is designed to be read, forked and adapted. Banks, identity
providers, card issuers, payment rails, custody systems and liquidity venues
connect through deployment-owned adapters; their inclusion in the provider
directory does not imply a partnership or live integration.

## What is included

- Product interfaces for accounts, cards, transfers, onboarding and financial
  operations.
- A banking API with 181 documented operations and exact decimal accounting.
- A double-entry ledger whose balances are derived from postings.
- A sandbox builder for creating and testing tenant-isolated product models.
- A canonical FX runtime for policy, pricing, liquidity selection, reservation
  and settlement state.
- Optional Solidity contracts for token backing, authorization, cancellation
  and atomic settlement.
- A dependency-free JavaScript FX SDK and OpenAPI contracts.
- Node.js/SQLite and Cloudflare Workers/Durable Objects runtimes.

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
pnpm install
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
has not been configured.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for data ownership, runtime topology and
extension boundaries.

## Financial and security boundaries

- Monetary amounts cross API boundaries as decimal strings and are represented
  internally as integer minor units or atomic units.
- Ledger postings must balance, and customer accounts cannot be overdrawn by a
  posting.
- Tenant resources, events and idempotency records are isolated by a stable
  tenant principal.
- FX liquidity is policy-checked before it can compete on price.
- A firm FX quote exists only after all selected capacity is reserved.
- Fiat submission and settlement remain distinct states.
- Provider credentials and production customer data never belong in the
  repository or browser bundle.

Blueballs is software, not a bank, sponsor-bank relationship, insured account,
custodian, compliance programme or production certification. A production
deployment must supply its own licences, providers, security controls,
availability design, monitoring, reconciliation and customer protections. See
[SECURITY.md](SECURITY.md) and the
[production checklist](spec/fx/PRODUCTION-CHECKLIST.md).

## Verification

Run the complete local verification suite:

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
```

Foundry is required for the Solidity test suite. Docker and Wrangler are needed
only for their respective deployment workflows. See [TESTING.md](TESTING.md)
for the complete local setup.

## Documentation

| Document | Purpose |
| --- | --- |
| [VISION.md](VISION.md) | Product direction and boundaries |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, ownership and extension points |
| [SANDBOX.md](SANDBOX.md) | Sandbox Builder product and API |
| [apps/api/README.md](apps/api/README.md) | Banking runtime |
| [apps/fx-node/README.md](apps/fx-node/README.md) | FX runtime |
| [packages/fx-sdk/README.md](packages/fx-sdk/README.md) | JavaScript SDK |
| [docs/partners/README.md](docs/partners/README.md) | Provider directory standards |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and production boundaries |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
changing public contracts, ledger behavior, policy, pricing or settlement
state.

## License

[MIT](LICENSE). Third-party notices are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
