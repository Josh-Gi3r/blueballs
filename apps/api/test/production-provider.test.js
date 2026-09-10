import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_production_bootstrap_test_key_1234567890";
const GATEWAY_TOKEN = "provider-gateway-test-token-123456";
const PAYLOAD_KEY = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

async function listenGateway(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/provider`,
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

async function bodyOf(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

function gatewayResponse(envelope) {
  switch (envelope.capability) {
    case "accounts.receiving_details":
      return {
        outcome: "succeeded",
        provider_reference: "acct-provider-1",
        provider_state: "active",
        result: {
          instrument: {
            type: "paynow",
            proxy: "+6591112222",
          },
        },
      };
    case "cards.issuing":
      return {
        outcome: "succeeded",
        provider_reference: "card-provider-1",
        provider_state: "active",
        result: {
          last4: "4242",
          bin: "555500",
          expires: "12/29",
          processor_token: "card_tok_provider_1",
          status: "active",
          // A malicious/misconfigured provider returning PCI data must not make
          // it into Blueballs persistent card state.
          pan: "5555000000004242",
          cvv: "123",
        },
      };
    case "identity.verification":
      return {
        outcome: "succeeded",
        provider_reference: "kyc-provider-1",
        provider_state: "completed",
        result: { decision: "approved" },
      };
    case "payments.transfer":
      return {
        outcome: "succeeded",
        provider_reference: "payment-provider-1",
        provider_state: "settled",
        funds_state: "settled",
        result: { status: "settled" },
      };
    default:
      return {
        outcome: "failed",
        error_code: "unsupported_capability",
      };
  }
}

async function waitFor(fn, description, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function productionApi(t, gateway) {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "ops@example.test",
      BANK_PROVIDER_GATEWAY_URL: gateway.url,
      BANK_PROVIDER_GATEWAY_TOKEN: GATEWAY_TOKEN,
      BANK_PROVIDER_PAYLOAD_KEY: PAYLOAD_KEY,
      BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "test-v1",
      BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST: "true",
      BANK_PROVIDER_PUMP_MS: "100",
      BANK_PROVIDER_RETRY_DELAYS_MS: "0,100,100,100,100",
    },
  });
  t.after(() => api.close());
  return api;
}

test("production cards, receiving details, onboarding and transfers execute through the provider protocol", async (t) => {
  const seen = [];
  const gateway = await listenGateway(async (req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${GATEWAY_TOKEN}`);
    const envelope = await bodyOf(req);
    assert.equal(req.headers["x-idempotency-key"], envelope.job_id);
    assert.equal(envelope.phase, "submit");
    assert.ok(envelope.payload && typeof envelope.payload === "object");
    assert.equal(
      envelope.payload.format,
      undefined,
      "the provider gateway must receive decrypted payload data, not the durable ciphertext envelope",
    );
    seen.push(envelope);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(gatewayResponse(envelope)));
  });
  t.after(() => gateway.close());
  const api = await productionApi(t, gateway);

  // Production mode has no self-serve sandbox signup.
  const signup = await api.request("POST", "/v2/auth/signup", {
    body: { email: "should-not-work@example.test" },
  });
  assert.equal(signup.status, 403);

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "Production Customer" },
  });
  assert.equal(customer.status, 201);

  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "SGD" },
  });
  assert.equal(account.status, 201);
  assert.equal(account.body.details, null, "production must not invent bank details");

  const details = await api.request(
    "POST",
    `/v2/accounts/${account.body.id}/details`,
    {
      key: BOOTSTRAP_KEY,
      body: { rail: "paynow" },
    },
  );
  assert.equal(details.status, 201);
  assert.equal(details.body.status, "pending_provisioning");
  assert.equal(details.body.proxy, undefined);

  const issuedDetails = await waitFor(async () => {
    const response = await api.request("GET", `/v2/details/${details.body.id}`, {
      key: BOOTSTRAP_KEY,
    });
    return response.status === 200 && response.body.status === "active"
      ? response.body
      : null;
  }, "provider-backed receiving details");
  assert.equal(issuedDetails.proxy, "+6591112222");

  const card = await api.request("POST", "/v2/cards", {
    key: BOOTSTRAP_KEY,
    body: {
      customer: customer.body.id,
      account: account.body.id,
      type: "virtual",
    },
  });
  assert.equal(card.status, 201);
  assert.equal(card.body.status, "pending_issuance");
  assert.equal(card.body.last4, null, "production must not return sandbox card digits");
  assert.equal(card.body.bin, null);
  assert.equal(card.body.expires, null);

  const issuedCard = await waitFor(async () => {
    const response = await api.request("GET", `/v2/cards/${card.body.id}`, {
      key: BOOTSTRAP_KEY,
    });
    return response.status === 200 && response.body.status === "active"
      ? response.body
      : null;
  }, "provider-backed card issuance");
  assert.equal(issuedCard.last4, "4242");
  assert.equal(issuedCard.processor_token, "card_tok_provider_1");
  assert.equal(issuedCard.pan, undefined);
  assert.equal(issuedCard.cvv, undefined);

  const application = await api.request("POST", "/v2/applications", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", customer: customer.body.id },
  });
  assert.equal(application.status, 201);
  const individual = await api.request(
    "PATCH",
    `/v2/applications/${application.body.id}/individual`,
    {
      key: BOOTSTRAP_KEY,
      body: { name: "Production Customer", country: "SG" },
    },
  );
  assert.equal(individual.status, 200);
  const submitted = await api.request(
    "POST",
    `/v2/applications/${application.body.id}/submit`,
    { key: BOOTSTRAP_KEY },
  );
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.provider_status, "queued");

  const completed = await waitFor(async () => {
    const response = await api.request(
      "GET",
      `/v2/applications/${application.body.id}`,
      { key: BOOTSTRAP_KEY },
    );
    return response.status === 200 && response.body.status === "completed"
      ? response.body
      : null;
  }, "provider-backed onboarding decision");
  assert.equal(completed.decision, "approved");

  // A credit-line draw is a real balanced product flow and gives this account a
  // balance without using the sandbox-only direct funding endpoint.
  const credit = await api.request("POST", "/v2/credit", {
    key: BOOTSTRAP_KEY,
    body: { account: account.body.id, limit: "1000.00" },
  });
  assert.equal(credit.status, 201);
  const draw = await api.request("POST", `/v2/credit/${credit.body.id}/draw`, {
    key: BOOTSTRAP_KEY,
    body: { amount: "500.00" },
  });
  assert.equal(draw.status, 200);

  const recipient = await api.request("POST", "/v2/recipients", {
    key: BOOTSTRAP_KEY,
    body: { name: "Production Supplier" },
  });
  const destination = await api.request(
    "POST",
    `/v2/recipients/${recipient.body.id}/destinations`,
    {
      key: BOOTSTRAP_KEY,
      body: {
        rail: "paynow",
        name: "Production Supplier",
        currency: "SGD",
        proxy: "+6593334444",
      },
    },
  );
  const transfer = await api.request("POST", "/v2/transfers", {
    key: BOOTSTRAP_KEY,
    body: {
      from: account.body.id,
      recipient: recipient.body.id,
      destination: destination.body.id,
      rail: "paynow",
      amount: "125.00",
    },
  });
  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.status, "funds_received");
  assert.equal(transfer.body.provider_status, "queued");

  const settled = await waitFor(async () => {
    const response = await api.request("GET", `/v2/transfers/${transfer.body.id}`, {
      key: BOOTSTRAP_KEY,
    });
    return response.status === 200 && response.body.status === "settled"
      ? response.body
      : null;
  }, "provider-backed transfer settlement");
  assert.equal(settled.provider_reference, "payment-provider-1");
  assert.equal(settled.reconciliation_required, false);

  assert.deepEqual(
    new Set(seen.map((envelope) => envelope.capability)),
    new Set([
      "accounts.receiving_details",
      "cards.issuing",
      "identity.verification",
      "payments.transfer",
    ]),
  );
});

