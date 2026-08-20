# Contributing

Blueballs is a young open-source banking reference stack. Read `VISION.md`,
`ARCHITECTURE.md`, `spec/conventions.md` and `spec/fx/PUBLIC-REFERENCE.md`
before changing financial behaviour. Superseded project plans live under
`docs/history/` and are not current contracts.

## Ground rules

1. **The contract is the product.** Do not casually change the endpoint catalogue, money conventions, signed payloads, state machines or public evidence labels.
2. **Money is not a float.** General banking amounts use decimal strings and minor-unit helpers. Canonical FX calculations use integer atomic units and exact rational prices.
3. **Double-entry or it does not post.** General ledger movements go through `post()` and must balance.
4. **Compliance precedes FX price.** A liquidity source must have live institution authority before it can compete economically.
5. **A firm quote reserves capacity.** An indicative calculation must never be labelled reserved or firm.
6. **Submission is not settlement.** Once an external attempt may have occurred, preserve `SUBMITTED` or ambiguous state until reconciliation.
7. **Fiat is not magically atomic.** Preserve the finality class of every payment, issuer, ledger and token edge.
8. **Providers stay behind adapters.** Canonical policy, pricing and route code must remain provider-neutral.
9. **The website does not invent a second market.** Live FX product interactions read `apps/fx-node`. Simulator output must be labelled as simulation.
10. **No claim stronger than its evidence.** Internal gates are not an independent audit, regulator approval or production proof.

## Canonical FX ownership

New FX work belongs in:

```text
apps/fx-node
packages/fx-contracts
packages/fx-market
packages/fx-pricing
packages/fx-liquidity
packages/fx-policy
packages/fx-fiat
packages/fx-sdk
packages/fx-simulator
spec/fx
```

The historical FX modules under `apps/api/src/routes/` are frozen compatibility surfaces. Read `spec/fx/LEGACY-MIGRATION.md` before touching them.

## Local development

```bash
pnpm install
pnpm dev
```

Services:

```text
site          http://localhost:5280
banking API   http://localhost:5290/v2
FX node       http://localhost:8788
```

Build the website:

```bash
pnpm build
```

Run the complete FX JavaScript suites:

```bash
for dir in \
  packages/fx-market \
  packages/fx-pricing \
  packages/fx-liquidity \
  packages/fx-policy \
  packages/fx-fiat \
  packages/fx-sdk \
  packages/fx-simulator \
  apps/fx-node
do
  (cd "$dir" && npm run test:ci)
done
```

Contracts:

```bash
make -C packages/fx-contracts ci
```

## Adding an FX adapter

Read `spec/fx/ADAPTERS.md`.

A pull request must include tests for:

- exact amounts and rounding;
- reservation and release idempotency;
- expiry;
- concurrent capacity protection;
- policy revocation;
- submission ambiguity;
- reconciliation replay;
- public/private data separation.

Do not place provider credentials, brand-specific economics or production endpoints in the canonical reference configuration.

## Changing the FX page

The page must continue to show one connected trade through customer, institution and developer views.

The `/fx` page is a labelled in-browser simulation. It must not call the FX node or imply that on-page numbers are live node reservations.

Before review:

- run the production build;
- inspect desktop and mobile layouts;
- confirm the page remains labelled as a simulation;
- confirm unavailable execution is shown honestly.

## Pull requests

Keep one coherent purpose per pull request. Include:

- problem and intended invariant;
- implementation summary;
- tests and evidence;
- migration impact;
- public claim impact;
- known limitations.

Do not merge release work directly into `main` without a green aggregate gate and visual review.

## Security reports

Follow `SECURITY.md`. Do not disclose exploitable details in a public issue.
