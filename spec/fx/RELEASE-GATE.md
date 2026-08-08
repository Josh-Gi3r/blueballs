# Blueballs FX — Backend Release Gate

Status: **FX-10 release candidate gate**

A Blueballs FX backend commit is eligible to be called an internal release candidate only when the aggregate `FX release gate` workflow passes on that exact commit.

## Required green subsystems

1. **Solidity kernel**
   - formatting
   - compile / contract-size check
   - ordinary adversarial tests
   - CI fuzz and stateful invariant profile

2. **Controlled EVM proof**
   - start real local JSON-RPC node (Anvil)
   - deploy kernel
   - fund independent maker/taker
   - deposit assets
   - grant live institution policy authorization
   - sign maker/taker EIP-712 payloads
   - broadcast route
   - assert backing/balances/nonce

3. **Private market** — complete `fx-market` test suite.

4. **Pricing and treasury risk** — complete `fx-pricing` test suite.

5. **Liquidity optimizer/coordinator** — complete `fx-liquidity` test suite.

6. **Compliance/policy** — complete `fx-policy` test suite including market integration.

7. **Fiat settlement/graph** — complete `fx-fiat` test suite.

8. **Runtime** — `fx-node` syntax + endpoint/ambiguity tests.

9. **SDK** — complete `fx-sdk` tests.

10. **Economic simulator** — deterministic hostile-scenario suite.

11. **Self-host packaging** — Docker image build from repository root.

## Failure policy

- A failure blocks release-candidate status.
- Do not waive a financial/security test merely to make the aggregate gate green.
- If a test is wrong, document why and fix the test while preserving the intended invariant.
- A change to a financial invariant requires an explicit specification change, not an implementation-only exception.

## Release wording

Passing this gate means:

> Blueballs FX reference backend passes its internal engineering, adversarial, economic and controlled-execution gates at this commit.

It does **not** mean:

- independently security audited;
- licensed or regulator approved;
- guaranteed suitable for a specific bank/jurisdiction;
- public-mainnet production proven;
- certified against every external partner/provider.

## Visual phase boundary

The polished public FX experience may start after this aggregate backend gate is green and the release candidate is frozen. The visuals must read actual implementation behavior rather than maintaining a second simulated product model.
