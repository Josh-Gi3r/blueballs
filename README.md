<h1 align="center">
  <img src="public/blueballs-mark.svg" alt="" width="22" />
  Blueballs
</h1>

<p align="center">
  <strong>Build the financial institution your market needs.</strong>
</p>

<p align="center">
  The open-source operating system for modern banking, stablecoin FX and programmable financial products.
</p>

<p align="center">
  <a href="https://blueballs.tech">Website</a> ·
  <a href="https://blueballs.tech/products">Products</a> ·
  <a href="https://blueballs.tech/fx">FX Market</a> ·
  <a href="https://blueballs.tech/cards">Cards</a> ·
  <a href="https://blueballs.tech/ecosystem">Providers</a> ·
  <a href="https://blueballs.tech/blueprint">Blueprints</a> ·
  <a href="https://blueballs.tech/proof">Proof</a> ·
  <a href="https://blueballs.tech/sandbox">Build in the Sandbox</a> ·
  <a href="https://blueballs.tech/developers">API</a> ·
  <a href="https://blueballs.tech/contact">Build with Blueballs</a>
</p>

<p align="center">
  <img src="docs/assets/readme/home-hero.png" alt="Blueballs — Build the financial institution your market needs" width="100%" />
</p>

## Own the financial stack

Most financial products are assembled around black boxes: a banking platform owns the ledger, another vendor owns cards, another owns FX, another owns orchestration, and the institution is left integrating everybody else's abstractions.

**Blueballs flips that model.**

Blueballs is an MIT-licensed, self-hostable financial operating system that puts the core architecture back in the hands of the institution building the product. One repository combines a **181-operation banking API**, exact double-entry accounting, provider orchestration, card and payment primitives, institution-owned stablecoin FX, programmable settlement, product-building interfaces and deterministic release tooling.

Clone it. Inspect it. Fork it. Connect the providers you want. Shape the products your market needs. Keep the financial logic, infrastructure choices and customer experience under your control.

> **One codebase for the product, the money, the providers, the market and the proof.**

## What ships in Blueballs

| Surface | What Blueballs gives you |
| --- | --- |
| **Banking** | 181 operations across customers, onboarding, accounts, receiving details, transfers, cards, wallets, business banking, approvals, custody, webhooks and platform controls |
| **Ledger** | Exact double-entry accounting with balances derived from postings, atomic command boundaries and overdraft protection at the posting layer |
| **Providers** | A provider-neutral orchestration layer with durable jobs, idempotency, retries, encrypted payloads, explicit finality and reconciliation |
| **FX** | Policy-aware pricing, private and institutional liquidity, route construction, reservations, treasury/principal capacity, fiat evidence and execution adapters |
| **Settlement** | Optional Blueballs AtomicRouter contracts for signed taker intent, maker liquidity, cancellation, segregated vault accounting and atomic token settlement |
| **Money primitives** | A reference monetary engine for reserve-backed instruments, settlement receipts and coverage accounting |
| **Product layer** | Interactive banking and FX experiences, Blueprint Library, provider decision tools, Cards market explorer, Sandbox Builder and generated implementation briefs |
| **Runtime** | Node.js/SQLite and Cloudflare Workers/Durable Objects using shared financial contracts |
| **Developer platform** | Generated OpenAPI, SDK contracts, provider conformance boundaries and executable examples |
| **Release proof** | Public Proof plus exact-checkout verification covering lifecycle tests, restart/eviction, migrations, recovery, load/chaos, dependency inventory and container scanning |

## Not another neobank template

Blueballs is built around financial invariants, not screenshots.

```text
product experience
      ↓
banking + FX contracts
      ↓
ledger / policy / routing / settlement
      ↓
durable provider adapters
      ↓
institution-owned infrastructure
```

The UI is a product surface. The API is a contract. The ledger is authoritative. External side effects are durable. Provider ambiguity becomes reconciliation. FX capacity passes policy before price. Firm quotes reserve capacity before execution.

That means Blueballs can be adapted into a consumer neobank, business account, card programme, wallet, remittance product, embedded-finance stack, stablecoin product or institution-owned FX platform without replacing the core financial model every time the interface changes.

## Build and operate your own FX market

Stablecoin FX should not have to mean sending every trade to one opaque venue.

Blueballs treats FX as an institution-owned market and control plane.

It can combine:

