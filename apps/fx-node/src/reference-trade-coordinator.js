import { randomUUID } from "node:crypto";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";

import { planExactOutput } from "../../../packages/fx-liquidity/src/index.js";

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError(`${field} required`);
  return value;
}

function parseDecimal(value, decimals, field) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text))
    throw new TypeError(`${field} must be a positive decimal string`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new RangeError(`${field} has more than ${decimals} decimal places`);
  }
  const atomic =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction.slice(0, decimals) || "").padEnd(decimals, "0") || "0");
  if (atomic <= 0n) throw new RangeError(`${field} must be greater than zero`);
  return atomic;
}

function formatDecimal(value, decimals) {
  const atomic = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = atomic / scale;
  if (decimals === 0) return whole.toString();
  return `${whole}.${(atomic % scale).toString().padStart(decimals, "0")}`;
}

function convertAtomic(value, fromDecimals, toDecimals) {
  const atomic = BigInt(value);
  if (fromDecimals === toDecimals) return atomic;
  if (fromDecimals < toDecimals) {
    return atomic * 10n ** BigInt(toDecimals - fromDecimals);
  }
  return atomic / 10n ** BigInt(fromDecimals - toDecimals);
}

function convertAtomicCeil(value, fromDecimals, toDecimals) {
  const atomic = BigInt(value);
  if (fromDecimals <= toDecimals)
    return convertAtomic(atomic, fromDecimals, toDecimals);
  const divisor = 10n ** BigInt(fromDecimals - toDecimals);
  return (atomic + divisor - 1n) / divisor;
}

function spreadBps(inputAtomic, outputAtomic, reference) {
  if (!reference?.available || !reference.midRational) return null;
  const input = BigInt(inputAtomic);
  const output = BigInt(outputAtomic);
  const referenceNumerator = BigInt(reference.midRational.numerator);
  const referenceDenominator = BigInt(reference.midRational.denominator);
  if (
    input <= 0n ||
    output <= 0n ||
    referenceNumerator <= 0n ||
    referenceDenominator <= 0n
  ) {
    return null;
  }
  const actualScaled = input * referenceDenominator * 10_000n;
  const referenceScaled = output * referenceNumerator;
  const signed = actualScaled - referenceScaled * 10_000n;
  const magnitude = signed < 0n ? -signed : signed;
  const rounded = (magnitude + referenceScaled / 2n) / referenceScaled;
  return Number(signed < 0n ? -rounded : rounded);
}

function rowToTrade(row, quote) {
  if (!row) return null;
  const stored = JSON.parse(row.public_json);
  return {
    ...stored,
    state: quote?.state ?? stored.state,
    submissionRef: quote?.submissionRef ?? null,
    eventId: quote?.eventId ?? null,
    failureReason: quote?.failureReason ?? null,
  };
}

/**
 * Customer-facing BRL → EUR reference orchestration.
 *
 * The fiat-facing product stays simple while the token corridor beneath it uses
 * the same policy-approved liquidity planner and reservation lifecycle as the
 * canonical FX node. Preview never reserves. Reserve creates exactly one firm
 * quote after every selected source has reserved capacity.
 */