test("ambiguous transfer submission reconciles with the same provider idempotency key", async (t) => {
  const attempts = [];
  let first = true;
  const gateway = await listenGateway(async (req, res) => {
    const envelope = await bodyOf(req);
    attempts.push({
      jobId: req.headers["x-idempotency-key"],
      phase: envelope.phase,
    });
    if (envelope.capability !== "payments.transfer") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(gatewayResponse(envelope)));
      return;
    }
    if (first) {
      first = false;
      req.socket.destroy();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        outcome: "succeeded",
        provider_reference: "reconciled-payment-1",
        provider_state: "settled",
        funds_state: "settled",
      }),
    );
  });
  t.after(() => gateway.close());
  const api = await productionApi(t, gateway);

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "business", name: "Reconciliation Test Ltd" },
  });
  const account = await api.request("POST", "/v2/accounts", {
    key: BOOTSTRAP_KEY,
    body: { customer: customer.body.id, currency: "SGD" },
  });
  const credit = await api.request("POST", "/v2/credit", {
    key: BOOTSTRAP_KEY,
    body: { account: account.body.id, limit: "500.00" },
  });
  await api.request("POST", `/v2/credit/${credit.body.id}/draw`, {
    key: BOOTSTRAP_KEY,
    body: { amount: "250.00" },
  });

  const transfer = await api.request("POST", "/v2/transfers", {
    key: BOOTSTRAP_KEY,
    body: { from: account.body.id, rail: "paynow", amount: "50.00" },
  });
  assert.equal(transfer.status, 201);

  const reconciled = await waitFor(async () => {
    const response = await api.request("GET", `/v2/transfers/${transfer.body.id}`, {
      key: BOOTSTRAP_KEY,
    });
    return response.status === 200 && response.body.status === "settled"
      ? response.body
      : null;
  }, "ambiguous provider submission reconciliation", 8_000);
  assert.equal(reconciled.provider_reference, "reconciled-payment-1");

  const transferAttempts = attempts.filter(
    (entry) => entry.jobId === transfer.body.provider_operation_id,
  );
  assert.ok(transferAttempts.length >= 2);
  assert.equal(transferAttempts[0].phase, "submit");
  assert.equal(transferAttempts[1].phase, "reconcile");
  assert.ok(
    transferAttempts.every((entry) => entry.jobId === transferAttempts[0].jobId),
    "submission and reconciliation must use one stable provider idempotency key",
  );
});
