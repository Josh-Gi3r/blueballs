import { EDGE_TYPES, FINALITY } from './intent.js';

function positiveBigInt(value, field) {
  const parsed = BigInt(String(value));
  if (parsed <= 0n) throw new RangeError(`${field} must be positive`);
  return parsed;
}

function required(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} required`);
  return value;
}

export function normalizeSettlementEdge(edge) {
  if (!edge || typeof edge !== 'object') throw new TypeError('edge required');
  if (!EDGE_TYPES.has(edge.edgeType)) throw new RangeError('edgeType invalid');
  if (!FINALITY.has(edge.finalityClass)) throw new RangeError('finalityClass invalid');

  const capacity = positiveBigInt(edge.capacity, 'capacity');
  const unitInput = positiveBigInt(edge.unitInput, 'unitInput');
  const unitOutput = positiveBigInt(edge.unitOutput, 'unitOutput');
  const cost = BigInt(String(edge.cost ?? '0'));
  if (cost < 0n) throw new RangeError('cost must be non-negative');

  const atomicGroup = edge.atomicGroup ?? null;
  if (edge.finalityClass === 'ATOMIC' && (!atomicGroup || typeof atomicGroup !== 'string')) {
    throw new TypeError('ATOMIC edge requires atomicGroup');
  }
  if (edge.finalityClass !== 'ATOMIC' && atomicGroup !== null) {
    throw new Error('non-atomic edge cannot declare atomicGroup');
  }

  return {
    edgeId: required(edge.edgeId, 'edgeId'),
    edgeType: edge.edgeType,
    finalityClass: edge.finalityClass,
    fromAsset: required(edge.fromAsset, 'fromAsset'),
    toAsset: required(edge.toAsset, 'toAsset'),
    providerId: required(edge.providerId, 'providerId'),
    policyAuthorizationId: required(edge.policyAuthorizationId, 'policyAuthorizationId'),
    capacity: capacity.toString(),
    unitInput: unitInput.toString(),
    unitOutput: unitOutput.toString(),
    cost: cost.toString(),
    available: edge.available !== false,
    atomicGroup,
    settlementWindowMs: edge.settlementWindowMs ?? null,
    metadata: edge.metadata ?? {},
  };
}

function routeGuarantee(edges) {
  if (edges.length === 0) return { atomic: false, class: 'EMPTY' };

  const allAtomic = edges.every((edge) => edge.finalityClass === 'ATOMIC');
  if (allAtomic) {
    const group = edges[0].atomicGroup;
    if (edges.every((edge) => edge.atomicGroup === group)) {
      return { atomic: true, class: 'ATOMIC', atomicGroup: group };
    }
    return { atomic: false, class: 'MULTI_ATOMIC_BOUNDARY' };
  }

  const classes = [...new Set(edges.map((edge) => edge.finalityClass))];
  return {
    atomic: false,
    class: classes.length === 1 ? classes[0] : 'MIXED_FINALITY',
    finalityClasses: classes,
  };
}

export class SettlementGraph {
  constructor({ authorizationVerifier = null } = {}) {
    if (authorizationVerifier !== null && typeof authorizationVerifier !== 'function') {
      throw new TypeError('authorizationVerifier must be a function');
    }
    this.authorizationVerifier = authorizationVerifier;
    this.edges = new Map();
  }

  #verifyEdgeAuthorization(edge) {
    if (!this.authorizationVerifier) return;
    const result = this.authorizationVerifier(edge.policyAuthorizationId, {
      action: 'SETTLE_FIAT_EDGE',
      inputAsset: edge.fromAsset,
      outputAsset: edge.toAsset,
      amount: edge.capacity,
      providerId: edge.providerId,
      edgeType: edge.edgeType,
    });
    if (!result || result.valid !== true) {
      const error = new Error(`settlement edge authorization invalid: ${result?.reason ?? 'INVALID'}`);
      error.code = 'POLICY_AUTHORIZATION_INVALID';
      error.edgeId = edge.edgeId;
      throw error;
    }
  }

  upsertEdge(edge) {
    const normalized = normalizeSettlementEdge(edge);
    this.#verifyEdgeAuthorization(normalized);
    this.edges.set(normalized.edgeId, normalized);
    return normalized;
  }

  setAvailability(edgeId, available) {
    const edge = this.edges.get(edgeId);
    if (!edge) throw new Error('edge not found');
    this.edges.set(edgeId, { ...edge, available: Boolean(available) });
  }

  getEdge(edgeId) {
    return this.edges.get(edgeId) ?? null;
  }

  activeEdges() {
    return [...this.edges.values()].filter((edge) => {
      if (!edge.available || BigInt(edge.capacity) <= 0n) return false;
      try {
        this.#verifyEdgeAuthorization(edge);
        return true;
      } catch {
        return false;
      }
    });
  }

  analyzeRoute(edgeIds) {
    if (!Array.isArray(edgeIds) || edgeIds.length === 0) throw new RangeError('route requires edges');
    const edges = edgeIds.map((edgeId) => {
      const edge = this.edges.get(edgeId);
      if (!edge) throw new Error(`edge not found: ${edgeId}`);
      if (!edge.available) throw new Error(`edge unavailable: ${edgeId}`);
      if (BigInt(edge.capacity) <= 0n) throw new Error(`edge has no capacity: ${edgeId}`);
      this.#verifyEdgeAuthorization(edge);
      return edge;
    });

    for (let i = 1; i < edges.length; i += 1) {
      if (edges[i - 1].toAsset !== edges[i].fromAsset) {
        throw new Error(`route discontinuity between ${edges[i - 1].edgeId} and ${edges[i].edgeId}`);
      }
    }

    return {
      edgeIds: [...edgeIds],
      fromAsset: edges[0].fromAsset,
      toAsset: edges.at(-1).toAsset,
      edges,
      guarantee: routeGuarantee(edges),
    };
  }
}

export { routeGuarantee };
