import http from 'node:http';

function apiError(code, status, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function errorResponse(error) {
  const known = {
    PAYMENT_REPLAY: 409,
    RISK_LIMIT: 409,
    POLICY_AUTHORIZATION_INVALID: 403,
    EXECUTION_UNAVAILABLE: 503,
    QUOTE_EXPIRED: 409,
    NOT_FOUND: 404,
    AUTH_REQUIRED: 401,
    VALIDATION_ERROR: 400,
  };
  let code = error.code ?? 'INTERNAL_ERROR';
  let status = error.status ?? known[code] ?? 400;
  const message = error.message ?? 'request failed';

  if (!error.code) {
    if (/not found/i.test(message)) { code = 'NOT_FOUND'; status = 404; }
    else if (/expired/i.test(message)) { code = 'QUOTE_EXPIRED'; status = 409; }
    else if (/insufficient eligible liquidity/i.test(message)) {
      code = 'INSUFFICIENT_LIQUIDITY'; status = 409;
    } else if (/required|invalid|must|mismatch|cannot/i.test(message)) {
      code = 'VALIDATION_ERROR'; status = 400;
    }
  }

  return { status, body: { error: { code, message, ...(error.details ? { details: error.details } : {}) } } };
}

async function readJson(req, maxBytes = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw apiError('VALIDATION_ERROR', 413, 'request body too large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw apiError('VALIDATION_ERROR', 400, 'invalid JSON');
  }
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function match(pathname, pattern) {
  const names = [];
  const expression = pattern
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        names.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const result = pathname.match(new RegExp(`^${expression}$`));
  if (!result) return null;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(result[index + 1])]));
}

export function createFxNodeServer({
  market,
  quotes,
  fiat,
  executionAdapter = null,
  apiKey,
  publicDepth = false,
} = {}) {
  if (!market) throw new TypeError('market service required');
  if (!quotes) throw new TypeError('quote coordinator required');
  if (!fiat) throw new TypeError('fiat settlement store required');
  if (typeof apiKey !== 'string' || apiKey.length < 8) throw new TypeError('apiKey of at least 8 characters required');

  function authenticate(req) {
    const authorization = req.headers.authorization;
    if (authorization !== `Bearer ${apiKey}`) throw apiError('AUTH_REQUIRED', 401, 'valid API key required');
  }

  async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://fx-node.local');
      const method = req.method ?? 'GET';
      const path = url.pathname;

      if (method === 'GET' && path === '/health') {
        return send(res, 200, { status: 'ok', service: 'blueballs-fx-node' });
      }

      if (method === 'GET' && path === '/v2/fx/depth') {
        if (!publicDepth) authenticate(req);
        const inputAsset = url.searchParams.get('inputAsset');
        const outputAsset = url.searchParams.get('outputAsset');
        if (!inputAsset || !outputAsset) throw apiError('VALIDATION_ERROR', 400, 'inputAsset and outputAsset required');
        return send(res, 200, {
          object: 'depth', inputAsset, outputAsset,
          levels: market.aggregateDepth({ inputToken: inputAsset, outputToken: outputAsset }),
        });
      }

      authenticate(req);

      if (method === 'POST' && path === '/v2/fx/orders') {
        return send(res, 201, await market.admitOrder(await readJson(req)));
      }
      if (method === 'GET' && path === '/v2/fx/orders') {
        const maker = url.searchParams.get('maker');
        if (!maker) throw apiError('VALIDATION_ERROR', 400, 'maker required');
        return send(res, 200, { object: 'list', data: market.listOrdersForMaker(maker) });
      }
      let params = match(path, '/v2/fx/orders/:orderHash/cancel');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 200, market.cancelOrderOffchain(params.orderHash, {
          onChainInvalidated: body.onChainInvalidated === true,
        }));
      }

      if (method === 'POST' && path === '/v2/fx/quotes') {
        const body = await readJson(req);
        if (!body.inputAsset || !body.outputAsset || body.exactOutput == null) {
          throw apiError('VALIDATION_ERROR', 400, 'inputAsset, outputAsset and exactOutput required');
        }
        return send(res, 201, quotes.reserveExactOutput({
          inputAsset: body.inputAsset,
          outputAsset: body.outputAsset,
          exactOutput: String(body.exactOutput),
          expiresInMs: body.expiresInMs ?? 15_000,
        }));
      }
      params = match(path, '/v2/fx/quotes/:quoteId');
      if (method === 'GET' && params) {
        const quote = quotes.getQuote(params.quoteId);
        if (!quote) throw apiError('NOT_FOUND', 404, 'quote not found');
        return send(res, 200, quote);
      }
      params = match(path, '/v2/fx/quotes/:quoteId/execute');
      if (method === 'POST' && params) {
        const privateQuote = quotes.getPrivateQuote(params.quoteId);
        if (!privateQuote) throw apiError('NOT_FOUND', 404, 'quote not found');
        if (privateQuote.row.expires_at <= Date.now()) throw apiError('QUOTE_EXPIRED', 409, 'quote expired');
        if (!executionAdapter || typeof executionAdapter.submit !== 'function') {
          throw apiError('EXECUTION_UNAVAILABLE', 503, 'execution adapter is not configured');
        }
        const submitted = await executionAdapter.submit(privateQuote);
        if (!submitted || typeof submitted.submissionRef !== 'string' || submitted.submissionRef.length === 0) {
          throw apiError('EXECUTION_UNAVAILABLE', 503, 'execution adapter did not return a submission reference');
        }
        return send(res, 202, quotes.markSubmitted(params.quoteId, submitted.submissionRef));
      }

      params = match(path, '/v2/fx/routes/:routeId');
      if (method === 'GET' && params) {
        const route = market.getRoute(params.routeId);
        if (!route) throw apiError('NOT_FOUND', 404, 'route not found');
        return send(res, 200, route);
      }

      if (method === 'POST' && path === '/v2/fx/fiat/intents') {
        return send(res, 201, fiat.createIntent(await readJson(req)));
      }
      params = match(path, '/v2/fx/fiat/intents/:intentId');
      if (method === 'GET' && params) {
        const intent = fiat.getIntent(params.intentId);
        if (!intent) throw apiError('NOT_FOUND', 404, 'fiat intent not found');
        return send(res, 200, intent);
      }
      params = match(path, '/v2/fx/fiat/intents/:intentId/reserve');
      if (method === 'POST' && params) return send(res, 200, fiat.reserveIntent(params.intentId));
      params = match(path, '/v2/fx/fiat/intents/:intentId/submit');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 202, fiat.submitIntent(params.intentId, body.submissionRef));
      }
      if (method === 'POST' && path === '/v2/fx/fiat/attestations') {
        return send(res, 200, fiat.acceptAttestation(await readJson(req)));
      }
      params = match(path, '/v2/fx/fiat/intents/:intentId/settle');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 200, fiat.settleVerifiedIntent(params.intentId, body.eventId));
      }

      params = match(path, '/v2/fx/ops/quotes/:quoteId/confirmed');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 200, quotes.confirm(params.quoteId, { eventId: body.eventId, fills: body.fills }));
      }
      params = match(path, '/v2/fx/ops/quotes/:quoteId/failed');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 200, quotes.fail(params.quoteId, { eventId: body.eventId ?? null, reason: body.reason }));
      }

      throw apiError('NOT_FOUND', 404, 'endpoint not found');
    } catch (error) {
      const response = errorResponse(error);
      send(res, response.status, response.body);
    }
  }

  const server = http.createServer((req, res) => { void handle(req, res); });
  return {
    server,
    listen({ port = 0, host = '127.0.0.1' } = {}) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
