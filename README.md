# Blueballs

Blueballs is an MIT-licensed, self-hostable **open-source neobank reference stack**. It combines product UI, a 144-endpoint banking API, double-entry ledger infrastructure and a modular institutional FX system in one repository.

Blueballs is free to use, fork and self-host. Sandbox keys are created directly from the running API; no approval from the Blueballs project is required. Production banking, identity, payment, card, custody and liquidity credentials come directly from whichever external providers a deployment chooses.

The project is for founders and teams building a bank, neobank, embedded-finance product or stablecoin-enabled financial product. It gives them a working foundation they can run, inspect, modify and replace provider by provider.

## What is included

### Banking foundation

- multi-currency accounts;
- cards and controls;
- transfers and rail metadata;
- onboarding and identity workflows;
- savings, credit and business-banking primitives;
- double-entry ledger and event history;
- product screens, journeys and executable API documentation.

All 144 catalogued banking endpoints respond. Some are reference implementations rather than production-provider integrations. Consumer iOS and Android applications are not included.

### Canonical FX foundation

The canonical FX implementation lives in `apps/fx-node` and the `packages/fx-*` packages. It includes:

- institution policy, participants, credentials and short-lived authorisations;
- signed private customer or member liquidity;
- issuer, institutional LP, other-institution and treasury adapters;
- deterministic reference-price consensus;
- bank-principal pricing and hard balance-sheet limits;
- exact-output multi-source optimisation;
- all-leg reservation before a quote becomes firm;
- mixed fiat and token settlement states;
- Solidity Vault, settlement, cancellation, policy registry and AtomicRouter contracts;
- typed JavaScript SDK, OpenAPI contract and deterministic simulator;
- unit, integration, fuzz, invariant, controlled-EVM and Docker release gates.

## The connected public reference trade

The FX page and node follow one BRL to EUR customer request through the same runtime:

```text
BRL through an attested PIX-style payment
    → BRLX
    → policy-approved, multi-source BRLX/EURC token FX
    → EURC issuer redemption
    → EUR
```

The customer sees one exchange. The institution can inspect which sources were eligible, which were excluded, the selected allocation, principal risk and the finality of every settlement leg.

The reference token market can combine:

```text
private customer liquidity
issuer liquidity
another financial institution
institutional LP liquidity
bank treasury
bank principal
```

A preview reads current policy-approved capacity but reserves nothing. A firm sandbox trade is returned only after every selected source and principal risk capacity has been reserved.

## Honest status

- The local reference market and provider inventory are deterministic adapters, not live commercial providers.
- The default FX node has **no execution adapter**. Execution fails closed with `EXECUTION_UNAVAILABLE`; it never invents a transaction hash.
- The Solidity kernel has internal unit, fuzz, invariant and controlled-Anvil execution evidence. This is not an independent audit or production-mainnet proof.
- Fiat payment and redemption legs are not made atomic by the token leg. The BRL to EUR route is correctly classified as `MIXED_FINALITY`.
- The reference persistence model uses SQLite and is designed for local development and single-writer deployments, not a clustered production bank.
- This repository ships software, not a bank, licence, insured account or regulated financial service.

See `spec/fx/KNOWN-LIMITATIONS.md` and `SECURITY.md` before deploying anything beyond local evaluation.

## Quickstart

Requires Node **24.15+** and pnpm.

```bash
git clone <this repository>
cd blueballs
pnpm install
pnpm dev
```

This starts:

- site: `http://localhost:5280`
- banking API: `http://localhost:5290/v2`
- canonical FX node: `http://localhost:8788`
- local FX key: `bb_test_local_fx`

Open `http://localhost:5280/fx`. The page calls the running FX node directly. It does not recreate pricing, policy or source capacity in React.

Run individual services:

```bash
pnpm dev:site
pnpm dev:api
pnpm dev:fx
```

### Cloudflare preview and deployment

The hosted reference stack runs at `https://blueballs.tech`. Cloudflare serves
the Vite site and routes the banking and FX APIs through same-origin service
bindings, with Durable Object SQLite storage behind both services.

