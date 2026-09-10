import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_custody_bootstrap_1234567890abcdef123456";
const OPERATOR_KEY = "bb_custody_operator_1234567890abcdef123456";
const PROVIDER_TOKEN = "custody-provider-test-token-123456";
const PAYLOAD_KEY =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function listenGateway(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/provider`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function bodyOf(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

async function waitFor(run, description, timeoutMs = 6_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await run();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function productionApi(t, gateway) {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "custody-ops@example.test",
      OPERATOR_API_KEY_HASH: sha256(OPERATOR_KEY),
      BANK_PROVIDER_GATEWAY_URL: gateway.url,
      BANK_PROVIDER_GATEWAY_TOKEN: PROVIDER_TOKEN,
      BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST: "true",
      BANK_PROVIDER_PAYLOAD_KEY: PAYLOAD_KEY,
      BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "custody-test-v1",
      BANK_PROVIDER_PUMP_MS: "100",
      BANK_PROVIDER_RETRY_DELAYS_MS: "0,100,100,100,100",
    },
  });
  t.after(() => api.close());
  return api;
}

test("production wallets use custody provisioning, idempotent inbound deposits and provider-backed sends", async (t) => {
  const seen = [];
  const gateway = await listenGateway(async (req, res) => {
    const envelope = await bodyOf(req);
    seen.push(envelope);
    assert.equal(req.headers.authorization, `Bearer ${PROVIDER_TOKEN}`);
    assert.equal(envelope.payload?.format, undefined, "provider sees decrypted payload only");

    if (envelope.capability === "custody.wallet") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          outcome: "succeeded",
          provider_reference: "custody-wallet-1",
          provider_state: "active",
          result: {
            address: "0x1111111111111111111111111111111111111111",
            network: "base",
          },
        }),
      );
      return;
    }
    if (envelope.capability === "custody.transfer") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          outcome: "succeeded",
          provider_reference: "custody-send-1",
          provider_state: "settled",
          funds_state: "settled",
        }),
      );
      return;
    }
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ outcome: "failed", error_code: "unsupported" }));
  });
  t.after(() => gateway.close());
  const api = await productionApi(t, gateway);

  const principal = await api.request("GET", "/v2/keys", { key: BOOTSTRAP_KEY });
  assert.equal(principal.status, 200);
  const tenantId = principal.body.current.tenant_id;

  const customer = await api.request("POST", "/v2/customers", {
    key: BOOTSTRAP_KEY,
    body: { type: "individual", name: "Custody Customer" },
  });
  assert.equal(customer.status, 201);

  const wallet = await api.request("POST", "/v2/wallets", {
    key: BOOTSTRAP_KEY,
    body: {
      customer: customer.body.id,
      currency: "USDC",
      network: "base",
    },
  });
  assert.equal(wallet.status, 201);
  assert.equal(wallet.body.address, null, "production never returns a generated sandbox address");
  assert.equal(wallet.body.status, "pending_provisioning");
  assert.equal(wallet.body.provider_status, "queued");

  const activeWallet = await waitFor(async () => {
    const response = await api.request("GET", `/v2/wallets/${wallet.body.id}`, {
      key: BOOTSTRAP_KEY,
    });
    return response.status === 200 && response.body.status === "active"
      ? response.body
      : null;
  }, "custody wallet provisioning");
  assert.equal(activeWallet.address, "0x1111111111111111111111111111111111111111");
  assert.equal(activeWallet.provider_reference, "custody-wallet-1");

  const depositBody = {
    event_id: "custody-deposit-000001",
    tenant_id: tenantId,
    type: "custody.wallet_deposit_settled",
    resource_id: wallet.body.id,
    amount: { amount: "100.00", currency: "USDC" },
    network: "base",
    provider_reference: "deposit-chain-tx-1",
    provider_state: "settled",
  };
  const deposit = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: depositBody,
  });
  assert.equal(deposit.status, 200);
  assert.equal(deposit.body.replayed, undefined);

  const replay = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: depositBody,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);

  const conflict = await api.request("POST", "/internal/provider/events", {
    key: OPERATOR_KEY,
    body: {
      ...depositBody,
      amount: { amount: "101.00", currency: "USDC" },
    },
  });
  assert.equal(conflict.status, 409);

  const funded = await api.request("GET", `/v2/wallets/${wallet.body.id}`, {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(funded.body.balance.amount, "100.00");

  const send = await api.request("POST", `/v2/wallets/${wallet.body.id}/send`, {
    key: BOOTSTRAP_KEY,
    body: {
      amount: "25.00",
      currency: "USDC",
      to: "0x2222222222222222222222222222222222222222",
    },
  });
  assert.equal(send.status, 200);
  assert.equal(send.body.status, "funds_reserved");
  assert.equal(send.body.provider_status, "queued");

  await waitFor(async () => {
    const events = await api.request("GET", "/v2/events?limit=100", {
      key: BOOTSTRAP_KEY,
    });
    return events.body.data.some(
      (event) =>
        event.type === "wallet.send_settled" &&
        event.data?.provider_operation_id === send.body.provider_operation_id,
    );
  }, "custody send settlement event");

  const afterSend = await api.request("GET", `/v2/wallets/${wallet.body.id}`, {
    key: BOOTSTRAP_KEY,
  });
  assert.equal(afterSend.body.balance.amount, "75.00");

  assert.deepEqual(
    new Set(seen.map((entry) => entry.capability)),
    new Set(["custody.wallet", "custody.transfer"]),
  );
});
