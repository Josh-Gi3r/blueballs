import test from 'node:test';
import assert from 'node:assert/strict';

import { BlueballsFxClient, BlueballsFxError } from '../src/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('SDK sends authenticated firm quote request with exact string amount and participant context', async () => {
  let seen;
  const client = new BlueballsFxClient({
    baseUrl: 'http://localhost:8788/',
    apiKey: 'secret-key',
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return jsonResponse({ id: 'quote-1', state: 'RESERVED' }, 201);
    },
  });

  const quote = await client.quote({
    inputAsset: 'USDC',
    outputAsset: 'EURC',
    exactOutput: 100000000n,
    expiresInMs: 15_000,
    participantId: 'customer-1',
    accountRef: 'customer-1:wallet',
  });
  assert.equal(quote.id, 'quote-1');
  assert.equal(seen.url, 'http://localhost:8788/v2/fx/quotes');
  assert.equal(seen.options.headers.authorization, 'Bearer secret-key');
  assert.deepEqual(JSON.parse(seen.options.body), {
    inputAsset: 'USDC',
    outputAsset: 'EURC',
    exactOutput: '100000000',
    expiresInMs: 15_000,
    participantId: 'customer-1',
    accountRef: 'customer-1:wallet',
  });
});

test('SDK exposes the canonical reference runtime inspection surface', async () => {
  const urls = [];
  const client = new BlueballsFxClient({
    baseUrl: 'http://localhost:8788',
    apiKey: 'secret-key',
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse({ ok: true });
    },
  });

  await client.referenceStatus();
  await client.referencePolicy();
  await client.referenceLiquidity({
    inputAsset: '0x input/value',
    outputAsset: '0x output/value',
    exactOutput: 100n,
  });
  await client.referenceSettlementRoute();

  assert.deepEqual(urls, [
    'http://localhost:8788/v2/fx/reference/status',
    'http://localhost:8788/v2/fx/reference/policy',
    'http://localhost:8788/v2/fx/reference/liquidity?inputAsset=0x+input%2Fvalue&outputAsset=0x+output%2Fvalue&exactOutput=100',
    'http://localhost:8788/v2/fx/reference/settlement-route',
  ]);
});

test('health request is intentionally unauthenticated', async () => {
  let headers;
  const client = new BlueballsFxClient({
    baseUrl: 'http://localhost:8788',
    apiKey: 'secret-key',
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return jsonResponse({ status: 'ok' });
    },
  });
  await client.health();
  assert.equal('authorization' in headers, false);
});

test('SDK preserves machine-readable node errors', async () => {
  const client = new BlueballsFxClient({
    baseUrl: 'http://localhost:8788',
    apiKey: 'bad-key',
    fetchImpl: async () => jsonResponse({
      error: { code: 'AUTH_REQUIRED', message: 'valid API key required', details: { scope: 'fx' } },
    }, 401),
  });

  await assert.rejects(
    () => client.getQuote('missing'),
    (error) => {
      assert.ok(error instanceof BlueballsFxError);
      assert.equal(error.code, 'AUTH_REQUIRED');
      assert.equal(error.status, 401);
      assert.deepEqual(error.details, { scope: 'fx' });
      return true;
    },
  );
});

test('SDK encodes resource identifiers and query values', async () => {
  const urls = [];
  const client = new BlueballsFxClient({
    baseUrl: 'http://localhost:8788',
    apiKey: 'secret-key',
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse({ object: 'list', data: [] });
    },
  });
  await client.listOrders('0x maker/value');
  assert.equal(urls[0], 'http://localhost:8788/v2/fx/orders?maker=0x%20maker%2Fvalue');
});
