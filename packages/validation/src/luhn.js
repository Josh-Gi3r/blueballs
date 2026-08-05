/** Luhn (mod-10) checksum — card/identifier numbers. Pure, no dependencies. */

/** digits[0] must be the rightmost digit of the number being summed. */
function luhnSum(digits, doubleAtEven) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let v = digits[i];
    if (i % 2 === (doubleAtEven ? 0 : 1)) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return sum;
}

/** True if `number` (digit string, check digit included as the last char) is Luhn-valid. */
export function luhnValid(number) {
  if (typeof number !== "string" || !/^\d+$/.test(number)) return false;
  const digits = number.split("").reverse().map(Number);
  // rightmost digit is the check digit itself — never doubled.
  return luhnSum(digits, false) % 10 === 0;
}

/** Compute the check digit that makes `payload` (digit string, check digit NOT
 *  included) Luhn-valid once appended. */
export function luhnCheckDigit(payload) {
  if (typeof payload !== "string" || !/^\d+$/.test(payload)) {
    throw new Error("payload must be a digit string");
  }
  const digits = payload.split("").reverse().map(Number);
  // payload's rightmost digit sits one place left of the (not-yet-appended)
  // check digit, so it's the one that gets doubled first.
  const sum = luhnSum(digits, true);
  return (10 - (sum % 10)) % 10;
}

/** Convenience: payload + its own valid check digit. */
export function luhnGenerate(payload) {
  return `${payload}${luhnCheckDigit(payload)}`;
}
