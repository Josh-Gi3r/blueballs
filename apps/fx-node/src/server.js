import { randomUUID } from 'node:crypto';
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
    POLICY_REJECTED: 403,
    NO_LIQUIDITY: 409,
    INSUFFICIENT_LIQUIDITY: 409,
    EXECUTION_UNAVAILABLE: 503,
    EXECUTION_REJECTED: 409,
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
    else if (/insufficient eligible liquidity|insufficient executable liquidity/i.test(message)) {
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
  const payload = JSON.stringify(body, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
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
  inspector = null,
  executionAdapter = null,
  apiKey,
  publicDepth = false,
  now = () => Date.now(),
} = {}) {
  if (!market) throw new TypeError('market service required');
  if (!quotes) throw new TypeError('quote coordinator required');
  if (!fiat) throw new TypeError('fiat settlement store required');
  if (inspector !== null && typeof inspector.status !== 'function') {
    throw new TypeError('inspector must expose status()');
  }
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
        return send(res, 200, {
          status: 'ok',
          service: 'blueballs-fx-node',
          ...(inspector ? { runtime: inspector.status().mode } : {}),
        });
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

      if (inspector && method === 'GET' && path === '/v2/fx/reference/status') {
        return send(res, 200, inspector.status());
      }
      if (inspector && method === 'GET' && path === '/v2/fx/reference/policy') {
        return send(res, 200, inspector.policy());
      }
      if (inspector && method === 'GET' && path === '/v2/fx/reference/liquidity') {
        const inputAsset = url.searchParams.get('inputAsset');
        const outputAsset = url.searchParams.get('outputAsset');
        const exactOutput = url.searchParams.get('exactOutput') ?? undefined;
        if (!inputAsset || !outputAsset) {
          throw apiError('VALIDATION_ERROR', 400, 'inputAsset and outputAsset required');
        }
        return send(res, 200, {
          object: 'list',
          data: inspector.liquidity({ inputAsset, outputAsset, exactOutput }),
        });
      }
      if (inspector && method === 'GET' && path === '/v2/fx/reference/settlement-route') {
        return send(res, 200, inspector.settlementRoute());
      }

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
        return send(res, 201, await quotes.reserveExactOutput({
          inputAsset: body.inputAsset,
          outputAsset: body.outputAsset,
          exactOutput: String(body.exactOutput),
          expiresInMs: body.expiresInMs ?? 15_000,
          participantId: body.participantId,
          accountRef: body.accountRef,
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
        if (privateQuote.row.expires_at <= now()) throw apiError('QUOTE_EXPIRED', 409, 'quote expired');
        if (!executionAdapter || typeof executionAdapter.submit !== 'function') {
          throw apiError('EXECUTION_UNAVAILABLE', 503, 'execution adapter is not configured');
        }

        // Revalidation occurs inside markSubmitted before any external call. From this
        // point the route is intentionally non-releasable and must be reconciled.
        const submissionRef = `submit_${randomUUID()}`;
        const committed = await quotes.markSubmitted(params.quoteId, submissionRef);
        let outcome;
        try {
          outcome = await executionAdapter.submit(privateQuote, { submissionRef });
        } catch (error) {
          return send(res, 202, {
            ...committed,
            execution: { status: 'UNKNOWN', submissionRef, reason: error.message },
          });
        }

        const status = outcome?.status ?? 'ACCEPTED';
        if (status === 'REJECTED') {
          await quotes.fail(params.quoteId, {
            eventId: outcome.eventId ?? `reject_${submissionRef}`,
            reason: outcome.reason ?? 'EXECUTION_ADAPTER_REJECTED',
          });
          throw apiError('EXECUTION_REJECTED', 409, outcome.reason ?? 'execution adapter rejected submission');
        }
        if (status === 'UNKNOWN') {
          return send(res, 202, {
            ...committed,
            execution: { status: 'UNKNOWN', submissionRef, reason: outcome.reason ?? null },
          });
        }
        if (status !== 'ACCEPTED') {
          return send(res, 202, {
            ...committed,
            execution: { status: 'UNKNOWN', submissionRef, reason: `unexpected adapter status: ${status}` },
          });
        }
        return send(res, 202, {
          ...committed,
          execution: {
            status: 'ACCEPTED',
            submissionRef,
            externalRef: outcome.externalRef ?? null,
          },
        });
      }

      params = match(path, '/v2/fx/routes/:routeId');
      if (method === 'GET' && params) {
        const route = typeof quotes.getRoute === 'function'
          ? quotes.getRoute(params.routeId)
          : market.getRoute(params.routeId);
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
        return send(res, 200, await quotes.confirm(params.quoteId, { eventId: body.eventId, fills: body.fills }));
      }
      params = match(path, '/v2/fx/ops/quotes/:quoteId/failed');
      if (method === 'POST' && params) {
        const body = await readJson(req);
        return send(res, 200, await quotes.fail(params.quoteId, { eventId: body.eventId ?? null, reason: body.reason }));
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
