# Blueballs FX Contracts - Deployment

This document covers the FX-1 settlement kernel. It does not turn a deployment into a regulated or production-ready financial service.

## Contracts

```text
FxVault
OrderCancellation
PolicyAuthorizationRegistry
FxSettlement
AtomicRouter
```

## Trust model

- identity, private orders, policy evaluation, pricing and route construction remain off-chain;
- participant token balances are held and accounted for by `FxVault`;
- makers sign EIP-712 orders;
- takers sign EIP-712 intents with max-input and min-output bounds;
- the institution grants short-lived policy-authorisation hashes;
- `AtomicRouter` executes all selected token fills in one transaction;
- cancellation, nonce replay, signature validity, policy validity and collateral are enforced on-chain.

## Deployment order

1. Choose the owner / institution-administration address.
2. Choose the exact supported token contracts.
3. Deploy `FxVault(owner, supportedTokens)`.
4. Deploy `OrderCancellation()`.
5. Deploy `PolicyAuthorizationRegistry(owner)`.
6. Deploy `FxSettlement(owner, vault, cancellation)`.
7. Deploy `AtomicRouter(settlement, policyRegistry)`.
8. Call `FxVault.bindSettlement(settlement)` from the owner.
9. Call `FxSettlement.bindRouter(router)` from the owner.
10. Verify all constructor arguments and bindings on the target network.

The Vault-to-Settlement and Settlement-to-Router bindings are one-time operations. The FX-1 contracts deliberately do not expose an administrative replacement path.

## Supported tokens

Only explicitly allowlisted tokens may be deposited.

Before production use, evaluate each token for:

- transfer fees;
- rebasing;
- blocklists and pausing;
- upgradeability and administrator authority;
- decimal precision;
- return-value behaviour;
- chain-specific token implementation;
- issuer and redemption risk.

`FxVault.deposit()` credits the actual balance delta received, which prevents a transfer-fee token from creating unbacked accounting credit. That does not make every unusual token economically suitable.

## Funding

A maker or taker must approve the Vault and deposit its own supported tokens:

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

The core solvency condition is:

```text
physical balance >= total liabilities
```

The owner may rescue only genuine surplus above recorded liabilities.

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

The signed order may be partially filled. Cumulative rounding prevents repeated small fills from collecting more than the signed full-order buy amount.

Makers can invalidate:

- one order hash with `OrderCancellation.cancelOrder()`;
- every order below a new epoch with `OrderCancellation.invalidateBefore()`.

## Institution policy authority

Before execution, the institution registers the hash referenced by the taker intent:

```text
PolicyAuthorizationRegistry.authorize(hash, validUntil, epoch)
```

The institution can later:

```text
revoke one authorisation
advance the minimum policy epoch
```

Valid maker and taker signatures are insufficient if policy authority is expired, revoked or below the minimum epoch.

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

The nonce is consumed on successful execution. A revert rolls back the nonce with every other state change.

## Route execution

`AtomicRouter.execute(intent, takerSignature, fills)`:

1. validates intent shape and deadline;
2. validates the institution policy authorisation;
3. validates the taker signature;
4. rejects a used nonce;
5. verifies every maker order and signature;
6. checks cancellation and maker epoch;
7. moves pre-funded Vault balances for every fill;
8. enforces aggregate max input and minimum output;
9. emits `RouteExecuted`.

If any fill or final bound fails, the entire EVM transaction reverts.

## Controlled proof

The repository contains `script/ControlledProof.s.sol`, which:

- deploys proof tokens and the settlement kernel;
- binds the contracts;
- funds independent maker and taker accounts;
- deposits through real JSON-RPC transactions;
- signs maker and taker EIP-712 payloads;
- broadcasts one route;
- asserts post-settlement balances, backing and nonce consumption.

Run against local Anvil:

```bash
cd packages/fx-contracts
make deps
anvil --host 127.0.0.1 --port 8545
```

In another shell, provide funded proof keys and run:

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

CI performs this controlled proof with deterministic Anvil accounts.

## Export ABIs

```bash
cd packages/fx-contracts
make abi
```

This writes release ABIs under `packages/fx-contracts/abi/` for:

```text
FxVault
OrderCancellation
PolicyAuthorizationRegistry
FxSettlement
AtomicRouter
```

Release automation packages the generated ABIs with checksums.

## Production checklist

Before real assets:

- freeze and review exact contract source;
- complete an independent audit;
- decide whether immutable one-time bindings meet the deployment model;
- use production-grade multisig or governed institution ownership;
- use production key custody and signer policies;
- verify supported token contracts and decimals;
- configure monitoring for deposits, withdrawals, fills, cancellations, policy changes and solvency;
- define emergency and reconciliation operations;
- deploy with tiny limits first;
- independently verify source and constructor arguments;
- reconcile on-chain events to the institution ledger.

The contracts do not implement KYC, custody governance, fiat settlement, price discovery or operational reconciliation by themselves.
