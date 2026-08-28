export function toPositiveBigInt(value, field) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new TypeError(`${field} must be an unsigned decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new RangeError(`${field} must be greater than zero`);
  return parsed;
}

export function toNonNegativeBigInt(value, field) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new TypeError(`${field} must be an unsigned decimal string`);
  }
  return BigInt(value);
}

export function compareMakerPrice(a, b) {
  const left = BigInt(a.buy_amount) * BigInt(b.sell_amount);
  const right = BigInt(b.buy_amount) * BigInt(a.sell_amount);
  if (left < right) return -1;
  if (left > right) return 1;

  if (a.sequence < b.sequence) return -1;
  if (a.sequence > b.sequence) return 1;
  return a.order_hash.localeCompare(b.order_hash);
}

export function availableSell(row) {
  const signed = BigInt(row.sell_amount);
  const filled = BigInt(row.confirmed_filled_sell);
  const reserved = BigInt(row.reserved_sell);
  const available = signed - filled - reserved;
  if (available < 0n)
    throw new Error(`negative available quantity for ${row.order_hash}`);
  return available;
}

export function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function normalizedPriceKey(buyAmount, sellAmount) {
  const buy = BigInt(buyAmount);
  const sell = BigInt(sellAmount);
  const divisor = gcd(buy, sell);
  return `${buy / divisor}:${sell / divisor}`;
}

export function minBigInt(a, b) {
  return a < b ? a : b;
}
