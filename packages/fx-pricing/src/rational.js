function absBigInt(value) {
  return value < 0n ? -value : value;
}

export function gcd(a, b) {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function rational(numerator, denominator = 1n) {
  if (denominator === 0n) throw new RangeError('zero denominator');
  let n = BigInt(numerator);
  let d = BigInt(denominator);
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}

export function parseDecimal(value) {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) {
    throw new TypeError(`invalid decimal: ${value}`);
  }
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = unsigned.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}` || '0') * (negative ? -1n : 1n);
  return rational(numerator, denominator);
}

export function add(a, b) {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a, b) {
  return rational(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a, b) {
  return rational(a.n * b.n, a.d * b.d);
}

export function div(a, b) {
  if (b.n === 0n) throw new RangeError('division by zero');
  return rational(a.n * b.d, a.d * b.n);
}

export function compare(a, b) {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function abs(a) {
  return rational(absBigInt(a.n), a.d);
}

export function midpoint(a, b) {
  return div(add(a, b), rational(2n));
}

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) throw new RangeError('median requires values');
  const sorted = [...values].sort(compare);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return midpoint(sorted[middle - 1], sorted[middle]);
}

export function applyBps(value, bps) {
  const basisPoints = BigInt(bps);
  if (basisPoints <= -10_000n) throw new RangeError('bps would make value non-positive');
  return mul(value, rational(10_000n + basisPoints, 10_000n));
}

export function deviationWithinBps(value, reference, maxBps) {
  if (reference.n <= 0n) throw new RangeError('reference must be positive');
  const difference = abs(sub(value, reference));
  const left = difference.n * reference.d * 10_000n;
  const right = BigInt(maxBps) * difference.d * reference.n;
  return left <= right;
}

export function ceilDiv(numerator, denominator) {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  if (n < 0n || d <= 0n) throw new RangeError('ceilDiv requires non-negative numerator and positive denominator');
  return (n + d - 1n) / d;
}

export function quoteInputAtomicExactOutput({
  outputAtomic,
  price,
  baseDecimals,
  quoteDecimals,
}) {
  const output = BigInt(outputAtomic);
  if (output < 0n) throw new RangeError('outputAtomic must be non-negative');
  if (!Number.isInteger(baseDecimals) || baseDecimals < 0 || baseDecimals > 255) {
    throw new RangeError('baseDecimals invalid');
  }
  if (!Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 255) {
    throw new RangeError('quoteDecimals invalid');
  }
  if (price.n <= 0n) throw new RangeError('price must be positive');

  const numerator = output * price.n * 10n ** BigInt(quoteDecimals);
  const denominator = price.d * 10n ** BigInt(baseDecimals);
  return ceilDiv(numerator, denominator);
}

export function toDecimalString(value, precision = 18) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 100) {
    throw new RangeError('precision invalid');
  }
  const negative = value.n < 0n;
  const n = absBigInt(value.n);
  const whole = n / value.d;
  let remainder = n % value.d;
  if (precision === 0) return `${negative ? '-' : ''}${whole}`;

  let fraction = '';
  for (let i = 0; i < precision; i += 1) {
    remainder *= 10n;
    fraction += (remainder / value.d).toString();
    remainder %= value.d;
    if (remainder === 0n) break;
  }
  fraction = fraction.replace(/0+$/, '');
  return fraction.length > 0
    ? `${negative ? '-' : ''}${whole}.${fraction}`
    : `${negative ? '-' : ''}${whole}`;
}
