import {
  compare,
  deviationWithinBps,
  median,
  midpoint,
  parseDecimal,
  toDecimalString,
} from './rational.js';

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export class ReferencePriceEngine {
  constructor({
    maxAgeMs = 15_000,
    minSources = 2,
    maxDeviationBps = 100,
    allowDegradedSingleSource = false,
    now = () => Date.now(),
  } = {}) {
    if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) throw new RangeError('maxAgeMs invalid');
    if (!Number.isSafeInteger(minSources) || minSources <= 0) throw new RangeError('minSources invalid');
    if (!Number.isSafeInteger(maxDeviationBps) || maxDeviationBps < 0) {
      throw new RangeError('maxDeviationBps invalid');
    }
    this.maxAgeMs = maxAgeMs;
    this.minSources = minSources;
    this.maxDeviationBps = maxDeviationBps;
    this.allowDegradedSingleSource = allowDegradedSingleSource;
    this.now = now;
  }

  consensus({ base, quote, observations }) {
    if (typeof base !== 'string' || base.length === 0) throw new TypeError('base required');
    if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote required');
    if (base === quote) throw new RangeError('base and quote must differ');
    if (!Array.isArray(observations)) throw new TypeError('observations must be an array');

    const now = this.now();
    const rejected = [];
    const latestBySource = new Map();

    for (const observation of observations) {
      const sourceId = String(observation?.sourceId ?? '');
      if (!sourceId) {
        rejected.push({ sourceId: '', reason: 'SOURCE_ID_REQUIRED' });
        continue;
      }
      if (observation.base !== base || observation.quote !== quote) {
        rejected.push({ sourceId, reason: 'WRONG_PAIR' });
        continue;
      }
      if (!validTimestamp(observation.observedAt)) {
        rejected.push({ sourceId, reason: 'INVALID_TIMESTAMP' });
        continue;
      }
      if (observation.observedAt > now || now - observation.observedAt > this.maxAgeMs) {
        rejected.push({ sourceId, reason: 'STALE' });
        continue;
      }
      if (observation.status && !['OK', 'DEGRADED'].includes(observation.status)) {
        rejected.push({ sourceId, reason: 'SOURCE_STATUS' });
        continue;
      }

      let bid;
      let ask;
      try {
        bid = parseDecimal(observation.bid);
        ask = parseDecimal(observation.ask);
      } catch {
        rejected.push({ sourceId, reason: 'INVALID_PRICE' });
        continue;
      }
      if (bid.n <= 0n || ask.n <= 0n || compare(bid, ask) > 0) {
        rejected.push({ sourceId, reason: 'INVALID_SPREAD' });
        continue;
      }

      const normalized = {
        sourceId,
        observedAt: observation.observedAt,
        mid: midpoint(bid, ask),
      };
      const existing = latestBySource.get(sourceId);
      if (!existing || normalized.observedAt > existing.observedAt) {
        latestBySource.set(sourceId, normalized);
      }
    }

    let accepted = [...latestBySource.values()];
    if (accepted.length === 0) return this.#unavailable(base, quote, rejected, 'NO_VALID_SOURCES');

    const firstMedian = median(accepted.map((item) => item.mid));
    const inliers = [];
    for (const item of accepted) {
      if (deviationWithinBps(item.mid, firstMedian, this.maxDeviationBps)) {
        inliers.push(item);
      } else {
        rejected.push({ sourceId: item.sourceId, reason: 'OUTLIER' });
      }
    }
    accepted = inliers;

    let confidence = 'NORMAL';
    if (accepted.length < this.minSources) {
      if (!(this.allowDegradedSingleSource && accepted.length >= 1)) {
        return this.#unavailable(base, quote, rejected, 'INSUFFICIENT_SOURCES');
      }
      confidence = 'DEGRADED';
    }

    const finalMedian = median(accepted.map((item) => item.mid));
    const sourceIds = accepted.map((item) => item.sourceId).sort();
    const observedAt = Math.min(...accepted.map((item) => item.observedAt));

    return {
      available: true,
      base,
      quote,
      mid: toDecimalString(finalMedian, 24),
      midRational: { numerator: finalMedian.n.toString(), denominator: finalMedian.d.toString() },
      sourceIds,
      rejected,
      observedAt,
      confidence,
    };
  }

  #unavailable(base, quote, rejected, reason) {
    return {
      available: false,
      base,
      quote,
      reason,
      sourceIds: [],
      rejected,
      confidence: 'UNAVAILABLE',
    };
  }
}
