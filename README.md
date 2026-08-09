# Blueballs

An MIT-licensed, self-hostable **open-source neobank stack**. Fork it, run it, and you have a reference implementation of the primitives a modern financial product needs: multi-currency accounts, issued cards, transfers, savings, credit, ledger infrastructure and a modular institutional FX stack.

## Honest status

### General banking API

- **144/144 catalogued endpoints respond.** Every endpoint either does the implemented reference behaviour or returns a deliberate response; the catalogue is not padded with generic 404s.
- **Consumer applications are not shipped.** The repository contains product UI demonstrations and journey screens, not production iOS/Android banking apps.
- **Statements PDF is still a stand-in.** CSV and JSON exports are real; the PDF response identifies itself as a placeholder.
- **The general API is a single-process SQLite reference deployment.** It is suitable for local development and one process, not a clustered production bank.

### FX reference runtime

- The modular FX packages include policy authorisation, private signed liquidity, reference pricing, principal risk, exact-output multi-source routing, fiat settlement states, Solidity settlement contracts, SDK, simulator and a standalone node.
- `reference-sandbox` composes the policy, market, pricing, liquidity, risk and fiat packages into one runnable local market.
- A reference quote is returned only after every selected source reserves capacity; principal balance-sheet risk is reserved with it.
- The default node has **no execution adapter**. Execution fails closed rather than inventing a transaction hash.
- The contract kernel passed internal unit, fuzz, invariant and controlled-Anvil execution gates at its frozen release-candidate commit. This is not an independent security audit or production-mainnet proof.

### Regulatory and provider boundary

- This repository ships software, not a bank or licensed financial service.
- Reference identity results, issuer capacity, LP capacity, bank rails and treasury inventory are local adapters. Production deployments must replace them with real providers and institution policy.
- Nothing here is regulated, insured or certified for a particular jurisdiction.

See `SCOPE.md` for the general banking scope, `spec/fx/` for the FX architecture and `spec/fx/PUBLIC-REFERENCE.md` for the public distribution contract.

## Quickstart

Requires Node **24.15+** and [pnpm](https://pnpm.io).

```bash
git clone <this repo>
cd blueballs
pnpm install
pnpm dev
```

That starts the complete local reference stack:

- Site → `http://localhost:5280`
- Banking API → `http://localhost:5290/v2`
- FX node → `http://localhost:8788`
- Local FX key → `bb_test_local_fx`

The website receives the local sandbox FX URL and key automatically.

Only need one part?

```bash
pnpm dev:site
pnpm dev:api
pnpm dev:fx
```

### Docker Compose

Build and start the same three-service stack without installing Node or pnpm locally:

```bash
docker compose -f compose.reference.yml up --build
```

The FX databases persist in the `fx-data` volume. Stop the stack with:

```bash
docker compose -f compose.reference.yml down
```

Use `down -v` only when you deliberately want to delete the seeded FX state.

## General banking API key

```bash
curl -X POST http://localhost:5290/v2/auth/signup \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com"}'

# → { "key": "bb_sandbox_…", ... }
```

Use it against authenticated banking endpoints:

```bash
curl -X POST http://localhost:5290/v2/customers \
  -H "content-type: application/json" \
  -H "x-api-key: bb_sandbox_…" \
  -d '{"type":"individual","name":"Ada Lovelace"}'
```

The `/developers` page can issue a sandbox key and run the general API directly from the browser.

## FX reference quote

The seeded token corridor uses these proof asset identifiers:

```text
USDC  0x0000000000000000000000000000000000000011
EURC  0x0000000000000000000000000000000000000022
```

Request a quote that is deliberately large enough to use private customer liquidity, an issuer, another neobank, an institutional LP, treasury and bank principal:

```bash
curl -X POST http://localhost:8788/v2/fx/quotes \
  -H 'Authorization: Bearer bb_test_local_fx' \
  -H 'content-type: application/json' \
  -d '{
    "inputAsset":"0x0000000000000000000000000000000000000011",
    "outputAsset":"0x0000000000000000000000000000000000000022",
    "exactOutput":"450000000000",
    "expiresInMs":30000
  }'
```

Inspect the canonical runtime:

```bash
curl \
  -H 'Authorization: Bearer bb_test_local_fx' \
  http://localhost:8788/v2/fx/reference/status
```

The machine-readable REST contract is available in the repository at `apps/fx-node/openapi.yaml` and from the running node at `http://localhost:8788/openapi.yaml`.

## Architecture

```text
blueballs/
├─ src/                         website, product UI and live API documentation
├─ apps/api/                    general banking API and double-entry ledger
├─ apps/fx-node/                canonical self-hostable FX reference runtime
├─ packages/
│  ├─ fx-contracts/             Vault, settlement, cancellation, policy registry, router
│  ├─ fx-market/                private signed orders, matching, reservations, reconciliation
│  ├─ fx-pricing/               exact arithmetic, reference consensus, principal risk and pricing
│  ├─ fx-liquidity/             cross-source exact-output optimisation and reservation coordination
│  ├─ fx-policy/                participants, credentials, account attribution and authorisations
│  ├─ fx-fiat/                  fiat intents, attestations, settlement graph and finality
│  ├─ fx-sdk/                   dependency-free JavaScript client
│  └─ fx-simulator/             deterministic economic and failure scenarios
├─ spec/fx/                     architecture, invariants, threat model and release contracts
└─ scripts/dev.mjs              starts site, banking API and FX node together
```

The general banking API uses decimal strings and double-entry ledger postings.

The modular FX stack keeps identity, policy, private orders, pricing and routing off-chain while using the contract kernel to constrain token settlement authority, cancellation, replay, policy validity, backing and atomicity.

## Canonical versus legacy FX

The modular packages and `apps/fx-node` are the canonical FX architecture.

Older FX routes inside `apps/api` remain compatibility/reference surfaces while migration is completed. New economic, policy, risk and website behaviour must be implemented against the canonical FX node rather than extending a second FX model.

## Testing

The aggregate FX release gate covers:

- market;
- pricing and principal risk;
- liquidity routing;
- policy integration;
- fiat settlement;
- SDK;
- node;
- deterministic simulator;
- Solidity compile, tests, fuzzing and invariants;
- controlled EVM execution through Anvil;
- Docker image build.

The FX node workflow additionally builds the complete reference image and validates the Docker Compose file.

Internal green gates prove the tested reference behaviour. They do not replace an external audit or production operating controls.

## Contributing

See `CONTRIBUTING.md`.

## Licence

MIT — see `LICENSE`.
