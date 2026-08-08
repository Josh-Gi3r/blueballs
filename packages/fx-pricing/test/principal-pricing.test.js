import test from 'node:test';
import assert from 'node:assert/strict';

import { PrincipalQuoteEngine, PrincipalRiskBook } from '../src/index.js';

const NOW = 1_000_000;
const REF = {
  available: true,
  mid: '1.1',
  midRational: { numerator: '11', denominator: '10' },
  sourceIds: ['a', 'b'],
  confidence: 'NORMAL',
  observedAt: NOW,
};

function setup(limits = { USD: '1000000', EUR: '1000000' }) {
  const riskBook = new PrincipalRiskBook({ now: () => NOW, limits });
  const engine = new PrincipalQuoteEngine({
    riskBook,
    baseSpreadBps: 20,
    minimumSpreadBps: 10,
    now: () => NOW,
  });
  return { riskBook, engine };
}

test('principal quote is exact, decomposable and reserves risk', () => {
  const { riskBook, engine } = setup();
  const quote = engine.quoteExactOutput({
    quoteId: 'q1',
    inputAsset: 'USD',
    outputAsset: 'EUR',
    outputAtomic: '10000',
    inputDecimals: 2,
    outputDecimals: 2,
    reference: REF,
    expiresAt: NOW + 10_000,
    volatilityBps: 10,
    sizeBps: 20,
    corridorBps: 5,
    railBps: 5,
    inventoryBps: -10,
  });

  assert.equal(quote.totalSpreadBps, 50);
  assert.equal(quote.totalInput, '11055');
  assert.deepEqual(quote.referenceProvenance.sourceIds, ['a', 'b']);
  assert.equal(riskBook.getPosition('USD').reserved, '11055');
  assert.equal(riskBook.getPosition('EUR').reserved, '-10000');
  riskBook.close();
});

test('minimum spread floors a favorable inventory adjustment', () => {
  const { riskBook, engine } = setup();
  const quote = engine.quoteExactOutput({
    quoteId: 'q1', inputAsset: 'USD', outputAsset: 'EUR', outputAtomic: '10000',
    inputDecimals: 2, outputDecimals: 2, reference: REF, expiresAt: NOW + 10_000,
    inventoryBps: -100,
  });
  assert.equal(quote.totalSpreadBps, 10);
  assert.equal(quote.totalInput, '11011');
  riskBook.close();
});

test('unavailable reference fails closed before consuming risk capacity', () => {
  const { riskBook, engine } = setup();
  assert.throws(
    () => engine.quoteExactOutput({
      quoteId: 'q1', inputAsset: 'USD', outputAsset: 'EUR', outputAtomic: '10000',
      inputDecimals: 2, outputDecimals: 2,
      reference: { available: false, reason: 'INSUFFICIENT_SOURCES' },
      expiresAt: NOW + 10_000,
    }),
    (error) => error.code === 'REFERENCE_UNAVAILABLE',
  );
  assert.equal(riskBook.getPosition('USD').reserved, '0');
  riskBook.close();
});

test('hard treasury risk limit rejects quote regardless of spread', () => {
  const { riskBook, engine } = setup({ USD: '11000', EUR: '1000000' });
  assert.throws(
    () => engine.quoteExactOutput({
      quoteId: 'q1', inputAsset: 'USD', outputAsset: 'EUR', outputAtomic: '10000',
      inputDecimals: 2, outputDecimals: 2, reference: REF, expiresAt: NOW + 10_000,
      volatilityBps: 500,
    }),
    (error) => error.code === 'RISK_LIMIT',
  );
  assert.equal(riskBook.getPosition('USD').reserved, '0');
  riskBook.close();
});

test('two quotes cannot both consume the same remaining principal capacity', () => {
  const { riskBook, engine } = setup({ USD: '20000', EUR: '20000' });
  engine.quoteExactOutput({
    quoteId: 'q1', inputAsset: 'USD', outputAsset: 'EUR', outputAtomic: '9000',
    inputDecimals: 2, outputDecimals: 2, reference: REF, expiresAt: NOW + 10_000,
  });
  assert.throws(
    () => engine.quoteExactOutput({
      quoteId: 'q2', inputAsset: 'USD', outputAsset: 'EUR', outputAtomic: '10000',
      inputDecimals: 2, outputDecimals: 2, reference: REF, expiresAt: NOW + 10_000,
    }),
    (error) => error.code === 'RISK_LIMIT',
  );
  riskBook.close();
});
