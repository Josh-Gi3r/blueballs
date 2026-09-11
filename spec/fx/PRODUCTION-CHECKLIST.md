# Blueballs FX — Production Deployment Playbook

Blueballs FX ships the financial core for policy-aware institutional FX: participant policy, exact pricing, source selection, route construction, reservations, risk limits, execution state, fiat evidence, reconciliation and optional atomic token settlement.

Production deployment is a composition exercise. The institution connects its own liquidity, banking rails, custodians, price sources, identity/compliance facts, keys and operating policy through the interfaces the stack already exposes.

## 1. Compose the production runtime

The canonical node supports a deployment adapter directly:

```bash
FX_NODE_MODE=production \
FX_NODE_PRODUCTION_ADAPTER=@institution/blueballs-fx-runtime \
FX_NODE_API_KEY='32-or-more-characters' \
node apps/fx-node/src/cli.js
```

The adapter supplies market/liquidity, quote persistence/lifecycle, fiat evidence and execution. Blueballs validates the complete runtime contract before opening the listener.

See [`ADAPTERS.md`](ADAPTERS.md).

## 2. Connect institutional liquidity

Blueballs accepts multiple provider-neutral liquidity classes behind the same exact-price and reservation contracts:

- private customer/business orders;
- issuer inventory;
- institutional LPs / professional market makers;
- neobank/institution capacity;
- treasury inventory;
- bank principal;
- external venues through deployment adapters.

Each source publishes exact rational economics, available capacity, expiry and policy authority. The router admits only eligible capacity and returns a firm quote only after every selected leg reserves.

## 3. Connect execution

The production runtime supplies `executionAdapter.submit()`.

The canonical node preserves three execution outcomes:

```text
ACCEPTED  submission accepted; confirmation follows
REJECTED  definitive rejection
UNKNOWN   reconciliation required
```

Routes are committed to `SUBMITTED` before the external call, so network ambiguity never becomes an accidental retry/release.

Execution can target the Blueballs `AtomicRouter`, an institution-owned ledger boundary, a bank/venue API or another provider-specific settlement path without changing the route lifecycle.

## 4. Preserve finality by edge

Blueballs keeps token, bank, provider, custody and issuer edges in their real finality class.

A mixed route can therefore express:

```text
VERIFIED_FIAT_PAYMENT   ATTESTED_EXTERNAL
TOKEN_SWAP              ATOMIC
ISSUER_REDEEM           ASYNC_EXTERNAL
```

The customer transaction remains one coordinated lifecycle while operators retain exact evidence for every settlement edge.

## 5. Configure participant policy

`FxPolicyEngine` consumes:

- participant identity/type;
- jurisdiction and risk tier;
- credential status/expiry;
- account attribution;
- permitted assets/corridors;
- ticket limits;
- institution policy version.

The engine issues short-lived transaction authority bound to those facts. Participant changes or policy-version changes invalidate stale authority automatically.

## 6. Connect price/reference controls

Supply the authenticated, monitored price/reference sources appropriate to each corridor. Blueballs pricing controls support freshness, source-count, spread and outlier checks while authoritative quote arithmetic stays integer/rational.

## 7. Configure treasury and principal risk

Principal liquidity can participate in the same route optimizer as external sources while respecting hard capacity and exposure limits.

Institutions can layer their own portfolio/risk models on top of the canonical reservation contract, including cross-currency netting, VaR, capital treatment, intraday funding, hedging and inter-entity limits.

## 8. Connect fiat evidence

Fiat settlement uses explicit intents and evidence rather than being treated as token finality.

Provider adapters supply payment identity, amount/currency, payer/payee reference hashes, settled time, verifier identity, proof reference and final state. Blueballs enforces replay protection and retains evidence for reconciliation.

## 9. Configure custody / key authority

The Solidity and provider execution paths are designed around explicit authority:

- EIP-712 maker orders;
- EIP-712 taker intents;
- ERC-1271 contract-wallet signatures;
- institution policy authorization;
- nonce and cancellation replay controls;
- segregated pre-funded vault accounting.

Deployments can use institution multisig, HSM/MPC/key-custody policy and signer governance appropriate to their operating model.

## 10. Choose persistence and HA topology

The self-hosted reference topology uses transactional SQLite/WAL. Cloudflare uses SQLite Durable Objects.

Scale-out keeps one authoritative writer per shard and expands through institution/tenant shard ownership, principal routing and explicit cross-shard settlement orchestration.

See [`../../docs/SCALING.md`](../../docs/SCALING.md) and [`../../docs/PRODUCTION-OPERATIONS.md`](../../docs/PRODUCTION-OPERATIONS.md).

## 11. Run adapter conformance

Every production adapter should prove the same core properties:

- exact amount/price handling;
- reservation idempotency;
- concurrent-capacity protection;
- partial-reservation rollback;
- expiry/policy revocation;
- submission ambiguity;
- confirmation/failure replay;
- secret/private-data boundaries.

The canonical production-runtime loader is tested in `apps/fx-node/test/production-runtime.test.js` and provider implementations can reuse the node/package suites.

## 12. Run the release profile

From the exact deployment candidate:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The release profile covers banking/FX contracts, Workers, Foundry unit/fuzz/invariants, restart/eviction, migrations/recovery, provider finality, dependency inventory, load/chaos and container security scanning.

The resulting artifacts bind the evidence to the exact source commit, Git tree and lockfile.

## 13. Operate from canonical evidence

Production operations should monitor:

- source commit / schema identity;
- provider and route reconciliation backlog;
- quote/reservation age;
- provider latency/finality;
- treasury/principal exposure;
- aggregate balances/control totals;
- webhook backlog;
- readiness and financial command failures.

Blueballs exposes the state required to reconcile financial outcomes rather than synthesizing success when a provider or network is ambiguous.

## 14. Extend only through canonical contracts

New FX economics, policy, risk, liquidity and settlement behavior belongs in `apps/fx-node`, `packages/fx-*` and `spec/fx`.

Banking-runtime FX compatibility routes remain supported for existing integrations, while the canonical FX stack owns new product behavior.

## Deployment ownership

Blueballs is open-source financial infrastructure. The deploying institution owns its licences, provider relationships, infrastructure credentials and jurisdiction-specific operating policy while retaining the Blueballs core and contracts unchanged.
