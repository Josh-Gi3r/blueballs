import { toPositiveBigInt } from "./math.js";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})+$/;

export function normalizeAddress(value, field) {
  if (typeof value !== "string" || !ADDRESS.test(value)) {
    throw new TypeError(`${field} must be a 20-byte hex address`);
  }
  return value.toLowerCase();
}

export function requireBytes32(value, field) {
  if (typeof value !== "string" || !BYTES32.test(value)) {
    throw new TypeError(`${field} must be bytes32 hex`);
  }
  return value.toLowerCase();
}

export function requireSignature(value) {
  if (typeof value !== "string" || !HEX.test(value)) {
    throw new TypeError("signature must be non-empty even-length hex");
  }
  return value.toLowerCase();
}

export function validateMakerOrder(order) {
  if (!order || typeof order !== "object")
    throw new TypeError("order is required");

  const normalized = {
    maker: normalizeAddress(order.maker, "order.maker"),
    sellToken: normalizeAddress(order.sellToken, "order.sellToken"),
    buyToken: normalizeAddress(order.buyToken, "order.buyToken"),
    sellAmount: String(order.sellAmount),
    buyAmount: String(order.buyAmount),
    recipient: normalizeAddress(order.recipient, "order.recipient"),
    validAfter: Number(order.validAfter),
    validUntil: Number(order.validUntil),
    epoch: Number(order.epoch),
    salt: requireBytes32(order.salt, "order.salt"),
  };

  toPositiveBigInt(normalized.sellAmount, "order.sellAmount");
  toPositiveBigInt(normalized.buyAmount, "order.buyAmount");

  if (normalized.sellToken === normalized.buyToken) {
    throw new RangeError("sellToken and buyToken must differ");
  }

  for (const [field, value] of [
    ["order.validAfter", normalized.validAfter],
    ["order.validUntil", normalized.validUntil],
    ["order.epoch", normalized.epoch],
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${field} must be a non-negative safe integer`);
    }
  }

  if (normalized.validUntil < normalized.validAfter) {
    throw new RangeError("order validity window is invalid");
  }

  return normalized;
}

export function validateAdmission(payload) {
  if (!payload || typeof payload !== "object")
    throw new TypeError("admission payload is required");
  return {
    orderHash: requireBytes32(payload.orderHash, "orderHash"),
    order: validateMakerOrder(payload.order),
    signature: requireSignature(payload.signature),
    policyAuthorizationId: String(payload.policyAuthorizationId ?? ""),
    policySnapshotHash: requireBytes32(
      payload.policySnapshotHash,
      "policySnapshotHash",
    ),
  };
}