```bash
# Cloudflare-flavoured local preview
pnpm preview:cloudflare

# Upload a shareable preview version without changing production
pnpm preview:upload

# Build and deploy the site plus both APIs
pnpm deploy:cloudflare
```

The deployment requires an authenticated Wrangler session. Production and
preview settings live in `wrangler.jsonc`, `wrangler.api.jsonc`, and
`wrangler.fx.jsonc`.

### Docker Compose

```bash
docker compose -f compose.reference.yml up --build
```

The FX databases persist in the `fx-data` volume.

```bash
docker compose -f compose.reference.yml down
```

Use `down -v` only when you deliberately want to remove the seeded reference state.

## Try the public FX trade

Preview without reserving:

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades/preview \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00","from":"BRL","to":"EUR"}'
```

Reserve the same trade:

```bash
curl -X POST http://localhost:8788/v2/fx/reference/trades \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"inputAmount":"50000.00","expiresInMs":60000}'
```

Inspect the runtime and alter the reference market:

```bash
curl -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/status

curl -X POST http://localhost:8788/v2/fx/reference/scenario \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{"id":"issuer_policy_blocked"}'
```

The complete REST contract is available at:

```text
apps/fx-node/openapi.yaml
http://localhost:8788/openapi.yaml
```

## Architecture

```text
blueballs/
├─ src/                         website, product UI and live API documentation
├─ apps/api/                    general banking API and double-entry ledger
├─ apps/fx-node/                canonical self-hostable FX runtime
├─ packages/
│  ├─ fx-contracts/             Vault, settlement, cancellation, policy registry, router
│  ├─ fx-market/                private signed orders, reservations and reconciliation
│  ├─ fx-pricing/               exact arithmetic, reference consensus, risk and principal pricing
│  ├─ fx-liquidity/             cross-source optimisation and reservation coordination
│  ├─ fx-policy/                participants, credentials, accounts and authorisations
│  ├─ fx-fiat/                  fiat intents, attestations, finality and settlement graph
│  ├─ fx-sdk/                   typed dependency-free JavaScript client
│  └─ fx-simulator/             deterministic economic and failure scenarios
├─ spec/fx/                     architecture, threat model, invariants and release contracts
└─ scripts/dev.mjs              starts site, banking API and FX node together
```

Identity, policy, private orders, pricing and route construction remain off-chain. The contract kernel constrains token backing, maker and taker authority, cancellation, replay, live institution policy and atomic settlement.

## Canonical versus legacy FX

`apps/fx-node` and `packages/fx-*` define all new FX economics, policy, risk, routing and public claims.

The older FX routes under `apps/api/src/routes/` are frozen compatibility demonstrations. They are not the source of truth and must not receive new FX features. See `spec/fx/LEGACY-MIGRATION.md`.

## Verification

The aggregate FX release gate covers:

- market, policy, pricing, liquidity, fiat, SDK, node and simulator tests;
- Solidity format, build, unit tests, fuzzing and invariants;
- controlled EVM execution through Anvil;
- self-hosted Docker image build;
- complete reference-stack build;
- TypeScript and Vite production build.

The visual workflow also renders the complete `/fx` page against the local reference stack and stores desktop and mobile screenshots as CI artifacts.

Internal green gates prove the tested reference behaviour. They do not replace independent security review or production operating controls.

## Documentation

- `apps/fx-node/README.md` - run and inspect the FX node
- `packages/fx-sdk/README.md` - use the SDK
- `spec/fx/PUBLIC-REFERENCE.md` - public product and evidence contract
- `spec/fx/ADAPTERS.md` - replace reference providers
- `spec/fx/KNOWN-LIMITATIONS.md` - explicit deployment boundaries
- `packages/fx-contracts/DEPLOYMENT.md` - contract deployment and binding order
- `RELEASE.md` - reproducible release procedure
- `SECURITY.md` - vulnerability reporting and security status

## Contributing

Read `CONTRIBUTING.md` before changing banking or FX contracts.

## Licence

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
