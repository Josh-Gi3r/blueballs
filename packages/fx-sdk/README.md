# `@blueballs/fx-sdk`

Dependency-free JavaScript client for the self-hostable Blueballs FX node.

## Local use from this repository

```js
import { BlueballsFxClient } from './packages/fx-sdk/src/index.js';

const fx = new BlueballsFxClient({
  baseUrl: 'http://localhost:8788',
  apiKey: 'bb_test_local_fx',
});
```

## Inspect the reference runtime

```js
const status = await fx.referenceStatus();
const policy = await fx.referencePolicy();
const mixedRoute = await fx.referenceSettlementRoute();
```

Inspect currently eligible source slices without reserving them:

```js
const liquidity = await fx.referenceLiquidity({
  inputAsset: '0x0000000000000000000000000000000000000011',
  outputAsset: '0x0000000000000000000000000000000000000022',
  exactOutput: '450000000000',
});
```

## Request a firm sandbox quote

```js
const quote = await fx.quote({
  inputAsset: '0x0000000000000000000000000000000000000011',
  outputAsset: '0x0000000000000000000000000000000000000022',
  exactOutput: '450000000000',
  expiresInMs: 30_000,
  participantId: 'sandbox-customer',
  accountRef: 'sandbox-customer:wallet',
});
```

The canonical `reference-sandbox` only returns the quote after every selected source reserves its capacity. The response can include:

```text
PRIVATE_MARKET
ISSUER
NEOBANK
INSTITUTIONAL_LP
BANK_TREASURY
BANK_PRINCIPAL
```

Retrieve the public route:

```js
const route = await fx.getRoute(quote.routeId);
```

## Execution

```js
await fx.execute(quote.id);
```

The default reference runtime deliberately returns `EXECUTION_UNAVAILABLE` because no execution adapter is configured. It never invents a transaction hash.

Production deployments provide an adapter that turns the reserved private route into an institution-approved settlement payload and reconciles the result.

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

Maker identity and signed payloads are not returned in public quote allocations.

## Fiat intents

```js
const intent = await fx.createFiatIntent(payload);
await fx.reserveFiatIntent(intent.intentId);
await fx.submitFiatIntent(intent.intentId, 'provider-submission-ref');
await fx.attestFiat(attestation);
await fx.settleFiatIntent(intent.intentId, 'canonical-event-id');
```

Submission is not settlement. Fiat intent states remain explicit through observation, verification and final settlement.

## Errors

Node errors become `BlueballsFxError` with:

```js
error.code
aerror.status
error.details
```

The machine-readable code should drive product behaviour. Do not infer financial state from error text.

## Distribution status

The package is currently private to the repository while the public reference distribution is completed. Before npm publication it still needs a stable package version, generated type declarations, changelog and compatibility policy.

See `apps/fx-node/openapi.yaml` for the REST contract and `spec/fx/PUBLIC-REFERENCE.md` for the release criteria.
