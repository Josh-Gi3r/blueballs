import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FxMarketService } from '../src/index.js';

const INPUT = '0x0000000000000000000000000000000000000011';
const OUTPUT = '0x0000000000000000000000000000000000000022';
const MAKER = '0x00000000000000000000000000000000000000a1';
const POLICY_HASH = `0x${'55'.repeat(32)}`;

function admission(id = 1) {
  return {
    orderHash: `0x${id.toString(16).padStart(64, '0')}`,
    signature: '0x01',
    policyAuthorizationId: `policy-${id}`,
    policySnapshotHash: POLICY_HASH,
    order: {
      maker: MAKER,
      sellToken: OUTPUT,
      buyToken: INPUT,
      sellAmount: '100',
      buyAmount: '200',
      recipient: MAKER,
      validAfter: 0,
      validUntil: 4_000_000_000,
      epoch: 1,
      salt: `0x${(10_000 + id).toString(16).padStart(64, '0')}`,
    },
  };
}

function service({ path = ':memory:', now = () => 1_000_000 } = {}) {
  return new FxMarketService({
    path,
    now,
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true }),
  });
}

function reserve(fx, routeId = 'route-1', desiredOutput = '40') {
  return fx.reserveExactOutput({
    routeId,
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput,
    expiresAt: 2_000_000,
  });
}

function confirmedFills(route) {
  return route.fills.map((fill) => ({
    orderHash: fill.orderHash,
    makerSellAmount: fill.makerSellAmount,
    takerPayAmount: fill.expectedTakerPay,
  }));
}

test('reserved route is explicit and can be released before submission', async () => {
  const fx = service();
  await fx.admitOrder(admission(1));
  const route = reserve(fx);
  assert.equal(route.state, 'RESERVED');
  assert.equal(fx.getRoute('route-1').state, 'RESERVED');

  assert.equal(fx.releaseRoute('route-1', 'CLIENT_ABORTED'), 1);
  assert.equal(fx.getRoute('route-1').state, 'RELEASED');
  assert.equal(fx.getOrder(admission(1).orderHash).reservedSell, '0');
  fx.close();
});

test('submitted route cannot be released and must be reconciled', async () => {
  const fx = service();
  await fx.admitOrder(admission(2));
  reserve(fx, 'route-2');
  fx.markRouteSubmitted('route-2', '0xsubmission');

  assert.equal(fx.getRoute('route-2').state, 'SUBMITTED');
  assert.throws(() => fx.releaseRoute('route-2'), /cannot be released/);
  assert.equal(fx.getOrder(admission(2).orderHash).reservedSell, '40');
  fx.close();
});

test('policy block before submission releases route immediately', async () => {
  const fx = service();
  const order = admission(3);
  await fx.admitOrder(order);
  reserve(fx, 'route-3');

  const result = fx.blockOrderPolicy(order.orderHash, 'sanctions refresh');
  assert.deepEqual(result, { released: 1, submitted: false });
  assert.equal(fx.getRoute('route-3').state, 'RELEASED');
  assert.equal(fx.getOrder(order.orderHash).state, 'POLICY_BLOCKED');
  assert.equal(fx.getOrder(order.orderHash).reservedSell, '0');
  fx.close();
});

test('policy block after submission preserves in-flight reservation but removes future liquidity', async () => {
  const fx = service();
  const order = admission(4);
  await fx.admitOrder(order);
  const route = reserve(fx, 'route-4');
  fx.markRouteSubmitted('route-4', 'tx-pending-4');

  const blocked = fx.blockOrderPolicy(order.orderHash, 'risk downgrade');
  assert.deepEqual(blocked, { released: 0, submitted: true });
  assert.equal(fx.getRoute('route-4').state, 'SUBMITTED');
  assert.equal(fx.getOrder(order.orderHash).policyBlocked, true);
  assert.equal(fx.getOrder(order.orderHash).reservedSell, '40');
  assert.deepEqual(fx.aggregateDepth({ inputToken: INPUT, outputToken: OUTPUT }), []);

  fx.confirmSubmittedRoute({
    routeId: 'route-4',
    eventId: 'tx4:log0',
    fills: confirmedFills(route),
  });

  const after = fx.getOrder(order.orderHash);
  assert.equal(fx.getRoute('route-4').state, 'CONFIRMED');
  assert.equal(after.confirmedFilledSell, '40');
  assert.equal(after.confirmedFilledBuy, '80');
  assert.equal(after.reservedSell, '0');
  assert.equal(after.state, 'POLICY_BLOCKED');
  fx.close();
});