export class ReferenceTradeCoordinator {
  constructor({
    quotes,
    settlementGraph,
    settlementEdgeIds,
    assets,
    sourceStatus = () => [],
    referenceFor = () => ({
      available: false,
      reason: "REFERENCE_NOT_CONFIGURED",
    }),
    path = ":memory:",
    now = () => Date.now(),
  } = {}) {
    if (
      !quotes ||
      typeof quotes.candidateSlices !== "function" ||
      typeof quotes.reserveExactOutput !== "function"
    ) {
      throw new TypeError("IntegratedQuoteCoordinator required");
    }
    if (
      !settlementGraph ||
      typeof settlementGraph.analyzeRoute !== "function"
    ) {
      throw new TypeError("SettlementGraph required");
    }
    if (!Array.isArray(settlementEdgeIds) || settlementEdgeIds.length === 0) {
      throw new TypeError("settlementEdgeIds required");
    }
    if (!assets?.BRL || !assets?.BRL_DEPOSIT || !assets?.EURC || !assets?.EUR) {
      throw new TypeError("BRL, BRL_DEPOSIT, EURC and EUR assets required");
    }
    if (typeof sourceStatus !== "function")
      throw new TypeError("sourceStatus must be a function");
    if (typeof referenceFor !== "function")
      throw new TypeError("referenceFor must be a function");

    this.quotes = quotes;
    this.settlementGraph = settlementGraph;
    this.settlementEdgeIds = [...settlementEdgeIds];
    this.assets = assets;
    this.sourceStatus = sourceStatus;
    this.referenceFor = referenceFor;
    this.now = now;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reference_fx_trades (
        trade_id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        public_json TEXT NOT NULL
      );
    `);
  }

  #routeAnalysis() {
    return this.settlementGraph.analyzeRoute(this.settlementEdgeIds);
  }

  #pricingEvidence(inputAtomic, outputAtomic, { reserved }) {
    const reference = this.referenceFor(
      this.assets.BRL_DEPOSIT.id,
      this.assets.EURC.id,
    );
    return {
      reference: {
        providerType: "REFERENCE_FIXTURE",
        intendedUse: "VALUATION_CONTROL_ONLY",
        executable: false,
        available: Boolean(reference?.available),
        ...(reference?.available
          ? {
              mid: reference.mid,
              midRational: reference.midRational,
              sourceIds: [...reference.sourceIds],
              observedAt: reference.observedAt,
              confidence: reference.confidence,
              rejected: [...reference.rejected],
            }
          : {
              reason: reference?.reason ?? "REFERENCE_UNAVAILABLE",
              sourceIds: [],
              confidence: "UNAVAILABLE",
            }),
      },
      client: {
        reserved,
        quoteType: reserved ? "FIRM_SANDBOX" : "INDICATIVE",
        executable: false,
        referenceSpreadBps: spreadBps(inputAtomic, outputAtomic, reference),
      },
    };
  }

  #planExactInput({ inputMinor, expiresAt }) {
    const { BRL, BRL_DEPOSIT, EURC, EUR } = this.assets;
    const tokenBudget = convertAtomic(
      inputMinor,
      BRL.decimals,
      BRL_DEPOSIT.decimals,
    );
    let lowCents = 1n;
    let highCents = inputMinor;
    let best = null;

    while (lowCents <= highCents) {
      const outputCents = (lowCents + highCents) / 2n;
      const exactOutput = convertAtomic(
        outputCents,
        EUR.decimals,
        EURC.decimals,
      );
      const slices = this.quotes.candidateSlices({
        inputAsset: BRL_DEPOSIT.id,
        outputAsset: EURC.id,
        exactOutput: exactOutput.toString(),
        expiresAt,
      });

      try {
        const plan = planExactOutput({
          inputAsset: BRL_DEPOSIT.id,
          outputAsset: EURC.id,
          desiredOutput: exactOutput.toString(),
          slices,
          now: this.now(),
        });
        if (BigInt(plan.totalInput) <= tokenBudget) {
          best = { outputCents, exactOutput, plan };
          lowCents = outputCents + 1n;
        } else {
          highCents = outputCents - 1n;
        }
      } catch (error) {
        if (error.code !== "NO_LIQUIDITY") throw error;
        highCents = outputCents - 1n;
      }
    }

    if (!best) {
      const error = new Error(
        "insufficient executable liquidity for this BRL to EUR request",
      );
      error.code = "NO_LIQUIDITY";
      throw error;
    }
    return { tokenBudget, ...best };
  }

  previewExactInput({
    inputAmount,
    from = "BRL",
    to = "EUR",
    expiresInMs = 30_000,
  }) {
    if (from !== "BRL" || to !== "EUR") {
      const error = new Error(
        "the public reference trade currently supports BRL to EUR",
      );
      error.code = "VALIDATION_ERROR";
      throw error;
    }
    if (
      !Number.isSafeInteger(expiresInMs) ||
      expiresInMs <= 0 ||
      expiresInMs > 120_000
    ) {
      throw new RangeError("expiresInMs invalid");
    }

    const inputMinor = parseDecimal(
      inputAmount,
      this.assets.BRL.decimals,
      "inputAmount",
    );
    const expiresAt = this.now() + expiresInMs;
    const result = this.#planExactInput({ inputMinor, expiresAt });
    const chargedToken = BigInt(result.plan.totalInput);
    const chargedMinor = convertAtomicCeil(
      chargedToken,
      this.assets.BRL_DEPOSIT.decimals,
      this.assets.BRL.decimals,
    );
    const outputMinor = result.outputCents;
    // A fiat payout is rounded to its currency precision. Accept a sub-BRL
    // rounding remainder smaller than one output-cent price step, expose the
    // exact charged amount, and fail when materially less of the request can
    // be routed. At the seeded BRL/EUR rate one EUR cent is roughly six BRL
    // cents, so ten minor units is a conservative hard ceiling.
    const maximumRoundingRemainder = 10n;
    if (chargedMinor + maximumRoundingRemainder < inputMinor) {
      const error = new Error(
        "eligible liquidity cannot consume the full BRL amount",
      );
      error.code = "NO_LIQUIDITY";
      error.details = {
        requestedInputMinor: inputMinor.toString(),
        executableInputMinor: chargedMinor.toString(),
        missingInputMinor: (inputMinor - chargedMinor).toString(),
      };
      throw error;
    }
    const route = this.#routeAnalysis();

    return {
      object: "fx_trade_preview",
      mode: "REFERENCE_SANDBOX",
      state: "PREVIEW",
      from: {
        asset: this.assets.BRL.id,
        symbol: this.assets.BRL.symbol,
        requested: formatDecimal(inputMinor, this.assets.BRL.decimals),
        charged: formatDecimal(chargedMinor, this.assets.BRL.decimals),
        atomic: chargedMinor.toString(),
      },
      to: {
        asset: this.assets.EUR.id,
        symbol: this.assets.EUR.symbol,
        amount: formatDecimal(outputMinor, this.assets.EUR.decimals),
        atomic: outputMinor.toString(),
      },
      rate: formatDecimal((chargedMinor * 1_000_000n) / outputMinor, 6),
      pricing: this.#pricingEvidence(
        result.plan.totalInput,
        result.plan.totalOutput,
        { reserved: false },
      ),
      expiresAt,
      sources: result.plan.legs.map((leg) => ({
        type: leg.sourceType,
        sourceId: leg.sourceId,
        inputAtomic: leg.inputAmount,
        outputAtomic: leg.outputAmount,
        inputAmount: formatDecimal(
          convertAtomic(
            leg.inputAmount,
            this.assets.BRL_DEPOSIT.decimals,
            this.assets.BRL.decimals,
          ),
          this.assets.BRL.decimals,
        ),
        outputAmount: formatDecimal(
          convertAtomic(
            leg.outputAmount,
            this.assets.EURC.decimals,
            this.assets.EUR.decimals,
          ),
          this.assets.EUR.decimals,
        ),
      })),
      sourceStatus: this.sourceStatus(),
      tokenRoute: {
        inputAsset: this.assets.BRL_DEPOSIT.id,
        inputSymbol: this.assets.BRL_DEPOSIT.symbol,
        inputAtomic: result.plan.totalInput,
        outputAsset: this.assets.EURC.id,
        outputSymbol: this.assets.EURC.symbol,
        outputAtomic: result.plan.totalOutput,
      },
      settlement: {
        guarantee: route.guarantee,
        edges: route.edges,
      },
      evidence: {
        reserved: false,
        label: "LIVE FX NODE PREVIEW",
        note: "Uses current policy-approved capacity but does not reserve it.",
      },
    };
  }

  async reserveExactInput(args) {
    const preview = this.previewExactInput(args);
    const quote = await this.quotes.reserveExactOutput({
      inputAsset: preview.tokenRoute.inputAsset,
      outputAsset: preview.tokenRoute.outputAsset,
      exactOutput: preview.tokenRoute.outputAtomic,
      expiresInMs: args.expiresInMs ?? 30_000,
      participantId: args.participantId,
      accountRef: args.accountRef,
    });

    const inputMinor = convertAtomicCeil(
      quote.maxInput,
      this.assets.BRL_DEPOSIT.decimals,
      this.assets.BRL.decimals,
    );
    const outputMinor = convertAtomic(
      quote.output,
      this.assets.EURC.decimals,
      this.assets.EUR.decimals,
    );
    const tradeId = `trade_${randomUUID()}`;
    const createdAt = this.now();
    const settlement = this.#routeAnalysis();
    const publicTrade = {
      object: "fx_trade",
      id: tradeId,
      quoteId: quote.id,
      routeId: quote.routeId,
      state: quote.state,
      createdAt,
      expiresAt: quote.expiresAt,
      from: {
        asset: this.assets.BRL.id,
        symbol: this.assets.BRL.symbol,
        requested: String(args.inputAmount),
        charged: formatDecimal(inputMinor, this.assets.BRL.decimals),
        atomic: inputMinor.toString(),
      },
      to: {
        asset: this.assets.EUR.id,
        symbol: this.assets.EUR.symbol,
        amount: formatDecimal(outputMinor, this.assets.EUR.decimals),
        atomic: outputMinor.toString(),
      },
      rate: formatDecimal((inputMinor * 1_000_000n) / outputMinor, 6),
      pricing: this.#pricingEvidence(quote.maxInput, quote.output, {
        reserved: true,
      }),
      sources: quote.sources.map((source) => ({
        ...source,
        inputAmount: formatDecimal(
          convertAtomic(
            source.input,
            this.assets.BRL_DEPOSIT.decimals,
            this.assets.BRL.decimals,
          ),
          this.assets.BRL.decimals,
        ),
        outputAmount: formatDecimal(
          convertAtomic(
            source.output,
            this.assets.EURC.decimals,
            this.assets.EUR.decimals,
          ),
          this.assets.EUR.decimals,
        ),
      })),
      sourceStatus: this.sourceStatus(),
      tokenRoute: {
        inputAsset: quote.inputAsset,
        inputSymbol: quote.inputSymbol,
        inputAtomic: quote.maxInput,
        outputAsset: quote.outputAsset,
        outputSymbol: quote.outputSymbol,
        outputAtomic: quote.output,
      },
      settlement: {
        guarantee: settlement.guarantee,
        edges: settlement.edges,
      },
      customerAuthorization: quote.customerAuthorization,
      evidence: {
        reserved: true,
        label: "FIRM RESERVED SANDBOX QUOTE",
        note: "Every selected source and principal risk capacity has been reserved.",
      },
    };

    this.db
      .prepare(
        `
      INSERT INTO reference_fx_trades(trade_id, quote_id, created_at, public_json)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(tradeId, quote.id, createdAt, JSON.stringify(publicTrade));
    return publicTrade;
  }

