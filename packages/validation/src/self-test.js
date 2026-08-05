/** Tiny self-test — `node src/self-test.js` or `npm test`. No test runner dependency. */
import { ibanValid, ibanGenerate, ibanCheckDigits } from "./iban.js";
import { luhnValid, luhnCheckDigit, luhnGenerate } from "./luhn.js";
import { abaValid, abaCheckDigit, abaGenerate } from "./aba.js";

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.error(`FAIL ${name}`); }
}

/* ---- IBAN: canonical German test vector (Wikipedia / ISO 13616 example) ---- */
assert("ibanValid: known-good DE IBAN", ibanValid("DE89370400440532013000") === true);
assert("ibanValid: spaces stripped", ibanValid("DE89 3704 0044 0532 0130 00") === true);
assert("ibanValid: corrupted checksum rejected", ibanValid("DE89370400440532013001") === false);
assert("ibanValid: garbage rejected", ibanValid("not-an-iban") === false);
assert("ibanCheckDigits: matches known vector", ibanCheckDigits("DE", "370400440532013000") === "89");
assert("ibanGenerate: round-trips to known vector", ibanGenerate("DE", "370400440532013000") === "DE89370400440532013000");
assert("ibanGenerate: different BBAN -> different, still-valid IBAN", (() => {
  const a = ibanGenerate("DE", "370400440532013000");
  const b = ibanGenerate("DE", "370400440532013001");
  return a !== b && ibanValid(a) && ibanValid(b);
})());

/* ---- Luhn: standard Visa test card ---- */
assert("luhnValid: known-good test card", luhnValid("4111111111111111") === true);
assert("luhnValid: off-by-one digit rejected", luhnValid("4111111111111112") === false);
assert("luhnCheckDigit + luhnValid round-trip", (() => {
  const payload = "41111111111111";
  const check = luhnCheckDigit(payload);
  return luhnValid(payload + check) === true;
})());
assert("luhnGenerate produces a Luhn-valid number", luhnValid(luhnGenerate("511111111111111")) === true);

/* ---- ABA: hand-verified real-world routing number (JPMorgan Chase NY) ---- */
assert("abaValid: known-good routing number", abaValid("021000021") === true);
assert("abaValid: corrupted checksum rejected", abaValid("021000022") === false);
assert("abaValid: wrong length rejected", abaValid("12345") === false);
assert("abaCheckDigit: matches known vector", abaCheckDigit("02100002") === 1);
assert("abaGenerate: two different prefixes -> two different, both-valid numbers", (() => {
  const a = abaGenerate("12345670");
  const b = abaGenerate("12345680");
  return a !== b && abaValid(a) && abaValid(b);
})());

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
