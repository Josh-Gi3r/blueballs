import { SqliteFxMarket } from './sqlite-market.js';

function rowToRoute(row) {
  if (!row) return null;
  return {
    routeId: row.route_id,
    state: row.state,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    submissionRef: row.submission_ref,
    confirmedEventId: row.confirmed_event_id,
    failureReason: row.failure_reason,
  };
}

export class FxMarketService {
  constructor(options = {}) {
    this.market = options.market ?? new SqliteFxMarket(options);
    this.db = this.market.db;
    this.now = options.now ?? this.market.now;
    this.authorizationVerifier = options.authorizationVerifier ?? null;
    if (this.authorizationVerifier !== null && typeof this.authorizationVerifier !== 'function') {
      throw new TypeError('authorizationVerifier must be a function');
    }
    this.#migrate();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS routes (
        route_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        submission_ref TEXT UNIQUE,
        confirmed_event_id TEXT UNIQUE,
        failure_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_routes_state_expiry ON routes(state, expires_at);
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

  #verifyAuthorization(order) {
    if (!this.authorizationVerifier) return { valid: true };
    const result = this.authorizationVerifier(order.policy_authorization_id, {
      orderHash: order.order_hash,
      maker: order.maker,
      accountRef: order.maker,
      inputAsset: order.buy_token,
      outputAsset: order.sell_token,
      amount: order.sell_amount,
      policySnapshotHash: order.policy_snapshot_hash,
    });
    if (!result || result.valid !== true) {
      return { valid: false, reason: result?.reason ?? 'AUTHORIZATION_INVALID' };
    }
    return result;
  }

  #revalidatePair(inputToken, outputToken) {
    if (!this.authorizationVerifier) return 0;
    const rows = this.db
      .prepare(`
        SELECT * FROM orders
        WHERE buy_token = ?
          AND sell_token = ?
          AND state IN ('OPEN', 'PARTIALLY_FILLED')
          AND offchain_hidden = 0
          AND onchain_invalidated = 0
          AND policy_blocked = 0
      `)
      .all(inputToken.toLowerCase(), outputToken.toLowerCase());

