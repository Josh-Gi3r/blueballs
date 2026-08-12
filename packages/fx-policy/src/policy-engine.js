import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from '../../sqlite-compat/src/index.js';

const PARTICIPANT_TYPES = new Set([
  'CUSTOMER', 'INDIVIDUAL_LP', 'INSTITUTIONAL_LP', 'ISSUER',
  'NEOBANK', 'BANK_TREASURY', 'BANK_PRINCIPAL', 'FIAT_PROVIDER',
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshot(value) {
  return `0x${createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function parseJson(value) {
  return JSON.parse(value);
}

function asAmount(value) {
  const amount = BigInt(String(value));
  if (amount <= 0n) throw new RangeError('amount must be positive');
  return amount;
}

export class FxPolicyEngine {
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
      CREATE TABLE IF NOT EXISTS fx_policy (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        policy_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        policy_json TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fx_participants (
        participant_id TEXT PRIMARY KEY,
        participant_type TEXT NOT NULL,
        status TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        risk_tier TEXT,
        epoch INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS fx_credentials (
        participant_id TEXT NOT NULL REFERENCES fx_participants(participant_id),
        credential_type TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_ref TEXT,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER,
        PRIMARY KEY(participant_id, credential_type)
      );
      CREATE TABLE IF NOT EXISTS fx_accounts (
        account_ref TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL REFERENCES fx_participants(participant_id),
        account_type TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fx_authorizations (
        authorization_id TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL REFERENCES fx_participants(participant_id),
        action TEXT NOT NULL,
        participant_type TEXT NOT NULL,
        input_asset TEXT NOT NULL,
        output_asset TEXT NOT NULL,
        max_amount TEXT NOT NULL,
        participant_epoch INTEGER NOT NULL,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        policy_snapshot_hash TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        decision_snapshot_json TEXT NOT NULL
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

  configurePolicy(policy) {
    if (!policy || typeof policy !== 'object') throw new TypeError('policy required');
    if (typeof policy.policyId !== 'string' || !policy.policyId) throw new TypeError('policyId required');
    if (!Number.isSafeInteger(policy.version) || policy.version <= 0) throw new RangeError('policy version invalid');
    if (!Number.isSafeInteger(policy.authorizationTtlMs) || policy.authorizationTtlMs <= 0) {
      throw new RangeError('authorizationTtlMs invalid');
    }
    const normalized = {
      policyId: policy.policyId,
      version: policy.version,
      enabledParticipantTypes: [...new Set(policy.enabledParticipantTypes ?? [])].sort(),
      requiredCredentials: policy.requiredCredentials ?? {},
      allowedAssets: [...new Set(policy.allowedAssets ?? [])].sort(),
      allowedCorridors: [...new Set(policy.allowedCorridors ?? [])].sort(),
      blockedJurisdictions: [...new Set(policy.blockedJurisdictions ?? [])].sort(),
      maxTicketByType: policy.maxTicketByType ?? {},
      authorizationTtlMs: policy.authorizationTtlMs,
    };
    for (const type of normalized.enabledParticipantTypes) {
      if (!PARTICIPANT_TYPES.has(type)) throw new RangeError(`unsupported participant type: ${type}`);
    }
    const snapshotHash = hashSnapshot(normalized);
    this.db.prepare(`
      INSERT INTO fx_policy(singleton, policy_id, version, policy_json, snapshot_hash)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        policy_id = excluded.policy_id,
        version = excluded.version,
        policy_json = excluded.policy_json,
        snapshot_hash = excluded.snapshot_hash
    `).run(normalized.policyId, normalized.version, canonical(normalized), snapshotHash);
    return { ...normalized, snapshotHash };
  }

  currentPolicy() {
    const row = this.db.prepare('SELECT * FROM fx_policy WHERE singleton = 1').get();
    if (!row) throw new Error('FX policy not configured');
    return { ...parseJson(row.policy_json), snapshotHash: row.snapshot_hash };
  }

  upsertParticipant({ participantId, participantType, status = 'ACTIVE', jurisdiction, riskTier = null }) {
    if (typeof participantId !== 'string' || !participantId) throw new TypeError('participantId required');
    if (!PARTICIPANT_TYPES.has(participantType)) throw new RangeError('participantType invalid');
    if (!['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) throw new RangeError('participant status invalid');
    if (typeof jurisdiction !== 'string' || !jurisdiction) throw new TypeError('jurisdiction required');

    return this.#transaction(() => {
      const existing = this.db.prepare('SELECT * FROM fx_participants WHERE participant_id = ?').get(participantId);
      const changed = existing && (
        existing.participant_type !== participantType || existing.status !== status ||
        existing.jurisdiction !== jurisdiction || existing.risk_tier !== riskTier
      );
      const epoch = existing ? Number(existing.epoch) + (changed ? 1 : 0) : 1;
      this.db.prepare(`
        INSERT INTO fx_participants(participant_id, participant_type, status, jurisdiction, risk_tier, epoch)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_id) DO UPDATE SET
          participant_type = excluded.participant_type,
          status = excluded.status,
          jurisdiction = excluded.jurisdiction,
          risk_tier = excluded.risk_tier,
          epoch = excluded.epoch
      `).run(participantId, participantType, status, jurisdiction, riskTier, epoch);
      return this.getParticipant(participantId);
    });
  }

  getParticipant(participantId) {
    const row = this.db.prepare('SELECT * FROM fx_participants WHERE participant_id = ?').get(participantId);
    return row ? {
      participantId: row.participant_id,
      participantType: row.participant_type,
      status: row.status,
      jurisdiction: row.jurisdiction,
      riskTier: row.risk_tier,
      epoch: Number(row.epoch),
    } : null;
  }

  upsertCredential({ participantId, credentialType, status, providerRef = null, issuedAt, expiresAt = null }) {
    if (!this.getParticipant(participantId)) throw new Error('participant not found');
    if (typeof credentialType !== 'string' || !credentialType) throw new TypeError('credentialType required');
    if (!['PASSED', 'FAILED', 'PENDING', 'EXPIRED'].includes(status)) throw new RangeError('credential status invalid');
    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new RangeError('issuedAt invalid');
    if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt)) {
      throw new RangeError('expiresAt invalid');
    }
    return this.#transaction(() => {
      const previous = this.db.prepare(
        'SELECT * FROM fx_credentials WHERE participant_id = ? AND credential_type = ?',
      ).get(participantId, credentialType);
      const next = { status, providerRef, issuedAt, expiresAt };
      const changed = !previous || previous.status !== status || previous.provider_ref !== providerRef ||
        previous.issued_at !== issuedAt || previous.expires_at !== expiresAt;
      this.db.prepare(`
        INSERT INTO fx_credentials(participant_id, credential_type, status, provider_ref, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_id, credential_type) DO UPDATE SET
          status = excluded.status,
          provider_ref = excluded.provider_ref,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at
      `).run(participantId, credentialType, status, providerRef, issuedAt, expiresAt);
      if (changed) this.#bumpParticipantEpoch(participantId);
      return next;
    });
  }

  mapAccount({ participantId, accountRef, accountType = 'WALLET' }) {
    if (!this.getParticipant(participantId)) throw new Error('participant not found');
    if (typeof accountRef !== 'string' || !accountRef) throw new TypeError('accountRef required');
    return this.#transaction(() => {
      const previous = this.db.prepare('SELECT * FROM fx_accounts WHERE account_ref = ?').get(accountRef);
      if (previous && previous.participant_id !== participantId) {
        throw new Error('account already attributed to another participant');
      }
      this.db.prepare(`
        INSERT INTO fx_accounts(account_ref, participant_id, account_type)
        VALUES (?, ?, ?)
        ON CONFLICT(account_ref) DO UPDATE SET account_type = excluded.account_type
      `).run(accountRef, participantId, accountType);
      if (!previous) this.#bumpParticipantEpoch(participantId);
    });
  }

  #bumpParticipantEpoch(participantId) {
    this.db.prepare('UPDATE fx_participants SET epoch = epoch + 1 WHERE participant_id = ?').run(participantId);
  }

  #credential(participantId, credentialType) {
    return this.db.prepare(
      'SELECT * FROM fx_credentials WHERE participant_id = ? AND credential_type = ?',
    ).get(participantId, credentialType);
  }

  authorize({ participantId, action, inputAsset, outputAsset, amount, accountRef = null }) {
    const now = this.now();
    const participant = this.getParticipant(participantId);
    const policy = this.currentPolicy();
    const reasons = [];
    const requested = asAmount(amount);

    if (!participant) reasons.push('PARTICIPANT_NOT_FOUND');
    if (participant?.status !== 'ACTIVE') reasons.push('PARTICIPANT_NOT_ACTIVE');
    if (participant && !policy.enabledParticipantTypes.includes(participant.participantType)) reasons.push('PARTICIPANT_TYPE_DISABLED');
    if (participant && policy.blockedJurisdictions.includes(participant.jurisdiction)) reasons.push('JURISDICTION_BLOCKED');
    if (!policy.allowedAssets.includes(inputAsset) || !policy.allowedAssets.includes(outputAsset)) reasons.push('ASSET_NOT_ALLOWED');
    if (!policy.allowedCorridors.includes(`${inputAsset}/${outputAsset}`)) reasons.push('CORRIDOR_NOT_ALLOWED');

    let maxTicket = null;
    if (participant) {
      const rawMax = policy.maxTicketByType[participant.participantType];
      if (rawMax == null) reasons.push('MAX_TICKET_NOT_CONFIGURED');
      else {
        maxTicket = BigInt(String(rawMax));
        if (requested > maxTicket) reasons.push('TICKET_LIMIT');
      }
    }

    const credentialsUsed = [];
    let credentialExpiry = null;
    if (participant) {
      for (const type of policy.requiredCredentials[participant.participantType] ?? []) {
        const credential = this.#credential(participantId, type);
        if (!credential) {
          reasons.push(`CREDENTIAL_MISSING:${type}`);
          continue;
        }
        const expired = credential.expires_at !== null && credential.expires_at <= now;
        if (credential.status !== 'PASSED' || expired) {
          reasons.push(`CREDENTIAL_NOT_VALID:${type}`);
          continue;
        }
        credentialsUsed.push({ type, providerRef: credential.provider_ref, expiresAt: credential.expires_at });
        if (credential.expires_at !== null) {
          credentialExpiry = credentialExpiry === null
            ? credential.expires_at
            : Math.min(credentialExpiry, credential.expires_at);
        }
      }
    }

    if (accountRef !== null) {
      const mapping = this.db.prepare('SELECT participant_id FROM fx_accounts WHERE account_ref = ?').get(accountRef);
      if (!mapping || mapping.participant_id !== participantId) reasons.push('ACCOUNT_NOT_ATTRIBUTED');
    }

    if (reasons.length > 0) return { eligible: false, reasons: [...new Set(reasons)] };

    const expiresAt = Math.min(now + policy.authorizationTtlMs, credentialExpiry ?? Number.MAX_SAFE_INTEGER);
    const snapshot = {
      participantId,
      participantType: participant.participantType,
      participantEpoch: participant.epoch,
      jurisdiction: participant.jurisdiction,
      riskTier: participant.riskTier,
      action,
      inputAsset,
      outputAsset,
      amount: requested.toString(),
      accountRef,
      credentialsUsed,
      policyId: policy.policyId,
      policyVersion: policy.version,
      policySnapshotHash: policy.snapshotHash,
    };
    const decisionSnapshotHash = hashSnapshot(snapshot);
    const authorizationId = randomUUID();
    this.db.prepare(`
      INSERT INTO fx_authorizations(
        authorization_id, participant_id, action, participant_type, input_asset, output_asset,
        max_amount, participant_epoch, policy_id, policy_version, policy_snapshot_hash,
        issued_at, expires_at, decision_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      authorizationId, participantId, action, participant.participantType, inputAsset, outputAsset,
      requested.toString(), participant.epoch, policy.policyId, policy.version, decisionSnapshotHash,
      now, expiresAt, canonical(snapshot),
    );
    return {
      eligible: true,
      authorizationId,
      participantId,
      participantType: participant.participantType,
      action,
      inputAsset,
      outputAsset,
      maxAmount: requested.toString(),
      participantEpoch: participant.epoch,
      policyId: policy.policyId,
      policyVersion: policy.version,
      policySnapshotHash: decisionSnapshotHash,
      issuedAt: now,
      expiresAt,
    };
  }

  verifyAuthorization(authorizationId) {
    const row = this.db.prepare('SELECT * FROM fx_authorizations WHERE authorization_id = ?').get(authorizationId);
    if (!row) return { valid: false, reason: 'NOT_FOUND' };
    if (row.revoked) return { valid: false, reason: 'REVOKED' };
    if (row.expires_at <= this.now()) return { valid: false, reason: 'EXPIRED' };
    const participant = this.getParticipant(row.participant_id);
    if (!participant || participant.status !== 'ACTIVE') return { valid: false, reason: 'PARTICIPANT_NOT_ACTIVE' };
    if (participant.epoch !== row.participant_epoch) return { valid: false, reason: 'PARTICIPANT_CHANGED' };
    const policy = this.currentPolicy();
    if (policy.policyId !== row.policy_id || policy.version !== row.policy_version) {
      return { valid: false, reason: 'POLICY_CHANGED' };
    }
    return { valid: true, authorizationId };
  }

  revokeAuthorization(authorizationId) {
    const result = this.db.prepare('UPDATE fx_authorizations SET revoked = 1 WHERE authorization_id = ? AND revoked = 0').run(authorizationId);
    return Number(result.changes) === 1;
  }
}
