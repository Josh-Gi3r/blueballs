function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} required`);
  return value;
}

function routeFills(market, routeId) {
  return market.db.prepare(`
    SELECT order_hash, maker_sell_amount, taker_pay_amount
    FROM reservations
    WHERE route_id = ?
    ORDER BY rowid
  `).all(routeId).map((row) => ({
    orderHash: row.order_hash,
    makerSellAmount: row.maker_sell_amount,
    takerPayAmount: row.taker_pay_amount,
  }));
}

/**
 * Makes the private signed-order market look like a liquidity source to the
 * cross-source planner without exposing maker identities or signed payloads.
 */
export class PrivateMarketLiquidityAdapter {
  constructor({ market, now = () => Date.now() } = {}) {
    if (!market || typeof market.aggregateDepth !== 'function') {
      throw new TypeError('FxMarketService required');
    }
    this.market = market;
    this.now = now;
  }

  listSlices({ inputAsset, outputAsset, expiresAt }) {
    return this.market.aggregateDepth({ inputToken: inputAsset, outputToken: outputAsset })
      .map((level, index) => ({
        sourceType: 'PRIVATE_MARKET',
        sourceId: `private-market:${index}`,
        sliceId: `private-market:${inputAsset}:${outputAsset}:${level.buyAmount}:${level.sellAmount}`,
        inputAsset,
        outputAsset,
        maxOutput: level.availableSell,
        inputNumerator: level.buyAmount,
        inputDenominator: level.sellAmount,
        // Individual signed orders retain their own authorisations. This aggregate
        // marker exists only to satisfy the common planner schema; reservation and
        // submission revalidate the underlying orders in FxMarketService.
        policyAuthorizationId: 'private-market:underlying-orders',
        expiresAt,
        reservationPayload: { aggregate: true },
      }));
  }

  reserve({ routeId, leg, index }) {
    const subRouteId = `${routeId}:private:${index}`;
    const route = this.market.reserveExactOutput({
      routeId: subRouteId,
      inputToken: leg.inputAsset,
      outputToken: leg.outputAsset,
      desiredOutput: leg.outputAmount,
      expiresAt: leg.expiresAt,
    });
    if (BigInt(route.totalInput) > BigInt(leg.inputAmount)) {
      this.market.releaseRoute(subRouteId, 'PRIVATE_MARKET_PRICE_MOVED');
      throw new Error('private market price changed before reservation');
    }
    return { reservationHandle: subRouteId };
  }

  release({ reservationHandle, reason = 'RELEASED' }) {
    return this.market.releaseRoute(reservationHandle, reason);
  }

  validateReserved({ reservationHandle }) {
    const route = this.market.getRoute(reservationHandle);
    if (!route) throw new Error('private market route not found');
    if (!['RESERVED', 'SUBMITTED'].includes(route.state)) {
      throw new Error(`private market route is ${route.state}`);
    }
    if (route.state === 'RESERVED' && route.expiresAt <= this.now()) {
      throw new Error('private market route expired');
    }
    return route;
  }

  markSubmitted({ reservationHandle, submissionRef }) {
    return this.market.markRouteSubmitted(reservationHandle, `${submissionRef}:private`);
  }

  confirm({ reservationHandle, eventId }) {
    return this.market.confirmSubmittedRoute({
      routeId: reservationHandle,
      eventId,
      fills: routeFills(this.market, reservationHandle),
    });
  }

  fail({ reservationHandle, eventId = null, reason = 'SETTLEMENT_FAILED' }) {
    return this.market.failSubmittedRoute({
      routeId: reservationHandle,
      eventId,
      reason,
    });
  }
}

/**
 * Exposes bank principal as one policy-approved source. Pricing is previewed
 * for comparison, then the exact selected leg consumes risk capacity only when
 * the route is reserved.
 */
export class PrincipalLiquidityAdapter {
  constructor({
    engine,
    riskBook,
    referenceFor,
    assetFor,
    authorizationVerifier = null,
    policyAuthorizationId,
    policySnapshotHash = null,
    accountRef = null,
    sourceId = 'bank-principal',
    pricing = {},
    now = () => Date.now(),
  } = {}) {
    if (!engine || typeof engine.previewExactOutput !== 'function') {
      throw new TypeError('PrincipalQuoteEngine required');
    }
    if (!riskBook || typeof riskBook.checkDeltas !== 'function') {
      throw new TypeError('PrincipalRiskBook required');
    }
    if (typeof referenceFor !== 'function') throw new TypeError('referenceFor required');
    if (typeof assetFor !== 'function') throw new TypeError('assetFor required');
    if (authorizationVerifier !== null && typeof authorizationVerifier !== 'function') {
      throw new TypeError('authorizationVerifier must be a function');
    }
    this.engine = engine;
    this.riskBook = riskBook;
    this.referenceFor = referenceFor;
    this.assetFor = assetFor;
    this.authorizationVerifier = authorizationVerifier;
    this.policyAuthorizationId = requiredString(policyAuthorizationId, 'policyAuthorizationId');
    this.policySnapshotHash = policySnapshotHash;
    this.accountRef = accountRef;
    this.sourceId = sourceId;
    this.pricing = pricing;
    this.now = now;
  }

  #authorization(amount, inputAsset, outputAsset) {
    if (!this.authorizationVerifier) return { valid: true };
    return this.authorizationVerifier(this.policyAuthorizationId, {
      inputAsset,
      outputAsset,
      amount: String(amount),
      accountRef: this.accountRef,
      policySnapshotHash: this.policySnapshotHash,
    });
  }

  #quoteArgs({ quoteId, inputAsset, outputAsset, outputAtomic, expiresAt }) {
    const input = this.assetFor(inputAsset);
    const output = this.assetFor(outputAsset);
    if (!input || !output) throw new Error('principal asset metadata unavailable');
    return {
      quoteId,
      inputAsset,
      outputAsset,
      outputAtomic: String(outputAtomic),
      inputDecimals: input.decimals,
      outputDecimals: output.decimals,
      reference: this.referenceFor(inputAsset, outputAsset),
      expiresAt,
      ...this.pricing,
    };
  }

  listSlices({ inputAsset, outputAsset, desiredOutput, expiresAt }) {
    const authorization = this.#authorization(desiredOutput, inputAsset, outputAsset);
    if (!authorization || authorization.valid !== true) return [];

    let preview;
    try {
      preview = this.engine.previewExactOutput(this.#quoteArgs({
        quoteId: `preview:${inputAsset}:${outputAsset}:${desiredOutput}:${expiresAt}`,
        inputAsset,
        outputAsset,
        outputAtomic: desiredOutput,
        expiresAt,
      }));
    } catch {
      return [];
    }
    if (!this.riskBook.checkDeltas(preview.riskDeltas).allowed) return [];

    return [{
      sourceType: 'BANK_PRINCIPAL',
      sourceId: this.sourceId,
      sliceId: `${this.sourceId}:${inputAsset}:${outputAsset}:${expiresAt}`,
      inputAsset,
      outputAsset,
      maxOutput: String(desiredOutput),
      inputNumerator: preview.totalInput,
      inputDenominator: preview.totalOutput,
      policyAuthorizationId: this.policyAuthorizationId,
      policySnapshotHash: this.policySnapshotHash,
      expiresAt,
      reservationPayload: {
        accountRef: this.accountRef,
        referenceProvenance: preview.referenceProvenance,
        spread: preview.components,
      },
    }];
  }

  reserve({ routeId, leg, index }) {
    const authorization = this.#authorization(leg.outputAmount, leg.inputAsset, leg.outputAsset);
    if (!authorization || authorization.valid !== true) {
      const error = new Error(`principal authorization invalid: ${authorization?.reason ?? 'INVALID'}`);
      error.code = 'POLICY_AUTHORIZATION_INVALID';
      throw error;
    }
    const quoteId = `${routeId}:principal:${index}`;
    const quote = this.engine.quoteExactOutput(this.#quoteArgs({
      quoteId,
      inputAsset: leg.inputAsset,
      outputAsset: leg.outputAsset,
      outputAtomic: leg.outputAmount,
      expiresAt: leg.expiresAt,
    }));
    if (BigInt(quote.totalInput) > BigInt(leg.inputAmount)) {
      this.riskBook.release(quoteId, 'PRICE_MOVED');
      throw new Error('principal price changed before reservation');
    }
    return { reservationHandle: quoteId };
  }

  release({ reservationHandle, reason = 'RELEASED' }) {
    return this.riskBook.release(reservationHandle, reason);
  }

  validateReserved({ reservationHandle }) {
    const rows = this.riskBook.db.prepare(`
      SELECT asset, delta, expires_at, state
      FROM principal_reservations
      WHERE quote_id = ?
    `).all(reservationHandle);
    if (rows.length === 0) throw new Error('principal reservation not found');
    if (rows.some((row) => row.state !== 'ACTIVE')) throw new Error('principal reservation is not active');
    if (rows.some((row) => row.expires_at <= this.now())) throw new Error('principal reservation expired');
    return { reservationHandle };
  }

  markSubmitted({ reservationHandle, submissionRef }) {
    requiredString(submissionRef, 'submissionRef');
    this.validateReserved({ reservationHandle });
    return { reservationHandle, submissionRef };
  }

  confirm({ reservationHandle, eventId }) {
    return this.riskBook.settle({ quoteId: reservationHandle, eventId });
  }

  fail({ reservationHandle, reason = 'SETTLEMENT_FAILED' }) {
    return this.riskBook.release(reservationHandle, reason);
  }
}
