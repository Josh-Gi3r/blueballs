# Blueballs FX - Visual Product Contract

Status: **connected runtime implementation**

The FX page is a product demonstration for founders and teams building banks. It must show what they can ship, what the institution controls and where the implementation lives.

It must never create a second pricing, policy, capacity or settlement model in React.

## Primary audience

- founders building a bank or neobank;
- product and technology leaders building embedded finance;
- treasury, risk and compliance teams evaluating control;
- developers deciding whether to clone and extend the stack.

## Primary question

> What FX capability do I get when I build on Blueballs, and can I inspect and run the machinery underneath it?

## One connected trade

The page follows one BRL to EUR request:

```text
Customer view
BRL → EUR

Institution view
policy → eligible sources → allocation → risk → settlement

Developer view
request → response → IDs → source → tests
```

The customer, institution and developer views must share the same runtime response, including amount, source allocation, quote ID, route ID, expiry and finality.

## Product sequence

### 1. Customer product

Show a credible banking exchange experience:

- enter BRL amount;
- receive live EUR preview;
- review and reserve;
- see rate, expiry and delivery boundary;
- encounter honest execution availability;
- never expose internal source classes inside the customer experience unless the visitor opens the bank view.

### 2. Open the same trade

Show:

- all potential source classes;
- which sources are eligible;
- which are excluded and why;
- selected allocation;
- capacity used;
- current policy and reference state.

Values must come from `apps/fx-node`.

### 3. Explain the infrastructure

Use four editorial stories:

1. liquidity network;
2. policy before price;
3. treasury and principal risk;
4. mixed fiat and token settlement.

Each editorial visual is paired with live or coded evidence. Artwork does not prove behaviour by itself.

### 4. Break the market

Two different tools must remain visibly separate:

- backend reference scenarios alter the live local market used by the customer trade;
- the deterministic simulator runs larger economic and failure scenarios used in CI.

The simulator must always be labelled `NOT A LIVE QUOTE`.

### 5. Inspect and take it

Expose:

- request and response;
- lifecycle identifiers;
- OpenAPI;
- implementation files;
- integration tests;
- controlled EVM proof;
- every FX package;
- one-command local run instructions.

## Visual language

The FX page remains part of the existing Blueballs site:

- light grey page background;
- white rounded cards;
- Archivo and IBM Plex Mono;
- restrained blue accent;
- customer phone UI;
- dark code panels;
- no generic futuristic fintech styling;
- no decorative control that does nothing.

## Editorial assets

The final page uses scalable 2400 × 1350 SVG artwork:

```text
src/assets/fx-editorial-liquidity.svg
src/assets/fx-editorial-policy.svg
src/assets/fx-editorial-treasury.svg
src/assets/fx-editorial-route.svg
```

Do not stretch tiny raster thumbnails across large sections. Generated concepts may inform composition, but labels, typography and diagrams used in the product must remain crisp and reviewable.

## Live-node mode

Browser configuration:

```text
VITE_FX_NODE_BASE
VITE_FX_NODE_KEY
```

Only a sandbox or demo credential may be embedded in a browser build.

When the node is unavailable, the page must say so. It must not silently fall back to:

- hardcoded rates;
- hardcoded source capacity;
- the legacy `/v2/fx/route` API;
- fabricated quote or transaction identifiers.

## Evidence labels

Use precise labels:

```text
LIVE LOCAL FX NODE
LIVE FX NODE PREVIEW
FIRM RESERVED SANDBOX QUOTE
DETERMINISTIC SIMULATOR · NOT A LIVE QUOTE
CONTROLLED EVM PROOF
EXECUTION ADAPTER NOT CONFIGURED
INTERNAL ENGINEERING GATE
NOT INDEPENDENTLY AUDITED
```

## Claims discipline

Supported by current evidence:

- policy-controlled, provider-neutral FX architecture;
- six reference liquidity classes in one reserved route;
- hard principal risk limits;
- live policy revocation before pricing;
- mixed-finality BRL to EUR route;
- atomic token settlement kernel;
- controlled Anvil JSON-RPC proof;
- deterministic stress scenarios;
- self-hosted reference node, SDK and Docker distribution.

Not supported without separate evidence:

- independent audit;
- regulator approval;
- production bank certification;
- production public-mainnet settlement;
- guaranteed cheapest FX;
- real PIX or issuer integration;
- end-to-end atomic fiat settlement.

## Visual QA gate

Every pull request changing the FX page must:

- pass TypeScript and production build;
- start the complete local stack;
- render the live page against the FX node;
- capture full-page desktop and mobile screenshots;
- capture the runtime status and trade preview used by the render;
- upload them as CI artefacts for human review.
