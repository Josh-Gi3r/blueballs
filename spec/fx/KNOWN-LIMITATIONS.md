# Blueballs FX - Known Limitations

Status: **reference release boundary**

This document lists limitations that must remain visible in the repository, API documentation and public product claims.

## 1. The reference market is not a live commercial market

The seeded customer order, issuer inventory, institutional LP, neobank, treasury and bank-principal capacity are deterministic local adapters. They demonstrate policy, exact pricing, route construction and reservation semantics.

They are not connected to a live issuer, bank, payment rail, exchange, market maker or institutional liquidity provider.

## 2. Execution is not configured by default

The reference node reserves a route but does not submit it to a production settlement venue.

`POST /v2/fx/quotes/:quoteId/execute` and `POST /v2/fx/reference/trades/:tradeId/execute` fail closed with `EXECUTION_UNAVAILABLE` unless an operator supplies an execution adapter.

The controlled Anvil proof demonstrates the Solidity kernel separately. It is not a substitute for an operational adapter or production deployment.

## 3. The complete BRL to EUR route is not end-to-end atomic

The reference route contains:

- an attested external BRL payment;
- an atomic BRLX/EURC token swap;
- an asynchronous EURC redemption.

Only the token swap can be atomic. The whole route is `MIXED_FINALITY`.

## 4. SQLite is the reference persistence layer

The FX services use SQLite transactions and WAL for a simple self-hosted reference deployment.

The project does not yet ship:

- multi-region replication;
- clustered writers;
- automated leader election;
- managed backup and restore;
- production disaster recovery;
- a supported PostgreSQL adapter.

A production operator must preserve the same reservation, idempotency and reconciliation invariants in its chosen database architecture.

## 5. Sandbox signatures are permissive

The canonical reference mode seeds syntactically valid proof signatures and local participants so the system can be exercised without external key infrastructure.

Production must verify real EIP-712 signatures, contract-wallet signatures, key custody and signer authority.

## 6. Identity and compliance facts are supplied, not performed

`FxPolicyEngine` consumes participant, credential, jurisdiction, account-attribution and policy facts. It is not a KYC, KYB, AML or sanctions-screening provider.

Production deployments must source, refresh and govern those facts through appropriate providers and institution processes.

## 7. Reference prices are deterministic

The reference-price engine performs freshness, spread, source-count and outlier checks. The local observations are deterministic proof data.

Production deployments must supply independent, authenticated and monitored price sources appropriate to each corridor.

## 8. Principal risk is simplified to configured asset positions

The risk book enforces hard per-asset limits and reserves quote deltas transactionally.

It does not yet model:

- full portfolio VaR;
- cross-currency netting agreements;
- capital treatment;
- liquidity coverage ratios;
- intraday funding costs;
- hedge execution;
- credit limits between legal entities;
- jurisdiction-specific prudential requirements.

## 9. Provider adapters are reference interfaces

The project provides provider-neutral reservation and execution contracts plus local adapters. It does not ship certified production integrations for every issuer, LP, bank rail, card provider or identity provider.

See `spec/fx/ADAPTERS.md`.

## 10. No independent audit has been completed

Internal tests, fuzzing, invariants and controlled execution are not an external security audit.

No claim should describe Blueballs as audited, regulator-approved, bank-certified, insured or production-proven until separate evidence exists.

## 11. The website is a reference product experience

The customer phone, institution view and developer inspector are real interfaces to the local FX node. They are not a complete production consumer application.

Production teams still need accessibility review, localisation, user research, legal disclosures, fee presentation, support flows, fraud controls and jurisdiction-specific customer communications.

## 12. Legacy FX routes remain for compatibility

Older FX demonstrations under `apps/api/src/routes/` use a different historical model. They are frozen and deprecated as a source of new FX behaviour.

The canonical implementation is `apps/fx-node` plus `packages/fx-*`. See `spec/fx/LEGACY-MIGRATION.md`.

## 13. Release status

A tagged reference release means the documented source, tests and artefacts were reproduced at that commit. It does not mean production suitability for a particular institution or jurisdiction.
