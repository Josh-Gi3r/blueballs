import { randomUUID } from 'node:crypto';
import { DatabaseSync } from '../../sqlite-compat/src/index.js';

import { availableSell, compareMakerPrice, minBigInt, normalizedPriceKey } from './math.js';
import { normalizeAddress, validateAdmission } from './validation.js';

const ACTIVE_STATES = new Set(['OPEN', 'PARTIALLY_FILLED']);

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function json(value) {
  return JSON.stringify(value);
}

function parseJson(value) {
  return JSON.parse(value);
}

function sameJson(a, b) {
  return json(a) === json(b);
}

function rowToOrder(row) {
  return {
    orderHash: row.order_hash,
    order: parseJson(row.order_json),
    signature: row.signature,
    policyAuthorizationId: row.policy_authorization_id,
    policySnapshotHash: row.policy_snapshot_hash,
    receivedAt: row.received_at,
    sequence: BigInt(row.sequence),
    state: row.state,
    confirmedFilledSell: row.confirmed_filled_sell,
    confirmedFilledBuy: row.confirmed_filled_buy,
    reservedSell: row.reserved_sell,
    offChainHidden: Boolean(row.offchain_hidden),
    onChainInvalidated: Boolean(row.onchain_invalidated),
    policyBlocked: Boolean(row.policy_blocked),
    policyReason: row.policy_reason,
  };
}

