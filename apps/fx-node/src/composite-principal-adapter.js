function pairKey(inputAsset, outputAsset) {
  return `${inputAsset}/${outputAsset}`;
}

/** Delegates bank-principal pricing and reservation to the adapter configured for a corridor. */
export class CompositePrincipalLiquidityAdapter {
  constructor(adapters = {}) {
    this.adapters = new Map(Object.entries(adapters));
  }

  #adapter(inputAsset, outputAsset) {
    return this.adapters.get(pairKey(inputAsset, outputAsset)) ?? null;
  }

  listSlices(args) {
    return this.#adapter(args.inputAsset, args.outputAsset)?.listSlices(args) ?? [];
  }

  reserve(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.reserve(args);
  }

  release(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.release(args);
  }

  validateReserved(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.validateReserved(args);
  }

  markSubmitted(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.markSubmitted(args);
  }

  confirm(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.confirm(args);
  }

  fail(args) {
    const adapter = this.#adapter(args.leg.inputAsset, args.leg.outputAsset);
    if (!adapter) throw new Error('bank principal is not configured for this corridor');
    return adapter.fail(args);
  }
}

export { pairKey };
