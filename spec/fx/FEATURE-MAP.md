# Blueballs FX - Feature and Evidence Map

This map connects what a founder sees on `/fx` to the runtime, implementation and tests that produce it.

## Customer exchange

| Product state | API | Implementation | Evidence |
|---|---|---|---|
| BRL to EUR preview | `POST /v2/fx/reference/trades/preview` | `apps/fx-node/src/reference-trade-coordinator.js` | `apps/fx-node/test/public-reference-runtime.test.js` |
| reserve for review | `POST /v2/fx/reference/trades` | `ReferenceTradeCoordinator.reserveExactInput()` | all-source reservation test |
| retrieve lifecycle | `GET /v2/fx/reference/trades/:tradeId` | `ReferenceTradeCoordinator.getTrade()` | HTTP connected-trade test |
| abandon reserved quote | `DELETE /v2/fx/reference/trades/:tradeId` | `ReferenceTradeCoordinator.releaseTrade()` | release-state test |
| execution boundary | `POST /v2/fx/reference/trades/:tradeId/execute` | `apps/fx-node/src/server.js` | fail-closed execution test |

## Institution policy

| Capability | Implementation | Evidence |
|---|---|---|
| participant and credential facts | `packages/fx-policy/src/policy-engine.js` | `packages/fx-policy/test/policy.test.js` |
| account attribution | `FxPolicyEngine.mapAccount()` | policy tests |
| short-lived authority | `FxPolicyEngine.authorize()` | policy tests |
| live market verification | `packages/fx-policy/src/market-verifier.js` | market integration tests |
| issuer revocation before price | `apps/fx-node/src/public-reference-runtime.js` | public-reference issuer-revocation test |
| on-chain policy authority | `packages/fx-contracts/src/PolicyAuthorizationRegistry.sol` | contract tests and controlled proof |

## Liquidity and route construction

| Capability | Implementation | Evidence |
|---|---|---|
| private signed orders | `packages/fx-market/src/sqlite-market.js` | market lifecycle and concurrency tests |
| exact price comparison | `packages/fx-liquidity/src/optimizer.js` | liquidity tests |
| cross-source route | `planExactOutput()` | six-source public-reference test |
| reserve every selected leg | `packages/fx-liquidity/src/coordinator.js` | rollback and reservation tests |
| source adapters | `apps/fx-node/src/source-adapters.js` | node integration tests |
| issuer / LP / treasury reference capacity | `apps/fx-node/src/reference-liquidity.js` | reference-runtime tests |
| public BRLX/EURC market | `apps/fx-node/src/public-reference-runtime.js` | public-reference tests |

## Reference and principal pricing

| Capability | Implementation | Evidence |
|---|---|---|
| source freshness and outliers | `packages/fx-pricing/src/reference.js` | reference-price tests |
| exact principal quote | `packages/fx-pricing/src/principal-pricing.js` | principal-pricing tests |
| hard asset risk limits | `packages/fx-pricing/src/risk-book.js` | risk-book and concurrent quote tests |
| reserve principal risk with quote | `PrincipalLiquidityAdapter.reserve()` | reference-runtime reconciliation test |
| reference outage | `public-reference-runtime.js` scenario | public-reference failure test |

## Fiat and token settlement

| Capability | Implementation | Evidence |
|---|---|---|
| typed fiat intent | `packages/fx-fiat/src/intent.js` | fiat tests |
| route continuity and finality | `packages/fx-fiat/src/settlement-graph.js` | graph tests |
| payment evidence and replay protection | `packages/fx-fiat/src/settlement-store.js` | settlement tests |
| internal / attested verifier adapters | `packages/fx-fiat/src/adapters.js` | fiat adapter tests |
| BRL → BRLX → EURC → EUR graph | `reference-runtime.js` | mixed-finality test |

## Atomic token settlement

| Capability | Implementation | Evidence |
|---|---|---|
| backed participant accounting | `packages/fx-contracts/src/FxVault.sol` | unit and invariant tests |
| signed maker fills | `packages/fx-contracts/src/FxSettlement.sol` | settlement tests |
| maker cancellation and epoch | `OrderCancellation.sol` | cancellation tests |
| taker bounds and nonce | `AtomicRouter.sol` | router tests |
| contract-wallet signatures | OpenZeppelin `SignatureChecker` integration | ERC-1271 tests |
| real JSON-RPC broadcast | `script/ControlledProof.s.sol` | controlled EVM CI job |

## Reconciliation

| State | Owner | Evidence |
|---|---|---|
| `RESERVED` | quote coordinator and adapters | node tests |
| `SUBMITTED` | node before external call | ambiguous execution test |
| `CONFIRMED` | canonical chain/provider evidence | route confirmation tests |
| `FAILED` | definitive failure evidence | failure and release tests |
| `UNKNOWN` result | operational reconciliation | adapter timeout test |

## Website and documentation

| Surface | Implementation | Evidence |
|---|---|---|
| customer phone | `src/fx/Phone.tsx` | production build + visual screenshots |
| customer / bank / API views | `src/fx/TradeViews.tsx` | live-node screenshot artefact |
| source allocation | `AllocationMap` | captured trade preview JSON |
| deterministic stress lab | `src/fx/Simulator.tsx` | simulator tests |
| developer inspector | `src/fx/Developer.tsx` | source links and live response |
| high-resolution editorial diagrams | `src/assets/fx-editorial-*.svg` | visual CI screenshots |
| OpenAPI | `apps/fx-node/openapi.yaml` | node workflow contract checks |
| SDK | `packages/fx-sdk` | SDK tests and pack dry-run |

## Release evidence

| Evidence | Location |
|---|---|
| aggregate release gate | `pnpm verify` (no CI service; run locally) |
| visual render gate | not automated |
| reference release bundle | `RELEASE.md` manual runbook |
| security status | `SECURITY.md` |
| known boundaries | `spec/fx/KNOWN-LIMITATIONS.md` |
| release procedure | `RELEASE.md` |
