import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from '../../sqlite-compat/src/index.js';

import { hashFiatIntent, normalizeFiatIntent } from './intent.js';

const INTENT_STATES = new Set([
  'CREATED', 'RESERVED', 'SUBMITTED', 'PAYMENT_OBSERVED', 'VERIFIED', 'SETTLED',
  'CANCELLED', 'EXPIRED', 'FAILED', 'MANUAL_REVIEW',
]);

function hashRef(value) {
  return `0x${createHash('sha256').update(String(value)).digest('hex')}`;
}

function parseJson(value) {
  return JSON.parse(value);
}

function rowToIntent(row) {
  if (!row) return null;
  return {
    ...parseJson(row.intent_json),
    intentHash: row.intent_hash,
    state: row.state,
    submissionRef: row.submission_ref,
    paymentObservedAt: row.payment_observed_at,
    attestationId: row.attestation_id,
    settledAt: row.settled_at,
    failureReason: row.failure_reason,
  };
}

export class FiatSettlementStore {
  constructor({ path = ':memory:', now = () => Date.now() } = {}) {
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  close() { this.db.close(); }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fiat_verifiers (
        verifier_id TEXT PRIMARY KEY,
        verifier_type TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fiat_intents (
        intent_id TEXT PRIMARY KEY,
        intent_hash TEXT NOT NULL UNIQUE,
        route_id TEXT NOT NULL,
        edge_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount TEXT NOT NULL,
        payer_ref_hash TEXT NOT NULL,
        payee_ref_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        state TEXT NOT NULL,
        intent_json TEXT NOT NULL,
        submission_ref TEXT,
        payment_observed_at INTEGER,
        attestation_id TEXT,
        settled_at INTEGER,
        failure_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_fiat_intents_route ON fiat_intents(route_id, state);
      CREATE TABLE IF NOT EXISTS fiat_attestations (
        attestation_id TEXT PRIMARY KEY,
        verifier_id TEXT NOT NULL REFERENCES fiat_verifiers(verifier_id),
        intent_id TEXT NOT NULL REFERENCES fiat_intents(intent_id),
        intent_hash TEXT NOT NULL,
        payment_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount TEXT NOT NULL,
        payer_ref_hash TEXT NOT NULL,
        payee_ref_hash TEXT NOT NULL,
        settled_at INTEGER NOT NULL,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        proof_ref TEXT,
        payload_json TEXT NOT NULL,
        UNIQUE(verifier_id, payment_id)
      );
      CREATE TABLE IF NOT EXISTS fiat_events (
        event_id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);
  }

  #transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  registerVerifier({ verifierId, verifierType, enabled = true, metadata = {} }) {
    if (typeof verifierId !== 'string' || verifierId.length === 0) throw new TypeError('verifierId required');
    if (typeof verifierType !== 'string' || verifierType.length === 0) throw new TypeError('verifierType required');
    this.db.prepare(`
      INSERT INTO fiat_verifiers(verifier_id, verifier_type, enabled, metadata_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(verifier_id) DO UPDATE SET
        verifier_type = excluded.verifier_type,
        enabled = excluded.enabled,
        metadata_json = excluded.metadata_json
    `).run(verifierId, verifierType, enabled ? 1 : 0, JSON.stringify(metadata));
  }

  setVerifierEnabled(verifierId, enabled) {
    const result = this.db.prepare('UPDATE fiat_verifiers SET enabled = ? WHERE verifier_id = ?')
      .run(enabled ? 1 : 0, verifierId);
    if (Number(result.changes) !== 1) throw new Error('verifier not found');
  }

  createIntent(intent) {
    const normalized = normalizeFiatIntent(intent);
    const intentHash = hashFiatIntent(normalized);
    if (normalized.expiresAt <= this.now()) throw new Error('intent already expired');

    return this.#transaction(() => {
      const existing = this.db.prepare('SELECT * FROM fiat_intents WHERE intent_id = ?').get(normalized.intentId);
      if (existing) {
        if (existing.intent_hash !== intentHash) throw new Error('intentId already exists with different payload');
        return rowToIntent(existing);
      }
      this.db.prepare(`
        INSERT INTO fiat_intents(
          intent_id, intent_hash, route_id, edge_id, provider_id, currency, amount,
          payer_ref_hash, payee_ref_hash, expires_at, state, intent_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', ?)
      `).run(
        normalized.intentId, intentHash, normalized.routeId, normalized.edgeId,
        normalized.providerId, normalized.currency, normalized.amount,
        hashRef(normalized.payerAccountRef), hashRef(normalized.payeeAccountRef),
        normalized.expiresAt, JSON.stringify(normalized),
      );
      return this.getIntent(normalized.intentId);
    });
  }

  getIntent(intentId) {
    return rowToIntent(this.db.prepare('SELECT * FROM fiat_intents WHERE intent_id = ?').get(intentId));
  }

  #transition(intentId, fromStates, toState, updates = {}) {
    if (!INTENT_STATES.has(toState)) throw new RangeError('invalid target state');
    return this.#transaction(() => {
      const row = this.db.prepare('SELECT * FROM fiat_intents WHERE intent_id = ?').get(intentId);
      if (!row) throw new Error('intent not found');
      if (!fromStates.includes(row.state)) throw new Error(`cannot transition ${row.state} to ${toState}`);
      if (row.expires_at <= this.now() && !['EXPIRED', 'FAILED'].includes(toState)) throw new Error('intent expired');

      const fields = ['state = ?'];
      const values = [toState];
      const mapping = {
        submissionRef: 'submission_ref', paymentObservedAt: 'payment_observed_at',
        attestationId: 'attestation_id', settledAt: 'settled_at', failureReason: 'failure_reason',
      };
      for (const [key, value] of Object.entries(updates)) {
        const column = mapping[key];
        if (!column) throw new Error(`unsupported transition field: ${key}`);
        fields.push(`${column} = ?`);
        values.push(value);
      }
      values.push(intentId);
      this.db.prepare(`UPDATE fiat_intents SET ${fields.join(', ')} WHERE intent_id = ?`).run(...values);
      return this.getIntent(intentId);
    });
  }

  reserveIntent(intentId) { return this.#transition(intentId, ['CREATED'], 'RESERVED'); }

  submitIntent(intentId, submissionRef) {
    if (typeof submissionRef !== 'string' || submissionRef.length === 0) throw new TypeError('submissionRef required');
    return this.#transition(intentId, ['RESERVED'], 'SUBMITTED', { submissionRef });
  }

  observePayment(intentId, observedAt = this.now()) {
    if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new RangeError('observedAt invalid');
    return this.#transition(intentId, ['SUBMITTED'], 'PAYMENT_OBSERVED', { paymentObservedAt: observedAt });
  }

  cancelIntent(intentId) { return this.#transition(intentId, ['CREATED', 'RESERVED'], 'CANCELLED'); }

  expireIntents(now = this.now()) {
    const result = this.db.prepare(`
      UPDATE fiat_intents SET state = 'EXPIRED'
      WHERE state IN ('CREATED', 'RESERVED') AND expires_at <= ?
    `).run(now);
    return Number(result.changes);
  }

  failIntent(intentId, reason) {
    if (typeof reason !== 'string' || reason.length === 0) throw new TypeError('reason required');
    return this.#transition(intentId, ['SUBMITTED', 'PAYMENT_OBSERVED', 'VERIFIED'], 'FAILED', { failureReason: reason });
  }

  manualReview(intentId, reason) {
    if (typeof reason !== 'string' || reason.length === 0) throw new TypeError('reason required');
    return this.#transition(intentId, ['SUBMITTED', 'PAYMENT_OBSERVED', 'VERIFIED'], 'MANUAL_REVIEW', { failureReason: reason });
  }

  acceptAttestation(attestation) {
    if (!attestation || typeof attestation !== 'object') throw new TypeError('attestation required');
    const now = this.now();
    const verifier = this.db.prepare('SELECT * FROM fiat_verifiers WHERE verifier_id = ?').get(attestation.verifierId);
    if (!verifier || !verifier.enabled) throw new Error('verifier not enabled');

    const suppliedId = attestation.attestationId ?? null;
    if (suppliedId) {
      const prior = this.db.prepare('SELECT * FROM fiat_attestations WHERE attestation_id = ?').get(suppliedId);
      if (prior) {
        if (prior.intent_id === attestation.intentId && prior.payment_id === attestation.paymentId) {
          return { duplicate: true, attestationId: suppliedId };
        }
        throw new Error('attestationId collision');
      }
    }

    return this.#transaction(() => {
      const intent = this.db.prepare('SELECT * FROM fiat_intents WHERE intent_id = ?').get(attestation.intentId);
      if (!intent) throw new Error('intent not found');
      if (!['SUBMITTED', 'PAYMENT_OBSERVED'].includes(intent.state)) {
        throw new Error(`intent cannot accept attestation from ${intent.state}`);
      }
      if (intent.expires_at <= now) throw new Error('intent expired');
      if (attestation.intentHash !== intent.intent_hash) throw new Error('intent hash mismatch');
      if (String(attestation.currency) !== intent.currency) throw new Error('currency mismatch');
      if (BigInt(String(attestation.amount)) !== BigInt(intent.amount)) throw new Error('amount mismatch');
      if (attestation.payerRefHash !== intent.payer_ref_hash) throw new Error('payer mismatch');
      if (attestation.payeeRefHash !== intent.payee_ref_hash) throw new Error('payee mismatch');
      if (typeof attestation.paymentId !== 'string' || attestation.paymentId.length === 0) throw new TypeError('paymentId required');
      if (!Number.isSafeInteger(attestation.settledAt) || attestation.settledAt < 0) throw new RangeError('settledAt invalid');
      if (!Number.isSafeInteger(attestation.issuedAt) || attestation.issuedAt < attestation.settledAt) throw new RangeError('issuedAt invalid');
      if (!Number.isSafeInteger(attestation.expiresAt) || attestation.expiresAt <= now) throw new Error('attestation expired');
      if (attestation.status !== 'VERIFIED') throw new Error('attestation is not verified');

      const paymentReplay = this.db
        .prepare('SELECT intent_id FROM fiat_attestations WHERE verifier_id = ? AND payment_id = ?')
        .get(attestation.verifierId, attestation.paymentId);
      if (paymentReplay) {
        const error = new Error('paymentId already used');
        error.code = 'PAYMENT_REPLAY';
        throw error;
      }

      const attestationId = suppliedId ?? randomUUID();
      this.db.prepare(`
        INSERT INTO fiat_attestations(
          attestation_id, verifier_id, intent_id, intent_hash, payment_id, currency, amount,
          payer_ref_hash, payee_ref_hash, settled_at, issued_at, expires_at, status, proof_ref, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        attestationId, attestation.verifierId, intent.intent_id, intent.intent_hash,
        attestation.paymentId, intent.currency, intent.amount, intent.payer_ref_hash,
        intent.payee_ref_hash, attestation.settledAt, attestation.issuedAt,
        attestation.expiresAt, attestation.status, attestation.proofRef ?? null,
        JSON.stringify(attestation),
      );
      this.db.prepare("UPDATE fiat_intents SET state = 'VERIFIED', attestation_id = ? WHERE intent_id = ?")
        .run(attestationId, intent.intent_id);
      return { duplicate: false, attestationId };
    });
  }

  settleVerifiedIntent(intentId, eventId = randomUUID()) {
    return this.#transaction(() => {
      const prior = this.db.prepare('SELECT event_id FROM fiat_events WHERE event_id = ?').get(eventId);
      if (prior) return { duplicate: true };
      const intent = this.db.prepare('SELECT * FROM fiat_intents WHERE intent_id = ?').get(intentId);
      if (!intent) throw new Error('intent not found');
      if (intent.state !== 'VERIFIED') throw new Error('intent must be VERIFIED before settlement');
      this.db.prepare("UPDATE fiat_intents SET state = 'SETTLED', settled_at = ? WHERE intent_id = ?")
        .run(this.now(), intentId);
      this.db.prepare('INSERT INTO fiat_events(event_id, intent_id, kind, created_at, payload_json) VALUES (?, ?, ?, ?, ?)')
        .run(eventId, intentId, 'SETTLED', this.now(), '{}');
      return { duplicate: false };
    });
  }
}

export { hashRef, INTENT_STATES };
