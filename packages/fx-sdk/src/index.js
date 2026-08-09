export class BlueballsFxError extends Error {
  constructor(message, { code = 'HTTP_ERROR', status = 0, details = undefined } = {}) {
    super(message);
    this.name = 'BlueballsFxError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class BlueballsFxClient {
  constructor({ baseUrl, apiKey, fetchImpl = globalThis.fetch } = {}) {
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) throw new TypeError('baseUrl required');
    if (typeof apiKey !== 'string' || apiKey.length === 0) throw new TypeError('apiKey required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async #request(path, { method = 'GET', body, auth = true } = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new BlueballsFxError(`FX node returned non-JSON response (${response.status})`, {
        status: response.status,
      });
    }
    if (!response.ok) {
      throw new BlueballsFxError(payload?.error?.message ?? `FX request failed (${response.status})`, {
        code: payload?.error?.code ?? 'HTTP_ERROR',
        status: response.status,
        details: payload?.error?.details,
      });
    }
    return payload;
  }

  health() { return this.#request('/health', { auth: false }); }

  referenceStatus() { return this.#request('/v2/fx/reference/status'); }
  referencePolicy() { return this.#request('/v2/fx/reference/policy'); }
  referenceLiquidity({ inputAsset, outputAsset, exactOutput }) {
    const query = new URLSearchParams({ inputAsset, outputAsset });
    if (exactOutput !== undefined) query.set('exactOutput', String(exactOutput));
    return this.#request(`/v2/fx/reference/liquidity?${query.toString()}`);
  }
  referenceSettlementRoute() { return this.#request('/v2/fx/reference/settlement-route'); }

  createOrder(order) { return this.#request('/v2/fx/orders', { method: 'POST', body: order }); }
  listOrders(maker) { return this.#request(`/v2/fx/orders?maker=${encodeURIComponent(maker)}`); }
  cancelOrder(orderHash, options = {}) {
    return this.#request(`/v2/fx/orders/${encodeURIComponent(orderHash)}/cancel`, {
      method: 'POST', body: options,
    });
  }
  depth({ inputAsset, outputAsset }) {
    return this.#request(`/v2/fx/depth?inputAsset=${encodeURIComponent(inputAsset)}&outputAsset=${encodeURIComponent(outputAsset)}`);
  }

  quote({ inputAsset, outputAsset, exactOutput, expiresInMs, participantId, accountRef }) {
    return this.#request('/v2/fx/quotes', {
      method: 'POST',
      body: {
        inputAsset,
        outputAsset,
        exactOutput: String(exactOutput),
        ...(expiresInMs === undefined ? {} : { expiresInMs }),
        ...(participantId === undefined ? {} : { participantId }),
        ...(accountRef === undefined ? {} : { accountRef }),
      },
    });
  }
  getQuote(quoteId) { return this.#request(`/v2/fx/quotes/${encodeURIComponent(quoteId)}`); }
  execute(quoteId) { return this.#request(`/v2/fx/quotes/${encodeURIComponent(quoteId)}/execute`, { method: 'POST' }); }
  getRoute(routeId) { return this.#request(`/v2/fx/routes/${encodeURIComponent(routeId)}`); }

  createFiatIntent(intent) { return this.#request('/v2/fx/fiat/intents', { method: 'POST', body: intent }); }
  getFiatIntent(intentId) { return this.#request(`/v2/fx/fiat/intents/${encodeURIComponent(intentId)}`); }
  reserveFiatIntent(intentId) {
    return this.#request(`/v2/fx/fiat/intents/${encodeURIComponent(intentId)}/reserve`, { method: 'POST' });
  }
  submitFiatIntent(intentId, submissionRef) {
    return this.#request(`/v2/fx/fiat/intents/${encodeURIComponent(intentId)}/submit`, {
      method: 'POST', body: { submissionRef },
    });
  }
  attestFiat(attestation) {
    return this.#request('/v2/fx/fiat/attestations', { method: 'POST', body: attestation });
  }
  settleFiatIntent(intentId, eventId) {
    return this.#request(`/v2/fx/fiat/intents/${encodeURIComponent(intentId)}/settle`, {
      method: 'POST', body: { eventId },
    });
  }
}
