import test from 'node:test';
import assert from 'node:assert/strict';

import { createReferenceRuntime, REFERENCE_ASSETS } from '../src/reference-runtime.js';
import { createFxNodeServer } from '../src/server.js';

const NOW = 1_000_000;
const API_KEY = 'reference-test-key';
const UNIT = 1_000_000n;
const INPUT = REFERENCE_ASSETS.USDC.id;
const OUTPUT = REFERENCE_ASSETS.EURC.id;
const SITE_ORIGIN = 'http://localhost:5280';

async function runtime() {
  return createReferenceRuntime({ memory: true, now: () => NOW });
}

async function serverSetup() {
  const reference = await runtime();
  const node = createFxNodeServer({
    market: reference.market,
    quotes: reference.quotes,
    fiat: reference.fiat,
    inspector: reference.inspector,
    apiKey: API_KEY,
    corsOrigins: [SITE_ORIGIN],
    now: () => NOW,
  });
  const address = await node.listen();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = 'GET', body, auth = true, headers = {}, parse = 'json' } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: `Bearer ${API_KEY}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      response,
      body: parse === 'text' ? await response.text() : await response.json(),
    };
  }

  return {
    reference,
    node,
    request,
    async close() {
      await node.close();
      reference.close();
    },
  };
}

test('reference runtime reserves one firm route across every authorised source class', async () => {
  const env = await runtime();
  try {
    const desired = 450_000n * UNIT;
    const quote = await env.quotes.reserveExactOutput({
      inputAsset: INPUT,
      outputAsset: OUTPUT,
      exactOutput: desired.toString(),
      expiresInMs: 30_000,
    });

    assert.equal(quote.state, 'RESERVED');
    assert.equal(quote.output, desired.toString());
    assert.deepEqual(
      quote.sources.map((source) => source.type),
      [
        'PRIVATE_MARKET',
        'ISSUER',
        'NEOBANK',
        'INSTITUTIONAL_LP',
        'BANK_TREASURY',
        'BANK_PRINCIPAL',
      ],
    );
    assert.equal(
      quote.sources.reduce((sum, source) => sum + BigInt(source.output), 0n),
      desired,
    );
    assert.equal(env.riskBook.getPosition(OUTPUT).reserved, (-50_000n * UNIT).toString());
  } finally {
    env.close();
  }
});

test('revoked issuer authorisation removes it before pricing and increases principal use', async () => {
  const env = await runtime();
  try {
    env.policy.revokeAuthorization(env.seed.sourceAuthorizations['issuer-eurc']);
    const quote = await env.quotes.reserveExactOutput({
      inputAsset: INPUT,
      outputAsset: OUTPUT,
      exactOutput: (450_000n * UNIT).toString(),
      expiresInMs: 30_000,
    });

    assert.equal(quote.sources.some((source) => source.type === 'ISSUER'), false);
    const principal = quote.sources.find((source) => source.type === 'BANK_PRINCIPAL');
    assert.ok(principal);
    assert.equal(principal.output, (150_000n * UNIT).toString());
  } finally {
    env.close();
  }
});

test('submitted integrated route reconciles every source and settles principal risk', async () => {
  const env = await runtime();
  try {
    const quote = await env.quotes.reserveExactOutput({
      inputAsset: INPUT,
      outputAsset: OUTPUT,
      exactOutput: (450_000n * UNIT).toString(),
      expiresInMs: 30_000,
    });
    const submitted = env.quotes.markSubmitted(quote.id, 'submit-reference-1');
    assert.equal(submitted.state, 'SUBMITTED');

    const confirmed = env.quotes.confirm(quote.id, { eventId: 'event-reference-1' });
    assert.equal(confirmed.quote.state, 'CONFIRMED');
    assert.equal(env.riskBook.getPosition(OUTPUT).reserved, '0');
    assert.equal(env.riskBook.getPosition(OUTPUT).settled, (-50_000n * UNIT).toString());
  } finally {
    env.close();
  }
});

test('mixed fiat route keeps external and atomic finality domains distinct', async () => {
  const env = await runtime();
  try {
    const route = env.inspector.settlementRoute();
    assert.equal(route.fromAsset, 'BRL');
    assert.equal(route.toAsset, 'EUR');
    assert.equal(route.guarantee.atomic, false);
    assert.equal(route.guarantee.class, 'MIXED_FINALITY');
    assert.deepEqual(
      route.edges.map((edge) => edge.finalityClass),
      ['ATTESTED_EXTERNAL', 'ATOMIC', 'ASYNC_EXTERNAL'],
    );
  } finally {
    env.close();
  }
});

test('HTTP reference endpoints expose the same runtime and quote reservations', async () => {
  const env = await serverSetup();
  try {
    const status = await env.request('/v2/fx/reference/status');
    assert.equal(status.response.status, 200);
    assert.equal(status.body.canonicalFxRuntime, true);
    assert.equal(status.body.mode, 'REFERENCE_SANDBOX');

    const quoted = await env.request('/v2/fx/quotes', {
      method: 'POST',
      body: {
        inputAsset: INPUT,
        outputAsset: OUTPUT,
        exactOutput: (450_000n * UNIT).toString(),
        expiresInMs: 30_000,
      },
    });
    assert.equal(quoted.response.status, 201);
    assert.equal(quoted.body.state, 'RESERVED');
    assert.equal(quoted.body.sources.length, 6);

    const route = await env.request(`/v2/fx/routes/${quoted.body.routeId}`);
    assert.equal(route.response.status, 200);
    assert.equal(route.body.quoteId, quoted.body.id);
    assert.equal(route.body.sources.length, 6);

    const execution = await env.request(`/v2/fx/quotes/${quoted.body.id}/execute`, { method: 'POST' });
    assert.equal(execution.response.status, 503);
    assert.equal(execution.body.error.code, 'EXECUTION_UNAVAILABLE');
    const stillReserved = await env.request(`/v2/fx/quotes/${quoted.body.id}`);
    assert.equal(stillReserved.body.state, 'RESERVED');
  } finally {
    await env.close();
  }
});

test('the node serves its OpenAPI contract without authentication', async () => {
  const env = await serverSetup();
  try {
    const openapi = await env.request('/openapi.yaml', { auth: false, parse: 'text' });
    assert.equal(openapi.response.status, 200);
    assert.match(openapi.response.headers.get('content-type'), /^application\/yaml/);
    assert.match(openapi.body, /^openapi: 3\.1\.0/m);
    assert.match(openapi.body, /\/v2\/fx\/quotes:/);
    assert.match(openapi.body, /\/v2\/fx\/reference\/status:/);
  } finally {
    await env.close();
  }
});

test('the local site receives explicit CORS permission and unknown origins are rejected', async () => {
  const env = await serverSetup();
  try {
    const preflight = await env.request('/v2/fx/quotes', {
      method: 'OPTIONS',
      auth: false,
      headers: {
        origin: SITE_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
      parse: 'text',
    });
    assert.equal(preflight.response.status, 204);
    assert.equal(preflight.response.headers.get('access-control-allow-origin'), SITE_ORIGIN);
    assert.match(preflight.response.headers.get('access-control-allow-methods'), /POST/);

    const allowed = await env.request('/v2/fx/reference/status', {
      headers: { origin: SITE_ORIGIN },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.response.headers.get('access-control-allow-origin'), SITE_ORIGIN);

    const blocked = await env.request('/v2/fx/reference/status', {
      method: 'OPTIONS',
      auth: false,
      headers: { origin: 'https://untrusted.example' },
    });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.body.error.code, 'ORIGIN_NOT_ALLOWED');
  } finally {
    await env.close();
  }
});
