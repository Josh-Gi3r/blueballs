import { DatabaseSync } from "../../sqlite-compat/src/index.js";

function abs(value) {
  return value < 0n ? -value : value;
}

function finalityCollision(eventId, existing, quoteId, kind) {
  const error = new Error(
    `principal event ${eventId} is already bound to ${existing.quote_id}/${existing.kind}`,
  );
  error.code = "FINALITY_EVENT_COLLISION";
  error.status = 409;
  error.details = {
    eventId,
    requestedQuoteId: quoteId,
    requestedKind: kind,
    existingQuoteId: existing.quote_id,
    existingKind: existing.kind,
  };
  return error;
}

export class PrincipalRiskBook {
  constructor({ path = ":memory:", now = () => Date.now(), limits = {} } = {}) {
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
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
    return this.db.transactionSync(fn);
  }

  #event(eventId, quoteId, kind) {
    if (eventId === null || eventId === undefined) return { duplicate: false };
    if (typeof eventId !== "string" || eventId.length === 0)
      throw new TypeError("eventId required");
    const previous = this.db
      .prepare("SELECT quote_id, kind FROM principal_events WHERE event_id = ?")
      .get(eventId);
    if (previous) {
      if (previous.quote_id !== quoteId || previous.kind !== kind) {
        throw finalityCollision(eventId, previous, quoteId, kind);
      }
      return { duplicate: true };
    }
    this.db
      .prepare(
        "INSERT INTO principal_events(event_id, quote_id, kind, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(eventId, quoteId, kind, this.now());
    return { duplicate: false };
  }

  configureAsset(asset, hardLimit) {
    if (typeof asset !== "string" || asset.length === 0)
      throw new TypeError("asset required");
    const limit = BigInt(hardLimit);
    if (limit <= 0n) throw new RangeError("hard limit must be positive");

    const existing = this.db
      .prepare(
        "SELECT settled_position FROM principal_positions WHERE asset = ?",
      )
      .get(asset);
    if (existing) {
      const projected =
        BigInt(existing.settled_position) + this.activeReservedDelta(asset);
      if (abs(projected) > limit) {
        throw new Error("new hard limit is below current projected position");
      }
    }

    this.db
      .prepare(
        `
        INSERT INTO principal_positions(asset, settled_position, hard_limit)
        VALUES (?, '0', ?)
        ON CONFLICT(asset) DO UPDATE SET hard_limit = excluded.hard_limit
      `,
      )
      .run(asset, limit.toString());
  }

  setSettledPosition(asset, position) {
    const row = this.#positionRow(asset);
    const next = BigInt(position);
    const projected = next + this.activeReservedDelta(asset);
    if (abs(projected) > BigInt(row.hard_limit))
      throw new Error("settled position plus reserved exposure exceeds hard limit");
    this.db
      .prepare(
        "UPDATE principal_positions SET settled_position = ? WHERE asset = ?",
      )
      .run(next.toString(), asset);
  }

