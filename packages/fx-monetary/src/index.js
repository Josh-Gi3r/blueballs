import { randomUUID } from "node:crypto";

import { DatabaseSync } from "../../sqlite-compat/src/index.js";

export const INSTRUMENT_KINDS = Object.freeze({
  STABLECOIN: "STABLECOIN",
  TOKENIZED_DEPOSIT: "TOKENIZED_DEPOSIT",
});

const INSTRUMENT_KIND_SET = new Set(Object.values(INSTRUMENT_KINDS));
const RECEIPT_STATES = new Set(["ACTIVE", "CONSUMED", "EXPIRED"]);

function fail(code, message, status = 400, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  throw error;
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0)
    fail("VALIDATION_ERROR", `${name} required`);
  return value.trim();
}

export function atomic(value, name = "amount") {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    fail("VALIDATION_ERROR", `${name} must be an unsigned integer string`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n)
    fail("VALIDATION_ERROR", `${name} must be greater than zero`);
  return parsed;
}

function nonNegativeAtomic(value, name) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    fail("VALIDATION_ERROR", `${name} must be an unsigned integer string`);
  }
  return BigInt(value);
}

function safeInteger(
  value,
  name,
  { min = 0, max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(
      "VALIDATION_ERROR",
      `${name} must be an integer between ${min} and ${max}`,
    );
  }
  return value;
}

