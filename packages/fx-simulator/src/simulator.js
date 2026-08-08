import { planExactOutput } from '../../fx-liquidity/src/index.js';

const SOURCE_TYPES = [
  'PRIVATE_MARKET',
  'ISSUER',
  'INSTITUTIONAL_LP',
  'NEOBANK',
  'BANK_TREASURY',
  'BANK_PRINCIPAL',
];

function abs(value) { return value < 0n ? -value : value; }

function seeded(seed) {
  let state = BigInt(seed) & 0xffffffffn;
  return () => {
    state = (1664525n * state + 1013904223n) & 0xffffffffn;
    return Number(state) / 0x100000000;
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function sourceKey(source) { return `${source.sourceType}:${source.sourceId}`; }

function assertSource(source) {
  if (!SOURCE_TYPES.includes(source.sourceType)) throw new RangeError(`invalid sourceType ${source.sourceType}`);
  if (typeof source.sourceId !== 'string' || !source.sourceId) throw new TypeError('sourceId required');
  for (const field of ['capacityBuy', 'capacitySell', 'inputNumeratorBuy', 'inputDenominatorBuy', 'inputNumeratorSell', 'inputDenominatorSell']) {
    if (BigInt(String(source[field])) <= 0n) throw new RangeError(`${field} must be positive`);
  }
}

function makeSlice(source, direction, now, principalCapacity) {
  if (!source.online) return null;
  let capacity = BigInt(direction === 'BUY_B' ? source.capacityBuy : source.capacitySell);
  if (source.sourceType === 'PRIVATE_MARKET') {
    capacity = (capacity * BigInt(source.privateCapacityBps ?? 10_000)) / 10_000n;
  }
  if (source.sourceType === 'BANK_PRINCIPAL') {
    capacity = capacity < principalCapacity ? capacity : principalCapacity;
  }
  if (capacity <= 0n) return null;
  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sliceId: `${source.sourceId}:${direction}`,
    inputAsset: direction === 'BUY_B' ? 'A' : 'B',
    outputAsset: direction === 'BUY_B' ? 'B' : 'A',
    maxOutput: capacity.toString(),
    inputNumerator: String(direction === 'BUY_B' ? source.inputNumeratorBuy : source.inputNumeratorSell),
    inputDenominator: String(direction === 'BUY_B' ? source.inputDenominatorBuy : source.inputDenominatorSell),
    policyAuthorizationId: `sim-auth:${source.sourceId}`,
    expiresAt: now + 1_000_000,
  };
}

function pct(n, d) { return d === 0 ? 0 : Number((BigInt(n) * 1_000_000n) / BigInt(d)) / 10_000; }

export function runSimulation(config) {
  if (!config || typeof config !== 'object') throw new TypeError('config required');
  const rng = seeded(config.seed ?? 1);
  const sources = clone(config.sources ?? []);
  sources.forEach(assertSource);

  const hardLimit = BigInt(String(config.principalHardLimit ?? '0'));
  if (hardLimit <= 0n) throw new RangeError('principalHardLimit must be positive');

  const state = {
    referenceAvailable: true,
    referenceIndex: Number(config.referenceIndex ?? 1),
    settlementFailureProbability: Number(config.settlementFailureProbability ?? 0),
    principalExposureB: BigInt(String(config.initialPrincipalExposureB ?? '0')),
    peakPrincipalExposureAbs: 0n,
  };
  if (abs(state.principalExposureB) > hardLimit) throw new Error('initial principal exposure exceeds hard limit');

  const events = [...(config.events ?? [])].sort((a, b) => a.at - b.at);
  const requests = config.requests ?? [];
  const metrics = {
    seed: config.seed ?? 1,
    requestedOrders: 0,
    filledOrders: 0,
    requestedVolume: 0n,
    filledVolume: 0n,
    totalInput: 0n,
    routeComposition: Object.fromEntries(SOURCE_TYPES.map((t) => [t, 0n])),
    rejections: { RISK_LIMIT: 0, NO_LIQUIDITY: 0 },
    settlementFailures: 0,
    principalExposureB: state.principalExposureB,
    peakPrincipalExposureAbs: abs(state.principalExposureB),
    referenceOutageRequests: 0,
  };

  let eventIndex = 0;
  function applyEvent(event) {
    if (event.type === 'REFERENCE_UNAVAILABLE') state.referenceAvailable = false;
    else if (event.type === 'REFERENCE_AVAILABLE') state.referenceAvailable = true;
    else if (event.type === 'CHAIN_CONGESTION') state.settlementFailureProbability = Number(event.failureProbability ?? 0.25);
    else if (event.type === 'CHAIN_RECOVERY') state.settlementFailureProbability = Number(event.failureProbability ?? 0);
    else if (event.type === 'PRICE_SHOCK') state.referenceIndex *= Number(event.multiplier ?? 1);
    else {
      const source = sources.find((s) => s.sourceId === event.sourceId);
      if (!source) throw new Error(`event source not found: ${event.sourceId}`);
      if (event.type === 'SOURCE_OFFLINE') source.online = false;
      else if (event.type === 'SOURCE_ONLINE') source.online = true;
      else if (event.type === 'CANCELLATION_STORM') source.privateCapacityBps = Number(event.remainingBps ?? 1_000);
      else if (event.type === 'CANCELLATION_RECOVERY') source.privateCapacityBps = 10_000;
      else throw new Error(`unknown event type: ${event.type}`);
    }
  }

  for (let i = 0; i < requests.length; i += 1) {
    while (eventIndex < events.length && events[eventIndex].at === i) applyEvent(events[eventIndex++]);
    const request = requests[i];
    const direction = request.direction;
    if (!['BUY_B', 'SELL_B'].includes(direction)) throw new RangeError('request direction invalid');
    const amount = BigInt(String(request.outputAmount));
    if (amount <= 0n) throw new RangeError('request outputAmount must be positive');

    metrics.requestedOrders += 1;
    metrics.requestedVolume += amount;
    if (!state.referenceAvailable) metrics.referenceOutageRequests += 1;

    const principalCapacity = direction === 'BUY_B'
      ? hardLimit + state.principalExposureB
      : hardLimit - state.principalExposureB;

    const slices = [];
    for (const source of sources) {
      if (source.sourceType === 'BANK_PRINCIPAL' && !state.referenceAvailable) continue;
      const slice = makeSlice(source, direction, i, principalCapacity > 0n ? principalCapacity : 0n);
      if (slice) slices.push(slice);
    }

    let plan;
    try {
      plan = planExactOutput({
        inputAsset: direction === 'BUY_B' ? 'A' : 'B',
        outputAsset: direction === 'BUY_B' ? 'B' : 'A',
        desiredOutput: amount.toString(),
        slices,
        now: i,
      });
    } catch (error) {
      const anyPrincipal = sources.some((s) => s.sourceType === 'BANK_PRINCIPAL' && s.online);
      const principalAtLimit = direction === 'BUY_B'
        ? state.principalExposureB <= -hardLimit
        : state.principalExposureB >= hardLimit;
      if (anyPrincipal && principalAtLimit) metrics.rejections.RISK_LIMIT += 1;
      else metrics.rejections.NO_LIQUIDITY += 1;
      continue;
    }

    let principalDelta = 0n;
    for (const leg of plan.legs) {
      if (leg.sourceType === 'BANK_PRINCIPAL') {
        const out = BigInt(leg.outputAmount);
        principalDelta += direction === 'BUY_B' ? -out : out;
      }
    }
    if (abs(state.principalExposureB + principalDelta) > hardLimit) {
      metrics.rejections.RISK_LIMIT += 1;
      continue;
    }

    const failed = rng() < state.settlementFailureProbability;
    if (failed) {
      metrics.settlementFailures += 1;
      continue;
    }

    state.principalExposureB += principalDelta;
    if (abs(state.principalExposureB) > metrics.peakPrincipalExposureAbs) {
      metrics.peakPrincipalExposureAbs = abs(state.principalExposureB);
    }
    metrics.filledOrders += 1;
    metrics.filledVolume += amount;
    metrics.totalInput += BigInt(plan.totalInput);
    for (const leg of plan.legs) {
      metrics.routeComposition[leg.sourceType] += BigInt(leg.outputAmount);
    }
  }

  while (eventIndex < events.length) applyEvent(events[eventIndex++]);

  if (abs(state.principalExposureB) > hardLimit) throw new Error('SIMULATION_INVARIANT: principal hard limit exceeded');
  metrics.principalExposureB = state.principalExposureB;

  return {
    seed: metrics.seed,
    requestedOrders: metrics.requestedOrders,
    filledOrders: metrics.filledOrders,
    fillRatePct: pct(metrics.filledOrders, metrics.requestedOrders),
    requestedVolume: metrics.requestedVolume.toString(),
    filledVolume: metrics.filledVolume.toString(),
    volumeFillPct: pct(metrics.filledVolume, metrics.requestedVolume),
    totalInput: metrics.totalInput.toString(),
    routeComposition: Object.fromEntries(Object.entries(metrics.routeComposition).map(([k, v]) => [k, v.toString()])),
    principalExposureB: metrics.principalExposureB.toString(),
    peakPrincipalExposureAbs: metrics.peakPrincipalExposureAbs.toString(),
    principalHardLimit: hardLimit.toString(),
    rejections: metrics.rejections,
    settlementFailures: metrics.settlementFailures,
    referenceOutageRequests: metrics.referenceOutageRequests,
    referenceIndex: state.referenceIndex,
  };
}
