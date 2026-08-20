function adapterFor(adapters, leg) {
  const adapter = adapters?.[leg.sourceType];
  if (!adapter || typeof adapter.reserve !== 'function' || typeof adapter.release !== 'function') {
    throw new Error(`missing liquidity adapter for ${leg.sourceType}`);
  }
  return adapter;
}

export async function reservePlan({ routeId, plan, adapters }) {
  if (typeof routeId !== 'string' || !routeId) throw new TypeError('routeId required');
  if (!plan || !Array.isArray(plan.legs) || plan.legs.length === 0) {
    throw new TypeError('non-empty plan required');
  }

  const reserved = [];
  try {
    for (let index = 0; index < plan.legs.length; index += 1) {
      const leg = plan.legs[index];
      const adapter = adapterFor(adapters, leg);
      const result = await adapter.reserve({ routeId, leg, index });
      if (!result || typeof result.reservationHandle !== 'string' || !result.reservationHandle) {
        throw new Error(`${leg.sourceType} returned invalid reservation handle`);
      }
      reserved.push({ ...leg, reservationHandle: result.reservationHandle, index });
    }
  } catch (error) {
    const releaseErrors = [];
    for (let i = reserved.length - 1; i >= 0; i -= 1) {
      const item = reserved[i];
      try {
        await adapterFor(adapters, item).release({
          routeId,
          leg: item,
          reservationHandle: item.reservationHandle,
          reason: 'ROUTE_RESERVATION_FAILED',
        });
      } catch (releaseError) {
        releaseErrors.push({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          reservationHandle: item.reservationHandle,
          error: releaseError.message,
        });
      }
    }
    error.releaseErrors = releaseErrors;
    throw error;
  }

  return {
    routeId,
    inputAsset: plan.inputAsset,
    outputAsset: plan.outputAsset,
    totalInput: plan.totalInput,
    totalOutput: plan.totalOutput,
    legs: reserved,
  };
}

export async function releaseReservedRoute({ route, adapters, reason = 'RELEASED' }) {
  if (!route || !Array.isArray(route.legs)) throw new TypeError('route required');
  const results = [];
  for (let i = route.legs.length - 1; i >= 0; i -= 1) {
    const leg = route.legs[i];
    const result = await adapterFor(adapters, leg).release({
      routeId: route.routeId,
      leg,
      reservationHandle: leg.reservationHandle,
      reason,
    });
    results.push({ sourceType: leg.sourceType, sourceId: leg.sourceId, result });
  }
  return results;
}
