import { createHash } from 'node:crypto';

const FINALITY = new Set(['ATOMIC', 'AUTHORITATIVE_LEDGER', 'ATTESTED_EXTERNAL', 'ASYNC_EXTERNAL']);
const EDGE_TYPES = new Set([
  'TOKEN_SWAP', 'ISSUER_MINT', 'ISSUER_REDEEM', 'VERIFIED_FIAT_PAYMENT', 'INTERNAL_LEDGER', 'BANK_RAIL',
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} required`);
  return value;
}

export function normalizeFiatIntent(intent) {
  if (!intent || typeof intent !== 'object') throw new TypeError('intent required');
  if (!EDGE_TYPES.has(intent.edgeType)) throw new RangeError('edgeType invalid');
  if (!FINALITY.has(intent.finalityClass)) throw new RangeError('finalityClass invalid');
  const amount = BigInt(String(intent.amount));
  if (amount <= 0n) throw new RangeError('amount must be positive');
  if (!Number.isSafeInteger(intent.createdAt) || intent.createdAt < 0) throw new RangeError('createdAt invalid');
  if (!Number.isSafeInteger(intent.expiresAt) || intent.expiresAt <= intent.createdAt) throw new RangeError('expiresAt invalid');

  return {
    intentId: requiredString(intent.intentId, 'intentId'),
    routeId: requiredString(intent.routeId, 'routeId'),
    edgeId: requiredString(intent.edgeId, 'edgeId'),
    edgeType: intent.edgeType,
    finalityClass: intent.finalityClass,
    payerParticipantId: requiredString(intent.payerParticipantId, 'payerParticipantId'),
    payeeParticipantId: requiredString(intent.payeeParticipantId, 'payeeParticipantId'),
    payerAccountRef: requiredString(intent.payerAccountRef, 'payerAccountRef'),
    payeeAccountRef: requiredString(intent.payeeAccountRef, 'payeeAccountRef'),
    currency: requiredString(intent.currency, 'currency'),
    amount: amount.toString(),
    rail: requiredString(intent.rail, 'rail'),
    providerId: requiredString(intent.providerId, 'providerId'),
    policyAuthorizationId: requiredString(intent.policyAuthorizationId, 'policyAuthorizationId'),
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    nonce: requiredString(String(intent.nonce), 'nonce'),
  };
}

export function hashFiatIntent(intent) {
  const normalized = normalizeFiatIntent(intent);
  return `0x${createHash('sha256').update(canonical(normalized)).digest('hex')}`;
}

export { EDGE_TYPES, FINALITY };
