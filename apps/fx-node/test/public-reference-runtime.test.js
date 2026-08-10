import test from 'node:test';
import assert from 'node:assert/strict';

import { createPublicReferenceRuntime } from '../src/public-reference-runtime.js';
import { createFxNodeServer } from '../src/server.js';

const NOW = 1_000_000;
const API_KEY = 'public-reference-key';
const SITE_ORIGIN = 'http://localhost:5280';

async function runtime() {
  return createPublicReferenceRuntime({ memory: true, now: () => NOW });
}

async function serverSetup() {
  const reference = await runtime();
  const node = createFxNodeServer({
    market: reference.market,
    quotes: reference.quotes,
    fiat: reference.fiat,
    inspector: reference.inspector,
    trades: reference.trades,
    scenario: reference.scenario,
    apiKey: API_KEY,
    corsOrigins: [SITE_ORIGIN],
    now: () => NOW,
  });
  const address = await node.listen();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: `Bearer ${API_KEY}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return { response, body: parsed };
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

test('one BRL to EUR preview uses the canonical six-source token market', async () => {
  const env = await runtime();
  try {
    const preview = env.trades.previewExactInput({ inputAmount: '50000.00' });
    assert.equal(preview.state, 'PREVIEW');
    assert.equal(preview.from.symbol, 'BRL');
    assert.equal(preview.to.symbol, 'EUR');
    assert.equal(preview.tokenRoute.inputSymbol, 'BRLX');
    assert.equal(preview.tokenRoute.outputSymbol, 'EURC');
    assert.deepEqual(
      preview.sources.map((source) => source.type),
      [
        'PRIVATE_MARKET',
        'ISSUER',
        'NEOBANK',
        'INSTITUTIONAL_LP',
        'BANK_TREASURY',
        'BANK_PRINCIPAL',
      ],
    );
    assert.equal(preview.settlement.guarantee.atomic, false);
    assert.equal(preview.settlement.guarantee.class, 'MIXED_FINALITY');
    assert.equal(preview.evidence.reserved, false);
  } finally {
    env.close();
  }
});

test('reserving the public trade reserves every selected source and returns one connected object', async () => {
  const env = await runtime();
  try {
    const trade = await env.trades.reserveExactInput({ inputAmount: '50000.00', expiresInMs: 30_000 });
    assert.equal(trade.state, 'RESERVED');
    assert.match(trade.id, /^trade_/);
    assert.match(trade.quoteId, /^quote_/);
    assert.match(trade.routeId, /^route_/);
    assert.equal(trade.sources.length, 6);
    assert.equal(trade.evidence.reserved, true);
    assert.equal(env.trades.getTrade(trade.id).quoteId, trade.quoteId);

    const released = await env.trades.releaseTrade(trade.id);
    assert.equal(released.state, 'RELEASED');
  } finally {
    env.close();
  }
});

test('policy revocation removes the issuer before pricing', async () => {
  const env = await runtime();
  try {
    const state = env.scenario.apply('issuer_policy_blocked');
    const issuer = state.sources.find((source) => source.sourceType === 'ISSUER');
    assert.equal(issuer.eligible, false);
    assert.equal(issuer.reason, 'REVOKED');

    const preview = env.trades.previewExactInput({ inputAmount: '50000.00' });
    assert.equal(preview.sources.some((source) => source.type === 'ISSUER'), false);
    assert.ok(preview.sources.some((source) => source.type === 'BANK_PRINCIPAL'));
  } finally {
    env.close();
  }
});

test('hard principal and reference failures fail the whole exact-input customer request', async () => {
  const env = await runtime();
  try {
    env.scenario.apply('principal_limit');
    assert.throws(
      () => env.trades.previewExactInput({ inputAmount: '50000.00' }),
      (error) => error.code === 'NO_LIQUIDITY',
    );

    env.scenario.apply('reference_outage');
    assert.throws(
      () => env.trades.previewExactInput({ inputAmount: '50000.00' }),
      (error) => error.code === 'NO_LIQUIDITY',
    );
  } finally {
    env.close();
  }
});

test('HTTP customer trade, market scenario and route state all use the same runtime', async () => {
  const env = await serverSetup();
  try {
    const preview = await env.request('/v2/fx/reference/trades/preview', {
      method: 'POST',
      body: { inputAmount: '50000.00' },
      headers: { origin: SITE_ORIGIN },
    });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.body.sources.length, 6);
    assert.equal(preview.response.headers.get('access-control-allow-origin'), SITE_ORIGIN);

    const reserved = await env.request('/v2/fx/reference/trades', {
      method: 'POST',
      body: { inputAmount: '50000.00', expiresInMs: 30_000 },
    });
    assert.equal(reserved.response.status, 201);
    assert.equal(reserved.body.state, 'RESERVED');

    const fetched = await env.request(`/v2/fx/reference/trades/${reserved.body.id}`);
    assert.equal(fetched.body.quoteId, reserved.body.quoteId);

    const released = await env.request(`/v2/fx/reference/trades/${reserved.body.id}`, { method: 'DELETE' });
    assert.equal(released.body.state, 'RELEASED');

    const scenario = await env.request('/v2/fx/reference/scenario', {
      method: 'POST', body: { id: 'lp_offline' },
    });
    assert.equal(scenario.body.id, 'lp_offline');
    assert.equal(
      scenario.body.sources.find((source) => source.sourceType === 'INSTITUTIONAL_LP').eligible,
      false,
    );
  } finally {
    await env.close();
  }
});
