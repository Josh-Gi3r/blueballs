/** IBAN — ISO 13616 mod-97 checksum. Pure, no dependencies. */

const A_CODE = "A".charCodeAt(0);

/** A→10 .. Z→35, digits pass through unchanged. */
function numericString(str) {
  let out = "";
  for (const ch of str) {
    out += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - A_CODE + 10) : ch;
  }
  return out;
}

/** True if `iban` (spaces allowed) passes the mod-97 == 1 check. Does not
 *  enforce per-country length — the moving part self-hosters actually need
 *  is "does this checksum verify", not a lookup table of 70 country lengths. */
export function ibanValid(iban) {
  if (typeof iban !== "string") return false;
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = numericString(rearranged);
  if (!/^\d+$/.test(numeric)) return false;
  return BigInt(numeric) % 97n === 1n;
}

/** Compute the 2-digit check for a given `countryCode` + `bban` (BBAN = bank
 *  code + branch + account, no country/check prefix, alphanumeric). */
export function ibanCheckDigits(countryCode, bban) {
  const cc = String(countryCode).toUpperCase();
  const b = String(bban).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error("countryCode must be 2 letters, e.g. \"DE\"");
  if (!/^[A-Z0-9]+$/.test(b)) throw new Error("bban must be alphanumeric");
  const numeric = numericString(b + cc + "00");
  const remainder = BigInt(numeric) % 97n;
  const check = 98n - remainder;
  return check.toString().padStart(2, "0");
}

/** Assemble a full, checksum-valid IBAN from a country code and a BBAN. */
export function ibanGenerate(countryCode, bban) {
  const cc = String(countryCode).toUpperCase();
  const b = String(bban).toUpperCase();
  return `${cc}${ibanCheckDigits(cc, b)}${b}`;
}
