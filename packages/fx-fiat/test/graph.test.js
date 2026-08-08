import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AttestedPaymentVerifier,
  FiatSettlementStore,
  InternalLedgerVerifier,
  SettlementGraph,
  hashFiatIntent,
  hashRef,
} from '../src/index.js';

const NOW = 1_000_000;

function edge(overrides = {}) {
  return {
    edgeId: 'edge-1',
    edgeType: 'TOKEN_SWAP',
    finalityClass: 'ATOMIC',
    atomicGroup: 'chain:8453:tx-1',
    fromAsset: 'USDC',
    toAsset: 'EURC',
    providerId: 'market',
    policyAuthorizationId: 'auth-edge',
    capacity: '1000000',
    unitInput: '110',
    unitOutput: '100',
    cost: '0',
    ...overrides,
  };
}

function fiatIntent(id, edgeType = 'VERIFIED_FIAT_PAYMENT', finalityClass = 'ATTESTED_EXTERNAL') {
  return {
    intentId: id,
    routeId: 'route-myr-eur',
    edgeId: `${id}-edge`,
    edgeType,
    finalityClass,
    payerParticipantId: 'payer',
    payeeParticipantId: 'payee',
    payerAccountRef: `payer:${id}`,
    payeeAccountRef: `payee:${id}`,
    currency: 'MYR',
    amount: '10000',
    rail: 'DUITNOW',
    providerId: 'fiat-provider',
    policyAuthorizationId: 'auth-fiat',
    createdAt: NOW,
    expiresAt: NOW + 60_000,
    nonce: id,
  };
}

test('same atomic boundary may truthfully advertise atomic route', () => {
  const graph = new SettlementGraph();
  graph.upsertEdge(edge({ edgeId: 'a', fromAsset: 'USDC', toAsset: 'EURC' }));
  graph.upsertEdge(edge({ edgeId: 'b', fromAsset: 'EURC', toAsset: 'XSGD' }));
  const route = graph.analyzeRoute(['a', 'b']);
  assert.deepEqual(route.guarantee, {
    atomic: true,
    class: 'ATOMIC',
    atomicGroup: 'chain:8453:tx-1',
  });
});

test('separate atomic transactions are not mislabelled as one atomic route', () => {
  const graph = new SettlementGraph();
  graph.upsertEdge(edge({ edgeId: 'a', fromAsset: 'USDC', toAsset: 'EURC', atomicGroup: 'tx-a' }));
  graph.upsertEdge(edge({ edgeId: 'b', fromAsset: 'EURC', toAsset: 'XSGD', atomicGroup: 'tx-b' }));
  assert.deepEqual(graph.analyzeRoute(['a', 'b']).guarantee, {
    atomic: false,
    class: 'MULTI_ATOMIC_BOUNDARY',
  });
});

test('mixed fiat-token route explicitly reports mixed finality', () => {
  const graph = new SettlementGraph();
  graph.upsertEdge(edge({
    edgeId: 'myr-usdc',
    edgeType: 'VERIFIED_FIAT_PAYMENT',
    finalityClass: 'ATTESTED_EXTERNAL',
    atomicGroup: null,
    fromAsset: 'MYR',
    toAsset: 'USDC',
    providerId: 'fiat-provider',
  }));
  graph.upsertEdge(edge({ edgeId: 'usdc-eurc', fromAsset: 'USDC', toAsset: 'EURC' }));
  graph.upsertEdge(edge({
    edgeId: 'eurc-eur',
    edgeType: 'ISSUER_REDEEM',
    finalityClass: 'ASYNC_EXTERNAL',
    atomicGroup: null,
    fromAsset: 'EURC',
    toAsset: 'EUR',
    providerId: 'issuer',
  }));

  const route = graph.analyzeRoute(['myr-usdc', 'usdc-eurc', 'eurc-eur']);
  assert.equal(route.fromAsset, 'MYR');
  assert.equal(route.toAsset, 'EUR');
  assert.equal(route.guarantee.atomic, false);
  assert.equal(route.guarantee.class, 'MIXED_FINALITY');
  assert.deepEqual(route.guarantee.finalityClasses, [
    'ATTESTED_EXTERNAL', 'ATOMIC', 'ASYNC_EXTERNAL',
  ]);
});

