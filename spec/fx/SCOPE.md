# Blueballs FX scope

Blueballs FX is provider-neutral foreign-exchange infrastructure for banks,
neobanks and embedded-finance products. It combines institution policy, private
liquidity, exact pricing, reservation, settlement state and reconciliation
without turning the market into a public order book.

## Principles

1. Policy eligibility is established before liquidity competes on price.
2. Monetary calculations use integer atomic units and exact rational prices.
3. A firm quote reserves every selected source.
4. Maker and taker authority is cryptographically bounded.
5. Token settlement is atomic only within one transaction boundary.
6. External fiat submission, confirmation and final settlement remain distinct.
7. Provider-specific behavior stays behind explicit adapters.
8. Private identities, orders and risk data remain off-chain.

## Components owned by Blueballs

- participant, credential, corridor and account-attribution policy;
- private signed-order storage, matching and reservation;
- reference pricing, spread construction and principal-risk limits;
- selection and reservation across approved liquidity sources;
- fiat intents, attestations, finality and reconciliation state;
- provider-neutral REST and JavaScript SDK contracts;
- optional Solidity vault, cancellation, policy and settlement contracts;
- deterministic reference adapters and failure simulations.

## Deployment-owned boundaries

A production operator supplies and governs:

- KYC, KYB, sanctions and transaction-monitoring providers;
- licences, regulated entities and customer-protection obligations;
- payment rails, bank accounts and correspondent relationships;
- stablecoin issuers, custody and liquidity providers;
- production price sources and prudential risk models;
- key custody, infrastructure, monitoring, backup and incident response;
- execution adapters and operational reconciliation.

## Actors

- **Institution** — the operator running the deployment.
- **Customer** — an individual or business requesting FX.
- **Maker** — an approved participant offering signed liquidity.
- **Liquidity provider** — a professional or programmatic maker.
- **Issuer** — an approved tokenized-money issuer.
- **Treasury** — institution-owned inventory.
- **Principal** — the institution providing liquidity within explicit limits.
- **Fiat settlement provider** — a service that sends, receives or verifies fiat
  payments.
- **Matcher** — the off-chain service that selects and reserves orders.
- **Execution coordinator** — the service that submits an approved route and
  records its outcome.
- **Reconciler** — the operational authority for external settlement state.

## Settlement graph

Routes are composed from typed edges:

- `TOKEN_SWAP`
- `ISSUER_MINT`
- `ISSUER_REDEEM`
- `VERIFIED_FIAT_PAYMENT`
- `BANK_RAIL`
- `INTERNAL_LEDGER`

Every edge must be executable, policy-approved and explicit about finality.

## Reference distribution

The repository includes:

- a BRL-to-EUR reference route through an internal BRL deposit claim and EURC;
- private maker, issuer, institutional, treasury and principal liquidity;
- exact-output routing and rollback-safe reservations;
- policy revocation and hard principal-risk limits;
- mixed fiat/token settlement state;
- local failure scenarios and a deterministic simulator;
- an optional local Anvil execution path for the Solidity contracts.

Reference participants and instruments are deterministic fixtures. They do not
represent live accounts, production assets, connected providers or real money.

## Outside the canonical scope

Blueballs FX does not provide:

- anonymous permissionless liquidity;
- a public on-chain order book;
- a governance token or liquidity-mining scheme;
- bank licences, fiat custody or compliance databases;
- automatic certification of provider integrations;
- production high availability or key custody;
- a claim of regulatory approval or production readiness.
