import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const STATIC_SOURCE_TYPES = new Set([
  'ISSUER',
  'INSTITUTIONAL_LP',
  'NEOBANK',
  'BANK_TREASURY',
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} required`);
  return value;
}

function positiveBigInt(value, field) {
  const parsed = BigInt(String(value));
  if (parsed <= 0n) throw new RangeError(`${field} must be positive`);
  return parsed;
}

function nonNegativeBigInt(value, field) {
  const parsed = BigInt(String(value));
  if (parsed < 0n) throw new RangeError(`${field} must be non-negative`);
  return parsed;
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function parseJson(value) {
  return JSON.parse(value);
}

function rowToReservation(row) {
  if (!row) return null;
  return {
    reservationHandle: row.reservation_handle,
    routeId: row.route_id,
    sliceId: row.slice_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    inputAmount: row.input_amount,
    outputAmount: row.output_amount,
    state: row.state,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    submissionRef: row.submission_ref,
    eventId: row.event_id,
    reason: row.reason,
  };
}

/**
 * Durable reference inventory for non-orderbook liquidity.
 *
 * Real issuer, LP, neobank and treasury integrations replace this class with
 * provider adapters. The reference runtime uses it to exercise the exact same
 * planner/reservation lifecycle without depending on a commercial provider.
 */
export class ReferenceLiquidityBook {
  constructor({ path = ':memory:', now = () => Date.now(), authorizationVerifier = null } = {}) {
    if (authorizationVerifier !== null && typeof authorizationVerifier !== 'function') {
      throw new TypeError('authorizationVerifier must be a function');
    }
    this.now = now;
    this.authorizationVerifier = authorizationVerifier;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reference_liquidity (
        slice_id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        input_asset TEXT NOT NULL,
        output_asset TEXT NOT NULL,
        max_output TEXT NOT NULL,
        reserved_output TEXT NOT NULL DEFAULT '0',
        input_numerator TEXT NOT NULL,
        input_denominator TEXT NOT NULL,
        policy_authorization_id TEXT NOT NULL,
        policy_snapshot_hash TEXT,
        account_ref TEXT,
        expires_at INTEGER NOT NULL,
        online INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reference_liquidity_pair
        ON reference_liquidity(input_asset, output_asset, online, expires_at);

      CREATE TABLE IF NOT EXISTS reference_liquidity_reservations (
        reservation_handle TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        leg_index INTEGER NOT NULL,
        slice_id TEXT NOT NULL REFERENCES reference_liquidity(slice_id),
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        input_amount TEXT NOT NULL,
        output_amount TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        submission_ref TEXT,
        event_id TEXT,
        reason TEXT,
        UNIQUE(route_id, leg_index)
      );
      CREATE INDEX IF NOT EXISTS idx_reference_reservation_state
        ON reference_liquidity_reservations(state, expires_at);
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

  #verifyAuthorization(slice, amount) {
    if (!this.authorizationVerifier) return { valid: true };
    return this.authorizationVerifier(slice.policy_authorization_id, {
      inputAsset: slice.input_asset,
      outputAsset: slice.output_asset,
      amount: String(amount),
      accountRef: slice.account_ref,
      policySnapshotHash: slice.policy_snapshot_hash,
    });
  }

  close() {
    this.db.close();
  }

  upsertSlice(slice) {
    if (!slice || typeof slice !== 'object') throw new TypeError('slice required');
    if (!STATIC_SOURCE_TYPES.has(slice.sourceType)) {
      throw new RangeError(`unsupported reference source type: ${slice.sourceType}`);
    }
    const normalized = {
      sliceId: requiredString(slice.sliceId, 'sliceId'),
      sourceType: slice.sourceType,
      sourceId: requiredString(slice.sourceId, 'sourceId'),
      inputAsset: requiredString(slice.inputAsset, 'inputAsset'),
      outputAsset: requiredString(slice.outputAsset, 'outputAsset'),
      maxOutput: positiveBigInt(slice.maxOutput, 'maxOutput').toString(),
      inputNumerator: positiveBigInt(slice.inputNumerator, 'inputNumerator').toString(),
      inputDenominator: positiveBigInt(slice.inputDenominator, 'inputDenominator').toString(),
      policyAuthorizationId: requiredString(slice.policyAuthorizationId, 'policyAuthorizationId'),
      policySnapshotHash: slice.policySnapshotHash ?? null,
      accountRef: slice.accountRef ?? null,
      expiresAt: Number(slice.expiresAt),
      online: slice.online !== false,
      metadata: slice.metadata ?? {},
    };
    if (normalized.inputAsset === normalized.outputAsset) {
      throw new RangeError('inputAsset and outputAsset must differ');
    }
    if (!Number.isSafeInteger(normalized.expiresAt) || normalized.expiresAt <= this.now()) {
      throw new RangeError('expiresAt must be a future millisecond timestamp');
    }

    this.db.prepare(`
      INSERT INTO reference_liquidity(
        slice_id, source_type, source_id, input_asset, output_asset, max_output,
        reserved_output, input_numerator, input_denominator, policy_authorization_id,
        policy_snapshot_hash, account_ref, expires_at, online, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slice_id) DO UPDATE SET
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        input_asset = excluded.input_asset,
        output_asset = excluded.output_asset,
        max_output = excluded.max_output,
        input_numerator = excluded.input_numerator,
        input_denominator = excluded.input_denominator,
        policy_authorization_id = excluded.policy_authorization_id,
        policy_snapshot_hash = excluded.policy_snapshot_hash,
        account_ref = excluded.account_ref,
        expires_at = excluded.expires_at,
        online = excluded.online,
        metadata_json = excluded.metadata_json
    `).run(
      normalized.sliceId,
      normalized.sourceType,
      normalized.sourceId,
      normalized.inputAsset,
      normalized.outputAsset,
      normalized.maxOutput,
      normalized.inputNumerator,
      normalized.inputDenominator,
      normalized.policyAuthorizationId,
      normalized.policySnapshotHash,
      normalized.accountRef,
      normalized.expiresAt,
      normalized.online ? 1 : 0,
      JSON.stringify(normalized.metadata),
    );
    return this.getSlice(normalized.sliceId);
  }

  getSlice(sliceId) {
    const row = this.db.prepare('SELECT * FROM reference_liquidity WHERE slice_id = ?').get(sliceId);
    if (!row) return null;
    return {
      sliceId: row.slice_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      inputAsset: row.input_asset,
      outputAsset: row.output_asset,
      maxOutput: row.max_output,
      reservedOutput: row.reserved_output,
      inputNumerator: row.input_numerator,
      inputDenominator: row.input_denominator,
      policyAuthorizationId: row.policy_authorization_id,
      policySnapshotHash: row.policy_snapshot_hash,
      accountRef: row.account_ref,
      expiresAt: row.expires_at,
      online: Boolean(row.online),
      metadata: parseJson(row.metadata_json),
    };
  }

  setOnline(sliceId, online) {
    const result = this.db
      .prepare('UPDATE reference_liquidity SET online = ? WHERE slice_id = ?')
      .run(online ? 1 : 0, sliceId);
    if (Number(result.changes) !== 1) throw new Error('reference liquidity slice not found');
  }

  listSlices({ inputAsset, outputAsset }) {
    const now = this.now();
    const rows = this.db.prepare(`
      SELECT * FROM reference_liquidity
      WHERE input_asset = ? AND output_asset = ? AND online = 1 AND expires_at > ?
      ORDER BY source_type, source_id, slice_id
    `).all(inputAsset, outputAsset, now);

    const slices = [];
    for (const row of rows) {
      const available = nonNegativeBigInt(row.max_output, 'max_output')
        - nonNegativeBigInt(row.reserved_output, 'reserved_output');
      if (available <= 0n) continue;
      const verification = this.#verifyAuthorization(row, available);
      if (!verification || verification.valid !== true) continue;
      slices.push({
        sourceType: row.source_type,
        sourceId: row.source_id,
        sliceId: row.slice_id,
        inputAsset: row.input_asset,
        outputAsset: row.output_asset,
        maxOutput: available.toString(),
        inputNumerator: row.input_numerator,
        inputDenominator: row.input_denominator,
        policyAuthorizationId: row.policy_authorization_id,
        policySnapshotHash: row.policy_snapshot_hash,
        expiresAt: row.expires_at,
        reservationPayload: {
          accountRef: row.account_ref,
          metadata: parseJson(row.metadata_json),
        },
      });
    }
    return slices;
  }

  reserve({ routeId, leg, index }) {
    if (!leg || !STATIC_SOURCE_TYPES.has(leg.sourceType)) {
      throw new TypeError('static reference liquidity leg required');
    }
    if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('leg index invalid');
    const output = positiveBigInt(leg.outputAmount, 'leg.outputAmount');

    return this.#transaction(() => {
      const row = this.db.prepare('SELECT * FROM reference_liquidity WHERE slice_id = ?').get(leg.sliceId);
      if (!row) throw new Error('reference liquidity slice not found');
      if (!row.online || row.expires_at <= this.now()) throw new Error('reference liquidity unavailable');
      if (
        row.source_type !== leg.sourceType || row.source_id !== leg.sourceId
        || row.input_asset !== leg.inputAsset || row.output_asset !== leg.outputAsset
      ) {
        throw new Error('reference liquidity leg does not match source');
      }

      const verification = this.#verifyAuthorization(row, output);
      if (!verification || verification.valid !== true) {
        const error = new Error(`reference liquidity authorization invalid: ${verification?.reason ?? 'INVALID'}`);
        error.code = 'POLICY_AUTHORIZATION_INVALID';
        throw error;
      }

      const maxOutput = BigInt(row.max_output);
      const reserved = BigInt(row.reserved_output);
      if (maxOutput - reserved < output) throw new Error('reference liquidity capacity changed');

      const input = ceilDiv(
        output * BigInt(row.input_numerator),
        BigInt(row.input_denominator),
      );
      if (input > BigInt(leg.inputAmount)) throw new Error('reference liquidity price changed');

      const reservationHandle = `ref_${randomUUID()}`;
      this.db.prepare(`
        INSERT INTO reference_liquidity_reservations(
          reservation_handle, route_id, leg_index, slice_id, source_type, source_id,
          input_amount, output_amount, state, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        reservationHandle,
        routeId,
        index,
        row.slice_id,
        row.source_type,
        row.source_id,
        input.toString(),
        output.toString(),
        this.now(),
        leg.expiresAt,
      );
      this.db
        .prepare('UPDATE reference_liquidity SET reserved_output = ? WHERE slice_id = ?')
        .run((reserved + output).toString(), row.slice_id);

      return { reservationHandle };
    });
  }

  getReservation(reservationHandle) {
    return rowToReservation(
      this.db
        .prepare('SELECT * FROM reference_liquidity_reservations WHERE reservation_handle = ?')
        .get(reservationHandle),
    );
  }

  validateReserved({ reservationHandle }) {
    const reservation = this.getReservation(reservationHandle);
    if (!reservation) throw new Error('reference reservation not found');
    if (!['ACTIVE', 'SUBMITTED'].includes(reservation.state)) {
      throw new Error(`reference reservation is ${reservation.state}`);
    }
    if (reservation.expiresAt <= this.now() && reservation.state === 'ACTIVE') {
      throw new Error('reference reservation expired');
    }
    const row = this.db.prepare('SELECT * FROM reference_liquidity WHERE slice_id = ?').get(reservation.sliceId);
    if (!row || !row.online) throw new Error('reference source is offline');
    const verification = this.#verifyAuthorization(row, BigInt(reservation.outputAmount));
    if (!verification || verification.valid !== true) {
      const error = new Error(`reference liquidity authorization invalid: ${verification?.reason ?? 'INVALID'}`);
      error.code = 'POLICY_AUTHORIZATION_INVALID';
      throw error;
    }
    return reservation;
  }

  markSubmitted({ reservationHandle, submissionRef }) {
    requiredString(submissionRef, 'submissionRef');
    return this.#transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM reference_liquidity_reservations WHERE reservation_handle = ?')
        .get(reservationHandle);
      if (!row) throw new Error('reference reservation not found');
      if (row.state === 'SUBMITTED' && row.submission_ref === submissionRef) return rowToReservation(row);
      if (row.state !== 'ACTIVE') throw new Error(`reference reservation cannot submit from ${row.state}`);
      if (row.expires_at <= this.now()) throw new Error('reference reservation expired');
      this.db.prepare(`
        UPDATE reference_liquidity_reservations
        SET state = 'SUBMITTED', submission_ref = ?
        WHERE reservation_handle = ?
      `).run(submissionRef, reservationHandle);
      return this.getReservation(reservationHandle);
    });
  }

  confirm({ reservationHandle, eventId }) {
    requiredString(eventId, 'eventId');
    return this.#transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM reference_liquidity_reservations WHERE reservation_handle = ?')
        .get(reservationHandle);
      if (!row) throw new Error('reference reservation not found');
      if (row.state === 'CONSUMED' && row.event_id === eventId) return { duplicate: true };
      if (row.state !== 'SUBMITTED') throw new Error(`reference reservation cannot confirm from ${row.state}`);

      const source = this.db.prepare('SELECT * FROM reference_liquidity WHERE slice_id = ?').get(row.slice_id);
      const output = BigInt(row.output_amount);
      const reserved = BigInt(source.reserved_output);
      const capacity = BigInt(source.max_output);
      if (reserved < output || capacity < output) throw new Error('reference source accounting mismatch');

      this.db.prepare(`
        UPDATE reference_liquidity
        SET max_output = ?, reserved_output = ?
        WHERE slice_id = ?
      `).run((capacity - output).toString(), (reserved - output).toString(), row.slice_id);
      this.db.prepare(`
        UPDATE reference_liquidity_reservations
        SET state = 'CONSUMED', event_id = ?
        WHERE reservation_handle = ?
      `).run(eventId, reservationHandle);
      return { duplicate: false };
    });
  }

  #releaseFromStates(reservationHandle, states, nextState, reason) {
    return this.#transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM reference_liquidity_reservations WHERE reservation_handle = ?')
        .get(reservationHandle);
      if (!row) return { duplicate: true };
      if (!states.includes(row.state)) return { duplicate: true };

      const source = this.db.prepare('SELECT * FROM reference_liquidity WHERE slice_id = ?').get(row.slice_id);
      const output = BigInt(row.output_amount);
      const reserved = BigInt(source.reserved_output);
      if (reserved < output) throw new Error('reference reserved capacity underflow');
      this.db
        .prepare('UPDATE reference_liquidity SET reserved_output = ? WHERE slice_id = ?')
        .run((reserved - output).toString(), row.slice_id);
      this.db.prepare(`
        UPDATE reference_liquidity_reservations
        SET state = ?, reason = ?
        WHERE reservation_handle = ?
      `).run(nextState, reason, reservationHandle);
      return { duplicate: false };
    });
  }

  release({ reservationHandle, reason = 'RELEASED' }) {
    return this.#releaseFromStates(reservationHandle, ['ACTIVE'], 'RELEASED', reason);
  }

  fail({ reservationHandle, reason = 'SETTLEMENT_FAILED' }) {
    return this.#releaseFromStates(reservationHandle, ['ACTIVE', 'SUBMITTED'], 'FAILED', reason);
  }
}

export class ReferenceLiquidityAdapter {
  constructor(book) {
    if (!book || typeof book.reserve !== 'function') throw new TypeError('ReferenceLiquidityBook required');
    this.book = book;
  }

  reserve(args) { return this.book.reserve(args); }
  release(args) { return this.book.release(args); }
  validateReserved(args) { return this.book.validateReserved(args); }
  markSubmitted(args) { return this.book.markSubmitted(args); }
  confirm(args) { return this.book.confirm(args); }
  fail(args) { return this.book.fail(args); }
}

export { STATIC_SOURCE_TYPES };