test('unavailable or unauthorized edge cannot enter route', () => {
  const graph = new SettlementGraph({
    authorizationVerifier: (authorizationId) => ({
      valid: authorizationId === 'allowed',
      reason: 'POLICY_BLOCKED',
    }),
  });
  assert.throws(
    () => graph.upsertEdge(edge({ policyAuthorizationId: 'denied' })),
    (error) => error.code === 'POLICY_AUTHORIZATION_INVALID',
  );

  graph.upsertEdge(edge({ edgeId: 'allowed-edge', policyAuthorizationId: 'allowed' }));
  graph.setAvailability('allowed-edge', false);
  assert.throws(() => graph.analyzeRoute(['allowed-edge']), /edge unavailable/);
});

test('route continuity is enforced', () => {
  const graph = new SettlementGraph();
  graph.upsertEdge(edge({ edgeId: 'a', fromAsset: 'USDC', toAsset: 'EURC' }));
  graph.upsertEdge(edge({ edgeId: 'b', fromAsset: 'XSGD', toAsset: 'MYRT' }));
  assert.throws(() => graph.analyzeRoute(['a', 'b']), /route discontinuity/);
});

test('internal ledger adapter converts an authoritative posted event into verified evidence', () => {
  const store = new FiatSettlementStore({ now: () => NOW + 2_000 });
  const intent = fiatIntent('ledger-1', 'INTERNAL_LEDGER', 'AUTHORITATIVE_LEDGER');
  store.createIntent(intent);
  store.reserveIntent(intent.intentId);
  store.submitIntent(intent.intentId, 'ledger:submission');

  const verifier = new InternalLedgerVerifier({ store, now: () => NOW + 2_000 });
  const result = verifier.attest(intent, {
    eventId: 'ledger-event-1',
    intentId: intent.intentId,
    status: 'POSTED',
    currency: intent.currency,
    amount: intent.amount,
    payerAccountRef: intent.payerAccountRef,
    payeeAccountRef: intent.payeeAccountRef,
    postedAt: NOW + 1_000,
  });

  assert.equal(result.status, 'VERIFIED');
  assert.equal(store.getIntent(intent.intentId).state, 'VERIFIED');
  store.close();
});

test('generic attested-payment adapter preserves pending/review/rejected/verified semantics', () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  const intent = fiatIntent('external-1');
  store.createIntent(intent);
  store.reserveIntent(intent.intentId);
  store.submitIntent(intent.intentId, 'external:submission');
  const verifier = new AttestedPaymentVerifier({ store, verifierId: 'peer-style', verifierType: 'TEE' });

  assert.deepEqual(verifier.verify(intent, { status: 'PENDING' }), { status: 'PENDING' });
  assert.deepEqual(verifier.verify(intent, { status: 'MANUAL_REVIEW', reason: 'NAME_MISMATCH' }), {
    status: 'MANUAL_REVIEW', reason: 'NAME_MISMATCH',
  });

  const evidence = {
    status: 'VERIFIED',
    attestationId: 'att-external',
    intentHash: hashFiatIntent(intent),
    paymentId: 'payment-external',
    currency: intent.currency,
    amount: intent.amount,
    payerRefHash: hashRef(intent.payerAccountRef),
    payeeRefHash: hashRef(intent.payeeAccountRef),
    settledAt: NOW - 100,
    issuedAt: NOW,
    expiresAt: NOW + 10_000,
    proofRef: 'opaque-provider-proof',
  };
  const result = verifier.verify(intent, evidence);
  assert.equal(result.status, 'VERIFIED');
  assert.equal(store.getIntent(intent.intentId).state, 'VERIFIED');
  store.close();
});