  getTrade(tradeId) {
    requiredString(tradeId, "tradeId");
    const row = this.db
      .prepare("SELECT * FROM reference_fx_trades WHERE trade_id = ?")
      .get(tradeId);
    if (!row) return null;
    const stored = JSON.parse(row.public_json);
    return rowToTrade(row, this.quotes.getQuote(stored.quoteId));
  }

  async releaseTrade(tradeId, reason = "CUSTOMER_ABANDONED") {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("trade not found");
    const quote = this.quotes.getPrivateQuote(trade.quoteId);
    if (!quote) throw new Error("quote not found");
    if (["RELEASED", "EXPIRED", "FAILED"].includes(quote.row.state))
      return this.getTrade(tradeId);
    if (quote.row.state !== "RESERVED") {
      throw new Error(
        `trade cannot be released from ${quote.row.state}; reconcile it instead`,
      );
    }

    for (
      let index = quote.route.reserved.legs.length - 1;
      index >= 0;
      index -= 1
    ) {
      const leg = quote.route.reserved.legs[index];
      const adapter = this.quotes.adapters[leg.sourceType];
      if (!adapter || typeof adapter.release !== "function") {
        throw new Error(`missing release adapter for ${leg.sourceType}`);
      }
      await adapter.release({
        routeId: quote.row.route_id,
        leg,
        reservationHandle: leg.reservationHandle,
        reason,
      });
    }
    this.quotes.db
      .prepare(
        `
      UPDATE integrated_fx_quotes
      SET state = 'RELEASED', failure_reason = ?
      WHERE quote_id = ?
    `,
      )
      .run(reason, trade.quoteId);
    return this.getTrade(tradeId);
  }

  close() {
    this.db.close();
  }
}

export { convertAtomic, convertAtomicCeil, formatDecimal, parseDecimal };
