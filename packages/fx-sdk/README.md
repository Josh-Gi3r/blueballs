# `@blueballs/fx-sdk`

Dependency-free JavaScript client for the self-hostable Blueballs FX node.

## Repository use

```js
import { BlueballsFxClient } from './packages/fx-sdk/src/index.js';

const fx = new BlueballsFxClient({
  baseUrl: 'http://localhost:8788',
  apiKey: 'bb_test_local_fx',
});
```

## Customer-facing BRL to EUR trade

Preview without reserving capacity:

```js
const preview = await fx.previewReferenceTrade({
  inputAmount: '50000.00',
  from: 'BRL',
  to: 'EUR',
});
```

Reserve the same trade:

```js
const trade = await fx.reserveReferenceTrade({
  inputAmount: '50000.00',
  expiresInMs: 60_000,
});
```

The reserved object contains:

```text
trade.id
trade.quoteId
trade.routeId
trade.from / trade.to
trade.sources
trade.sourceStatus
trade.tokenRoute
trade.settlement
authorisation and evidence labels
```

Retrieve or release the trade:

```js
const current = await fx.getReferenceTrade(trade.id);
const released = await fx.releaseReferenceTrade(trade.id);
```

Execution is explicit:

```js
await fx.executeReferenceTrade(trade.id);
```

The default reference node rejects this with `EXECUTION_UNAVAILABLE` because no execution adapter is configured. It never creates a fake transaction hash.

## Inspect and alter the reference market

```js
const status = await fx.referenceStatus();
const policy = await fx.referencePolicy();
const market = await fx.referenceMarket();
const route = await fx.referenceSettlementRoute();
```

Apply a deterministic backend scenario:

```js
await fx.applyReferenceScenario('issuer_policy_blocked');
```

Available scenarios are returned by:

```js
const scenarios = await fx.referenceScenario();
```

Inspect eligible source slices without reserving them:

```js
const liquidity = await fx.referenceLiquidity({
  inputAsset: '0x0000000000000000000000000000000000000033', // internal BRL deposit claim
  outputAsset: '0x0000000000000000000000000000000000000022', // EURC
  exactOutput: '1000000000',
});
```

## Underlying exact-output token API

```js
const quote = await fx.quote({
  inputAsset,
  outputAsset,
  exactOutput: 100000000n,
  expiresInMs: 30_000,
  participantId: 'sandbox-customer',
  accountRef: 'sandbox-customer:wallet',
});

const publicRoute = await fx.getRoute(quote.routeId);
```

A firm quote is returned only after all selected sources reserve capacity.

## Private maker orders

```js
await fx.createOrder({
  orderHash,
  order,
  signature,
  policyAuthorizationId,
  policySnapshotHash,
});

const depth = await fx.depth({ inputAsset, outputAsset });
await fx.cancelOrder(orderHash, { onChainInvalidated: true });
```

Maker identity and signed payloads are not returned in public source allocations.

## Fiat intents

```js
const intent = await fx.createFiatIntent(payload);
await fx.reserveFiatIntent(intent.intentId);
await fx.submitFiatIntent(intent.intentId, 'provider-submission-ref');
await fx.attestFiat(attestation);
await fx.settleFiatIntent(intent.intentId, 'canonical-event-id');
```

Submission is not settlement. Fiat states remain explicit through observation, verification and final settlement.

## Errors

Node errors become `BlueballsFxError`:

```js
try {
  await fx.reserveReferenceTrade({ inputAmount: '50000.00' });
} catch (error) {
  console.log(error.code);
  console.log(error.status);
  console.log(error.details);
}
```

Use the machine-readable code to drive product behaviour. Do not infer financial state from error text.

## TypeScript

The package exports `src/index.d.ts`, including types for:

- quotes and routes;
- public reference trades;
- source allocations and eligibility;
- market scenarios;
- settlement edges and finality;
- fiat intents;
- structured errors.

## Publication status

The package is prepared as the repository client for the `0.1.x` reference line. Before publishing to a public registry, the maintainers must create a signed release tag and run the release workflow described in `RELEASE.md`.

See `apps/fx-node/openapi.yaml`, `spec/fx/ADAPTERS.md` and `spec/fx/PUBLIC-REFERENCE.md`.
