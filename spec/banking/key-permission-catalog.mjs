/** Pure API-key permission vocabulary shared by runtime and OpenAPI generation.
 * This module must have no banking-runtime imports or persistence side effects. */
export const KEY_PERMISSION_DOMAINS = Object.freeze([
  "keys",
  "identity",
  "accounts",
  "wallets",
  "payments",
  "fx",
  "cards",
  "lending",
  "controls",
  "ledger",
  "webhooks",
  "sandbox",
]);

export const KEY_PERMISSIONS = Object.freeze(
  KEY_PERMISSION_DOMAINS.flatMap((domain) => [
    `${domain}:read`,
    `${domain}:write`,
    `${domain}:*`,
  ]),
);