- customer and private orders;
- issuer inventory;
- professional market makers;
- treasury liquidity;
- institution principal capacity;
- external execution venues;
- fiat settlement evidence;
- optional atomic token settlement.

Liquidity becomes eligible **after policy**. Routes compete on exact economics. A quote becomes firm **after capacity is reserved**. Submission, provider acceptance and settlement finality stay distinct until evidence closes the trade.

Production deployments plug in their own market, liquidity, banking and execution relationships through the FX runtime adapter while Blueballs retains the canonical policy, routing and lifecycle contract.

```bash
FX_NODE_MODE=production \
FX_NODE_PRODUCTION_ADAPTER=@institution/blueballs-fx-runtime \
FX_NODE_API_KEY='32-or-more-characters' \
node apps/fx-node/src/cli.js
```

Explore the interactive market at **[blueballs.tech/fx](https://blueballs.tech/fx)**.

## Design a bank before writing the bank

The **Blueballs Sandbox Builder** turns product strategy into something executable.

Start with a brief, define the audience and markets, choose currencies, capabilities and rails, shape the product, then exercise the same banking contracts that power the rest of the repository.

A Blueprint can now move through the full decision and distribution loop:

1. define markets, currencies, capabilities and rails;
2. generate explainable provider matches from capability fit, declared market coverage and explicit rail evidence;
3. shortlist infrastructure and inspect official technical documentation;
4. provision an isolated sandbox and exercise protected-ledger journeys;
5. share a public-safe Blueprint link and let another builder inspect or fork the architecture;
6. generate a concrete implementation brief from the Blueprint and user-selected shortlist;
7. take that brief into your own technical team or the Blueballs implementation route.

Provider matching is deliberately non-commercial: sponsorship or commercial relationships do not affect ranking.

Start from scratch or fork one of eight reusable architectures in the **[Blueprint Library](https://blueballs.tech/blueprint)**.

The hosted Builder can help turn an idea into a focused product blueprint without giving an AI model arbitrary authority over customer money.

**[Build in the Sandbox →](https://blueballs.tech/sandbox)**

## Explore the product

| Banking products | Stablecoin FX |
| --- | --- |
| [![Banking product catalogue](docs/assets/readme/products.png)](https://blueballs.tech/products) | [![Stablecoin FX market](docs/assets/readme/fx.png)](https://blueballs.tech/fx) |
| Card programmes | Developer API |
| [![Card programme builder](docs/assets/readme/cards.png)](https://blueballs.tech/cards) | [![Banking API documentation](docs/assets/readme/developers.png)](https://blueballs.tech/developers) |

[![Sandbox Builder](docs/assets/readme/sandbox.png)](https://blueballs.tech/sandbox)

## Provider-neutral by design

Blueballs is the software core. Institutions bring the regulated relationships, credentials and jurisdiction-specific operating policy appropriate to the products they launch.

Banks, payment rails, receiving-account providers, card processors, identity systems, custodians, stablecoin infrastructure and liquidity venues connect behind explicit adapter contracts rather than leaking provider-specific behavior through the product model.

That separation is leverage:

- change a provider without rewriting the customer-facing banking contract;
- keep commercial relationships outside the open-source kernel;
- operate different provider compositions by market;
- expose compatibility without pretending every listed provider is a Blueballs partner;
- build institution-specific infrastructure without forking the financial semantics.

Explore the **[Blueballs Provider Directory](https://blueballs.tech/ecosystem)**.

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
├─ src/                 public product and interactive interfaces
├─ apps/api/            banking API, ledger and provider orchestration
├─ apps/fx-node/        canonical FX runtime
├─ packages/fx-*/       policy, pricing, liquidity, fiat, monetary, SDK and contracts
├─ workers/             Cloudflare Worker / Durable Object runtimes
├─ spec/                machine-readable banking and FX contracts
├─ docs/                integration, deployment and operating guides
└─ examples/            executable integrations
```

Blueballs is one coherent monorepo. Banking, FX, settlement, product interfaces and edge runtimes share machine-readable ownership and compatibility contracts instead of maintaining parallel financial semantics.

### Banking command model

```text
request
  → authenticated principal / authorization
  → lifecycle and contract preflight
  → domain transition
  → ledger postings
  → durable events + outboxes
  → idempotency result
  → audit/correlation evidence
  → commit
```

Every local financial command commits as one authoritative unit of work. External effects begin from durable provider intent and complete through explicit provider evidence and reconciliation.

## Financial invariants

- Monetary API values cross boundaries as decimal strings and authoritative calculations use integer minor or atomic units.
- Ledger transactions balance exactly.
- Customer account postings cannot leave the account below zero.
- Tenant resources, events and idempotency records belong to a stable tenant principal.
- Restricted credentials cannot delegate authority they do not hold.
- Signed human attribution is bound to the credential, method, path, query and body.
- External provider work is durable before submission and retains a stable idempotency identity across retries and reconciliation.
- Provider transport evidence and business finality must agree before money becomes final.
- Inbound provider settlements require independent signed evidence and replay protection.
- FX liquidity passes policy before competing on price.
- A firm FX quote exists only after selected capacity is reserved.
- Submitted FX routes remain in explicit settlement or reconciliation state until final evidence arrives.
- Atomic token settlement is scoped to the actual AtomicRouter transaction; external fiat and provider edges retain their own finality.

## Proof lives with the code

Blueballs keeps its assurance model inside the repository so builders, institutions and reviewers can reproduce it from the exact checkout they are evaluating.

Standard engineering gate:

```bash
pnpm verify
```

Full clean-checkout release gate:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The full profile exercises build/types, lint/format, the banking lifecycle catalogue, FX suites, Cloudflare runtime/eviction behavior, OpenAPI and SDK contracts, Foundry fuzz/invariants, Compose, secret/dependency checks, CycloneDX inventory, restart/chaos, disposable banking + FX load proof and reference-container vulnerability scanning.

Machine-readable evidence is tied to the exact commit, Git tree and lockfile.

**[Blueballs Proof](https://blueballs.tech/proof)** exposes live site, banking and FX source-SHA parity from `/api/health` and links directly to the verification, release and deployment gates in source. The public proof claims are themselves checked against those repository scripts by the publication-truth gate.

Focused commands:

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

## Build on Blueballs

Blueballs is open source because financial infrastructure should be inspectable, adaptable and ownable.

Use the core as-is for exploration. Fork it for your product. Build a provider adapter. Extend a rail. Add a market. Design a new financial instrument. Bring Blueballs into an institution-owned deployment.

The project is deliberately provider-neutral and jurisdiction-flexible so serious teams can perform the additional integration, security, operational and regulatory work their own deployment requires without fighting a black-box platform.

**Blueballs is free to use. If you want the project involved in product design, integration, deployment or operating architecture, [build with Blueballs](https://blueballs.tech/contact).**

**[Explore Blueballs](https://blueballs.tech)** · **[Blueprint Library](https://blueballs.tech/blueprint)** · **[Build in the Sandbox](https://blueballs.tech/sandbox)** · **[Proof](https://blueballs.tech/proof)** · **[Read the API](https://blueballs.tech/developers)** · **[Build with Blueballs](https://blueballs.tech/contact)**

## Documentation

| Document | Purpose |
| --- | --- |
| [VISION.md](VISION.md) | Where Blueballs is going |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, ownership and extension points |
| [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) | Executable engineering assurance |
| [SANDBOX.md](SANDBOX.md) | Sandbox Builder |
| [docs/releases/v0.2.0.md](docs/releases/v0.2.0.md) | Publish-ready v0.2 launch notes |
| [apps/api/README.md](apps/api/README.md) | Banking runtime |
| [apps/fx-node/README.md](apps/fx-node/README.md) | FX runtime and production composition |
| [packages/fx-sdk/README.md](packages/fx-sdk/README.md) | JavaScript FX SDK |
| [docs/PROVIDER-GATEWAY.md](docs/PROVIDER-GATEWAY.md) | Banking provider protocol |
| [docs/PROVIDER-CONFORMANCE.md](docs/PROVIDER-CONFORMANCE.md) | Provider adapter conformance |
| [spec/fx/ADAPTERS.md](spec/fx/ADAPTERS.md) | FX production adapter contract |
| [docs/IAM.md](docs/IAM.md) | Machine credentials, human attribution and approvals |
| [docs/SCALING.md](docs/SCALING.md) | Authoritative shards and scale-out architecture |
| [OPERATIONS.md](OPERATIONS.md) | Deployment and operations |
| [SECURITY.md](SECURITY.md) | Security engineering and disclosure |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Build with the project |

## License

MIT. Build with it.

See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