    let blocked = 0;
    for (const order of rows) {
      const verification = this.#verifyAuthorization(order);
      if (!verification.valid) {
        const result = this.blockOrderPolicy(
          order.order_hash,
          `authorization invalid: ${verification.reason}`,
        );
        if (!result.submitted) blocked += 1;
      }
    }
    return blocked;
  }

  #revalidateReservedRoute(routeId) {
    if (!this.authorizationVerifier) return;
    const rows = this.db
      .prepare(`
        SELECT o.*
        FROM reservations r
        JOIN orders o ON o.order_hash = r.order_hash
        WHERE r.route_id = ? AND r.state = 'ACTIVE'
        ORDER BY r.rowid
      `)
      .all(routeId);

    for (const order of rows) {
      const verification = this.#verifyAuthorization(order);
      if (!verification.valid) {
        this.blockOrderPolicy(order.order_hash, `authorization invalid: ${verification.reason}`);
        const error = new Error(`route authorization invalid: ${verification.reason}`);
        error.code = 'POLICY_AUTHORIZATION_INVALID';
        error.orderHash = order.order_hash;
        throw error;
      }
    }
  }

  close() {
    this.market.close();
  }

  admitOrder(payload) {
    return this.market.admitOrder(payload);
  }

  getOrder(orderHash) {
    return this.market.getOrder(orderHash);
  }

  listOrdersForMaker(maker) {
    return this.market.listOrdersForMaker(maker);
  }

  aggregateDepth(pair) {
    this.#revalidatePair(pair.inputToken, pair.outputToken);
    return this.market.aggregateDepth(pair);
  }

  getRoute(routeId) {
    return rowToRoute(this.db.prepare('SELECT * FROM routes WHERE route_id = ?').get(routeId));
  }

  reserveExactOutput(args) {
    if (this.getRoute(args.routeId)) throw new Error('route already exists');
    this.#revalidatePair(args.inputToken, args.outputToken);

    const route = this.market.reserveExactOutput(args);
    try {
      this.db
        .prepare(`
          INSERT INTO routes(route_id, state, created_at, expires_at)
          VALUES (?, 'RESERVED', ?, ?)
        `)
        .run(route.routeId, this.now(), route.expiresAt);
      return { ...route, state: 'RESERVED' };
    } catch (error) {
      this.market.releaseRoute(route.routeId, 'RELEASED');
      throw error;
    }
  }

  markRouteSubmitted(routeId, submissionRef) {
    if (typeof submissionRef !== 'string' || submissionRef.length === 0) {
      throw new TypeError('submissionRef is required');
    }

    const current = this.getRoute(routeId);
    if (!current) throw new Error('route not found');
    if (current.state === 'SUBMITTED' && current.submissionRef === submissionRef) {
      return current;
    }
    if (current.state !== 'RESERVED') throw new Error(`route cannot be submitted from ${current.state}`);
    if (current.expiresAt <= this.now()) throw new Error('route reservation expired');

    this.#revalidateReservedRoute(routeId);

    return this.#transaction(() => {
      const route = this.db.prepare('SELECT * FROM routes WHERE route_id = ?').get(routeId);
      if (!route) throw new Error('route not found');
      if (route.state !== 'RESERVED') throw new Error(`route cannot be submitted from ${route.state}`);
      if (route.expires_at <= this.now()) throw new Error('route reservation expired');

      this.db
        .prepare("UPDATE routes SET state = 'SUBMITTED', submission_ref = ? WHERE route_id = ?")
        .run(submissionRef, routeId);
      return this.getRoute(routeId);
    });
  }

  releaseRoute(routeId, reason = 'RELEASED') {
    const route = this.getRoute(routeId);
    if (!route) return 0;
    if (route.state === 'SUBMITTED') throw new Error('submitted route cannot be released; reconcile it');
    if (['CONFIRMED', 'FAILED', 'RELEASED', 'EXPIRED'].includes(route.state)) return 0;

    const released = this.market.releaseRoute(routeId, reason);
    this.db
      .prepare("UPDATE routes SET state = 'RELEASED', failure_reason = ? WHERE route_id = ?")
      .run(reason, routeId);
    return released;
  }

  expireRoutes(now = this.now()) {
    const rows = this.db
      .prepare("SELECT route_id FROM routes WHERE state = 'RESERVED' AND expires_at <= ?")
      .all(now);

    let released = 0;
    for (const row of rows) {
      released += this.market.releaseRoute(row.route_id, 'EXPIRED');
      this.db.prepare("UPDATE routes SET state = 'EXPIRED' WHERE route_id = ?").run(row.route_id);
    }
    return released;
  }

  confirmSubmittedRoute({ routeId, eventId, fills }) {
    const route = this.getRoute(routeId);
    if (!route) throw new Error('route not found');
    if (route.state === 'CONFIRMED') {
      if (route.confirmedEventId !== eventId) throw new Error('route already confirmed by another event');
      return { duplicate: true };
    }
    if (route.state !== 'SUBMITTED') throw new Error('route must be SUBMITTED before confirmation');

    const result = this.market.confirmRoute({ routeId, eventId, fills });
    this.db
      .prepare("UPDATE routes SET state = 'CONFIRMED', confirmed_event_id = ? WHERE route_id = ?")
      .run(eventId, routeId);

    this.#normalizePostSettlementOrderStates(routeId);
    return result;
  }

  failSubmittedRoute({ routeId, eventId = null, reason = 'SETTLEMENT_FAILED' }) {
    const route = this.getRoute(routeId);
    if (!route) throw new Error('route not found');
    if (route.state === 'FAILED') return { duplicate: true, released: 0 };
    if (route.state !== 'SUBMITTED') throw new Error('only a submitted route can fail settlement');

    const result = this.market.failRoute({ routeId, eventId, reason });
    this.db
      .prepare("UPDATE routes SET state = 'FAILED', failure_reason = ? WHERE route_id = ?")
      .run(reason, routeId);
    return result;
  }

  blockOrderPolicy(orderHash, reason = 'policy revoked') {
    return this.#transaction(() => {
      const order = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!order) throw new Error('order not found');

      const activeReservation = this.db
        .prepare(`
          SELECT r.*, rt.state AS route_state
          FROM reservations r
          LEFT JOIN routes rt ON rt.route_id = r.route_id
          WHERE r.order_hash = ? AND r.state = 'ACTIVE'
        `)
        .get(orderHash);

      if (activeReservation?.route_state === 'SUBMITTED') {
        this.db
          .prepare('UPDATE orders SET policy_blocked = 1, policy_reason = ? WHERE order_hash = ?')
          .run(reason, orderHash);
        return { released: 0, submitted: true };
      }

      if (activeReservation) {
        this.db
          .prepare("UPDATE reservations SET state = 'RELEASED' WHERE reservation_id = ?")
          .run(activeReservation.reservation_id);
        this.db
          .prepare("UPDATE routes SET state = 'RELEASED', failure_reason = 'POLICY_BLOCKED' WHERE route_id = ? AND state = 'RESERVED'")
          .run(activeReservation.route_id);
      }

      this.db
        .prepare(`
          UPDATE orders
          SET policy_blocked = 1, policy_reason = ?, reserved_sell = '0', state = 'POLICY_BLOCKED'
          WHERE order_hash = ?
        `)
        .run(reason, orderHash);
      return { released: activeReservation ? 1 : 0, submitted: false };
    });
  }

  cancelOrderOffchain(orderHash, { onChainInvalidated = false } = {}) {
    return this.#transaction(() => {
      const order = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!order) throw new Error('order not found');

      const activeReservation = this.db
        .prepare(`
          SELECT r.*, rt.state AS route_state
          FROM reservations r
          LEFT JOIN routes rt ON rt.route_id = r.route_id
          WHERE r.order_hash = ? AND r.state = 'ACTIVE'
        `)
        .get(orderHash);

      if (activeReservation?.route_state === 'SUBMITTED') {
        this.db
          .prepare('UPDATE orders SET offchain_hidden = 1, onchain_invalidated = ? WHERE order_hash = ?')
          .run(onChainInvalidated ? 1 : order.onchain_invalidated, orderHash);
        return { released: 0, submitted: true };
      }

      if (activeReservation) {
        this.db
          .prepare("UPDATE reservations SET state = 'RELEASED' WHERE reservation_id = ?")
          .run(activeReservation.reservation_id);
        this.db
          .prepare("UPDATE routes SET state = 'RELEASED', failure_reason = 'ORDER_CANCELLED' WHERE route_id = ? AND state = 'RESERVED'")
          .run(activeReservation.route_id);
      }

      this.db
        .prepare(`
          UPDATE orders
          SET offchain_hidden = 1, onchain_invalidated = ?, reserved_sell = '0', state = 'CANCELLED'
          WHERE order_hash = ?
        `)
        .run(onChainInvalidated ? 1 : order.onchain_invalidated, orderHash);
      return { released: activeReservation ? 1 : 0, submitted: false };
    });
  }

  #normalizePostSettlementOrderStates(routeId) {
    const orderHashes = this.db
      .prepare('SELECT order_hash FROM reservations WHERE route_id = ?')
      .all(routeId)
      .map((row) => row.order_hash);

    for (const orderHash of orderHashes) {
      const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!row) continue;
      const filled = BigInt(row.confirmed_filled_sell);
      const signed = BigInt(row.sell_amount);
      if (filled >= signed) continue;

      if (row.onchain_invalidated || row.offchain_hidden) {
        this.db.prepare("UPDATE orders SET state = 'CANCELLED' WHERE order_hash = ?").run(orderHash);
      } else if (row.policy_blocked) {
        this.db.prepare("UPDATE orders SET state = 'POLICY_BLOCKED' WHERE order_hash = ?").run(orderHash);
      }
    }
  }
}
