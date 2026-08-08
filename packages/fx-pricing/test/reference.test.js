import test from 'node:test';
import assert from 'node:assert/strict';

import { ReferencePriceEngine } from '../src/index.js';

const NOW = 1_000_000;

function obs(sourceId, bid, ask, observedAt = NOW, extra = {}) {
  return { sourceId, base: 'USD', quote: 'EUR', bid, ask, observedAt, ...extra };
}

test('reference price uses median consensus and rejects outliers', () => {
  const engine = new ReferencePriceEngine({ now: () => NOW, maxDeviationBps: 100 });
  const result = engine.consensus({
    base: 'USD', quote: 'EUR', observations: [
      obs('a', '0.8990', '0.9010'),
      obs('b', '0.9000', '0.9020'),
      obs('c', '1.0500', '1.0520'),
    ],
  });
  assert.equal(result.available, true);
  assert.deepEqual(result.sourceIds, ['a', 'b']);
  assert.equal(result.rejected.some((x) => x.sourceId === 'c' && x.reason === 'OUTLIER'), true);
});

test('stale and inverted observations never enter consensus', () => {
  const engine = new ReferencePriceEngine({ now: () => NOW, maxAgeMs: 1000 });
  const result = engine.consensus({
    base: 'USD', quote: 'EUR', observations: [
      obs('stale', '0.9', '0.91', NOW - 1001),
      obs('bad', '0.92', '0.91'),
      obs('a', '0.9', '0.91'),
      obs('b', '0.9', '0.91'),
    ],
  });
  assert.equal(result.available, true);
  assert.equal(result.rejected.some((x) => x.sourceId === 'stale' && x.reason === 'STALE'), true);
  assert.equal(result.rejected.some((x) => x.sourceId === 'bad' && x.reason === 'INVALID_SPREAD'), true);
});

test('latest observation per source wins', () => {
  const engine = new ReferencePriceEngine({ now: () => NOW });
  const result = engine.consensus({
    base: 'USD', quote: 'EUR', observations: [
      obs('a', '0.80', '0.80', NOW - 10),
      obs('a', '0.90', '0.90', NOW),
      obs('b', '0.90', '0.90', NOW),
    ],
  });
  assert.equal(result.available, true);
  assert.equal(result.mid, '0.9');
});

test('insufficient trustworthy sources fails closed', () => {
  const engine = new ReferencePriceEngine({ now: () => NOW, minSources: 2 });
  const result = engine.consensus({ base: 'USD', quote: 'EUR', observations: [obs('a', '0.9', '0.9')] });
  assert.equal(result.available, false);
  assert.equal(result.reason, 'INSUFFICIENT_SOURCES');
});
