import test from 'node:test';
import assert from 'node:assert/strict';

import { FxPolicyEngine, createSettlementAuthorizationVerifier } from '../../fx-policy/src/index.js';
import { SettlementGraph } from '../src/index.js';

const NOW = 1_000_000;

function setup() {
  const policy = new FxPolicyEngine({ now: () => NOW });
  policy.configurePolicy({
    policyId: 'bank-fx',
    version: 1,
    enabledParticipantTypes: ['FIAT_PROVIDER'],
    requiredCredentials: { FIAT_PROVIDER: ['KYB', 'SANCTIONS', 'AML'] },
    allowedAssets: ['MYR', 'USDC', 'EURC', 'EUR'],
    allowedCorridors: ['MYR/USDC', 'EURC/EUR'],
    blockedJurisdictions: [],
    maxTicketByType: { FIAT_PROVIDER: '1000000' },
    authorizationTtlMs: 60_000,
  });
  policy.upsertParticipant({
    participantId: 'fiat-provider-1',
    participantType: 'FIAT_PROVIDER',
    status: 'ACTIVE',
    jurisdiction: 'MY',
  });
  for (const credentialType of ['KYB', 'SANCTIONS', 'AML']) {
    policy.upsertCredential({
      participantId: 'fiat-provider-1',
      credentialType,
      status: 'PASSED',
      providerRef: `provider:${credentialType}`,
      issuedAt: NOW - 100,
      expiresAt: NOW + 100_000,
    });
  }
  return policy;
}

function authorize(policy, overrides = {}) {
  return policy.authorize({
    participantId: 'fiat-provider-1',
    action: 'SETTLE_FIAT_EDGE',
    inputAsset: 'MYR',
    outputAsset: 'USDC',
    amount: '100000',
    ...overrides,
  });
}

function edge(authorizationId, overrides = {}) {
  return {
    edgeId: 'myr-usdc',
    edgeType: 'VERIFIED_FIAT_PAYMENT',
    finalityClass: 'ATTESTED_EXTERNAL',
    atomicGroup: null,
    fromAsset: 'MYR',
    toAsset: 'USDC',
    providerId: 'fiat-provider-1',
    policyAuthorizationId: authorizationId,
    capacity: '100000',
    unitInput: '100',
    unitOutput: '23',
    cost: '5',
    ...overrides,
  };
}

test('fiat settlement edge authorization is bound to provider pair and capacity', () => {
  const policy = setup();
  const verifier = createSettlementAuthorizationVerifier(policy);
  const decision = authorize(policy);
  assert.equal(decision.eligible, true);

  const graph = new SettlementGraph({ authorizationVerifier: verifier });
  graph.upsertEdge(edge(decision.authorizationId));

  assert.throws(
    () => graph.upsertEdge(edge(decision.authorizationId, { edgeId: 'too-large', capacity: '100001' })),
    (error) => error.code === 'POLICY_AUTHORIZATION_INVALID' && /AMOUNT_EXCEEDS_AUTHORIZATION/.test(error.message),
  );
  assert.throws(
    () => graph.upsertEdge(edge(decision.authorizationId, { edgeId: 'wrong-provider', providerId: 'other-provider' })),
    (error) => error.code === 'POLICY_AUTHORIZATION_INVALID' && /PROVIDER_MISMATCH/.test(error.message),
  );
  assert.throws(
    () => graph.upsertEdge(edge(decision.authorizationId, { edgeId: 'wrong-pair', toAsset: 'EURC' })),
    (error) => error.code === 'POLICY_AUTHORIZATION_INVALID' && /OUTPUT_ASSET_MISMATCH/.test(error.message),
  );
  policy.close();
});

test('credential change removes fiat edge at route-selection time', () => {
  const policy = setup();
  const verifier = createSettlementAuthorizationVerifier(policy);
  const decision = authorize(policy);
  const graph = new SettlementGraph({ authorizationVerifier: verifier });
  graph.upsertEdge(edge(decision.authorizationId));
  assert.equal(graph.activeEdges().length, 1);

  policy.upsertCredential({
    participantId: 'fiat-provider-1',
    credentialType: 'SANCTIONS',
    status: 'FAILED',
    providerRef: 'provider:SANCTIONS',
    issuedAt: NOW,
    expiresAt: NOW + 100_000,
  });

  assert.equal(graph.activeEdges().length, 0);
  assert.throws(
    () => graph.analyzeRoute(['myr-usdc']),
    (error) => error.code === 'POLICY_AUTHORIZATION_INVALID' && /PARTICIPANT_CHANGED/.test(error.message),
  );
  policy.close();
});
