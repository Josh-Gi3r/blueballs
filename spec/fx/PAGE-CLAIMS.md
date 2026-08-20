# Blueballs FX public capability claims

This file is the source of truth for public `/fx` wording. The page may describe the target architecture, but every operational claim must be labelled according to implementation status.

| Capability | Status | Canonical proof | Public wording |
| --- | --- | --- | --- |
| Private signed FX market | BUILT | `packages/fx-market` | May be described as implemented. |
| Aggregate private depth | BUILT | `packages/fx-market` | May be described as implemented. Individual maker identity remains private. |
| Cross-source optimizer and reservation | BUILT | `packages/fx-liquidity` | May be described as implemented. |
| Participant and corridor policy | BUILT | `packages/fx-policy` | May be described as implemented. |
| Pricing and principal risk | BUILT | `packages/fx-pricing` | May be described as implemented. |
| Atomic multi-maker token settlement | BUILT | `packages/fx-contracts` | May be described as implemented for token fills that execute in one router transaction. |
| Fiat intent / attestation / finality model | REFERENCE | `packages/fx-fiat` | May describe the state model. Must not imply a commercial bank or ramp is connected. |
| Issuer / LP / bank source adapters | ADAPTER_READY | `apps/fx-node/src/source-adapters.js`, `spec/fx/ADAPTERS.md` | May describe the adapter boundary and how providers can participate. Must label seeded providers as reference. |
| Peer / ZKP2P fiat edge | NOT_CONNECTED | adapter work required | May be shown as a provider model / planned adapter. Must not imply a Blueballs integration exists yet. |
| LI.FI / external venue | NOT_CONNECTED | adapter work required | May be shown as an external-route model. Must not imply a generic Blueballs adapter exists yet. |
| Production execution provider | NOT_CONNECTED | deployment-specific | Must not imply live execution or commercial settlement. |

## Page narrative

The `/fx` page is about progressive ownership of FX infrastructure:

1. launch using existing providers;
2. keep the customer-facing FX interface stable;
3. add the institution's own private market and counterparties;
4. let approved firms participate through orders, inventory or short-lived firm quotes;
5. keep fiat ramps and redemptions at the edges;
6. reserve, execute and reconcile each route explicitly;
7. make the implementation status and source visible to developers.

The page should not make liquidity the narrative. Liquidity is visible inside market and route graphics.

## Currency examples

Use globally important examples on the public page: USD, EUR, BRL and their major stablecoin representations. Smaller corridors may exist in tests or implementation examples but should not dominate the product narrative.
