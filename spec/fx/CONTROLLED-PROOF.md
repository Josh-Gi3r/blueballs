# Blueballs FX — Controlled Execution Proof

Status: FX-9 engineering specification.

## Purpose

FX-9 proves that the confirmed Solidity kernel can be deployed and exercised through a real JSON-RPC EVM node, not only inside unit-test calls.

CI uses Anvil because it is deterministic and does not require external secrets. The same Foundry script may be pointed at a public testnet by an operator supplying a funded RPC endpoint and private keys.

## Required proof

The controlled proof must:

1. deploy two ERC-20 proof assets;
2. deploy `FxVault`, `OrderCancellation`, `FxSettlement`, and `AtomicRouter`;
3. permanently bind Vault → Settlement and Settlement → Router;
4. fund an independent maker and taker;
5. deposit both assets into the Vault through actual RPC transactions;
6. create and sign a maker EIP-712 order;
7. create and sign a taker EIP-712 intent;
8. broadcast an atomic route through the Router;
9. prove expected maker/taker Vault balances after execution;
10. prove token liabilities remain exactly physically backed;
11. prove the taker nonce was consumed.

A script assertion failure fails the proof.

## Public-network boundary

CI passing on Anvil is **not** a claim that Blueballs has traded production funds or passed a public-network audit.

Public testnet execution requires an operator to provide:

- `RPC_URL`
- `OWNER_KEY`
- `MAKER_KEY`
- `TAKER_KEY`

The keys must be funded for gas on that network. The default controlled script deploys proof ERC-20s and therefore can be safely used for public-testnet plumbing validation without representing real stablecoin settlement.

Production-token proof is a later controlled-live step and must use explicit token addresses, tiny limits, production-grade signing/key custody, and reconciliation.
