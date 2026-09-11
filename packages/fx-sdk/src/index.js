export class BlueballsFxError extends Error {
  constructor(
    message,
    { code = "HTTP_ERROR", status = 0, details = undefined, cause } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "BlueballsFxError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizedBaseUrl(value) {
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError("baseUrl required");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be an absolute HTTP(S) URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TypeError("baseUrl must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError(
      "baseUrl must not contain credentials, query parameters or a fragment",
    );
  }
  return parsed.toString().replace(/\/$/, "");
}

function optionalSecret(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError(`${field} must be a non-empty string when provided`);
  return value;
}

function atomicAmount(value, field = "amount") {
  if (typeof value === "bigint") {
    if (value <= 0n) throw new RangeError(`${field} must be positive`);
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${field} number must be a positive safe integer`);
    }
    return String(value);
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  throw new TypeError(
    `${field} must be a positive integer string, bigint or safe integer`,
  );
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError(`${field} required`);
  return value;
}

export class BlueballsFxClient {
  constructor({
    baseUrl,
    apiKey,
    operatorApiKey,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function")
      throw new TypeError("fetch implementation required");
    this.baseUrl = normalizedBaseUrl(baseUrl);
    this.apiKey = optionalSecret(apiKey, "apiKey");
    this.operatorApiKey = optionalSecret(operatorApiKey, "operatorApiKey");
    this.fetch = fetchImpl;
  }

  #credential(auth) {
    if (auth === false) return null;
    if (auth === "operator") {
      if (!this.operatorApiKey) {
        throw new BlueballsFxError(
          "FX operator API key required for this finality operation",
          { code: "OPERATOR_AUTH_REQUIRED", status: 0 },
        );
      }
      return this.operatorApiKey;
    }
    if (!this.apiKey) {
      throw new BlueballsFxError("FX API key required for this operation", {
        code: "AUTH_REQUIRED",
        status: 0,
      });
    }
    return this.apiKey;
  }

  async #request(path, { method = "GET", body, auth = "client" } = {}) {
    const credential = this.#credential(auth);

    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (cause) {
      throw new BlueballsFxError(
        "FX node request failed before a response arrived",
        {
          code: "NETWORK_ERROR",
          status: 0,
          cause,
        },
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new BlueballsFxError(
        `FX node returned non-JSON response (${response.status})`,
        {
          code: "PROTOCOL_ERROR",
          status: response.status,
          cause,
        },
      );
    }
    if (!response.ok) {
      throw new BlueballsFxError(
        payload?.error?.message ?? `FX request failed (${response.status})`,
        {
          code: payload?.error?.code ?? "HTTP_ERROR",
          status: response.status,
          details: payload?.error?.details,
        },
      );
    }
    return payload;
  }

  health() {
    return this.#request("/health", { auth: false });
  }

  referenceStatus() {
    return this.#request("/v2/fx/reference/status", { auth: false });
  }
  referencePolicy() {
    return this.#request("/v2/fx/reference/policy", { auth: false });
  }
  referenceMarket() {
    return this.#request("/v2/fx/reference/market", { auth: false });
  }
  referenceScenario() {
    return this.#request("/v2/fx/reference/scenario", { auth: false });
  }
  applyReferenceScenario(id) {
    return this.#request("/v2/fx/reference/scenario", {
      method: "POST",
      body: { id: requiredString(id, "scenario id") },
    });
  }
  referenceLiquidity({ inputAsset, outputAsset, exactOutput }) {
    const query = new URLSearchParams({
      inputAsset: requiredString(inputAsset, "inputAsset"),
      outputAsset: requiredString(outputAsset, "outputAsset"),
    });
    if (exactOutput !== undefined)
      query.set("exactOutput", atomicAmount(exactOutput, "exactOutput"));
    return this.#request(`/v2/fx/reference/liquidity?${query.toString()}`, {
      auth: false,
    });
  }
  referenceSettlementRoute() {
    return this.#request("/v2/fx/reference/settlement-route", { auth: false });
  }
  previewReferenceTrade(request) {
    return this.#request("/v2/fx/reference/trades/preview", {
      method: "POST",
      body: request,
      auth: false,
    });
  }
  reserveReferenceTrade(request) {
    return this.#request("/v2/fx/reference/trades", {
      method: "POST",
      body: request,
    });
  }
  getReferenceTrade(tradeId) {
    return this.#request(
      `/v2/fx/reference/trades/${encodeURIComponent(requiredString(tradeId, "tradeId"))}`,
    );
  }
  releaseReferenceTrade(tradeId) {
    return this.#request(
      `/v2/fx/reference/trades/${encodeURIComponent(requiredString(tradeId, "tradeId"))}`,
      { method: "DELETE" },
    );
  }
  executeReferenceTrade(tradeId) {
    return this.#request(
      `/v2/fx/reference/trades/${encodeURIComponent(requiredString(tradeId, "tradeId"))}/execute`,
      { method: "POST" },
    );
  }

  createOrder(order) {
    return this.#request("/v2/fx/orders", { method: "POST", body: order });
  }
  listOrders(maker) {
    return this.#request(
      `/v2/fx/orders?maker=${encodeURIComponent(requiredString(maker, "maker"))}`,
    );
  }
  cancelOrder(orderHash, options = {}) {
    return this.#request(
      `/v2/fx/orders/${encodeURIComponent(requiredString(orderHash, "orderHash"))}/cancel`,
      {
        method: "POST",
        body: options,
      },
    );
  }
  depth({ inputAsset, outputAsset }) {
    return this.#request(
      `/v2/fx/depth?inputAsset=${encodeURIComponent(requiredString(inputAsset, "inputAsset"))}&outputAsset=${encodeURIComponent(requiredString(outputAsset, "outputAsset"))}`,
    );
  }

  quote({
    inputAsset,
    outputAsset,
    exactOutput,
    expiresInMs,
    participantId,
    accountRef,
  }) {
    return this.#request("/v2/fx/quotes", {
      method: "POST",
      body: {
        inputAsset: requiredString(inputAsset, "inputAsset"),
        outputAsset: requiredString(outputAsset, "outputAsset"),
        exactOutput: atomicAmount(exactOutput, "exactOutput"),
        ...(expiresInMs === undefined ? {} : { expiresInMs }),
        ...(participantId === undefined ? {} : { participantId }),
        ...(accountRef === undefined ? {} : { accountRef }),
      },
    });
  }
  getQuote(quoteId) {
    return this.#request(
      `/v2/fx/quotes/${encodeURIComponent(requiredString(quoteId, "quoteId"))}`,
    );
  }
  execute(quoteId) {
    return this.#request(
      `/v2/fx/quotes/${encodeURIComponent(requiredString(quoteId, "quoteId"))}/execute`,
      { method: "POST" },
    );
  }
  getRoute(routeId) {
    return this.#request(
      `/v2/fx/routes/${encodeURIComponent(requiredString(routeId, "routeId"))}`,
    );
  }

  confirmQuote(quoteId, { eventId, fills } = {}) {
    return this.#request(
      `/v2/fx/ops/quotes/${encodeURIComponent(requiredString(quoteId, "quoteId"))}/confirmed`,
      {
        method: "POST",
        auth: "operator",
        body: {
          eventId: requiredString(eventId, "eventId"),
          ...(fills === undefined ? {} : { fills }),
        },
      },
    );
  }

  failQuote(quoteId, { eventId, reason } = {}) {
    return this.#request(
      `/v2/fx/ops/quotes/${encodeURIComponent(requiredString(quoteId, "quoteId"))}/failed`,
      {
        method: "POST",
        auth: "operator",
        body: {
          ...(eventId === undefined ? {} : { eventId: requiredString(eventId, "eventId") }),
          reason: requiredString(reason, "reason"),
        },
      },
    );
  }

  createFiatIntent(intent) {
    return this.#request("/v2/fx/fiat/intents", {
      method: "POST",
      body: intent,
    });
  }
  getFiatIntent(intentId) {
    return this.#request(
      `/v2/fx/fiat/intents/${encodeURIComponent(requiredString(intentId, "intentId"))}`,
    );
  }
  reserveFiatIntent(intentId) {
    return this.#request(
      `/v2/fx/fiat/intents/${encodeURIComponent(requiredString(intentId, "intentId"))}/reserve`,
      { method: "POST" },
    );
  }
  submitFiatIntent(intentId, submissionRef) {
    return this.#request(
      `/v2/fx/fiat/intents/${encodeURIComponent(requiredString(intentId, "intentId"))}/submit`,
      {
        method: "POST",
        body: { submissionRef: requiredString(submissionRef, "submissionRef") },
      },
    );
  }
  attestFiat(attestation) {
    return this.#request("/v2/fx/fiat/attestations", {
      method: "POST",
      auth: "operator",
      body: attestation,
    });
  }
  settleFiatIntent(intentId, eventId) {
    return this.#request(
      `/v2/fx/fiat/intents/${encodeURIComponent(requiredString(intentId, "intentId"))}/settle`,
      {
        method: "POST",
        auth: "operator",
        body:
          eventId === undefined
            ? {}
            : { eventId: requiredString(eventId, "eventId") },
      },
    );
  }
}
