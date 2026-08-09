import test from 'node:test';
import assert from 'node:assert/strict';

import { createReferenceRuntime, REFERENCE_ASSETS } from '../src/reference-runtime.js';
import { createFxNodeServer } from '../src/server.js';

const NOW = 1_000_000;
const API_KEY = 'reference-test-key';
const UNIT = 1_000_000n;
const INPUT = REFERENCE_ASSETS.USDC.id;
const OUTPUT = REFERENCE_ASSETS.EURC.id;

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
    now: () => NOW,
  });
  const address = await node.listen();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: `Bearer ${API_KEY}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { response, json: await response.json() };
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
    assert.equal(status.json.canonicalFxRuntime, true);
    assert.equal(status.json.mode, 'REFERENCE_SANDBOX');

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
    assert.equal(quoted.json.state, 'RESERVED');
    assert.equal(quoted.json.sources.length, 6);

    const route = await env.request(`/v2/fx/routes/${quoted.json.routeId}`);
    assert.equal(route.response.status, 200);
    assert.equal(route.json.quoteId, quoted.json.id);
    assert.equal(route.json.sources.length, 6);

    const execution = await env.request(`/v2/fx/quotes/${quoted.json.id}/execute`, { method: 'POST' });
    assert.equal(execution.response.status, 503);
    assert.equal(execution.json.error.code, 'EXECUTION_UNAVAILABLE');
    const stillReserved = await env.request(`/v2/fx/quotes/${quoted.json.id}`);
    assert.equal(stillReserved.json.state, 'RESERVED');
  } finally {
    await env.close();
  }
});
