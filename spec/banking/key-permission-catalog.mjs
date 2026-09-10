/** Pure API-key permission vocabulary shared by runtime, docs and CI.
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

export const PERMISSION_ROUTE_RULES = Object.freeze([
  [/^\/v2\/keys(?:\/|$)/, "keys"],
  [/^\/v2\/(?:customers|applications)(?:\/|$)/, "identity"],
  [/^\/v2\/(?:accounts|details)(?:\/|$)/, "accounts"],
  [/^\/v2\/wallets(?:\/|$)/, "wallets"],
  [/^\/v2\/(?:recipients|destinations|transfers|qr|links|mandates|subscriptions)(?:\/|$)/, "payments"],
  [/^\/v2\/(?:fx|ramps)(?:\/|$)/, "fx"],
  [/^\/v2\/(?:cards|authorisations|disputes)(?:\/|$)/, "cards"],
  [/^\/v2\/(?:vaults|credit)(?:\/|$)/, "lending"],
  [/^\/v2\/(?:policies|approval-chains|approvals|orgs)(?:\/|$)/, "controls"],
  [/^\/v2\/(?:ledger|statements|fees)(?:\/|$)/, "ledger"],
  [/^\/v2\/(?:webhooks|events)(?:\/|$)/, "webhooks"],
  [/^\/v2\/(?:builder|sandbox)(?:\/|$)/, "sandbox"],
]);

export function permissionDomainForRoute(path) {
  const matches = PERMISSION_ROUTE_RULES.filter(([rule]) => rule.test(path));
  return matches.length === 1 ? matches[0][1] : null;
}

export function permissionForRoute(method, path) {
  const domain = permissionDomainForRoute(path);
  return domain ? `${domain}:${method === "GET" ? "read" : "write"}` : null;
}