test('off-chain cancel after submission hides future liquidity without erasing in-flight route', async () => {
  const fx = service();
  const order = admission(5);
  await fx.admitOrder(order);
  const route = reserve(fx, 'route-5');
  fx.markRouteSubmitted('route-5', 'tx-pending-5');

  const cancelled = fx.cancelOrderOffchain(order.orderHash);
  assert.deepEqual(cancelled, { released: 0, submitted: true });
  assert.equal(fx.getOrder(order.orderHash).offChainHidden, true);
  assert.equal(fx.getOrder(order.orderHash).reservedSell, '40');

  fx.confirmSubmittedRoute({
    routeId: 'route-5',
    eventId: 'tx5:log0',
    fills: confirmedFills(route),
  });
  assert.equal(fx.getOrder(order.orderHash).state, 'CANCELLED');
  assert.equal(fx.getOrder(order.orderHash).confirmedFilledSell, '40');
  fx.close();
});

test('confirmation requires prior submission and is idempotent by event', async () => {
  const fx = service();
  const order = admission(6);
  await fx.admitOrder(order);
  const route = reserve(fx, 'route-6');
  const fills = confirmedFills(route);

  assert.throws(
    () => fx.confirmSubmittedRoute({ routeId: 'route-6', eventId: 'tx6:log0', fills }),
    /must be SUBMITTED/,
  );

  fx.markRouteSubmitted('route-6', 'tx6');
  assert.deepEqual(
    fx.confirmSubmittedRoute({ routeId: 'route-6', eventId: 'tx6:log0', fills }),
    { duplicate: false },
  );
  assert.deepEqual(
    fx.confirmSubmittedRoute({ routeId: 'route-6', eventId: 'tx6:log0', fills }),
    { duplicate: true },
  );
  assert.throws(
    () => fx.confirmSubmittedRoute({ routeId: 'route-6', eventId: 'different-event', fills }),
    /another event/,
  );
  fx.close();
});

test('failed submitted settlement releases maker quantity and marks route failed', async () => {
  const fx = service();
  const order = admission(7);
  await fx.admitOrder(order);
  reserve(fx, 'route-7');
  fx.markRouteSubmitted('route-7', 'tx7');

  const result = fx.failSubmittedRoute({
    routeId: 'route-7',
    eventId: 'tx7:revert',
    reason: 'ORDER_INVALIDATED',
  });
  assert.equal(result.released, 1);
  assert.equal(fx.getRoute('route-7').state, 'FAILED');
  assert.equal(fx.getOrder(order.orderHash).reservedSell, '0');
  assert.equal(fx.getOrder(order.orderHash).confirmedFilledSell, '0');
  fx.close();
});

test('only unsubmitted expired routes are released automatically', async () => {
  let now = 1_000_000;
  const fx = service({ now: () => now });
  await fx.admitOrder(admission(8));
  fx.reserveExactOutput({
    routeId: 'expiring',
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: '40',
    expiresAt: 1_100_000,
  });
  now = 1_100_001;
  assert.equal(fx.expireRoutes(), 1);
  assert.equal(fx.getRoute('expiring').state, 'EXPIRED');
  fx.close();
});

test('route lifecycle survives restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'blueballs-fx-route-'));
  const path = join(dir, 'market.sqlite');
  try {
    const first = service({ path });
    await first.admitOrder(admission(9));
    reserve(first, 'persistent-route');
    first.markRouteSubmitted('persistent-route', 'persistent-tx');
    first.close();

    const second = service({ path });
    assert.equal(second.getRoute('persistent-route').state, 'SUBMITTED');
    assert.equal(second.getRoute('persistent-route').submissionRef, 'persistent-tx');
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
