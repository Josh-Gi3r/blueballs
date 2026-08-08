# Blueballs FX — Internal Red-Team Record

Status: **FX-10 internal release hardening**

This record documents adversarial failure classes tested by the reference implementation. It is not an independent external audit.

## Contract / custody layer

Covered by Forge unit, fuzz and stateful invariant tests:

- Vault physical assets cannot fall below accounted liabilities through supported operations.
- Administrative rescue cannot consume accounted participant funds.
- Participant withdrawal cannot exceed accounted balance.
- Maker signatures are EIP-712 domain separated.
- EOA and ERC-1271 maker authorization are supported.
- Maker cancellation and maker epoch invalidation block settlement.
- Partial fills cannot exceed signed maker amount.
- Cumulative fill arithmetic avoids repeated rounding leakage.
- Taker max input, min output and recipient are signature-bound.
- Taker nonce replay is rejected.
- Multi-maker execution rolls every earlier fill back if a later leg fails.
- A wrong asset pair cannot be substituted into a route.

## FX-10 critical finding: compromised executor after compliance revocation

**Finding:** the original Router correctly bound `policyAuthorizationHash` into the signed taker intent, and the canonical off-chain coordinator revalidated policy before submission. However, the Router itself did not know whether that opaque authorization had subsequently been revoked. Any party holding an otherwise valid signed route could therefore attempt direct on-chain submission after the off-chain compliance layer withdrew permission.

**Severity for the Blueballs thesis:** critical. A compliance-first institutional rail cannot rely solely on the goodwill/security of the canonical executor to respect later compliance revocation.

**Fix:** `PolicyAuthorizationRegistry` is now part of the financial kernel. The institution policy authority grants short-lived opaque authorization hashes on-chain. Router execution additionally requires that authorization to be present, unexpired, unrevoked and at or above the current minimum policy epoch.

**Red-team proofs:** 

- individual policy authorization revocation blocks a still-valid maker/taker signed route;
- policy epoch invalidation blocks older still-valid signed routes;
- failed policy checks do not consume taker nonce or survive partial maker settlement;
- non-owner callers cannot grant/revoke policy authorization;
- ERC-1271 institutional-maker execution also goes through the policy registry;
- the controlled Anvil RPC proof deploys and executes the kernel with live policy authorization enabled.

## Private market / concurrency

Covered by `fx-market` tests:

- best executable rational price wins before time priority;
- equal prices preserve deterministic admission ordering;
- insufficient multi-maker liquidity rolls back provisional reservations;
- one maker order cannot be promised to two routes concurrently;
- two independent SQLite connections racing the same maker order cannot both reserve it;
- expiration/release restores capacity exactly once;
- order state survives process restart;
- maker-private order views do not expose another maker's order;
- aggregate depth removes maker identity and normalizes equivalent rational prices;
- duplicate chain settlement events are idempotent.

## Compliance lifecycle

Covered by `fx-policy` + real `fx-market` integration tests:

- failed/missing/expired KYC/KYB/AML/sanctions credentials reject authorization;
- prohibited jurisdiction/corridor/asset/ticket size rejects authorization;
- settlement account must be attributed to the participant;
- authorization cannot be reused for a larger amount or different pair/account;
- credential/participant changes invalidate old authorization epochs;
- policy-version changes invalidate prior authorization;
- invalidation before reservation removes liquidity;
- invalidation after reservation blocks submission and releases the unsubmitted route;
- invalidation after actual submission does not rewrite history; the route reconciles while future liquidity stays blocked.

## Pricing / treasury risk

Covered by `fx-pricing`, `fx-liquidity` and simulator tests:

- stale/bad/inverted reference observations fail closed;
- consensus is deterministic and outlier-aware;
- bank-principal spread components are decomposable;
- hard principal limits cannot be overridden by larger spread;
- simultaneous firm quotes reserve risk capacity transactionally;
- executable routing does not invent capacity;
- source reservation failure triggers compensating release of earlier provisional sources;
- one-way flow cannot drive simulated principal beyond hard limit;
- reference outage removes bank-principal availability rather than synthesizing a stale quote.

## Fiat / payment evidence

Covered by `fx-fiat` tests:

- fiat evidence must match intent hash, currency, amount, payer and payee;
- a verifier must be enabled/allowed;
- payment IDs are single-use across intents;
- duplicate delivery of the same attestation is idempotent;
- expired evidence is rejected;
- external fiat intent cannot be treated as cancellable after submission;
- submitted external fiat requires explicit failure/review/settlement rather than implicit rollback;
- a fiat provider losing policy eligibility disappears at route-selection time;
- mixed fiat/token routes never claim end-to-end atomicity.

## Runtime / operational ambiguity

Covered by `fx-node` tests:

- financial endpoints require authentication;
- firm quote creation actually reserves market capacity;
- quote output does not leak maker signed payload;
- execution fails explicitly when no execution adapter exists;
- execution is committed `SUBMITTED` before an outbound adapter may create an externally ambiguous transaction;
- ambiguous adapter outcome leaves the route in reconciliation and does not release/reuse its liquidity;
- fiat submission is not represented as fiat settlement.

## Economic stress

The deterministic simulator regression suite covers:

- balanced flow;
- 90% one-way flow;
- institutional LP disappearance;
- issuer disappearance;
- bank-principal hard limit;
- reference-price outage/recovery;
- 5% reference shock;
- cancellation storm/recovery;
- chain congestion/settlement failure;
- combined outage and recovery.

The simulator uses the real `fx-liquidity` exact-output planner rather than an independent toy router.

## Controlled execution proof

The Anvil gate broadcasts real JSON-RPC transactions using separate owner/maker/taker keys and proves:

- deployment and one-time bindings;
- maker/taker token deposits;
- maker EIP-712 signature;
- taker EIP-712 signature;
- live institution policy authorization;
- Router execution;
- exact post-settlement participant balances;
- physical backing equals liabilities;
- taker nonce consumed.

## Explicitly not claimed

Passing this internal red-team record does **not** mean:

- the system has received an independent security audit;
- production fiat providers have been certified;
- real regulated-bank deployment obligations are satisfied;
- production stablecoins have been live-tested at material value;
- every unusual ERC-20 behavior is supported;
- public network finality/RPC/key-custody operations have been externally validated.

Those claims require deployment-specific and independent assurance beyond the open-source reference release.
