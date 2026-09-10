import assert from "node:assert/strict";
import test from "node:test";
import { enforceProviderResultContract } from "../src/provider-result-contract.js";

const claimed = (capability) => ({
  capability,
  provider_reference: null,
});

test("a transfer cannot be called successful without settled funds", () => {
  const result = enforceProviderResultContract(claimed("payments.transfer"), {
    outcome: "succeeded",
    provider_reference: "pay_1",
    funds_state: "submitted",
  });
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.error_code, "transfer_success_requires_settled_funds");
});

test("a failed transfer with settled funds is reconciliation, not a refund signal", () => {
  const result = enforceProviderResultContract(claimed("payments.transfer"), {
    outcome: "failed",
    provider_reference: "pay_2",
    funds_state: "settled",
  });
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.error_code, "transfer_failed_but_funds_settled");
});

test("identity success requires a canonical decision", () => {
  const result = enforceProviderResultContract(claimed("identity.verification"), {
    outcome: "succeeded",
    provider_reference: "kyc_1",
    result: {},
  });
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.error_code, "identity_success_requires_decision");
});

test("receiving-detail success requires an actual instrument", () => {
  const result = enforceProviderResultContract(
    claimed("accounts.receiving_details"),
    {
      outcome: "succeeded",
      provider_reference: "account_1",
      result: {},
    },
  );
  assert.equal(result.outcome, "ambiguous");
  assert.equal(
    result.error_code,
    "receiving_details_success_requires_instrument",
  );
});

test("sensitive card authentication data is stripped at the provider boundary", () => {
  const result = enforceProviderResultContract(claimed("cards.issuing"), {
    outcome: "succeeded",
    provider_reference: "card_1",
    result: {
      last4: "4242",
      pan: "5555000000004242",
      cvv: "123",
      cvc: "456",
      pin: "9999",
      processor_token: "tok_1",
    },
  });
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.result.last4, "4242");
  assert.equal(result.result.processor_token, "tok_1");
  assert.equal(result.result.pan, undefined);
  assert.equal(result.result.cvv, undefined);
  assert.equal(result.result.cvc, undefined);
  assert.equal(result.result.pin, undefined);
});

test("unknown funds-state vocabulary is never trusted", () => {
  const result = enforceProviderResultContract(claimed("payments.transfer"), {
    outcome: "failed",
    funds_state: "probably_not_sent",
  });
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.error_code, "provider_funds_state_invalid");
});
