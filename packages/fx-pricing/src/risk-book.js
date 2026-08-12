import { DatabaseSync } from '../../sqlite-compat/src/index.js';

function abs(value) {
  return value < 0n ? -value : value;
}

export class PrincipalRiskBook {
  constructor({ path = ':memory:', now = () => Date.now(), limits = {} } = {}) {
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();

    for (const [asset, limit] of Object.entries(limits)) {
      this.configureAsset(asset, String(limit));
    }
  }

  close() {
    this.db.close();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS principal_positions (
        asset TEXT PRIMARY KEY,
        settled_position TEXT NOT NULL DEFAULT '0',
        hard_limit TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS principal_reservations (
        quote_id TEXT NOT NULL,
        asset TEXT NOT NULL REFERENCES principal_positions(asset),
        delta TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        state TEXT NOT NULL,
        PRIMARY KEY(quote_id, asset)
      );
      CREATE INDEX IF NOT EXISTS idx_principal_reservation_expiry
        ON principal_reservations(state, expires_at);

      CREATE TABLE IF NOT EXISTS principal_events (
        event_id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL
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

  configureAsset(asset, hardLimit) {
    if (typeof asset !== 'string' || asset.length === 0) throw new TypeError('asset required');
    const limit = BigInt(hardLimit);
    if (limit <= 0n) throw new RangeError('hard limit must be positive');

    const existing = this.db
      .prepare('SELECT settled_position FROM principal_positions WHERE asset = ?')
      .get(asset);
    if (existing && abs(BigInt(existing.settled_position)) > limit) {
      throw new Error('new hard limit is below current settled position');
    }

    this.db
      .prepare(`
        INSERT INTO principal_positions(asset, settled_position, hard_limit)
        VALUES (?, '0', ?)
        ON CONFLICT(asset) DO UPDATE SET hard_limit = excluded.hard_limit
      `)
      .run(asset, limit.toString());
  }

  setSettledPosition(asset, position) {
    const row = this.#positionRow(asset);
    const next = BigInt(position);
    if (abs(next) > BigInt(row.hard_limit)) throw new Error('settled position exceeds hard limit');
    this.db
      .prepare('UPDATE principal_positions SET settled_position = ? WHERE asset = ?')
      .run(next.toString(), asset);
  }

  #positionRow(asset) {
    const row = this.db.prepare('SELECT * FROM principal_positions WHERE asset = ?').get(asset);
    if (!row) throw new Error(`unconfigured risk asset: ${asset}`);
    return row;
  }

  activeReservedDelta(asset) {
    const rows = this.db
      .prepare("SELECT delta FROM principal_reservations WHERE asset = ? AND state = 'ACTIVE'")
      .all(asset);
    return rows.reduce((sum, row) => sum + BigInt(row.delta), 0n);
  }

  getPosition(asset) {
    const row = this.#positionRow(asset);
    const settled = BigInt(row.settled_position);
    const reserved = this.activeReservedDelta(asset);
    return {
      asset,
      settled: settled.toString(),
      reserved: reserved.toString(),
      projected: (settled + reserved).toString(),
      hardLimit: row.hard_limit,
    };
  }

  utilizationBps(asset, additionalDelta = 0n) {
    const row = this.#positionRow(asset);
    const projected = BigInt(row.settled_position) + this.activeReservedDelta(asset) + BigInt(additionalDelta);
    return Number((abs(projected) * 10_000n) / BigInt(row.hard_limit));
  }

  checkDeltas(deltas) {
    const failures = [];
    for (const [asset, rawDelta] of Object.entries(deltas)) {
      const row = this.#positionRow(asset);
      const projected =
        BigInt(row.settled_position) + this.activeReservedDelta(asset) + BigInt(rawDelta);
      if (abs(projected) > BigInt(row.hard_limit)) {
        failures.push({
          asset,
          projected: projected.toString(),
          hardLimit: row.hard_limit,
        });
      }
    }
    return { allowed: failures.length === 0, failures };
  }

  reserve({ quoteId, deltas, expiresAt }) {
    if (typeof quoteId !== 'string' || quoteId.length === 0) throw new TypeError('quoteId required');
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now()) {
      throw new RangeError('expiresAt must be a future millisecond timestamp');
    }
    const entries = Object.entries(deltas);
    if (entries.length === 0) throw new RangeError('at least one risk delta required');

    return this.#transaction(() => {
      const existing = this.db
        .prepare('SELECT asset, delta, expires_at, state FROM principal_reservations WHERE quote_id = ?')
        .all(quoteId);
      if (existing.length > 0) {
        const active = existing.filter((row) => row.state === 'ACTIVE');
        const same =
          active.length === entries.length &&
          active.every((row) => String(deltas[row.asset]) === row.delta && row.expires_at === expiresAt);
        if (same) return { quoteId, duplicate: true };
        throw new Error('quoteId already exists with different risk reservation');
      }

      const check = this.checkDeltas(deltas);
      if (!check.allowed) {
        const error = new Error('principal risk limit exceeded');
        error.code = 'RISK_LIMIT';
        error.failures = check.failures;
        throw error;
      }

      const insert = this.db.prepare(`
        INSERT INTO principal_reservations(quote_id, asset, delta, expires_at, state)
        VALUES (?, ?, ?, ?, 'ACTIVE')
      `);
      for (const [asset, rawDelta] of entries) {
        this.#positionRow(asset);
        insert.run(quoteId, asset, BigInt(rawDelta).toString(), expiresAt);
      }
      return { quoteId, duplicate: false };
    });
  }

  release(quoteId, state = 'RELEASED') {
    return this.#transaction(() => {
      const active = this.db
        .prepare("SELECT asset FROM principal_reservations WHERE quote_id = ? AND state = 'ACTIVE'")
        .all(quoteId);
      this.db
        .prepare("UPDATE principal_reservations SET state = ? WHERE quote_id = ? AND state = 'ACTIVE'")
        .run(state, quoteId);
      return active.length;
    });
  }

  expire(now = this.now()) {
    return this.#transaction(() => {
      const result = this.db
        .prepare("UPDATE principal_reservations SET state = 'EXPIRED' WHERE state = 'ACTIVE' AND expires_at <= ?")
        .run(now);
      return Number(result.changes);
    });
  }

  settle({ quoteId, eventId }) {
    if (typeof eventId !== 'string' || eventId.length === 0) throw new TypeError('eventId required');

    return this.#transaction(() => {
      const previous = this.db.prepare('SELECT event_id FROM principal_events WHERE event_id = ?').get(eventId);
      if (previous) return { duplicate: true };

      const reservations = this.db
        .prepare("SELECT * FROM principal_reservations WHERE quote_id = ? AND state = 'ACTIVE'")
        .all(quoteId);
      if (reservations.length === 0) throw new Error('no active principal reservation');

      for (const reservation of reservations) {
        const row = this.#positionRow(reservation.asset);
        const next = BigInt(row.settled_position) + BigInt(reservation.delta);
        if (abs(next) > BigInt(row.hard_limit)) {
          throw new Error('settlement would exceed hard risk limit');
        }
        this.db
          .prepare('UPDATE principal_positions SET settled_position = ? WHERE asset = ?')
          .run(next.toString(), reservation.asset);
      }

      this.db
        .prepare("UPDATE principal_reservations SET state = 'SETTLED' WHERE quote_id = ? AND state = 'ACTIVE'")
        .run(quoteId);
      this.db
        .prepare('INSERT INTO principal_events(event_id, quote_id, kind, created_at) VALUES (?, ?, ?, ?)')
        .run(eventId, quoteId, 'SETTLED', this.now());
      return { duplicate: false };
    });
  }
}
