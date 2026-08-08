const SOURCE_TYPES = new Set([
  'PRIVATE_MARKET',
  'ISSUER',
  'INSTITUTIONAL_LP',
  'NEOBANK',
  'BANK_TREASURY',
  'BANK_PRINCIPAL',
]);

function asPositiveBigInt(value, name) {
  const parsed = BigInt(String(value));
  if (parsed <= 0n) throw new RangeError(`${name} must be positive`);
  return parsed;
}

function comparePrice(a, b) {
  const left = BigInt(a.inputNumerator) * BigInt(b.inputDenominator);
  const right = BigInt(b.inputNumerator) * BigInt(a.inputDenominator);
  if (left !== right) return left < right ? -1 : 1;
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  return a.sliceId < b.sliceId ? -1 : a.sliceId > b.sliceId ? 1 : 0;
}

function ceilDiv(n, d) {
  return (n + d - 1n) / d;
}

function validateSlice(slice, { inputAsset, outputAsset, now }) {
  if (!slice || typeof slice !== 'object') return false;
  if (!SOURCE_TYPES.has(slice.sourceType)) return false;
  if (typeof slice.sourceId !== 'string' || !slice.sourceId) return false;
  if (typeof slice.sliceId !== 'string' || !slice.sliceId) return false;
  if (slice.inputAsset !== inputAsset || slice.outputAsset !== outputAsset) return false;
  if (typeof slice.policyAuthorizationId !== 'string' || !slice.policyAuthorizationId) return false;
  if (!Number.isSafeInteger(slice.expiresAt) || slice.expiresAt <= now) return false;
  try {
    if (asPositiveBigInt(slice.maxOutput, 'maxOutput') <= 0n) return false;
    if (asPositiveBigInt(slice.inputNumerator, 'inputNumerator') <= 0n) return false;
    if (asPositiveBigInt(slice.inputDenominator, 'inputDenominator') <= 0n) return false;
  } catch {
    return false;
  }
  return true;
}

export function planExactOutput({ inputAsset, outputAsset, desiredOutput, slices, now = Date.now() }) {
  if (typeof inputAsset !== 'string' || !inputAsset) throw new TypeError('inputAsset required');
  if (typeof outputAsset !== 'string' || !outputAsset) throw new TypeError('outputAsset required');
  if (inputAsset === outputAsset) throw new RangeError('inputAsset and outputAsset must differ');
  if (!Array.isArray(slices)) throw new TypeError('slices must be an array');
  if (!Number.isSafeInteger(now) || now < 0) throw new RangeError('now invalid');

  const desired = asPositiveBigInt(desiredOutput, 'desiredOutput');
  const eligible = slices
    .filter((slice) => validateSlice(slice, { inputAsset, outputAsset, now }))
    .sort(comparePrice);

  let remaining = desired;
  let totalInput = 0n;
  const legs = [];

  for (const slice of eligible) {
    if (remaining === 0n) break;
    const capacity = BigInt(slice.maxOutput);
    const outputAmount = capacity < remaining ? capacity : remaining;
    const inputAmount = ceilDiv(
      outputAmount * BigInt(slice.inputNumerator),
      BigInt(slice.inputDenominator),
    );
    legs.push({
      sourceType: slice.sourceType,
      sourceId: slice.sourceId,
      sliceId: slice.sliceId,
      inputAsset,
      outputAsset,
      inputAmount: inputAmount.toString(),
      outputAmount: outputAmount.toString(),
      policyAuthorizationId: slice.policyAuthorizationId,
      policySnapshotHash: slice.policySnapshotHash ?? null,
      expiresAt: slice.expiresAt,
      reservationPayload: slice.reservationPayload ?? null,
    });
    totalInput += inputAmount;
    remaining -= outputAmount;
  }

  if (remaining !== 0n) {
    const error = new Error('insufficient executable liquidity');
    error.code = 'NO_LIQUIDITY';
    error.missingOutput = remaining.toString();
    throw error;
  }

  return {
    inputAsset,
    outputAsset,
    totalInput: totalInput.toString(),
    totalOutput: desired.toString(),
    legs,
  };
}
