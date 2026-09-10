import assert from "node:assert/strict";
import test from "node:test";
import {
  configureProviderEnvironment,
  sendProviderOperation,
  setProviderTransport,
} from "../src/provider-transport.js";

const originalFetch = globalThis.fetch;
const envelope = {
  job_id: "prv_provider_http_finality",
  capability: "payments.transfer",
  action: "submit",
  phase: "submit",
  resource: { type: "transfer", id: "trf_provider_http_finality" },
  tenant_id: "ten_provider_http_finality",
  command_id: "cmd_provider_http_finality",
  provider_reference: null,
  attempt: 1,
  payload: { amount: { amount: "10.00", currency: "USD" } },
};

function configure() {
  setProviderTransport(null);
  configureProviderEnvironment({
    BANK_PROVIDER_GATEWAY_URL: "https://provider.example.test/blueballs",
    BANK_PROVIDER_GATEWAY_TOKEN: "0123456789abcdef0123456789abcdef",
    BANK_PROVIDER_TIMEOUT_MS: "1000",
  });
}

function reply(status, body, headers = {}) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  configureProviderEnvironment({});
  setProviderTransport(null);
});

test("a 500 response can never finalize a transfer even if the body claims succeeded", async () => {
  configure();
  reply(500, {
    outcome: "succeeded",
    funds_state: "settled",
    provider_reference: "provider_claimed_success",
  });

  const result = await sendProviderOperation(envelope);
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.status_code, 500);
  assert.equal(result.provider_reference, "provider_claimed_success");
});

test("a 4xx response claiming success is contradictory evidence and reconciles", async () => {
  configure();
  reply(409, {
    outcome: "succeeded",
    funds_state: "settled",
    provider_reference: "provider_conflict_reference",
  });

  const result = await sendProviderOperation(envelope);
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.error_code, "provider_http_outcome_conflict");
  assert.equal(result.status_code, 409);
});

test("a valid 2xx settled transfer may finalize", async () => {
  configure();
  reply(200, {
    outcome: "succeeded",
    funds_state: "settled",
    provider_reference: "provider_settled_reference",
  });

  const result = await sendProviderOperation(envelope);
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.funds_state, "settled");
  assert.equal(result.status_code, 200);
});

test("a clear 4xx pre-submission rejection remains a terminal failure", async () => {
  configure();
  reply(422, {
    outcome: "failed",
    funds_state: "rejected_before_submission",
    error_code: "beneficiary_invalid",
  });

  const result = await sendProviderOperation(envelope);
  assert.equal(result.outcome, "failed");
  assert.equal(result.funds_state, "rejected_before_submission");
  assert.equal(result.error_code, "beneficiary_invalid");
});

test("rate limiting is retryable regardless of a contradictory response body", async () => {
  configure();
  reply(
    429,
    { outcome: "succeeded", funds_state: "settled" },
    { "retry-after": "3" },
  );

  const result = await sendProviderOperation(envelope);
  assert.equal(result.outcome, "retry");
  assert.equal(result.retry_after_ms, 3000);
  assert.equal(result.status_code, 429);
});
