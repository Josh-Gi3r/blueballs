import { randomUUID } from "node:crypto";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";

import {
  planExactOutput,
  reservePlan,
} from "../../../packages/fx-liquidity/src/index.js";

function parse(value) {
  return JSON.parse(value);
}

function rowToQuote(row) {
  if (!row) return null;
  return {
    ...parse(row.public_json),
    state: row.state,
    submissionRef: row.submission_ref,
    eventId: row.event_id,
    failureReason: row.failure_reason,
  };
}

function errorWithCode(message, code, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

/**
 * Canonical reference quote coordinator.
 *
 * It compares every policy-approved source through fx-liquidity, reserves every
 * selected leg, and only then exposes a firm sandbox quote. The underlying
 * providers remain adapters: private signed orders, issuer/LP/treasury reference
 * inventory and bank principal all keep their own reservation semantics.
 */
export class IntegratedQuoteCoordinator {
  constructor({
    market,
    policyEngine,
    privateAdapter,
    referenceBook,
    staticAdapter,
    principalAdapter,
    assetFor,
    path = ":memory:",
    now = () => Date.now(),
    defaultParticipantId = "sandbox-customer",
    defaultAccountRef = "sandbox-customer:wallet",
  } = {}) {
    if (!market || typeof market.getRoute !== "function")
      throw new TypeError("FxMarketService required");
    if (!policyEngine || typeof policyEngine.authorize !== "function")
      throw new TypeError("FxPolicyEngine required");
    if (!privateAdapter || typeof privateAdapter.listSlices !== "function") {
      throw new TypeError("PrivateMarketLiquidityAdapter required");
    }
    if (!referenceBook || typeof referenceBook.listSlices !== "function") {
      throw new TypeError("ReferenceLiquidityBook required");
    }
    if (!staticAdapter || typeof staticAdapter.reserve !== "function") {
      throw new TypeError("ReferenceLiquidityAdapter required");
    }
    if (
      !principalAdapter ||
      typeof principalAdapter.listSlices !== "function"
    ) {
      throw new TypeError("PrincipalLiquidityAdapter required");
    }
    if (typeof assetFor !== "function")
      throw new TypeError("assetFor required");

    this.market = market;
    this.policyEngine = policyEngine;
    this.privateAdapter = privateAdapter;
    this.referenceBook = referenceBook;
    this.staticAdapter = staticAdapter;
    this.principalAdapter = principalAdapter;
    this.assetFor = assetFor;
    this.now = now;
    this.defaultParticipantId = defaultParticipantId;
    this.defaultAccountRef = defaultAccountRef;
    this.adapters = {
      PRIVATE_MARKET: privateAdapter,
      ISSUER: staticAdapter,
      INSTITUTIONAL_LP: staticAdapter,
      NEOBANK: staticAdapter,
      BANK_TREASURY: staticAdapter,
      BANK_PRINCIPAL: principalAdapter,
    };

    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS integrated_fx_quotes (
        quote_id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        public_json TEXT NOT NULL,
        private_json TEXT NOT NULL,
        submission_ref TEXT,
        event_id TEXT,
        failure_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_integrated_fx_quote_state
        ON integrated_fx_quotes(state, expires_at);
    `);
  }

  #transaction(fn) {
    return this.db.transactionSync(fn);
  }

  #adapterFor(sourceType) {
    const adapter = this.adapters[sourceType];
    if (!adapter)
      throw new Error(`missing integrated adapter for ${sourceType}`);
    return adapter;
  }

  #authorizeCustomer({
    participantId,
    accountRef,
    inputAsset,
    outputAsset,
    exactOutput,
  }) {
    const decision = this.policyEngine.authorize({
      participantId,
      action: "TAKE_LIQUIDITY",
      inputAsset,
      outputAsset,
      amount: String(exactOutput),
      accountRef,
    });
    if (!decision.eligible) {
      throw errorWithCode(
        "customer is not eligible for this FX request",
        "POLICY_REJECTED",
        {
          reasons: decision.reasons,
        },
      );
    }
    return decision;
  }

  candidateSlices({ inputAsset, outputAsset, exactOutput, expiresAt }) {
    return [
      ...this.privateAdapter.listSlices({ inputAsset, outputAsset, expiresAt }),
      ...this.referenceBook.listSlices({ inputAsset, outputAsset }),
      ...this.principalAdapter.listSlices({
        inputAsset,
        outputAsset,
        desiredOutput: String(exactOutput),
        expiresAt,
      }),
    ];
  }

  async reserveExactOutput({
    inputAsset,
    outputAsset,
    exactOutput,
    expiresInMs = 15_000,
    participantId = this.defaultParticipantId,
    accountRef = this.defaultAccountRef,
  }) {
    if (
      !Number.isSafeInteger(expiresInMs) ||
      expiresInMs <= 0 ||
      expiresInMs > 120_000
    ) {
      throw new RangeError("expiresInMs invalid");
    }
    const desired = BigInt(String(exactOutput));
    if (desired <= 0n) throw new RangeError("exactOutput must be positive");
    if (!this.assetFor(inputAsset) || !this.assetFor(outputAsset)) {
      throw errorWithCode("unknown reference asset", "VALIDATION_ERROR");
    }

    const now = this.now();
    const expiresAt = now + expiresInMs;
    const quoteId = `quote_${randomUUID()}`;
    const routeId = `route_${randomUUID()}`;
    const customerAuthorization = this.#authorizeCustomer({
      participantId,
      accountRef,
      inputAsset,
      outputAsset,
      exactOutput: desired,
    });

    const slices = this.candidateSlices({
      inputAsset,
      outputAsset,
      exactOutput: desired,
      expiresAt,
    });
    let plan;
    try {
      plan = planExactOutput({
        inputAsset,
        outputAsset,
        desiredOutput: desired.toString(),
        slices,
        now,
      });
    } catch (error) {
      if (error.code === "NO_LIQUIDITY") throw error;
      throw errorWithCode(error.message, "NO_LIQUIDITY");
    }

    const reserved = await reservePlan({
      routeId,
      plan,
      adapters: this.adapters,
    });

    const inputMeta = this.assetFor(inputAsset);
    const outputMeta = this.assetFor(outputAsset);
    const publicQuote = {
      id: quoteId,
      routeId,
      state: "RESERVED",
      inputAsset,
      outputAsset,
      inputSymbol: inputMeta.symbol,
      outputSymbol: outputMeta.symbol,
      maxInput: reserved.totalInput,
      output: reserved.totalOutput,
      expiresAt,
      participantId,
      customerAuthorization: {
        authorizationId: customerAuthorization.authorizationId,
        expiresAt: customerAuthorization.expiresAt,
        policyId: customerAuthorization.policyId,
        policyVersion: customerAuthorization.policyVersion,
      },
      sources: reserved.legs.map((leg) => ({
        type: leg.sourceType,
        sourceId: leg.sourceId,
        input: leg.inputAmount,
        output: leg.outputAmount,
      })),
      finality: {
        // `atomic` is a property of the ROUTE THIS QUOTE DESCRIBES, not evidence
        // that anything settled atomically. The on-chain router in
        // packages/fx-contracts is real, tested Solidity that this runtime does
        // not call: there is no chain client here and the execution adapter is
        // unconfigured by default, so a quote settles against the ledger.
        // The previous `condition` claimed the route "executed through the
        // Blueballs AtomicRouter", which described something that had not
        // happened and could not happen in this configuration.
        atomic: true,
        class: "ATOMIC",
        condition:
          "atomic once executed through the Blueballs AtomicRouter; requires a configured execution adapter",
        onChainSettlement: "not-configured",
      },
    };
    const privateQuote = {
      quoteId,
      routeId,
      participantId,
      accountRef,
      customerAuthorization,
      plan,
      reserved,
    };

    try {
      this.db
        .prepare(
          `
        INSERT INTO integrated_fx_quotes(
          quote_id, route_id, state, created_at, expires_at, public_json, private_json
        ) VALUES (?, ?, 'RESERVED', ?, ?, ?, ?)
      `,
        )
        .run(
          quoteId,
          routeId,
          now,
          expiresAt,
          JSON.stringify(publicQuote),
          JSON.stringify(privateQuote),
        );
    } catch (error) {
      for (let i = reserved.legs.length - 1; i >= 0; i -= 1) {
        const leg = reserved.legs[i];
        await this.#adapterFor(leg.sourceType).release({
          routeId,
          leg,
          reservationHandle: leg.reservationHandle,
          reason: "QUOTE_STORE_FAILED",
        });
      }
      throw error;
    }
    return publicQuote;
  }

  getQuote(quoteId) {
    return rowToQuote(
      this.db
        .prepare("SELECT * FROM integrated_fx_quotes WHERE quote_id = ?")
        .get(quoteId),
    );
  }

  getPrivateQuote(quoteId) {
    const row = this.db
      .prepare("SELECT * FROM integrated_fx_quotes WHERE quote_id = ?")
      .get(quoteId);
    if (!row) return null;
    return {
      row,
      publicQuote: rowToQuote(row),
      route: parse(row.private_json),
    };
  }

  getRoute(routeId) {
    const row = this.db
      .prepare("SELECT * FROM integrated_fx_quotes WHERE route_id = ?")
      .get(routeId);
    if (!row) return null;
    const publicQuote = parse(row.public_json);
    return {
      routeId,
      quoteId: row.quote_id,
      state: row.state,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      submissionRef: row.submission_ref,
      eventId: row.event_id,
      failureReason: row.failure_reason,
      inputAsset: publicQuote.inputAsset,
      outputAsset: publicQuote.outputAsset,
      totalInput: publicQuote.maxInput,
      totalOutput: publicQuote.output,
      sources: publicQuote.sources,
      finality: publicQuote.finality,
    };
  }

  markSubmitted(quoteId, submissionRef) {
    if (typeof submissionRef !== "string" || submissionRef.length === 0) {
      throw new TypeError("submissionRef is required");
    }
    const quote = this.getPrivateQuote(quoteId);
    if (!quote) throw new Error("quote not found");
    if (
      quote.row.state === "SUBMITTED" &&
      quote.row.submission_ref === submissionRef
    ) {
      return this.getQuote(quoteId);
    }
    if (quote.row.state !== "RESERVED")
      throw new Error(`quote cannot execute from ${quote.row.state}`);
    if (quote.row.expires_at <= this.now()) throw new Error("quote expired");

    for (const leg of quote.route.reserved.legs) {
      const adapter = this.#adapterFor(leg.sourceType);
      if (typeof adapter.validateReserved === "function") {
        adapter.validateReserved({
          routeId: quote.row.route_id,
          leg,
          reservationHandle: leg.reservationHandle,
        });
      }
    }

    this.#transaction(() => {
      const current = this.db
        .prepare(
          "SELECT state, expires_at FROM integrated_fx_quotes WHERE quote_id = ?",
        )
        .get(quoteId);
      if (!current) throw new Error("quote not found");
      if (current.state !== "RESERVED")
        throw new Error(`quote cannot execute from ${current.state}`);
      if (current.expires_at <= this.now()) throw new Error("quote expired");
      this.db
        .prepare(
          `
        UPDATE integrated_fx_quotes
        SET state = 'SUBMITTED', submission_ref = ?
        WHERE quote_id = ?
      `,
        )
        .run(submissionRef, quoteId);
    });

    for (let index = 0; index < quote.route.reserved.legs.length; index += 1) {
      const leg = quote.route.reserved.legs[index];
      const adapter = this.#adapterFor(leg.sourceType);
      if (typeof adapter.markSubmitted === "function") {
        adapter.markSubmitted({
          routeId: quote.row.route_id,
          leg,
          reservationHandle: leg.reservationHandle,
          submissionRef: `${submissionRef}:${index}`,
        });
      }
    }
    return this.getQuote(quoteId);
  }

  confirm(quoteId, { eventId }) {
    if (typeof eventId !== "string" || eventId.length === 0)
      throw new TypeError("eventId required");
    const quote = this.getPrivateQuote(quoteId);
    if (!quote) throw new Error("quote not found");
    if (quote.row.state === "CONFIRMED" && quote.row.event_id === eventId) {
      return { duplicate: true, quote: this.getQuote(quoteId) };
    }
    if (quote.row.state !== "SUBMITTED")
      throw new Error("quote must be SUBMITTED before confirmation");

    for (let index = 0; index < quote.route.reserved.legs.length; index += 1) {
      const leg = quote.route.reserved.legs[index];
      const adapter = this.#adapterFor(leg.sourceType);
      if (typeof adapter.confirm === "function") {
        adapter.confirm({
          routeId: quote.row.route_id,
          leg,
          reservationHandle: leg.reservationHandle,
          eventId: `${eventId}:${index}`,
        });
      }
    }
    this.db
      .prepare(
        `
      UPDATE integrated_fx_quotes
      SET state = 'CONFIRMED', event_id = ?
      WHERE quote_id = ?
    `,
      )
      .run(eventId, quoteId);
    return { duplicate: false, quote: this.getQuote(quoteId) };
  }

  fail(quoteId, { eventId = null, reason = "SETTLEMENT_FAILED" }) {
    const quote = this.getPrivateQuote(quoteId);
    if (!quote) throw new Error("quote not found");
    if (quote.row.state === "FAILED")
      return { duplicate: true, quote: this.getQuote(quoteId) };
    if (quote.row.state !== "SUBMITTED")
      throw new Error("only a submitted quote can fail settlement");

    for (
      let index = quote.route.reserved.legs.length - 1;
      index >= 0;
      index -= 1
    ) {
      const leg = quote.route.reserved.legs[index];
      const adapter = this.#adapterFor(leg.sourceType);
      if (typeof adapter.fail === "function") {
        adapter.fail({
          routeId: quote.row.route_id,
          leg,
          reservationHandle: leg.reservationHandle,
          eventId: eventId ? `${eventId}:${index}` : null,
          reason,
        });
      }
    }
    this.db
      .prepare(
        `
      UPDATE integrated_fx_quotes
      SET state = 'FAILED', event_id = ?, failure_reason = ?
      WHERE quote_id = ?
    `,
      )
      .run(eventId, reason, quoteId);
    return { duplicate: false, quote: this.getQuote(quoteId) };
  }

  expire(now = this.now()) {
    const rows = this.db
      .prepare(
        `
      SELECT quote_id FROM integrated_fx_quotes
      WHERE state = 'RESERVED' AND expires_at <= ?
    `,
      )
      .all(now);
    let expired = 0;
    for (const { quote_id: quoteId } of rows) {
      const quote = this.getPrivateQuote(quoteId);
      if (!quote) continue;
      for (
        let index = quote.route.reserved.legs.length - 1;
        index >= 0;
        index -= 1
      ) {
        const leg = quote.route.reserved.legs[index];
        this.#adapterFor(leg.sourceType).release({
          routeId: quote.row.route_id,
          leg,
          reservationHandle: leg.reservationHandle,
          reason: "EXPIRED",
        });
      }
      this.db
        .prepare(
          "UPDATE integrated_fx_quotes SET state = 'EXPIRED' WHERE quote_id = ?",
        )
        .run(quoteId);
      expired += 1;
    }
    return expired;
  }

  close() {
    this.db.close();
  }
}
