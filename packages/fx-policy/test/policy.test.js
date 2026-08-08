import test from 'node:test';
import assert from 'node:assert/strict';

import { FxPolicyEngine } from '../src/index.js';

const NOW = 1_000_000;

function configured() {
  const engine = new FxPolicyEngine({ now: () => NOW });
  engine.configurePolicy({
    policyId: 'bank-fx',
    version: 1,
    enabledParticipantTypes: ['CUSTOMER', 'INSTITUTIONAL_LP', 'BANK_PRINCIPAL'],
    requiredCredentials: {
      CUSTOMER: ['KYC', 'SANCTIONS'],
      INSTITUTIONAL_LP: ['KYB', 'SANCTIONS', 'AML'],
      BANK_PRINCIPAL: [],
    },
    allowedAssets: ['USD', 'EUR', 'SGD'],
    allowedCorridors: ['USD/EUR', 'SGD/USD'],
    blockedJurisdictions: ['BLOCKED'],
    maxTicketByType: {
      CUSTOMER: '5000',
      INSTITUTIONAL_LP: '1000000',
      BANK_PRINCIPAL: '10000000',
    },
    authorizationTtlMs: 60_000,
  });
  return engine;
}

function addInstitution(engine, overrides = {}) {
  engine.upsertParticipant({
    participantId: 'lp-1', participantType: 'INSTITUTIONAL_LP',
    status: 'ACTIVE', jurisdiction: 'SG', riskTier: 'LOW', ...overrides,
  });
  for (const type of ['KYB', 'SANCTIONS', 'AML']) {
    engine.upsertCredential({
      participantId: 'lp-1', credentialType: type, status: 'PASSED',
      providerRef: `provider:${type}`, issuedAt: NOW - 1000, expiresAt: NOW + 100_000,
    });
  }
  engine.mapAccount({ participantId: 'lp-1', accountRef: 'wallet:lp-1' });
}

test('eligible institutional LP receives short-lived authorization', () => {
  const engine = configured();
  addInstitution(engine);
  const decision = engine.authorize({
    participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR',
    amount: '100000', accountRef: 'wallet:lp-1',
  });
  assert.equal(decision.eligible, true);
  assert.equal(typeof decision.authorizationId, 'string');
  assert.equal(engine.verifyAuthorization(decision.authorizationId).valid, true);
  engine.close();
});

test('missing failed or expired required credential blocks authorization', () => {
  const engine = configured();
  engine.upsertParticipant({ participantId: 'lp-1', participantType: 'INSTITUTIONAL_LP', status: 'ACTIVE', jurisdiction: 'SG' });
  engine.upsertCredential({ participantId: 'lp-1', credentialType: 'KYB', status: 'PASSED', issuedAt: NOW - 1000, expiresAt: NOW + 1000 });
  engine.upsertCredential({ participantId: 'lp-1', credentialType: 'SANCTIONS', status: 'FAILED', issuedAt: NOW - 1000, expiresAt: NOW + 1000 });
  const result = engine.authorize({ participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR', amount: '100' });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.includes('CREDENTIAL_NOT_VALID:SANCTIONS'), true);
  assert.equal(result.reasons.includes('CREDENTIAL_MISSING:AML'), true);
  engine.close();
});

test('blocked jurisdiction disabled type corridor and ticket rules are hard gates', () => {
  const engine = configured();
  addInstitution(engine, { jurisdiction: 'BLOCKED' });
  let result = engine.authorize({ participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR', amount: '100' });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.includes('JURISDICTION_BLOCKED'), true);

  engine.upsertParticipant({ participantId: 'customer-x', participantType: 'CUSTOMER', status: 'ACTIVE', jurisdiction: 'SG' });
  engine.upsertCredential({ participantId: 'customer-x', credentialType: 'KYC', status: 'PASSED', issuedAt: NOW - 1, expiresAt: NOW + 1000 });
  engine.upsertCredential({ participantId: 'customer-x', credentialType: 'SANCTIONS', status: 'PASSED', issuedAt: NOW - 1, expiresAt: NOW + 1000 });
  result = engine.authorize({ participantId: 'customer-x', action: 'TAKE_LIQUIDITY', inputAsset: 'EUR', outputAsset: 'SGD', amount: '6000' });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.includes('CORRIDOR_NOT_ALLOWED'), true);
  assert.equal(result.reasons.includes('TICKET_LIMIT'), true);
  engine.close();
});

test('settlement account must be attributable to the authorized participant', () => {
  const engine = configured();
  addInstitution(engine);
  const result = engine.authorize({
    participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR',
    amount: '100', accountRef: 'wallet:someone-else',
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.includes('ACCOUNT_NOT_ATTRIBUTED'), true);
  engine.close();
});

test('credential or participant change invalidates old authorization', () => {
  const engine = configured();
  addInstitution(engine);
  const decision = engine.authorize({ participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR', amount: '100' });
  assert.equal(engine.verifyAuthorization(decision.authorizationId).valid, true);

  engine.upsertCredential({
    participantId: 'lp-1', credentialType: 'SANCTIONS', status: 'FAILED',
    providerRef: 'provider:SANCTIONS', issuedAt: NOW, expiresAt: NOW + 100_000,
  });
  assert.deepEqual(engine.verifyAuthorization(decision.authorizationId), {
    valid: false, reason: 'PARTICIPANT_CHANGED',
  });
  engine.close();
});

test('policy version change invalidates previously issued authorization', () => {
  const engine = configured();
  addInstitution(engine);
  const decision = engine.authorize({ participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR', amount: '100' });

  engine.configurePolicy({
    policyId: 'bank-fx', version: 2,
    enabledParticipantTypes: ['INSTITUTIONAL_LP'],
    requiredCredentials: { INSTITUTIONAL_LP: ['KYB', 'SANCTIONS', 'AML'] },
    allowedAssets: ['USD', 'EUR'], allowedCorridors: ['USD/EUR'], blockedJurisdictions: [],
    maxTicketByType: { INSTITUTIONAL_LP: '1000000' }, authorizationTtlMs: 60_000,
  });
  assert.deepEqual(engine.verifyAuthorization(decision.authorizationId), {
    valid: false, reason: 'POLICY_CHANGED',
  });
  engine.close();
});

test('credential expiry caps authorization lifetime', () => {
  const engine = configured();
  engine.upsertParticipant({ participantId: 'lp-1', participantType: 'INSTITUTIONAL_LP', status: 'ACTIVE', jurisdiction: 'SG' });
  for (const type of ['KYB', 'SANCTIONS', 'AML']) {
    engine.upsertCredential({ participantId: 'lp-1', credentialType: type, status: 'PASSED', issuedAt: NOW - 10, expiresAt: NOW + 5000 });
  }
  const decision = engine.authorize({ participantId: 'lp-1', action: 'PROVIDE_LIQUIDITY', inputAsset: 'USD', outputAsset: 'EUR', amount: '100' });
  assert.equal(decision.expiresAt, NOW + 5000);
  engine.close();
});
