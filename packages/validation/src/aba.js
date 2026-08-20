/** US ABA routing number checksum (weights 3-7-1 repeating over 9 digits). */

const WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1];

/** True if `routing` is 9 digits and its weighted sum is a multiple of 10. */
export function abaValid(routing) {
  if (typeof routing !== "string" || !/^\d{9}$/.test(routing)) return false;
  const digits = routing.split("").map(Number);
  const sum = digits.reduce((s, d, i) => s + d * WEIGHTS[i], 0);
  return sum % 10 === 0;
}

/** Compute the 9th (check) digit for the first 8 digits of a routing number. */
export function abaCheckDigit(first8) {
  if (typeof first8 !== "string" || !/^\d{8}$/.test(first8)) {
    throw new Error("first8 must be exactly 8 digits");
  }
  const digits = first8.split("").map(Number);
  const partial = digits.reduce((s, d, i) => s + d * WEIGHTS[i], 0);
  return (10 - (partial % 10)) % 10;
}

/** Assemble a full, checksum-valid 9-digit ABA routing number. */
export function abaGenerate(first8) {
  return `${first8}${abaCheckDigit(first8)}`;
}