export class SqliteFxMarket {
  constructor({
    path = ':memory:',
    signatureVerifier,
    policyAuthorizer,
    now = () => Date.now(),
  } = {}) {
    if (typeof signatureVerifier !== 'function') {
      throw new TypeError('signatureVerifier callback is required');
    }
    if (typeof policyAuthorizer !== 'function') {
      throw new TypeError('policyAuthorizer callback is required');
    }

    this.signatureVerifier = signatureVerifier;
    this.policyAuthorizer = policyAuthorizer;
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  close() {
    this.db.close();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        order_hash TEXT NOT NULL UNIQUE,
        maker TEXT NOT NULL,
        sell_token TEXT NOT NULL,
        buy_token TEXT NOT NULL,
        sell_amount TEXT NOT NULL,
        buy_amount TEXT NOT NULL,
        recipient TEXT NOT NULL,
        valid_after INTEGER NOT NULL,
        valid_until INTEGER NOT NULL,
        epoch INTEGER NOT NULL,
        salt TEXT NOT NULL,
        signature TEXT NOT NULL,
        order_json TEXT NOT NULL,
        policy_authorization_id TEXT NOT NULL,
        policy_snapshot_hash TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        state TEXT NOT NULL,
        confirmed_filled_sell TEXT NOT NULL DEFAULT '0',
        confirmed_filled_buy TEXT NOT NULL DEFAULT '0',
        reserved_sell TEXT NOT NULL DEFAULT '0',
        offchain_hidden INTEGER NOT NULL DEFAULT 0,
        onchain_invalidated INTEGER NOT NULL DEFAULT 0,
        policy_blocked INTEGER NOT NULL DEFAULT 0,
        policy_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_orders_pair
        ON orders(sell_token, buy_token, state, offchain_hidden, policy_blocked, onchain_invalidated);
      CREATE INDEX IF NOT EXISTS idx_orders_maker ON orders(maker, sequence);

      CREATE TABLE IF NOT EXISTS reservations (
        reservation_id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        order_hash TEXT NOT NULL REFERENCES orders(order_hash),
        maker_sell_amount TEXT NOT NULL,
        taker_pay_amount TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        state TEXT NOT NULL,
        UNIQUE(route_id, order_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_reservations_route ON reservations(route_id, state);
      CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON reservations(state, expires_at);

      CREATE TABLE IF NOT EXISTS chain_events (
        event_id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        order_hash TEXT,
        route_id TEXT,
        created_at INTEGER NOT NULL,
        details_json TEXT NOT NULL
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

  #audit(kind, { orderHash = null, routeId = null, details = {} } = {}) {
    this.db
      .prepare(`
        INSERT INTO audit_events(kind, order_hash, route_id, created_at, details_json)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(kind, orderHash, routeId, this.now(), json(details));
  }

  async admitOrder(payload) {
    const admission = validateAdmission(payload);
    const now = this.now();
    if (admission.order.validUntil < Math.floor(now / 1000)) {
      throw new Error('order is already expired');
    }

    const signatureValid = await this.signatureVerifier(admission);
    if (!signatureValid) throw new Error('maker signature rejected');

    const policy = await this.policyAuthorizer(admission);
    if (!policy || policy.eligible !== true) {
      throw new Error(`policy rejected order${policy?.reason ? `: ${policy.reason}` : ''}`);
    }

    return this.#transaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM orders WHERE order_hash = ?')
        .get(admission.orderHash);

      if (existing) {
        const existingPayload = {
          orderHash: existing.order_hash,
          order: parseJson(existing.order_json),
          signature: existing.signature,
          policyAuthorizationId: existing.policy_authorization_id,
          policySnapshotHash: existing.policy_snapshot_hash,
        };
        if (!sameJson(existingPayload, admission)) {
          throw new Error('order hash already exists with different payload');
        }
        return rowToOrder(existing);
      }

      this.db
        .prepare(`
          INSERT INTO orders(
            order_hash, maker, sell_token, buy_token, sell_amount, buy_amount,
            recipient, valid_after, valid_until, epoch, salt, signature, order_json,
            policy_authorization_id, policy_snapshot_hash, received_at, state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
        `)
        .run(
          admission.orderHash,
          admission.order.maker,
          admission.order.sellToken,
          admission.order.buyToken,
          admission.order.sellAmount,
          admission.order.buyAmount,
          admission.order.recipient,
          admission.order.validAfter,
          admission.order.validUntil,
          admission.order.epoch,
          admission.order.salt,
          admission.signature,
          json(admission.order),
          admission.policyAuthorizationId,
          admission.policySnapshotHash,
          now,
        );

      this.#audit('ORDER_ADMITTED', {
        orderHash: admission.orderHash,
        details: { policyAuthorizationId: admission.policyAuthorizationId },
      });

      return rowToOrder(
        this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(admission.orderHash),
      );
    });
  }

  getOrder(orderHash) {
    const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
    return row ? rowToOrder(row) : null;
  }

  listOrdersForMaker(maker) {
    const normalizedMaker = normalizeAddress(maker, 'maker');
    return this.db
      .prepare('SELECT * FROM orders WHERE maker = ? ORDER BY sequence ASC')
      .all(normalizedMaker)
      .map(rowToOrder);
  }

  #candidateRows(inputToken, outputToken, nowSeconds) {
    return this.db
      .prepare(`
        SELECT * FROM orders
        WHERE sell_token = ?
          AND buy_token = ?
          AND state IN ('OPEN', 'PARTIALLY_FILLED')
          AND offchain_hidden = 0
          AND onchain_invalidated = 0
          AND policy_blocked = 0
          AND reserved_sell = '0'
          AND valid_after <= ?
          AND valid_until >= ?
      `)
      .all(outputToken, inputToken, nowSeconds, nowSeconds)
      .filter((row) => ACTIVE_STATES.has(row.state) && availableSell(row) > 0n)
      .sort(compareMakerPrice);
  }

  reserveExactOutput({ routeId, inputToken, outputToken, desiredOutput, expiresAt }) {
    if (typeof routeId !== 'string' || routeId.length === 0) throw new TypeError('routeId is required');
    const input = normalizeAddress(inputToken, 'inputToken');
    const output = normalizeAddress(outputToken, 'outputToken');
    if (input === output) throw new RangeError('input and output token must differ');

    const desired = BigInt(String(desiredOutput));
    if (desired <= 0n) throw new RangeError('desiredOutput must be greater than zero');

    const now = this.now();
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
      throw new RangeError('expiresAt must be a future millisecond timestamp');
    }

    return this.#transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM reservations WHERE route_id = ? AND state = 'ACTIVE'")
        .all(routeId);
      if (existing.length > 0) throw new Error('route already has active reservations');

      let remaining = desired;
      let totalInput = 0n;
      const fills = [];
      const candidates = this.#candidateRows(input, output, Math.floor(now / 1000));

      for (const row of candidates) {
        if (remaining === 0n) break;

        const available = availableSell(row);
        const makerSell = minBigInt(available, remaining);
        const oldSell = BigInt(row.confirmed_filled_sell);
        const oldBuy = BigInt(row.confirmed_filled_buy);
        const targetBuy = ceilDiv(
          (oldSell + makerSell) * BigInt(row.buy_amount),
          BigInt(row.sell_amount),
        );
        const takerPay = targetBuy - oldBuy;

        const reservationId = randomUUID();
        this.db
          .prepare(`
            INSERT INTO reservations(
              reservation_id, route_id, order_hash, maker_sell_amount, taker_pay_amount,
              created_at, expires_at, state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
          `)
          .run(
            reservationId,
            routeId,
            row.order_hash,
            makerSell.toString(),
            takerPay.toString(),
            now,
            expiresAt,
          );

        this.db
          .prepare("UPDATE orders SET reserved_sell = ?, state = 'RESERVED' WHERE order_hash = ?")
          .run(makerSell.toString(), row.order_hash);

        fills.push({
          reservationId,
          orderHash: row.order_hash,
          order: parseJson(row.order_json),
          signature: row.signature,
          makerSellAmount: makerSell.toString(),
          expectedTakerPay: takerPay.toString(),
        });
        totalInput += takerPay;
        remaining -= makerSell;
      }

      if (remaining !== 0n) throw new Error('insufficient eligible liquidity');

      this.#audit('ROUTE_RESERVED', {
        routeId,
        details: {
          inputToken: input,
          outputToken: output,
          desiredOutput: desired.toString(),
          totalInput: totalInput.toString(),
          fillCount: fills.length,
        },
      });

      return {
        routeId,
        inputToken: input,
        outputToken: output,
        totalInput: totalInput.toString(),
        totalOutput: desired.toString(),
        expiresAt,
        fills,
      };
    });
  }

  #restoreOrderAfterReservation(orderHash) {
    const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
    if (!row) return;

    const filled = BigInt(row.confirmed_filled_sell);
    const signed = BigInt(row.sell_amount);
    let state = filled === 0n ? 'OPEN' : filled < signed ? 'PARTIALLY_FILLED' : 'FILLED';
    if (row.policy_blocked) state = 'POLICY_BLOCKED';
    if (row.offchain_hidden || row.onchain_invalidated) state = 'CANCELLED';

    this.db
      .prepare('UPDATE orders SET reserved_sell = ?, state = ? WHERE order_hash = ?')
      .run('0', state, orderHash);
  }

  releaseRoute(routeId, reason = 'RELEASED') {
    return this.#transaction(() => {
      const reservations = this.db
        .prepare("SELECT * FROM reservations WHERE route_id = ? AND state = 'ACTIVE'")
        .all(routeId);

      for (const reservation of reservations) {
        this.db
          .prepare('UPDATE reservations SET state = ? WHERE reservation_id = ?')
          .run(reason, reservation.reservation_id);
        this.#restoreOrderAfterReservation(reservation.order_hash);
      }

      if (reservations.length > 0) {
        this.#audit('ROUTE_RELEASED', {
          routeId,
          details: { reason, count: reservations.length },
        });
      }
      return reservations.length;
    });
  }

  expireReservations(now = this.now()) {
    return this.#transaction(() => {
      const expired = this.db
        .prepare(
          "SELECT DISTINCT route_id FROM reservations WHERE state = 'ACTIVE' AND expires_at <= ?",
        )
        .all(now)
        .map((row) => row.route_id);

      let count = 0;
      for (const routeId of expired) {
        const reservations = this.db
          .prepare("SELECT * FROM reservations WHERE route_id = ? AND state = 'ACTIVE'")
          .all(routeId);
        for (const reservation of reservations) {
          this.db
            .prepare("UPDATE reservations SET state = 'EXPIRED' WHERE reservation_id = ?")
            .run(reservation.reservation_id);
          this.#restoreOrderAfterReservation(reservation.order_hash);
          count += 1;
        }
        this.#audit('ROUTE_EXPIRED', { routeId, details: { count: reservations.length } });
      }
      return count;
    });
  }

  confirmRoute({ routeId, eventId, fills }) {
    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw new TypeError('eventId is required');
    }
    if (!Array.isArray(fills)) throw new TypeError('fills must be an array');

    return this.#transaction(() => {
      const existingEvent = this.db
        .prepare('SELECT event_id FROM chain_events WHERE event_id = ?')
        .get(eventId);
      if (existingEvent) return { duplicate: true };

      const reservations = this.db
        .prepare(
          "SELECT * FROM reservations WHERE route_id = ? AND state = 'ACTIVE' ORDER BY rowid",
        )
        .all(routeId);
      if (reservations.length === 0) throw new Error('no active reservations for route');
      if (reservations.length !== fills.length) {
        throw new Error('confirmed fill count does not match reservations');
      }

      for (let i = 0; i < reservations.length; i += 1) {
        const reservation = reservations[i];
        const fill = fills[i];
        if (
          fill.orderHash !== reservation.order_hash ||
          String(fill.makerSellAmount) !== reservation.maker_sell_amount ||
          String(fill.takerPayAmount) !== reservation.taker_pay_amount
        ) {
          throw new Error('confirmed fill does not match reservation');
        }

        const order = this.db
          .prepare('SELECT * FROM orders WHERE order_hash = ?')
          .get(reservation.order_hash);
        const newSell = BigInt(order.confirmed_filled_sell) + BigInt(reservation.maker_sell_amount);
        const newBuy = BigInt(order.confirmed_filled_buy) + BigInt(reservation.taker_pay_amount);
        if (newSell > BigInt(order.sell_amount) || newBuy > BigInt(order.buy_amount)) {
          throw new Error('confirmed fill exceeds signed maker order');
        }

        const nextState = newSell === BigInt(order.sell_amount) ? 'FILLED' : 'PARTIALLY_FILLED';
        this.db
          .prepare(`
            UPDATE orders
            SET confirmed_filled_sell = ?, confirmed_filled_buy = ?, reserved_sell = '0', state = ?
            WHERE order_hash = ?
          `)
          .run(newSell.toString(), newBuy.toString(), nextState, reservation.order_hash);
        this.db
          .prepare("UPDATE reservations SET state = 'CONSUMED' WHERE reservation_id = ?")
          .run(reservation.reservation_id);
      }

      this.db
        .prepare(
          'INSERT INTO chain_events(event_id, route_id, kind, created_at, payload_json) VALUES (?, ?, ?, ?, ?)',
        )
        .run(eventId, routeId, 'SETTLEMENT_CONFIRMED', this.now(), json(fills));
      this.#audit('SETTLEMENT_CONFIRMED', {
        routeId,
        details: { eventId, fillCount: fills.length },
      });
      return { duplicate: false };
    });
  }

  failRoute({ routeId, eventId = null, reason = 'SETTLEMENT_FAILED' }) {
    return this.#transaction(() => {
      if (eventId) {
        const existing = this.db
          .prepare('SELECT event_id FROM chain_events WHERE event_id = ?')
          .get(eventId);
        if (existing) return { duplicate: true, released: 0 };
        this.db
          .prepare(
            'INSERT INTO chain_events(event_id, route_id, kind, created_at, payload_json) VALUES (?, ?, ?, ?, ?)',
          )
          .run(eventId, routeId, 'SETTLEMENT_FAILED', this.now(), json({ reason }));
      }

      const reservations = this.db
        .prepare("SELECT * FROM reservations WHERE route_id = ? AND state = 'ACTIVE'")
        .all(routeId);
      for (const reservation of reservations) {
        this.db
          .prepare("UPDATE reservations SET state = 'RELEASED' WHERE reservation_id = ?")
          .run(reservation.reservation_id);
        this.#restoreOrderAfterReservation(reservation.order_hash);
      }
      this.#audit('SETTLEMENT_FAILED', {
        routeId,
        details: { reason, count: reservations.length },
      });
      return { duplicate: false, released: reservations.length };
    });
  }

  blockPolicy(orderHash, reason = 'policy revoked') {
    return this.#transaction(() => {
      const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!row) throw new Error('order not found');

      const active = this.db
        .prepare("SELECT * FROM reservations WHERE order_hash = ? AND state = 'ACTIVE'")
        .all(orderHash);
      for (const reservation of active) {
        this.db
          .prepare("UPDATE reservations SET state = 'RELEASED' WHERE reservation_id = ?")
          .run(reservation.reservation_id);
      }

      this.db
        .prepare(`
          UPDATE orders
          SET policy_blocked = 1, policy_reason = ?, reserved_sell = '0', state = 'POLICY_BLOCKED'
          WHERE order_hash = ?
        `)
        .run(reason, orderHash);
      this.#audit('POLICY_BLOCKED', { orderHash, details: { reason } });
      return active.length;
    });
  }

  unblockPolicy(orderHash) {
    return this.#transaction(() => {
      const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!row) throw new Error('order not found');
      if (row.offchain_hidden || row.onchain_invalidated) {
        throw new Error('cancelled order cannot be policy-unblocked');
      }

      const filled = BigInt(row.confirmed_filled_sell);
      const signed = BigInt(row.sell_amount);
      const state = filled === 0n ? 'OPEN' : filled < signed ? 'PARTIALLY_FILLED' : 'FILLED';
      this.db
        .prepare(
          'UPDATE orders SET policy_blocked = 0, policy_reason = NULL, state = ? WHERE order_hash = ?',
        )
        .run(state, orderHash);
      this.#audit('POLICY_UNBLOCKED', { orderHash });
    });
  }

  cancelOffchain(orderHash, { onChainInvalidated = false } = {}) {
    return this.#transaction(() => {
      const row = this.db.prepare('SELECT * FROM orders WHERE order_hash = ?').get(orderHash);
      if (!row) throw new Error('order not found');

      const active = this.db
        .prepare("SELECT * FROM reservations WHERE order_hash = ? AND state = 'ACTIVE'")
        .all(orderHash);
      for (const reservation of active) {
        this.db
          .prepare("UPDATE reservations SET state = 'RELEASED' WHERE reservation_id = ?")
          .run(reservation.reservation_id);
      }

      this.db
        .prepare(`
          UPDATE orders
          SET offchain_hidden = 1, onchain_invalidated = ?, reserved_sell = '0', state = 'CANCELLED'
          WHERE order_hash = ?
        `)
        .run(onChainInvalidated ? 1 : row.onchain_invalidated, orderHash);
      this.#audit('ORDER_CANCELLED', { orderHash, details: { onChainInvalidated } });
      return active.length;
    });
  }

  markOnChainInvalidated(orderHash) {
    return this.#transaction(() => {
      const row = this.db
        .prepare('SELECT order_hash FROM orders WHERE order_hash = ?')
        .get(orderHash);
      if (!row) throw new Error('order not found');
      this.db
        .prepare(
          "UPDATE orders SET onchain_invalidated = 1, offchain_hidden = 1, reserved_sell = '0', state = 'CANCELLED' WHERE order_hash = ?",
        )
        .run(orderHash);
      this.#audit('ONCHAIN_INVALIDATION_OBSERVED', { orderHash });
    });
  }

  aggregateDepth({ inputToken, outputToken }) {
    const input = normalizeAddress(inputToken, 'inputToken');
    const output = normalizeAddress(outputToken, 'outputToken');
    const nowSeconds = Math.floor(this.now() / 1000);
    const rows = this.#candidateRows(input, output, nowSeconds);
    const levels = new Map();

    for (const row of rows) {
      const key = normalizedPriceKey(row.buy_amount, row.sell_amount);
      const [buyAmount, sellAmount] = key.split(':');
      const current = levels.get(key) ?? {
        buyAmount,
        sellAmount,
        availableSell: 0n,
      };
      current.availableSell += availableSell(row);
      levels.set(key, current);
    }

    return [...levels.values()].map((level) => ({
      buyAmount: level.buyAmount,
      sellAmount: level.sellAmount,
      availableSell: level.availableSell.toString(),
    }));
  }

  auditEvents() {
    return this.db
      .prepare('SELECT * FROM audit_events ORDER BY id ASC')
      .all()
      .map((row) => ({ ...row, details: parseJson(row.details_json) }));
  }
}
