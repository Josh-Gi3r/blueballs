import { createHash } from "node:crypto";

function suffix(value, length = 12) {
  return createHash("sha256")
    .update(String(value ?? "blueballs-provider-fixture"))
    .digest("hex")
    .slice(0, length);
}

/**
 * Deterministic, side-effect-free provider adapter used by conformance tests.
 * It implements every capability in spec/provider-capabilities.mjs and returns
 * canonical evidence only; it never performs network or custody operations.
 */
export function deterministicProviderResult(envelope) {
  const key = `${envelope.capability}:${envelope.action}`;
  const id = suffix(envelope.job_id ?? key);

  switch (key) {
    case "payments.transfer:submit":
      return {
        outcome: "succeeded",
        provider_reference: `pay_${id}`,
        provider_state: "settled",
        funds_state: "settled",
        result: { status: "settled" },
      };

    case "cards.issuing:issue":
      return {
        outcome: "succeeded",
        provider_reference: `card_${id}`,
        provider_state: "active",
        result: {
          last4: "4242",
          bin: "555500",
          expires: "12/29",
          processor_token: `tok_${id}`,
          status: "active",
        },
      };

    case "accounts.receiving_details:issue":
      return {
        outcome: "succeeded",
        provider_reference: `acct_${id}`,
        provider_state: "active",
        result: {
          instrument: {
            type: "iban",
            iban: `DE02${id.padEnd(18, "0").slice(0, 18)}`,
            bic: "BLBLDEB2",
          },
        },
      };

    case "identity.verification:submit":
      return {
        outcome: "succeeded",
        provider_reference: `kyc_${id}`,
        provider_state: "completed",
        result: { decision: "approved" },
      };

    case "custody.wallet:create":
      return {
        outcome: "succeeded",
        provider_reference: `wallet_${id}`,
        provider_state: "active",
        result: {
          address: `0x${suffix(`${id}:address`, 40).padEnd(40, "0")}`,
          network: "base",
        },
      };

    case "custody.transfer:submit":
      return {
        outcome: "succeeded",
        provider_reference: `ctx_${id}`,
        provider_state: "settled",
        funds_state: "settled",
        result: { status: "settled" },
      };

    default: {
      const error = new Error(`Fake provider does not implement ${key}`);
      error.code = "FAKE_PROVIDER_CAPABILITY_MISSING";
      throw error;
    }
  }
}

export function createDeterministicProviderTransport() {
  return async (envelope) => structuredClone(deterministicProviderResult(envelope));
}