function rowToInstrument(row) {
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    reserveCurrency: row.reserve_currency,
    decimals: row.decimals,
    minCoverageBps: row.min_coverage_bps,
    transferable: row.transferable === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

function rowToReserve(row) {
  if (!row) return null;
  return {
    depositId: row.deposit_id,
    reserveCurrency: row.reserve_currency,
    amount: row.amount,
    state: row.state,
    providerRef: row.provider_ref,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  };
}

function rowToReceipt(row) {
  if (!row) return null;
  return {
    receiptId: row.receipt_id,
    reserveCurrency: row.reserve_currency,
    amount: row.amount,
    beneficiaryRef: row.beneficiary_ref,
    purpose: row.purpose,
    transferable: false,
    state: row.state,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

export class MonetaryEngine {
  constructor({ path = ":memory:", now = () => Date.now() } = {}) {
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    this.#migrate();
  }

  close() {
    this.db.close();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monetary_instruments (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        reserve_currency TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        min_coverage_bps INTEGER NOT NULL,
        transferable INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS monetary_reserve_deposits (
        deposit_id TEXT PRIMARY KEY,
        reserve_currency TEXT NOT NULL,
        amount TEXT NOT NULL,
        state TEXT NOT NULL,
        provider_ref TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        settled_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS monetary_supply (
        instrument_code TEXT PRIMARY KEY REFERENCES monetary_instruments(code),
        amount TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS monetary_risk_capital (
        reserve_currency TEXT PRIMARY KEY,
        amount TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS monetary_receipts (
        receipt_id TEXT PRIMARY KEY,
        reserve_currency TEXT NOT NULL,
        amount TEXT NOT NULL,
        beneficiary_ref TEXT NOT NULL,
        purpose TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS monetary_events (
        event_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        instrument_code TEXT,
        reserve_currency TEXT,
        amount TEXT,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_monetary_reserves_currency_state
        ON monetary_reserve_deposits(reserve_currency, state);
      CREATE INDEX IF NOT EXISTS idx_monetary_receipts_currency_state
        ON monetary_receipts(reserve_currency, state);
      CREATE INDEX IF NOT EXISTS idx_monetary_events_created
        ON monetary_events(created_at);
    `);
  }

  #transaction(callback) {
    return this.db.transactionSync(callback);
  }

  #event(
    kind,
    {
      instrumentCode = null,
      reserveCurrency = null,
      amount = null,
      ...payload
    } = {},
  ) {
    const eventId = `mon_evt_${randomUUID()}`;
    const createdAt = this.now();
    this.db
      .prepare(
        `
      INSERT INTO monetary_events(
        event_id, kind, instrument_code, reserve_currency, amount, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        eventId,
        kind,
        instrumentCode,
        reserveCurrency,
        amount,
        createdAt,
        JSON.stringify(payload),
      );
    return { eventId, createdAt };
  }

  configureInstrument({
    code,
    name,
    kind,
    reserveCurrency,
    decimals = 6,
    minCoverageBps = 10_000,
    transferable = true,
    enabled = true,
  }) {
    code = requiredString(code, "code").toUpperCase();
    name = requiredString(name, "name");
    reserveCurrency = requiredString(
      reserveCurrency,
      "reserveCurrency",
    ).toUpperCase();
    if (!INSTRUMENT_KIND_SET.has(kind))
      fail("VALIDATION_ERROR", "unsupported instrument kind");
    safeInteger(decimals, "decimals", { min: 0, max: 18 });
    safeInteger(minCoverageBps, "minCoverageBps", {
      min: 10_000,
      max: 100_000,
    });
    if (kind === INSTRUMENT_KINDS.TOKENIZED_DEPOSIT && transferable !== true) {
      fail(
        "VALIDATION_ERROR",
        "tokenized deposit transferability must be explicit and enabled in this reference model",
      );
    }
    const createdAt = this.now();
    this.#transaction(() => {
      this.db
        .prepare(
          `
        INSERT INTO monetary_instruments(
          code, name, kind, reserve_currency, decimals, min_coverage_bps, transferable, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          kind = excluded.kind,
          reserve_currency = excluded.reserve_currency,
          decimals = excluded.decimals,
          min_coverage_bps = excluded.min_coverage_bps,
          transferable = excluded.transferable,
          enabled = excluded.enabled
      `,
        )
        .run(
          code,
          name,
          kind,
          reserveCurrency,
          decimals,
          minCoverageBps,
          transferable ? 1 : 0,
          enabled ? 1 : 0,
          createdAt,
        );
      this.db
        .prepare(
          `
        INSERT INTO monetary_supply(instrument_code, amount) VALUES (?, '0')
        ON CONFLICT(instrument_code) DO NOTHING
      `,
        )
        .run(code);
    });
    return this.getInstrument(code);
  }

  listInstruments({ includeDisabled = false } = {}) {
    const sql = includeDisabled
      ? "SELECT * FROM monetary_instruments ORDER BY code"
      : "SELECT * FROM monetary_instruments WHERE enabled = 1 ORDER BY code";
    return this.db.prepare(sql).all().map(rowToInstrument);
  }

  getInstrument(code) {
    return rowToInstrument(
      this.db
        .prepare("SELECT * FROM monetary_instruments WHERE code = ?")
        .get(String(code).toUpperCase()),
    );
  }

  disableInstrument(code) {
    code = requiredString(code, "code").toUpperCase();
    const instrument = this.getInstrument(code);
    if (!instrument) return null;
    const supply = this.db
      .prepare("SELECT amount FROM monetary_supply WHERE instrument_code = ?")
      .get(code);
    if (BigInt(supply?.amount ?? "0") !== 0n) {
      fail(
        "INSTRUMENT_HAS_SUPPLY",
        "cannot disable an instrument with outstanding supply",
        409,
      );
    }
    this.db
      .prepare("UPDATE monetary_instruments SET enabled = 0 WHERE code = ?")
      .run(code);
    return this.getInstrument(code);
  }

  createReserveDeposit({ reserveCurrency, amount, providerRef }) {
    reserveCurrency = requiredString(
      reserveCurrency,
      "reserveCurrency",
    ).toUpperCase();
    const amountValue = atomic(amount);
    providerRef = requiredString(providerRef, "providerRef");
    const depositId = `reserve_${randomUUID()}`;
    const createdAt = this.now();
    try {
      this.#transaction(() => {
        this.db
          .prepare(
            `
          INSERT INTO monetary_reserve_deposits(
            deposit_id, reserve_currency, amount, state, provider_ref, created_at
          ) VALUES (?, ?, ?, 'PENDING', ?, ?)
        `,
          )
          .run(
            depositId,
            reserveCurrency,
            amountValue.toString(),
            providerRef,
            createdAt,
          );
        this.#event("RESERVE_DEPOSIT_CREATED", {
          reserveCurrency,
          amount: amountValue.toString(),
          depositId,
          providerRef,
        });
      });
    } catch (error) {
      if (/unique/i.test(error.message))
        fail("RESERVE_REPLAY", "providerRef already used", 409);
      throw error;
    }
    return this.getReserveDeposit(depositId);
  }

  settleReserveDeposit(depositId) {
    return this.#transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM monetary_reserve_deposits WHERE deposit_id = ?")
        .get(depositId);
      if (!row) fail("NOT_FOUND", "reserve deposit not found", 404);
      if (row.state !== "PENDING")
        fail(
          "INVALID_STATE",
          `cannot settle reserve deposit from ${row.state}`,
          409,
        );
      const settledAt = this.now();
      this.db
        .prepare(
          `
        UPDATE monetary_reserve_deposits SET state = 'SETTLED', settled_at = ? WHERE deposit_id = ?
      `,
        )
        .run(settledAt, depositId);
      this.#event("RESERVE_DEPOSIT_SETTLED", {
        reserveCurrency: row.reserve_currency,
        amount: row.amount,
        depositId,
      });
      return this.getReserveDeposit(depositId);
    });
  }

  getReserveDeposit(depositId) {
    return rowToReserve(
      this.db
        .prepare("SELECT * FROM monetary_reserve_deposits WHERE deposit_id = ?")
        .get(depositId),
    );
  }

  setRiskCapital({ reserveCurrency, amount }) {
    reserveCurrency = requiredString(
      reserveCurrency,
      "reserveCurrency",
    ).toUpperCase();
    const amountValue = nonNegativeAtomic(String(amount), "amount");
    this.#transaction(() => {
      this.db
        .prepare(
          `
        INSERT INTO monetary_risk_capital(reserve_currency, amount) VALUES (?, ?)
        ON CONFLICT(reserve_currency) DO UPDATE SET amount = excluded.amount
      `,
        )
        .run(reserveCurrency, amountValue.toString());
      this.#event("RISK_CAPITAL_SET", {
        reserveCurrency,
        amount: amountValue.toString(),
      });
    });
    return {
      reserveCurrency,
      amount: amountValue.toString(),
      countedAsReserve: false,
    };
  }

  #expireReceipts(reserveCurrency = null) {
    const rows = reserveCurrency
      ? this.db
          .prepare(
            `
          SELECT * FROM monetary_receipts
          WHERE reserve_currency = ? AND state = 'ACTIVE' AND expires_at <= ?
        `,
          )
          .all(reserveCurrency, this.now())
      : this.db
          .prepare(
            `
          SELECT * FROM monetary_receipts WHERE state = 'ACTIVE' AND expires_at <= ?
        `,
          )
          .all(this.now());
    for (const row of rows) {
      this.db
        .prepare(
          "UPDATE monetary_receipts SET state = 'EXPIRED' WHERE receipt_id = ?",
        )
        .run(row.receipt_id);
      this.#event("RECEIPT_EXPIRED", {
        reserveCurrency: row.reserve_currency,
        amount: row.amount,
        receiptId: row.receipt_id,
      });
    }
  }

  #currencyTotals(reserveCurrency) {
    this.#expireReceipts(reserveCurrency);
    const settled = this.db
      .prepare(
        `
      SELECT amount FROM monetary_reserve_deposits
      WHERE reserve_currency = ? AND state = 'SETTLED'
    `,
      )
      .all(reserveCurrency)
      .reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const supply = this.db
      .prepare(
        `
      SELECT s.amount FROM monetary_supply s
      JOIN monetary_instruments i ON i.code = s.instrument_code
      WHERE i.reserve_currency = ?
    `,
      )
      .all(reserveCurrency)
      .reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const lockedReceipts = this.db
      .prepare(
        `
      SELECT amount FROM monetary_receipts
      WHERE reserve_currency = ? AND state = 'ACTIVE'
    `,
      )
      .all(reserveCurrency)
      .reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const risk = this.db
      .prepare(
        "SELECT amount FROM monetary_risk_capital WHERE reserve_currency = ?",
      )
      .get(reserveCurrency);
    return {
      settled,
      supply,
      lockedReceipts,
      riskCapital: BigInt(risk?.amount ?? "0"),
      unallocated: settled - supply - lockedReceipts,
    };
  }

  mint({ instrumentCode, amount, beneficiaryRef }) {
    const code = requiredString(instrumentCode, "instrumentCode").toUpperCase();
    const amountValue = atomic(amount);
    beneficiaryRef = requiredString(beneficiaryRef, "beneficiaryRef");
    return this.#transaction(() => {
      const instrument = this.getInstrument(code);
      if (!instrument) fail("NOT_FOUND", "instrument not found", 404);
      if (!instrument.enabled)
        fail("INSTRUMENT_DISABLED", "instrument disabled", 409);
      const totals = this.#currencyTotals(instrument.reserveCurrency);
      if (totals.unallocated < amountValue) {
        fail(
          "INSUFFICIENT_SETTLED_RESERVE",
          "only settled, unallocated reserve can support minting",
          409,
          {
            requested: amountValue.toString(),
            available: (totals.unallocated > 0n
              ? totals.unallocated
              : 0n
            ).toString(),
          },
        );
      }
      const current = this.db
        .prepare("SELECT amount FROM monetary_supply WHERE instrument_code = ?")
        .get(code);
      const nextSupply = BigInt(current.amount) + amountValue;
      const liabilities = this.db
        .prepare(
          `
        SELECT i.code, i.min_coverage_bps, s.amount
        FROM monetary_instruments i
        JOIN monetary_supply s ON s.instrument_code = i.code
        WHERE i.reserve_currency = ?
      `,
        )
        .all(instrument.reserveCurrency);
      const requiredReserve = liabilities.reduce((sum, liability) => {
        const supply =
          liability.code === code ? nextSupply : BigInt(liability.amount);
        return (
          sum + (supply * BigInt(liability.min_coverage_bps) + 9_999n) / 10_000n
        );
      }, 0n);
      if (totals.settled < requiredReserve)
        fail(
          "COVERAGE_LIMIT",
          "mint would violate minimum reserve coverage",
          409,
        );
      this.db
        .prepare(
          "UPDATE monetary_supply SET amount = ? WHERE instrument_code = ?",
        )
        .run(nextSupply.toString(), code);
      const event = this.#event("MINTED", {
        instrumentCode: code,
        reserveCurrency: instrument.reserveCurrency,
        amount: amountValue.toString(),
        beneficiaryRef,
      });
      return {
        ...event,
        instrumentCode: code,
        amount: amountValue.toString(),
        beneficiaryRef,
        supply: nextSupply.toString(),
      };
    });
  }

  redeem({ instrumentCode, amount, holderRef }) {
    const code = requiredString(instrumentCode, "instrumentCode").toUpperCase();
    const amountValue = atomic(amount);
    holderRef = requiredString(holderRef, "holderRef");
    return this.#transaction(() => {
      const instrument = this.getInstrument(code);
      if (!instrument) fail("NOT_FOUND", "instrument not found", 404);
      const current = this.db
        .prepare("SELECT amount FROM monetary_supply WHERE instrument_code = ?")
        .get(code);
      const supply = BigInt(current.amount);
      if (supply < amountValue)
        fail(
          "INSUFFICIENT_SUPPLY",
          "redemption exceeds outstanding supply",
          409,
        );
      const deposits = this.db
        .prepare(
          `
        SELECT * FROM monetary_reserve_deposits
        WHERE reserve_currency = ? AND state = 'SETTLED'
        ORDER BY settled_at, deposit_id
      `,
        )
        .all(instrument.reserveCurrency);
      let remaining = amountValue;
      for (const deposit of deposits) {
        if (remaining === 0n) break;
        const available = BigInt(deposit.amount);
        if (available <= remaining) {
          this.db
            .prepare(
              "UPDATE monetary_reserve_deposits SET amount = '0', state = 'REDEEMED' WHERE deposit_id = ?",
            )
            .run(deposit.deposit_id);
          remaining -= available;
        } else {
          this.db
            .prepare(
              "UPDATE monetary_reserve_deposits SET amount = ? WHERE deposit_id = ?",
            )
            .run((available - remaining).toString(), deposit.deposit_id);
          remaining = 0n;
        }
      }
      if (remaining !== 0n)
        fail(
          "INSUFFICIENT_SETTLED_RESERVE",
          "settled reserve unavailable for redemption",
          409,
        );
      const nextSupply = supply - amountValue;
      this.db
        .prepare(
          "UPDATE monetary_supply SET amount = ? WHERE instrument_code = ?",
        )
        .run(nextSupply.toString(), code);
      const event = this.#event("REDEEMED", {
        instrumentCode: code,
        reserveCurrency: instrument.reserveCurrency,
        amount: amountValue.toString(),
        holderRef,
      });
      return {
        ...event,
        instrumentCode: code,
        amount: amountValue.toString(),
        holderRef,
        supply: nextSupply.toString(),
      };
    });
  }

  createReceipt({
    reserveCurrency,
    amount,
    beneficiaryRef,
    purpose,
    expiresAt,
  }) {
    reserveCurrency = requiredString(
      reserveCurrency,
      "reserveCurrency",
    ).toUpperCase();
    const amountValue = atomic(amount);
    beneficiaryRef = requiredString(beneficiaryRef, "beneficiaryRef");
    purpose = requiredString(purpose, "purpose");
    safeInteger(expiresAt, "expiresAt", { min: this.now() + 1 });
    return this.#transaction(() => {
      const totals = this.#currencyTotals(reserveCurrency);
      if (totals.unallocated < amountValue) {
        fail(
          "INSUFFICIENT_SETTLED_RESERVE",
          "receipt requires settled, unallocated reserve",
          409,
        );
      }
      const receiptId = `receipt_${randomUUID()}`;
      const createdAt = this.now();
      this.db
        .prepare(
          `
        INSERT INTO monetary_receipts(
          receipt_id, reserve_currency, amount, beneficiary_ref, purpose, state, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `,
        )
        .run(
          receiptId,
          reserveCurrency,
          amountValue.toString(),
          beneficiaryRef,
          purpose,
          createdAt,
          expiresAt,
        );
      this.#event("RECEIPT_CREATED", {
        reserveCurrency,
        amount: amountValue.toString(),
        receiptId,
        beneficiaryRef,
        purpose,
        expiresAt,
      });
      return this.getReceipt(receiptId);
    });
  }

  getReceipt(receiptId) {
    const initial = this.db
      .prepare("SELECT * FROM monetary_receipts WHERE receipt_id = ?")
      .get(receiptId);
    if (!initial) return null;
    if (initial.state === "ACTIVE" && initial.expires_at <= this.now())
      this.#expireReceipts(initial.reserve_currency);
    return rowToReceipt(
      this.db
        .prepare("SELECT * FROM monetary_receipts WHERE receipt_id = ?")
        .get(receiptId),
    );
  }

  consumeReceipt(receiptId) {
    return this.#transaction(() => {
      const receipt = this.getReceipt(receiptId);
      if (!receipt) fail("NOT_FOUND", "receipt not found", 404);
      if (!RECEIPT_STATES.has(receipt.state))
        fail("INVALID_STATE", "receipt has invalid state", 409);
      if (receipt.state !== "ACTIVE")
        fail(
          "INVALID_STATE",
          `cannot consume receipt from ${receipt.state}`,
          409,
        );
      const deposits = this.db
        .prepare(
          `
        SELECT * FROM monetary_reserve_deposits
        WHERE reserve_currency = ? AND state = 'SETTLED'
        ORDER BY settled_at, deposit_id
      `,
        )
        .all(receipt.reserveCurrency);
      let remaining = BigInt(receipt.amount);
      for (const deposit of deposits) {
        if (remaining === 0n) break;
        const available = BigInt(deposit.amount);
        if (available <= remaining) {
          this.db
            .prepare(
              "UPDATE monetary_reserve_deposits SET amount = '0', state = 'DISBURSED' WHERE deposit_id = ?",
            )
            .run(deposit.deposit_id);
          remaining -= available;
        } else {
          this.db
            .prepare(
              "UPDATE monetary_reserve_deposits SET amount = ? WHERE deposit_id = ?",
            )
            .run((available - remaining).toString(), deposit.deposit_id);
          remaining = 0n;
        }
      }
      if (remaining !== 0n)
        fail(
          "INSUFFICIENT_SETTLED_RESERVE",
          "receipt reserve unavailable",
          409,
        );
      const consumedAt = this.now();
      this.db
        .prepare(
          "UPDATE monetary_receipts SET state = 'CONSUMED', consumed_at = ? WHERE receipt_id = ?",
        )
        .run(consumedAt, receiptId);
      this.#event("RECEIPT_CONSUMED", {
        reserveCurrency: receipt.reserveCurrency,
        amount: receipt.amount,
        receiptId,
      });
      return this.getReceipt(receiptId);
    });
  }

  health() {
    const instruments = this.listInstruments();
    const currencies = [
      ...new Set(instruments.map((item) => item.reserveCurrency)),
    ].sort();
    const reserves = currencies.map((reserveCurrency) => {
      const totals = this.#transaction(() =>
        this.#currencyTotals(reserveCurrency),
      );
      const coverageBps =
        totals.supply === 0n
          ? null
          : Number((totals.settled * 10_000n) / totals.supply);
      return {
        reserveCurrency,
        settledReserve: totals.settled.toString(),
        redeemableSupply: totals.supply.toString(),
        lockedReceipts: totals.lockedReceipts.toString(),
        unallocatedReserve: (totals.unallocated > 0n
          ? totals.unallocated
          : 0n
        ).toString(),
        coverageBps,
        riskCapital: totals.riskCapital.toString(),
        riskCapitalCountedAsReserve: false,
      };
    });
    return {
      object: "monetary_health",
      mode: "reference-sandbox",
      reserveModel: "segregated",
      instruments: instruments.map((instrument) => {
        const supply = this.db
          .prepare(
            "SELECT amount FROM monetary_supply WHERE instrument_code = ?",
          )
          .get(instrument.code);
        return { ...instrument, supply: supply?.amount ?? "0" };
      }),
      reserves,
    };
  }

  events({ limit = 50 } = {}) {
    safeInteger(limit, "limit", { min: 1, max: 200 });
    return this.db
      .prepare(
        "SELECT * FROM monetary_events ORDER BY created_at DESC, event_id DESC LIMIT ?",
      )
      .all(limit)
      .map((row) => ({
        eventId: row.event_id,
        kind: row.kind,
        instrumentCode: row.instrument_code,
        reserveCurrency: row.reserve_currency,
        amount: row.amount,
        createdAt: row.created_at,
        ...JSON.parse(row.payload_json),
      }));
  }
}

