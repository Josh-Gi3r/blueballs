# `@blueballs/fx-sdk`

Dependency-free JavaScript client for the self-hostable Blueballs FX node.

## Repository use

Public inspection and preview methods need only the node URL:

```js
import { BlueballsFxClient } from './packages/fx-sdk/src/index.js';

const publicFx = new BlueballsFxClient({
  baseUrl: 'http://localhost:8788',
});

const status = await publicFx.referenceStatus();
```

Authenticated market/execution integrations provide the client credential:

```js
const fx = new BlueballsFxClient({
  baseUrl: 'http://localhost:8788',
  apiKey: process.env.FX_NODE_API_KEY,
});
```

Operator/reconciliation services add a distinct operator credential:

```js
const ops = new BlueballsFxClient({
  baseUrl: 'http://localhost:8788',
  apiKey: process.env.FX_NODE_API_KEY,
  operatorApiKey: process.env.FX_NODE_OPERATOR_API_KEY,
});
```

The SDK keeps the two authorities separate: ordinary methods never send the operator credential, while authoritative quote reconciliation and fiat-finality methods require it.

## Customer-facing BRL to EUR trade

Preview without reserving capacity:

```js
const preview = await publicFx.previewReferenceTrade({
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

Execution submission is explicit:

```js
await fx.executeReferenceTrade(trade.id);
```

Production runtime composition sends this through the configured venue/provider/AtomicRouter execution adapter while Blueballs preserves the canonical `SUBMITTED` and reconciliation lifecycle.

## Inspect and alter the reference market

Public inspection:

```js
const status = await publicFx.referenceStatus();
const policy = await publicFx.referencePolicy();
const market = await publicFx.referenceMarket();
const route = await publicFx.referenceSettlementRoute();
```

Authenticated scenario control:

```js
await fx.applyReferenceScenario('issuer_policy_blocked');
```

Available scenarios are public:

```js
const scenarios = await publicFx.referenceScenario();
```

Inspect eligible source slices without reserving them:

```js
const liquidity = await publicFx.referenceLiquidity({
  inputAsset: '0x0000000000000000000000000000000000000033',
  outputAsset: '0x0000000000000000000000000000000000000022',
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
  participantId: 'customer-or-integration-principal',
  accountRef: 'attributed-account-ref',
});

const publicRoute = await fx.getRoute(quote.routeId);
await fx.execute(quote.id);
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

## Fiat intent and finality lifecycle

Client/integration authority creates and submits the intent:

```js
const intent = await fx.createFiatIntent(payload);
await fx.reserveFiatIntent(intent.intentId);
await fx.submitFiatIntent(intent.intentId, 'provider-submission-ref');
```

Operator/finality authority binds external evidence and records final settlement:

```js
await ops.attestFiat(attestation);
await ops.settleFiatIntent(intent.intentId, 'canonical-event-id');
```

Quote reconciliation uses the same operator credential:

```js
await ops.confirmQuote(quote.id, {
  eventId: 'provider-or-chain-event-id',
  fills,
});

await ops.failQuote(quote.id, {
  eventId: 'provider-or-chain-event-id',
  reason: 'definitive-provider-failure',
});
```

Submission is not settlement. Fiat and quote states remain explicit until authoritative evidence reaches the operator surface.

## Exact amounts and transport safety

Atomic monetary inputs accept integer strings, `bigint`, or positive safe-integer JavaScript numbers. Unsafe numbers are rejected before transport rather than silently losing precision.

The client validates its base URL before sending credentials and normalizes network/protocol failures into structured `BlueballsFxError` values.

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
- separated client/operator credentials;
- structured errors.

## Package assurance

The SDK package boundary is exercised by the repository verification gate, including dry-run package contents, public/authenticated request behavior, exact amount handling, transport errors and client/operator authority separation.

See `apps/fx-node/openapi.yaml`, `spec/fx/ADAPTERS.md` and `spec/fx/PUBLIC-REFERENCE.md`.
