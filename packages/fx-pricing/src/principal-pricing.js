import {
  applyBps,
  quoteInputAtomicExactOutput,
  rational,
  toDecimalString,
} from "./rational.js";

function integerBps(name, value, { allowNegative = false } = {}) {
  if (!Number.isSafeInteger(value))
    throw new TypeError(`${name} must be a safe integer`);
  if (!allowNegative && value < 0)
    throw new RangeError(`${name} cannot be negative`);
  return value;
}

function referenceRational(reference) {
  if (!reference?.available) {
    const error = new Error("reference price unavailable");
    error.code = "REFERENCE_UNAVAILABLE";
    throw error;
  }
  const numerator = reference.midRational?.numerator;
  const denominator = reference.midRational?.denominator;
  if (numerator == null || denominator == null)
    throw new TypeError("reference midRational required");
  const value = rational(BigInt(numerator), BigInt(denominator));
  if (value.n <= 0n) throw new RangeError("reference price must be positive");
  return value;
}

export class PrincipalQuoteEngine {
  constructor({
    riskBook,
    baseSpreadBps = 0,
    minimumSpreadBps = 0,
    now = () => Date.now(),
  } = {}) {
    if (!riskBook || typeof riskBook.reserve !== "function")
      throw new TypeError("riskBook required");
    this.riskBook = riskBook;
    this.baseSpreadBps = integerBps("baseSpreadBps", baseSpreadBps);
    this.minimumSpreadBps = integerBps("minimumSpreadBps", minimumSpreadBps);
    this.now = now;
  }

  /**
   * Build the exact principal economics without consuming balance-sheet capacity.
   *
   * The public reference router uses this to compare bank principal with other
   * already-authorised liquidity. A quote only becomes firm when quoteExactOutput
   * subsequently reserves the returned risk deltas.
   */
  previewExactOutput({
    quoteId,
    inputAsset,
    outputAsset,
    outputAtomic,
    inputDecimals,
    outputDecimals,
    reference,
    expiresAt,
    volatilityBps = 0,
    sizeBps = 0,
    corridorBps = 0,
    railBps = 0,
    inventoryBps = 0,
  }) {
    if (typeof quoteId !== "string" || quoteId.length === 0)
      throw new TypeError("quoteId required");
    if (typeof inputAsset !== "string" || inputAsset.length === 0)
      throw new TypeError("inputAsset required");
    if (typeof outputAsset !== "string" || outputAsset.length === 0)
      throw new TypeError("outputAsset required");
    if (inputAsset === outputAsset)
      throw new RangeError("inputAsset and outputAsset must differ");
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now()) {
      throw new RangeError("expiresAt must be a future millisecond timestamp");
    }

    const output = BigInt(outputAtomic);
    if (output <= 0n) throw new RangeError("outputAtomic must be positive");

    const components = {
      baseSpreadBps: this.baseSpreadBps,
      volatilityBps: integerBps("volatilityBps", volatilityBps),
      sizeBps: integerBps("sizeBps", sizeBps),
      corridorBps: integerBps("corridorBps", corridorBps),
      railBps: integerBps("railBps", railBps),
      inventoryBps: integerBps("inventoryBps", inventoryBps, {
        allowNegative: true,
      }),
    };
    const rawSpreadBps = Object.values(components).reduce(
      (sum, value) => sum + value,
      0,
    );
    const totalSpreadBps = Math.max(this.minimumSpreadBps, rawSpreadBps);
    if (totalSpreadBps <= -10_000)
      throw new RangeError("total spread makes price non-positive");

    const mid = referenceRational(reference);
    const executablePrice = applyBps(mid, totalSpreadBps);
    const totalInput = quoteInputAtomicExactOutput({
      outputAtomic: output,
      price: executablePrice,
      baseDecimals: outputDecimals,
      quoteDecimals: inputDecimals,
    });

    const riskDeltas = {
      [inputAsset]: totalInput.toString(),
      [outputAsset]: (-output).toString(),
    };

    return {
      quoteId,
      sourceType: "BANK_PRINCIPAL",
      inputAsset,
      outputAsset,
      totalInput: totalInput.toString(),
      totalOutput: output.toString(),
      referenceMid: reference.mid,
      executablePrice: toDecimalString(executablePrice, 24),
      totalSpreadBps,
      components,
      referenceProvenance: {
        sourceIds: [...(reference.sourceIds ?? [])],
        confidence: reference.confidence,
        observedAt: reference.observedAt,
      },
      riskDeltas,
      expiresAt,
    };
  }

  quoteExactOutput(args) {
    const quote = this.previewExactOutput(args);
    this.riskBook.reserve({
      quoteId: quote.quoteId,
      deltas: quote.riskDeltas,
      expiresAt: quote.expiresAt,
    });
    return quote;
  }
}
