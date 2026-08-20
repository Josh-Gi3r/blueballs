# Blueballs FX - Adapter Contracts

Blueballs keeps institution policy and route construction separate from commercial providers. A deployment replaces reference adapters without changing customer quote semantics or the financial state machine.

## Adapter classes

A production composition normally supplies four kinds of adapter:

1. liquidity discovery;
2. liquidity reservation and release;
3. execution submission;
4. fiat evidence and reconciliation.

Identity and compliance providers feed facts into `FxPolicyEngine`; they do not decide route economics directly.

## 1. Liquidity discovery

A discoverable source produces one or more slices for the exact asset pair:

```js
{
  sourceType: 'INSTITUTIONAL_LP',
  sourceId: 'provider-instance',
  sliceId: 'provider-instance:price-level',
  inputAsset: 'BRLX',
  outputAsset: 'EURC',
  maxOutput: '1000000000',
  inputNumerator: '6082',
  inputDenominator: '1000',
  policyAuthorizationId: '...',
  policySnapshotHash: '...',
  expiresAt: 1780000000000,
  reservationPayload: { ... }
}
```

Rules:

- amounts are integer atomic-unit strings;
- price is an exact rational number;
- capacity must be currently available;
- expiry must be explicit;
- every slice must carry live institution policy authority;
- provider secrets and maker identity must not be exposed to the public quote response;
- discovery is indicative until reservation succeeds.

The canonical planner is `packages/fx-liquidity/src/optimizer.js`.

## 2. Reservation adapter

`reservePlan()` calls the adapter associated with each selected source type.

Minimum interface:

```js
const adapter = {
  async reserve({ routeId, leg, index }) {
    return { reservationHandle: 'provider-reservation-id' };
  },

  async release({ routeId, leg, reservationHandle, reason }) {
    return { released: true };
  },
};
```

`reserve()` must:

- be idempotent for the same route, leg and economic terms;
- reserve real capacity, not merely acknowledge the request;
- return an opaque stable handle;
- reject expired or changed provider terms;
- apply provider authentication and request signing;
- persist enough data for reconciliation.

`release()` must:

- be idempotent;
- release only the referenced reservation;
- preserve an audit trail and reason;
- never release capacity after external submission if execution may already have occurred.

If any selected leg fails to reserve, Blueballs releases previously reserved legs in reverse order and does not return a firm quote.

## Optional lifecycle hooks

The integrated coordinator uses these hooks when implemented:

```js
validateReserved({ routeId, leg, reservationHandle })
markSubmitted({ routeId, leg, reservationHandle, submissionRef })
confirm({ routeId, leg, reservationHandle, eventId })
fail({ routeId, leg, reservationHandle, eventId, reason })
```

`validateReserved()` must verify live capacity and policy immediately before submission.

`markSubmitted()` creates a non-releasable boundary. From this point, timeout or network failure is an ambiguous result requiring reconciliation.

`confirm()` and `fail()` must be idempotent on the canonical event identifier.

Reference implementations live in:

```text
apps/fx-node/src/source-adapters.js
apps/fx-node/src/reference-liquidity.js
apps/fx-node/src/composite-principal-adapter.js
```

## 3. Execution adapter

The node accepts an optional execution adapter:

```js
const executionAdapter = {
  async submit(privateQuote, { submissionRef }) {
    return {
      status: 'ACCEPTED',
      externalRef: 'provider-or-chain-reference',
    };
  },
};
```

Allowed outcomes:

```text
ACCEPTED   provider accepted submission; confirmation still comes from reconciliation
REJECTED   provider definitively rejected it
UNKNOWN    outcome cannot be determined yet
```

Throwing after submission is treated as `UNKNOWN`, not as safe failure.

The node commits the route to `SUBMITTED` before calling the adapter. Submitted reservations are not returned to the market until canonical reconciliation proves failure.

A production execution adapter must:

- construct payloads only from the private reserved route;
- preserve taker max-input, min-output, recipient, deadline and nonce;
- preserve maker-signed economics;
- bind institution policy authority;
- use idempotency keys;
- authenticate and sign outbound requests;
- expose a reconciliation lookup;
- never manufacture a success reference.

For token settlement, the target can be `AtomicRouter`. For institutional or provider settlement, the same lifecycle rules still apply.

## 4. Fiat evidence adapter

Fiat settlement is modelled as an intent and evidence lifecycle, not an atomic token call.

A verifier eventually submits an attestation matching:

```text
intent hash
payment ID
currency
amount
payer reference hash
payee reference hash
settled time
verifier identity
proof reference
expiry
status
```

Reference classes:

```text
InternalLedgerVerifier
AttestedPaymentVerifier
```

Production adapters must authenticate provider callbacks, prevent payment-ID replay, retain evidence and support manual review.

See `packages/fx-fiat/src/adapters.js` and `packages/fx-fiat/src/settlement-store.js`.

## Policy integration

Provider eligibility must be decided before price competition.

A production onboarding pipeline supplies:

- participant identity and type;
- jurisdiction and risk tier;
- credential status and expiry;
- attributed account references;
- allowed assets and corridors;
- ticket limits.

`FxPolicyEngine` issues short-lived transaction authority tied to those facts. Changing participant facts or policy version invalidates stale authority.

Do not let a provider adapter bypass policy because it has already authenticated the provider commercially.

## Conformance tests

Every adapter should prove:

- deterministic amount and price handling;
- reservation idempotency;
- concurrent capacity protection;
- rollback after partial route-reservation failure;
- expiry;
- policy revocation;
- cancellation;
- submission ambiguity;
- confirmation and failure replay;
- no secret data in public responses;
- no floating-point authoritative money calculations.

Use the reference-node integration tests as a starting point:

```text
apps/fx-node/test/node.test.js
apps/fx-node/test/reference-runtime.test.js
apps/fx-node/test/public-reference-runtime.test.js
```

## Provider-neutral rule

Provider names, credentials and commercial assumptions belong in deployment-specific adapter packages or configuration, not in canonical pricing, policy or route code.
