# Blueballs FX — Production Checklist

The FX stack ships complete: pricing policy, source selection, route construction, reservations, risk limits, settlement records and a Solidity settlement kernel, all deterministic and all reproducible from source.

Going live is a matter of connecting the parts that are specific to your institution — your liquidity, your providers, your prices, your keys, your jurisdiction. This is that list, in the order you work it. Every item names the interface the stack already provides for it.

## 1. Connect your market

The reference ships deterministic local adapters for the customer order, issuer inventory, institutional LP, neobank, treasury and bank-principal capacity. They exercise the full policy, pricing, routing and reservation path with no external dependency, which is what makes the numbers on a fresh clone reproducible.

For production, implement the same adapter contracts against your issuer, bank, payment rail, exchange, market maker or institutional liquidity provider. The contracts are provider-neutral by design: see `spec/fx/ADAPTERS.md`.

## 2. Supply an execution adapter

`POST /v2/fx/quotes/:quoteId/execute` and `POST /v2/fx/reference/trades/:tradeId/execute` fail closed with `EXECUTION_UNAVAILABLE` until an operator supplies an execution adapter, and the node says so at boot rather than at the worst possible moment.

That is deliberate. A settlement path that silently invents a transaction hash is the single most expensive failure an FX system can have. Configure the adapter for your settlement venue and the same routes execute.

The controlled Anvil proof in `spec/fx/CONTROLLED-PROOF.md` demonstrates the Solidity kernel independently of any venue.

## 3. Know the finality of each route

The reference BRL→EUR route contains an attested external BRL payment, an atomic internal-BRL-deposit-claim/EURC swap and an asynchronous EURC redemption. Only the swap leg is atomic, so the route reports `MIXED_FINALITY`.

The stack states the finality of every route rather than assuming it, so an interface built on this cannot present a submission as a settlement. Read the finality your route returns and present it to the customer accordingly.

## 4. Choose your persistence topology

The FX services use SQLite transactions with WAL, which gives a self-hosted deployment real transactional guarantees with nothing to operate.

For a multi-region or clustered deployment, choose your database architecture and preserve the same three invariants the reference enforces: reservation atomicity, idempotency and reconciliation. They are stated precisely in `spec/fx/INVARIANTS.md`, and the test suite for them is portable.

## 5. Turn on production signature verification

Reference mode seeds syntactically valid proof signatures and local participants so the system can be exercised without external key infrastructure.

Production verifies real EIP-712 signatures, contract-wallet signatures, key custody and signer authority. The verification points are the same code path; the configuration is in `packages/fx-contracts/DEPLOYMENT.md`.

## 6. Connect your identity and compliance providers

`FxPolicyEngine` consumes participant, credential, jurisdiction, account-attribution and policy facts, and enforces them consistently across every corridor. It is a policy engine, not a KYC, KYB, AML or sanctions provider — which is what lets you choose providers per market without changing the engine.

Source, refresh and govern those facts through your providers and institution processes, and feed them to the engine.

## 7. Connect your price sources

The reference-price engine enforces freshness, spread, source-count and outlier checks. The local observations are deterministic proof data so the checks themselves can be tested.

Supply independent, authenticated and monitored price sources for each corridor you run. The engine's checks apply unchanged.

## 8. Extend the risk book to your prudential model

The risk book enforces hard per-asset limits and reserves quote deltas transactionally — the property that stops two concurrent quotes committing the same inventory.

Institutions carrying principal risk in production layer their own treatment on top: portfolio VaR, cross-currency netting, capital treatment, liquidity coverage, intraday funding, hedge execution, inter-entity credit limits and jurisdiction-specific prudential requirements.

## 9. Certify your provider integrations

The project ships provider-neutral reservation and execution contracts plus working local adapters. Certification of a given issuer, LP, bank rail, card provider or identity provider is a per-provider, per-jurisdiction exercise you run against those contracts.

## 10. Commission an independent security audit

Internal tests, fuzzing, invariants and controlled execution are engineering controls. Commission an external smart-contract and application security review before production use.

Until that evidence exists, no claim should describe a deployment as audited, regulator-approved, bank-certified, insured or production-proven.

## 11. Take the interfaces to production standard

The customer phone, institution view and developer inspector are real interfaces to the local FX node, built so you can see the engine work end to end.

A consumer product on top of them still needs accessibility review, localisation, user research, legal disclosures, fee presentation, support flows, fraud controls and jurisdiction-specific customer communications.

## 12. Build new FX behaviour on the canonical stack

The canonical implementation is `apps/fx-node` plus `packages/fx-*`. Older FX demonstrations under `apps/api/src/routes/` are frozen compatibility surfaces kept so existing examples keep working; they do not define new FX economics, policy, risk, settlement or website behaviour. See `spec/fx/LEGACY-MIGRATION.md`.

## 13. What a tagged release means

A tagged reference release identifies one tested source revision. Production
suitability for a particular institution or jurisdiction is established by the
work in this checklist.

## Scope

Blueballs is MIT-licensed software, not a licensed bank and not a regulated entity. A production deployment is operated by the institution that deploys it, under its own licences and obligations.
