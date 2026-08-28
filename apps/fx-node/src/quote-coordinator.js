import { randomUUID } from "node:crypto";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";

function parse(value) {
  return JSON.parse(value);
}

export class PrivateMarketQuoteCoordinator {
  constructor({ market, path = ":memory:", now = () => Date.now() } = {}) {
    if (!market || typeof market.reserveExactOutput !== "function") {
      throw new TypeError("market service required");
    }
    this.market = market;
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fx_node_quotes (
        quote_id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        public_json TEXT NOT NULL,
        private_json TEXT NOT NULL,
        submission_ref TEXT
      );
    `);
  }

  close() {
    this.db.close();
  }

  reserveExactOutput({
    inputAsset,
    outputAsset,
    exactOutput,
    expiresInMs = 15_000,
  }) {
    if (
      !Number.isSafeInteger(expiresInMs) ||
      expiresInMs <= 0 ||
      expiresInMs > 120_000
    ) {
      throw new RangeError("expiresInMs invalid");
    }
    const now = this.now();
    const quoteId = `quote_${randomUUID()}`;
    const routeId = `route_${randomUUID()}`;
    const expiresAt = now + expiresInMs;

    const route = this.market.reserveExactOutput({
      routeId,
      inputToken: inputAsset,
      outputToken: outputAsset,
      desiredOutput: String(exactOutput),
      expiresAt,
    });

    const publicQuote = {
      id: quoteId,
      routeId,
      state: "RESERVED",
      inputAsset,
      outputAsset,
      maxInput: route.totalInput,
      output: route.totalOutput,
      expiresAt,
      sources: route.fills.map((fill) => ({
        type: "PRIVATE_MARKET",
        input: fill.expectedTakerPay,
        output: fill.makerSellAmount,
      })),
      finality: { atomic: true, class: "ATOMIC" },
    };

    try {
      this.db
        .prepare(
          `
        INSERT INTO fx_node_quotes(
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
          JSON.stringify(route),
        );
    } catch (error) {
      this.market.releaseRoute(routeId, "QUOTE_STORE_FAILED");
      throw error;
    }
    return publicQuote;
  }

  getQuote(quoteId) {
    const row = this.db
      .prepare("SELECT * FROM fx_node_quotes WHERE quote_id = ?")
      .get(quoteId);
    if (!row) return null;
    return {
      ...parse(row.public_json),
      state: row.state,
      submissionRef: row.submission_ref,
    };
  }

  getPrivateQuote(quoteId) {
    const row = this.db
      .prepare("SELECT * FROM fx_node_quotes WHERE quote_id = ?")
      .get(quoteId);
    if (!row) return null;
    return {
      row,
      publicQuote: parse(row.public_json),
      route: parse(row.private_json),
    };
  }

  markSubmitted(quoteId, submissionRef) {
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

    this.market.markRouteSubmitted(quote.row.route_id, submissionRef);
    this.db
      .prepare(
        "UPDATE fx_node_quotes SET state = 'SUBMITTED', submission_ref = ? WHERE quote_id = ?",
      )
      .run(submissionRef, quoteId);
    return this.getQuote(quoteId);
  }

  confirm(quoteId, { eventId, fills }) {
    const quote = this.getPrivateQuote(quoteId);
    if (!quote) throw new Error("quote not found");
    this.market.confirmSubmittedRoute({
      routeId: quote.row.route_id,
      eventId,
      fills,
    });
    this.db
      .prepare(
        "UPDATE fx_node_quotes SET state = 'CONFIRMED' WHERE quote_id = ?",
      )
      .run(quoteId);
    return this.getQuote(quoteId);
  }

  fail(quoteId, { eventId = null, reason }) {
    const quote = this.getPrivateQuote(quoteId);
    if (!quote) throw new Error("quote not found");
    this.market.failSubmittedRoute({
      routeId: quote.row.route_id,
      eventId,
      reason,
    });
    this.db
      .prepare("UPDATE fx_node_quotes SET state = 'FAILED' WHERE quote_id = ?")
      .run(quoteId);
    return this.getQuote(quoteId);
  }
}