export function previewRemittance({
  inputAmount,
  inputCurrency,
  outputCurrency,
  oracle,
  bps,
  now = Date.now(),
}) {
  const input = atomic(inputAmount, "inputAmount");
  inputCurrency = requiredString(inputCurrency, "inputCurrency").toUpperCase();
  outputCurrency = requiredString(
    outputCurrency,
    "outputCurrency",
  ).toUpperCase();
  if (!oracle || typeof oracle !== "object")
    fail("VALIDATION_ERROR", "oracle required");
  const numerator = atomic(String(oracle.midNumerator), "oracle.midNumerator");
  const denominator = atomic(
    String(oracle.midDenominator),
    "oracle.midDenominator",
  );
  safeInteger(oracle.observedAt, "oracle.observedAt");
  safeInteger(oracle.expiresAt, "oracle.expiresAt", {
    min: oracle.observedAt + 1,
  });
  if (oracle.expiresAt <= now)
    fail("ORACLE_STALE", "oracle reference is stale", 409);
  if (
    !Array.isArray(oracle.sourceIds) ||
    oracle.sourceIds.length < 2 ||
    oracle.sourceIds.some((id) => typeof id !== "string")
  ) {
    fail("VALIDATION_ERROR", "oracle requires at least two sourceIds");
  }
  if (!bps || typeof bps !== "object") fail("VALIDATION_ERROR", "bps required");
  const components = {
    market: safeInteger(bps.market ?? 0, "bps.market", { max: 10_000 }),
    volatility: safeInteger(bps.volatility ?? 0, "bps.volatility", {
      max: 10_000,
    }),
    inventory: safeInteger(bps.inventory ?? 0, "bps.inventory", {
      max: 10_000,
    }),
    sizeDepth: safeInteger(bps.sizeDepth ?? 0, "bps.sizeDepth", {
      max: 10_000,
    }),
    rail: safeInteger(bps.rail ?? 0, "bps.rail", { max: 10_000 }),
    finality: safeInteger(bps.finality ?? 0, "bps.finality", { max: 10_000 }),
    margin: safeInteger(bps.margin ?? 0, "bps.margin", { max: 10_000 }),
    nettingRebate: safeInteger(bps.nettingRebate ?? 0, "bps.nettingRebate", {
      max: 10_000,
    }),
  };
  const grossBps = Object.entries(components)
    .filter(([key]) => key !== "nettingRebate")
    .reduce((sum, [, value]) => sum + value, 0);
  const allInBps = grossBps - components.nettingRebate;
  if (allInBps < 0 || allInBps >= 10_000)
    fail("VALIDATION_ERROR", "all-in bps must be between 0 and 9999");
  const midOutput = (input * numerator) / denominator;
  const output = (midOutput * BigInt(10_000 - allInBps)) / 10_000n;
  return {
    object: "remittance_preview",
    evidence: "indicative-unreserved",
    input: { currency: inputCurrency, amount: input.toString() },
    output: {
      currency: outputCurrency,
      amount: output.toString(),
      midAmount: midOutput.toString(),
    },
    cost: {
      outputAmount: (midOutput - output).toString(),
      allInBps,
      components,
    },
    oracle: {
      midNumerator: numerator.toString(),
      midDenominator: denominator.toString(),
      observedAt: oracle.observedAt,
      expiresAt: oracle.expiresAt,
      sourceIds: [...oracle.sourceIds],
      confidence: requiredString(oracle.confidence, "oracle.confidence"),
    },
  };
}
