# Blueballs FX — Visual Laboratory

Status: **FX-11 visual product contract**

The visual layer starts only after the backend aggregate release gate is green. It must visualize the implementation that exists; it must not create a second economic or compliance model in React.

## Primary message

**Compliant FX infrastructure for financial institutions.**

Blueballs lets an institution assemble an FX market from its own treasury, approved customer/member liquidity, institutional LPs, stablecoin issuers, other neobanks and verified fiat providers while retaining control over exactly who can participate and under what policy.

The product is not marketed as generic P2P FX.

## Visual hierarchy

The page should make this sequence obvious before explaining implementation details:

`IDENTITY → POLICY → AUTHORIZED LIQUIDITY → PRICE / ROUTE → POLICY AUTHORIZATION → SETTLEMENT → RECONCILIATION`

A source that fails policy is removed before price competition. A cryptographically valid maker/taker signature is still insufficient when institution policy authorization is expired or revoked.

## Six modes

### SEE IT
Show the route as a financial system, not a generic swap widget:
- requested exchange;
- eligible liquidity sources;
- source allocation;
- institution principal participation;
- price/reference provenance;
- policy state;
- finality per leg;
- settlement/reconciliation state.

### TRY IT
Interactive inputs must run real implementation logic:
- deterministic simulator imported from `packages/fx-simulator` for economic scenarios;
- live `fx-node` firm quotes when a sandbox node is configured.

No duplicated React-only pricing formula is permitted.

### BREAK IT
Allow a visitor to select proven hostile scenarios:
- 90% one-way flow;
- LP disappearance;
- issuer disappearance;
- principal hard limit;
- reference outage;
- price shock;
- cancellation storm;
- chain congestion;
- recovery.

Results must come from the same deterministic simulator used in CI.

### INSPECT IT
Expose implementation evidence:
- route composition;
- rejection reason;
- principal exposure / hard limit;
- settlement finality class;
- policy gate explanation;
- API request/response where live node is connected;
- source/package links.

### READ IT
Plain language must distinguish:
- policy/compliance framework from KYC vendor;
- atomic token settlement from asynchronous fiat settlement;
- firm/reserved liquidity from indicative depth;
- internal release gates from independent external audit.

### TAKE IT
Direct developers to:
- `apps/fx-node`
- `packages/fx-sdk`
- `packages/fx-contracts`
- `packages/fx-market`
- `packages/fx-pricing`
- `packages/fx-liquidity`
- `packages/fx-policy`
- `packages/fx-fiat`
- `packages/fx-simulator`
- `spec/fx`

## Live-node mode

The marketing/docs site and FX node are deliberately separate runtimes.

Browser configuration:
- `VITE_FX_NODE_BASE`
- `VITE_FX_NODE_KEY`

The key must be a sandbox/demo credential only. Production credentials must never be embedded in a public browser build.

When the live node is not configured, the page must say so clearly. It may still run the real in-browser simulator because that simulator is deterministic application code, not mocked API output.

The page must never silently fall back to the older hardcoded monolithic `/v2/fx/route` implementation.

## Claims discipline

Allowed:
- internal backend release gate passed for the frozen reference commit;
- deterministic simulator behavior;
- controlled Anvil JSON-RPC execution proof;
- provider-neutral compliance architecture;
- on-chain institution policy authorization exists.

Not allowed without separate evidence:
- independently audited;
- regulator approved;
- production bank certified;
- production public-mainnet proven;
- guaranteed cheapest FX;
- every fiat leg atomic.
