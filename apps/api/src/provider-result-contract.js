/** Capability-specific provider-result validation.
 *
 * HTTP success is not financial finality. This layer prevents a gateway from
 * returning internally contradictory canonical results that would otherwise
 * make Blueballs declare money/KYC/card/custody state final without evidence.
 */

const FUNDS_STATES = new Set([
  "not_sent",
  "rejected_before_submission",
  "submitted",
  "settled",
  "returned",
  "unknown",
]);
const DECISIONS = new Set(["approved", "declined", "withdrawn"]);
const CARD_SENSITIVE_FIELDS = new Set(["pan", "cvv", "cvc", "pin"]);

function ambiguous(result, errorCode) {
  return {
    ...result,
    outcome: "ambiguous",
    error_code: errorCode,
  };
}

function sanitizedCardResult(result) {
  if (!result?.result || typeof result.result !== "object") return result;
  return {
    ...result,
    result: Object.fromEntries(
      Object.entries(result.result).filter(
        ([field]) => !CARD_SENSITIVE_FIELDS.has(field.toLowerCase()),
      ),
    ),
  };
}

function receivingInstrument(result) {
  return result?.result?.instrument ?? result?.result ?? null;
}

function enforceMoneyFinality(result, prefix) {
  if (result.outcome === "succeeded" && result.funds_state !== "settled") {
    return ambiguous(result, `${prefix}_success_requires_settled_funds`);
  }
  if (result.outcome === "failed" && result.funds_state === "settled") {
    return ambiguous(result, `${prefix}_failed_but_funds_settled`);
  }
  if (result.outcome === "pending" && result.funds_state === "settled") {
    return ambiguous(result, `${prefix}_pending_but_funds_settled`);
  }
  return result;
}

/** Return a normalized result. Contract violations are deliberately ambiguous:
 * the remote side may already have acted, so a malformed response is never
 * proof that resubmission or customer refund is safe. */
export function enforceProviderResultContract(claimed, input) {
  let result = input;
  if (!result || typeof result !== "object") {
    return {
      outcome: "ambiguous",
      provider_reference: claimed.provider_reference ?? null,
      provider_state: null,
      funds_state: null,
      retry_after_ms: null,
      error_code: "provider_result_missing",
      result: null,
      status_code: null,
      transport: null,
    };
  }

  if (
    result.funds_state !== null &&
    result.funds_state !== undefined &&
    !FUNDS_STATES.has(result.funds_state)
  ) {
    return ambiguous(result, "provider_funds_state_invalid");
  }

  if (claimed.capability === "payments.transfer") {
    result = enforceMoneyFinality(result, "transfer");
  }

  if (claimed.capability === "custody.transfer") {
    result = enforceMoneyFinality(result, "custody_transfer");
  }

  if (claimed.capability === "identity.verification") {
    if (
      result.outcome === "succeeded" &&
      !DECISIONS.has(result.result?.decision)
    ) {
      return ambiguous(result, "identity_success_requires_decision");
    }
  }

  if (claimed.capability === "accounts.receiving_details") {
    if (result.outcome === "succeeded") {
      const instrument = receivingInstrument(result);
      const hasIdentifier =
        instrument &&
        ["iban", "account_number", "proxy", "address"].some(
          (field) =>
            typeof instrument[field] === "string" && instrument[field].length > 0,
        );
      if (!hasIdentifier) {
        return ambiguous(
          result,
          "receiving_details_success_requires_instrument",
        );
      }
    }
  }

  if (claimed.capability === "cards.issuing") {
    result = sanitizedCardResult(result);
    if (result.outcome === "succeeded") {
      const card = result.result ?? {};
      const hasReference =
        !!result.provider_reference ||
        (typeof card.processor_token === "string" && card.processor_token) ||
        (typeof card.last4 === "string" && /^\d{4}$/.test(card.last4));
      if (!hasReference) {
        return ambiguous(result, "card_success_requires_reference");
      }
    }
  }

  if (claimed.capability === "custody.wallet" && result.outcome === "succeeded") {
    const wallet = result.result ?? {};
    if (typeof wallet.address !== "string" || wallet.address.trim().length < 8) {
      return ambiguous(result, "custody_wallet_success_requires_address");
    }
  }

  return result;
}

export const PROVIDER_FUNDS_STATES = Object.freeze([...FUNDS_STATES]);
