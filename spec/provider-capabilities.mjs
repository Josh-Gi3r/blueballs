/** Machine-readable provider boundary owned by Blueballs core.
 *
 * Adapter implementations are deployment-owned, but these canonical capability
 * names, actions and finality requirements are part of the production protocol.
 */
export const PROVIDER_PROTOCOL_VERSION = "2026-09-11";

export const PROVIDER_CAPABILITIES = Object.freeze([
  Object.freeze({
    capability: "payments.transfer",
    action: "submit",
    kind: "money_movement",
    success_finality: "funds_state=settled",
    safe_failure_funds_states: Object.freeze([
      "not_sent",
      "rejected_before_submission",
      "returned",
    ]),
  }),
  Object.freeze({
    capability: "cards.issuing",
    action: "issue",
    kind: "resource_provisioning",
    success_finality: "provider reference, processor token or valid last4",
  }),
  Object.freeze({
    capability: "accounts.receiving_details",
    action: "issue",
    kind: "resource_provisioning",
    success_finality: "provider-backed receiving instrument identifier",
  }),
  Object.freeze({
    capability: "identity.verification",
    action: "submit",
    kind: "compliance",
    success_finality: "decision=approved|declined|withdrawn",
  }),
  Object.freeze({
    capability: "custody.wallet",
    action: "create",
    kind: "resource_provisioning",
    success_finality: "provider-backed wallet address",
  }),
  Object.freeze({
    capability: "custody.transfer",
    action: "submit",
    kind: "money_movement",
    success_finality: "funds_state=settled",
    safe_failure_funds_states: Object.freeze([
      "not_sent",
      "rejected_before_submission",
      "returned",
    ]),
  }),
]);

export const PROVIDER_CAPABILITY_KEYS = Object.freeze(
  PROVIDER_CAPABILITIES.map(({ capability, action }) => `${capability}:${action}`),
);

export const PROVIDER_INBOUND_EVENTS = Object.freeze([
  "payments.account_credit_settled",
  "custody.wallet_deposit_settled",
]);