  #positionRow(asset) {
    const row = this.db
      .prepare("SELECT * FROM principal_positions WHERE asset = ?")
      .get(asset);
    if (!row) throw new Error(`unconfigured risk asset: ${asset}`);
    return row;
  }

  activeReservedDelta(asset) {
    const rows = this.db
      .prepare(
        "SELECT delta FROM principal_reservations WHERE asset = ? AND state IN ('ACTIVE', 'SUBMITTED')",
      )
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
    const projected =
      BigInt(row.settled_position) +
      this.activeReservedDelta(asset) +
      BigInt(additionalDelta);
    return Number((abs(projected) * 10_000n) / BigInt(row.hard_limit));
  }

  checkDeltas(deltas) {
    const failures = [];
    for (const [asset, rawDelta] of Object.entries(deltas)) {
      const row = this.#positionRow(asset);
      const projected =
        BigInt(row.settled_position) +
        this.activeReservedDelta(asset) +
        BigInt(rawDelta);
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
    if (typeof quoteId !== "string" || quoteId.length === 0)
      throw new TypeError("quoteId required");
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now()) {
      throw new RangeError("expiresAt must be a future millisecond timestamp");
    }
    const entries = Object.entries(deltas);
    if (entries.length === 0)
      throw new RangeError("at least one risk delta required");

    return this.#transaction(() => {
      const existing = this.db
        .prepare(
          "SELECT asset, delta, expires_at, state FROM principal_reservations WHERE quote_id = ?",
        )
        .all(quoteId);
      if (existing.length > 0) {
        const active = existing.filter((row) => row.state === "ACTIVE");
        const same =
          active.length === entries.length &&
          active.every(
            (row) =>
              String(deltas[row.asset]) === row.delta &&
              row.expires_at === expiresAt,
          );
        if (same) return { quoteId, duplicate: true };
        throw new Error(
          "quoteId already exists with different risk reservation",
        );
      }

      const check = this.checkDeltas(deltas);
      if (!check.allowed) {
        const error = new Error("principal risk limit exceeded");
        error.code = "RISK_LIMIT";
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

  markSubmitted(quoteId) {
    if (typeof quoteId !== "string" || quoteId.length === 0)
      throw new TypeError("quoteId required");
    return this.#transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT state FROM principal_reservations WHERE quote_id = ?",
        )
        .all(quoteId);
      if (rows.length === 0) throw new Error("principal reservation not found");
      if (rows.every((row) => row.state === "SUBMITTED")) {
        return { quoteId, duplicate: true };
      }
      if (rows.some((row) => row.state !== "ACTIVE")) {
        throw new Error("principal reservation cannot be submitted from current state");
      }
      const result = this.db
        .prepare(
          "UPDATE principal_reservations SET state = 'SUBMITTED' WHERE quote_id = ? AND state = 'ACTIVE'",
        )
        .run(quoteId);
      return { quoteId, duplicate: false, rows: Number(result.changes) };
    });
  }

  release(quoteId, state = "RELEASED") {
    return this.#transaction(() => {
      const active = this.db
        .prepare(
          "SELECT asset FROM principal_reservations WHERE quote_id = ? AND state = 'ACTIVE'",
        )
        .all(quoteId);
      this.db
        .prepare(
          "UPDATE principal_reservations SET state = ? WHERE quote_id = ? AND state = 'ACTIVE'",
        )
        .run(state, quoteId);
      return active.length;
    });
  }

  fail({ quoteId, eventId = null, reason = "SETTLEMENT_FAILED" }) {
    if (typeof quoteId !== "string" || quoteId.length === 0)
      throw new TypeError("quoteId required");
    if (typeof reason !== "string" || reason.length === 0)
      throw new TypeError("reason required");
    return this.#transaction(() => {
      if (eventId) {
        const identity = this.#event(eventId, quoteId, "FAILED");
        if (identity.duplicate) return { duplicate: true, released: 0 };
      }
      const rows = this.db
        .prepare(
          "SELECT state FROM principal_reservations WHERE quote_id = ?",
        )
        .all(quoteId);
      if (rows.length === 0) throw new Error("principal reservation not found");
      if (rows.every((row) => row.state === "FAILED"))
        return { duplicate: true, released: 0 };
      if (
        rows.some(
          (row) => !["ACTIVE", "SUBMITTED"].includes(row.state),
        )
      ) {
        throw new Error("principal reservation cannot fail from current state");
      }
      const result = this.db
        .prepare(
          "UPDATE principal_reservations SET state = 'FAILED' WHERE quote_id = ? AND state IN ('ACTIVE', 'SUBMITTED')",
        )
        .run(quoteId);
      return { duplicate: false, released: Number(result.changes), reason };
    });
  }

  expire(now = this.now()) {
    return this.#transaction(() => {
      const result = this.db
        .prepare(
          "UPDATE principal_reservations SET state = 'EXPIRED' WHERE state = 'ACTIVE' AND expires_at <= ?",
        )
        .run(now);
      return Number(result.changes);
    });
  }

  settle({ quoteId, eventId }) {
    if (typeof eventId !== "string" || eventId.length === 0)
      throw new TypeError("eventId required");

    return this.#transaction(() => {
      const identity = this.#event(eventId, quoteId, "SETTLED");
      if (identity.duplicate) return { duplicate: true };

      const reservations = this.db
        .prepare(
          "SELECT * FROM principal_reservations WHERE quote_id = ? AND state IN ('ACTIVE', 'SUBMITTED')",
        )
        .all(quoteId);
      if (reservations.length === 0)
        throw new Error("no reservable principal exposure for settlement");

      for (const reservation of reservations) {
        const row = this.#positionRow(reservation.asset);
        const next = BigInt(row.settled_position) + BigInt(reservation.delta);
        if (abs(next) > BigInt(row.hard_limit)) {
          throw new Error("settlement would exceed hard risk limit");
        }
        this.db
          .prepare(
            "UPDATE principal_positions SET settled_position = ? WHERE asset = ?",
          )
          .run(next.toString(), reservation.asset);
      }

      this.db
        .prepare(
          "UPDATE principal_reservations SET state = 'SETTLED' WHERE quote_id = ? AND state IN ('ACTIVE', 'SUBMITTED')",
        )
        .run(quoteId);
      return { duplicate: false };
    });
  }
}
