# Blueballs FX Contracts — Deployment

This guide covers deployment of the Blueballs atomic token-settlement kernel.

## Contracts

```text
FxVault
OrderCancellation
PolicyAuthorizationRegistry
FxSettlement
AtomicRouter
```

Together they provide segregated token accounting, maker/taker authority, institution policy authorization, cancellation/replay controls and all-or-revert multi-fill token settlement.

## Trust model

- identity, private orders, policy evaluation, pricing and route construction stay off-chain;
- participant token balances are segregated and accounted for in `FxVault`;
- makers sign EIP-712 orders;
- takers sign EIP-712 intents with max-input/min-output bounds;
- the institution authorizes the exact taker-intent constraints through a router-domain-separated policy hash;
- `AtomicRouter` executes all selected token fills in one transaction;
- cancellation, nonce replay, signature validity, intent-bound policy validity and collateral are enforced on-chain.

## Deployment order

1. Choose the institution owner / governance address.
2. Choose the exact supported token contracts.
3. Deploy `FxVault(owner, supportedTokens)`.
4. Deploy `OrderCancellation()`.
5. Deploy `PolicyAuthorizationRegistry(owner)`.
6. Deploy `FxSettlement(owner, vault, cancellation)`.
7. Deploy `AtomicRouter(settlement, policyRegistry)`.
8. Call `FxVault.bindSettlement(settlement)` from the owner.
9. Call `FxSettlement.bindRouter(router)` from the owner.
10. Verify constructor arguments, source and bindings on the target network.

Vault-to-Settlement and Settlement-to-Router bindings are one-time operations. Core settlement authority is immutable after binding.

## Supported tokens

Only explicitly allowlisted tokens can be deposited.

Evaluate each token's transfer behavior, decimals, administrative controls, upgradeability, pausing/blocklist model and issuer/redemption characteristics before adding it to the deployment allowlist.

`FxVault.deposit()` credits the actual physical balance delta received, so transfer-fee behavior cannot create unbacked internal credit. Physical token-transfer paths are reentrancy-guarded, and every successful token movement rechecks vault solvency.

## Funding

A maker or taker approves the Vault and deposits its own supported tokens:

```text
ERC20.approve(vault, amount)
FxVault.deposit(token, amount)
```

The Vault tracks:

```text
participant balance by token
total liabilities by token
physical ERC-20 balance
surplus above liabilities
```

The core solvency invariant is:

```text
physical balance >= total liabilities
```

Institution governance can rescue only physical surplus above recorded liabilities.

## Maker order

A maker signs the EIP-712 `MakerOrder` defined by `FxSettlement`:

```text
maker
sellToken
buyToken
sellAmount
buyAmount
recipient
validAfter
validUntil
epoch
salt
```

Orders can fill partially. Cumulative rounding ensures repeated partial fills cannot collect more than the economics of the full signed order.

Makers can invalidate:

- one order hash with `OrderCancellation.cancelOrder()`;
- every order below a new epoch with `OrderCancellation.invalidateBefore()`.

## Institution policy authority

Policy authorization is bound to the exact taker intent rather than acting as a bearer credential.

Construct the intended taker constraints with `policyAuthorizationHash = bytes32(0)`, then calculate:

```text
AtomicRouter.hashPolicyIntent(intent)
```

The returned EIP-712 hash commits to:

```text
taker
inputToken
outputToken
maxInput
minOutput
recipient
deadline
nonce
chain id
router deployment
```

Set that returned value as `intent.policyAuthorizationHash`, register it through:

```text
PolicyAuthorizationRegistry.authorize(policyAuthorizationHash, validUntil, epoch)
```

and then have the taker sign the final `TakerIntent`.

At execution, `AtomicRouter` recomputes the exact policy hash from the current intent and requires equality before consulting the registry. A valid authorization therefore cannot be copied to another taker, pair, amount bound, recipient, nonce, chain or router deployment.

Institution governance can revoke one authorization or advance the minimum policy epoch. Maker and taker signatures alone are insufficient when institution policy authority is expired, revoked, below the active epoch or does not exactly match the signed intent constraints.

## Taker intent

The taker signs the EIP-712 `TakerIntent` defined by `AtomicRouter`:

```text
taker
inputToken
outputToken
maxInput
minOutput
recipient
deadline
nonce
policyAuthorizationHash
```

The nonce is consumed on successful execution. A revert rolls the nonce back with every other state change.

## Route execution

`AtomicRouter.execute(intent, takerSignature, fills)`:

1. validates intent shape/deadline;
2. recomputes and matches the exact intent-bound policy authorization hash;
3. validates the registered institution policy authorization;
4. validates the taker signature;
5. rejects a used nonce;
6. verifies every maker order/signature;
7. enforces cancellation and maker epoch;
8. moves pre-funded Vault balances for each fill;
9. enforces aggregate max-input/min-output bounds;
10. emits `RouteExecuted`.

If any fill or final bound fails, the entire EVM transaction reverts.

## Withdrawal and incident controls

`FxVault` can operate with immediate withdrawals or an institution-configured withdrawal delay. The delay is capped by the contract and applies only to participant withdrawals, not settlement `move()` operations.

Pending withdrawals are explicit, cancellable and time-bounded. This creates a finite incident-response window while keeping participant withdrawal rights encoded directly in the contract.

## Controlled execution proof

`script/ControlledProof.s.sol` provides a complete local execution proof:

- deploys proof tokens and the settlement kernel;
- binds the contracts;
- funds independent maker/taker accounts;
- deposits through JSON-RPC transactions;
- computes and registers the exact intent-bound policy authorization;
- signs maker and taker EIP-712 payloads;
- broadcasts one route;
- verifies post-settlement balances, backing and nonce consumption.

Run against local Anvil:

```bash
cd packages/fx-contracts
make deps
anvil --host 127.0.0.1 --port 8545
```

Then:

```bash
RPC_URL=http://127.0.0.1:8545 \
OWNER_KEY=0x... \
MAKER_KEY=0x... \
TAKER_KEY=0x... \
forge script script/ControlledProof.s.sol:ControlledProof \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvvv
```

## Foundry assurance

The contract gate is:

```bash
make -C packages/fx-contracts ci
```

It covers formatting, compilation, unit tests, fuzzing and invariants across router, settlement, vault, withdrawal controls, cancellation, policy authorization and ERC-1271 smart-wallet signatures.

The full Blueballs release gate includes this contract gate through:

```bash
pnpm verify:release
```

## Export ABIs

```bash
cd packages/fx-contracts
make abi
```

Generated ABIs are produced for:

```text
FxVault
OrderCancellation
PolicyAuthorizationRegistry
FxSettlement
AtomicRouter
```

## Institution deployment profile

A production contract deployment typically combines:

- institution multisig/governance ownership;
- institution key custody and signer policy;
- allowlisted token/source review;
- monitoring of deposits, withdrawals, fills, cancellations, policy changes and solvency;
- event reconciliation against the institution ledger;
- controlled limits during initial network rollout;
- independently reproducible source/constructor verification;
- the institution's normal application/contract review process.

KYC/compliance facts, fiat settlement, price discovery and provider reconciliation remain in the surrounding Blueballs policy, fiat, provider and FX runtime layers rather than being duplicated inside the token-settlement contracts.

See [`../../spec/fx/ADAPTERS.md`](../../spec/fx/ADAPTERS.md), [`../../spec/fx/THREAT-MODEL.md`](../../spec/fx/THREAT-MODEL.md) and [`../../PRODUCTION-HARDENING.md`](../../PRODUCTION-HARDENING.md).
