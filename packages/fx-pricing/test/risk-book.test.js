import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrincipalRiskBook } from '../src/index.js';

const NOW = 1_000_000;

function book(path = ':memory:') {
  return new PrincipalRiskBook({ path, now: () => NOW, limits: { USD: '1000', EUR: '1000' } });
}

test('active reservations consume hard risk capacity', () => {
  const risk = book();
  risk.setSettledPosition('USD', '700');
  risk.reserve({ quoteId: 'q1', deltas: { USD: '200' }, expiresAt: NOW + 10_000 });
  assert.equal(risk.getPosition('USD').projected, '900');
  assert.throws(
    () => risk.reserve({ quoteId: 'q2', deltas: { USD: '101' }, expiresAt: NOW + 10_000 }),
    (error) => error.code === 'RISK_LIMIT',
  );
  risk.close();
});

test('multi-asset reservation is atomic on any failed leg', () => {
  const risk = book();
  risk.setSettledPosition('USD', '950');
  assert.throws(
    () => risk.reserve({ quoteId: 'q1', deltas: { USD: '100', EUR: '100' }, expiresAt: NOW + 10_000 }),
    (error) => error.code === 'RISK_LIMIT',
  );
  assert.equal(risk.getPosition('EUR').reserved, '0');
  assert.equal(risk.getPosition('USD').reserved, '0');
  risk.close();
});

test('release and expiry return risk capacity exactly once', () => {
  const risk = book();
  risk.reserve({ quoteId: 'q1', deltas: { USD: '500' }, expiresAt: NOW + 10_000 });
  assert.equal(risk.release('q1'), 1);
  assert.equal(risk.release('q1'), 0);
  assert.equal(risk.getPosition('USD').reserved, '0');

  risk.reserve({ quoteId: 'q2', deltas: { USD: '500' }, expiresAt: NOW + 1 });
  assert.equal(risk.expire(NOW + 1), 1);
  assert.equal(risk.expire(NOW + 1), 0);
  assert.equal(risk.getPosition('USD').reserved, '0');
  risk.close();
});

test('settlement converts reserved exposure into settled exposure idempotently', () => {
  const risk = book();
  risk.reserve({ quoteId: 'q1', deltas: { USD: '-300', EUR: '250' }, expiresAt: NOW + 10_000 });
  assert.deepEqual(risk.settle({ quoteId: 'q1', eventId: 'evt-1' }), { duplicate: false });
  assert.equal(risk.getPosition('USD').settled, '-300');
  assert.equal(risk.getPosition('EUR').settled, '250');
  assert.equal(risk.getPosition('USD').reserved, '0');
  assert.deepEqual(risk.settle({ quoteId: 'q1', eventId: 'evt-1' }), { duplicate: true });
  risk.close();
});

test('risk positions and reservations survive restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bb-fx-risk-'));
  const path = join(dir, 'risk.sqlite');
  try {
    const first = book(path);
    first.setSettledPosition('USD', '100');
    first.reserve({ quoteId: 'q1', deltas: { USD: '200' }, expiresAt: NOW + 10_000 });
    first.close();

    const second = book(path);
    assert.equal(second.getPosition('USD').settled, '100');
    assert.equal(second.getPosition('USD').reserved, '200');
    assert.throws(
      () => second.reserve({ quoteId: 'q2', deltas: { USD: '701' }, expiresAt: NOW + 10_000 }),
      (error) => error.code === 'RISK_LIMIT',
    );
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reconfiguring a limit cannot strand an already-over-limit settled position', () => {
  const risk = book();
  risk.setSettledPosition('USD', '800');
  assert.throws(() => risk.configureAsset('USD', '799'), /below current settled position/);
  risk.close();
});
