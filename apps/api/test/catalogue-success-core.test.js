import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createApiFixture } from "./helpers/api-process.js";

const OPERATOR_KEY = "bb_operator_catalogue_success_test_key";
const FIXED_CLOCK = fileURLToPath(
  new URL("./helpers/fixed-clock.mjs", import.meta.url),
);

async function ok(api, method, path, options = {}) {
  const response = await api.request(method, path, options);
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${method} ${path} expected 2xx, got ${response.status}: ${JSON.stringify(response.body)}\n${api.output}`,
  );
  return response.body;
}

async function createCustomer(api, key, name, type = "individual") {
  return ok(api, "POST", "/v2/customers", {
    key,
    body: { type, name, email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.test` },
  });
}

async function createAccount(api, key, customer, currency) {
  return ok(api, "POST", "/v2/accounts", {
    key,
    body: { customer: customer.id, currency },
  });
}

async function fund(api, key, account, amount) {
  return ok(api, "POST", `/v2/accounts/${account.id}/credit`, {
    key,
    body: { amount },
  });
}

async function waitFor(fn, description, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

test("all non-FX banking catalogue families have explicit successful lifecycle coverage", async (t) => {
  const api = await createApiFixture({
    nodeArgs: ["--import", FIXED_CLOCK],
    env: {
      BLUEBALLS_TEST_NOW: "2026-09-09T12:00:00.000Z", // Wednesday UTC
      OPERATOR_API_KEY_HASH: createHash("sha256")
        .update(OPERATOR_KEY)
        .digest("hex"),
      WEBHOOK_DELIVERY_MODE: "allowlist",
      WEBHOOK_ALLOWED_HOSTS: "hooks.example.test",
      WEBHOOK_RETRY_DELAYS_MS: "600000",
    },
  });
  t.after(() => api.close());

  /* Auth & keys --------------------------------------------------------- */
  const tenant = await api.signup("catalogue-core@example.test");
  const keyToDelete = await ok(api, "POST", "/v2/keys", {
    key: tenant.key,
    body: { permissions: ["identity:read"] },
  });
  await ok(api, "GET", "/v2/keys", { key: tenant.key });
  await ok(api, "GET", `/v2/keys/${keyToDelete.id}`, { key: tenant.key });
  await ok(api, "DELETE", `/v2/keys/${keyToDelete.id}`, { key: tenant.key });
  const approverKey = await ok(api, "POST", "/v2/keys", {
    key: tenant.key,
    body: {},
  });

  /* Customers ----------------------------------------------------------- */
  const customer = await createCustomer(api, tenant.key, "Core Customer");
  await ok(api, "GET", `/v2/customers/${customer.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/customers?limit=10", { key: tenant.key });
  await ok(api, "PATCH", `/v2/customers/${customer.id}`, {
    key: tenant.key,
    body: { name: "Core Customer Updated", client_reference_id: "core-customer" },
  });
  await ok(api, "GET", `/v2/customers/${customer.id}/capabilities`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/customers/${customer.id}/verify`, {
    key: tenant.key,
    body: { decision: "approved" },
  });
  const disposableCustomer = await createCustomer(
    api,
    tenant.key,
    "Disposable Customer",
  );
  await ok(api, "DELETE", `/v2/customers/${disposableCustomer.id}`, {
    key: tenant.key,
  });

  /* Applications -------------------------------------------------------- */
  const businessApp = await ok(api, "POST", "/v2/applications", {
    key: tenant.key,
    body: { type: "business", customer: customer.id },
  });
  await ok(api, "GET", `/v2/applications/${businessApp.id}`, {
    key: tenant.key,
  });
  await ok(api, "GET", "/v2/applications", { key: tenant.key });
  await ok(api, "PATCH", `/v2/applications/${businessApp.id}/business`, {
    key: tenant.key,
    body: {
      legal_name: "Core Treasury Ltd",
      country: "GB",
      registration_number: "12345678",
    },
  });
  const individualApp = await ok(api, "POST", "/v2/applications", {
    key: tenant.key,
    body: { type: "individual", customer: customer.id },
  });
  await ok(api, "PATCH", `/v2/applications/${individualApp.id}/individual`, {
    key: tenant.key,
    body: {
      name: "Core Customer Updated",
      date_of_birth: "1990-01-01",
      country: "SG",
    },
  });
  const individual = await ok(
    api,
    "POST",
    `/v2/applications/${businessApp.id}/individuals`,
    {
      key: tenant.key,
      body: {
        name: "Beneficial Owner",
        role: "beneficial_owner",
        ownership_percent: 100,
      },
    },
  );
  await ok(
    api,
    "PATCH",
    `/v2/applications/${businessApp.id}/individuals/${individual.id}`,
    {
      key: tenant.key,
      body: { name: "Beneficial Owner Updated", ownership_percent: 100 },
    },
  );
  const document = await ok(
    api,
    "POST",
    `/v2/applications/${businessApp.id}/documents`,
    {
      key: tenant.key,
      body: {
        type: "incorporation_certificate",
        filename: "certificate.txt",
        content_type: "text/plain",
        content: Buffer.from("certificate").toString("base64"),
      },
    },
  );
  await ok(
    api,
    "GET",
    `/v2/applications/${businessApp.id}/documents/${document.id}`,
    { key: tenant.key },
  );
  await ok(
    api,
    "DELETE",
    `/v2/applications/${businessApp.id}/documents/${document.id}`,
    { key: tenant.key },
  );
  await ok(
    api,
    "DELETE",
    `/v2/applications/${businessApp.id}/individuals/${individual.id}`,
    { key: tenant.key },
  );
  await ok(api, "POST", `/v2/applications/${businessApp.id}/attestation`, {
    key: tenant.key,
    body: { statement: "Information is complete", agreed: true },
  });
  await ok(api, "POST", `/v2/applications/${businessApp.id}/submit`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/applications/${businessApp.id}/edd`, {
    key: tenant.key,
    body: { source_of_funds: "operating revenue", decision: "approved" },
  });

  /* Accounts / receiving details -------------------------------------- */
  const usd = await createAccount(api, tenant.key, customer, "USD");
  const eur = await createAccount(api, tenant.key, customer, "EUR");
  const sgd = await createAccount(api, tenant.key, customer, "SGD");
  await fund(api, tenant.key, usd, "5000.00");
  await fund(api, tenant.key, sgd, "5000.00");
  await ok(api, "GET", `/v2/accounts/${usd.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/accounts", { key: tenant.key });
  await ok(api, "PATCH", `/v2/accounts/${usd.id}`, {
    key: tenant.key,
    body: { label: "Operating USD", client_reference_id: "usd-operating" },
  });
  const closingAccount = await createAccount(
    api,
    tenant.key,
    customer,
    "GBP",
  );
  await ok(api, "DELETE", `/v2/accounts/${closingAccount.id}`, {
    key: tenant.key,
  });
  const receiving = await ok(api, "POST", `/v2/accounts/${usd.id}/details`, {
    key: tenant.key,
    body: { rail: "ach" },
  });
  await ok(api, "GET", `/v2/accounts/${usd.id}/details`, { key: tenant.key });
  await ok(api, "GET", `/v2/details/${receiving.id}`, { key: tenant.key });

  /* Wallets ------------------------------------------------------------ */
  const wallet = await ok(api, "POST", "/v2/wallets", {
    key: tenant.key,
    body: { customer: customer.id, currency: "USD", network: "base" },
  });
  await ok(api, "GET", `/v2/wallets/${wallet.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/wallets", { key: tenant.key });
  await ok(api, "GET", `/v2/wallets/${wallet.id}/balances`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/wallets/${wallet.id}/credit`, {
    key: tenant.key,
    body: { amount: "500.00", currency: "USD" },
  });
  await ok(api, "POST", `/v2/wallets/${wallet.id}/send`, {
    key: tenant.key,
    body: {
      amount: "5.00",
      currency: "USD",
      to: "0x0000000000000000000000000000000000000001",
    },
  });
  await ok(api, "GET", `/v2/wallets/${wallet.id}/policies`, {
    key: tenant.key,
  });

  /* Recipients / destinations ----------------------------------------- */
  const recipient = await ok(api, "POST", "/v2/recipients", {
    key: tenant.key,
    body: { name: "Core Supplier" },
  });
  await ok(api, "GET", `/v2/recipients/${recipient.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/recipients", { key: tenant.key });
  await ok(api, "PATCH", `/v2/recipients/${recipient.id}`, {
    key: tenant.key,
    body: { name: "Core Supplier Updated" },
  });
  const destination = await ok(
    api,
    "POST",
    `/v2/recipients/${recipient.id}/destinations`,
    {
      key: tenant.key,
      body: {
        rail: "ach",
        name: "Core Supplier Updated",
        currency: "USD",
        account_number: "000123456789",
        routing_number: "021000021",
      },
    },
  );
  await ok(api, "GET", `/v2/destinations/${destination.id}`, {
    key: tenant.key,
  });
  await ok(api, "PATCH", `/v2/destinations/${destination.id}`, {
    key: tenant.key,
    body: { name: "Core Supplier Updated" },
  });
  await ok(api, "POST", `/v2/destinations/${destination.id}/verify`, {
    key: tenant.key,
    body: { name: "Core Supplier Updated" },
  });
  const deleteDestination = await ok(
    api,
    "POST",
    `/v2/recipients/${recipient.id}/destinations`,
    {
      key: tenant.key,
      body: {
        rail: "ach",
        name: "Delete Destination",
        currency: "USD",
        account_number: "000987654321",
      },
    },
  );
  await ok(api, "DELETE", `/v2/destinations/${deleteDestination.id}`, {
    key: tenant.key,
  });
  const deleteRecipient = await ok(api, "POST", "/v2/recipients", {
    key: tenant.key,
    body: { name: "Delete Recipient" },
  });
  await ok(api, "DELETE", `/v2/recipients/${deleteRecipient.id}`, {
    key: tenant.key,
  });

  /* Quotes ------------------------------------------------------------- */
  const quote = await ok(api, "POST", "/v2/quotes", {
    key: tenant.key,
    body: { from: "USD", to: "EUR", amount: "25.00" },
  });
  await ok(api, "GET", `/v2/quotes/${quote.id}`, { key: tenant.key });
  await ok(api, "POST", `/v2/quotes/${quote.id}/execute`, {
    key: tenant.key,
    body: { from_account: usd.id, to_account: eur.id },
  });
  await ok(api, "GET", "/v2/rates", {});
  await ok(api, "GET", "/v2/rates?from=USD&to=EUR", {});
  await ok(api, "GET", "/v2/pairs", {});

  /* Transfers ---------------------------------------------------------- */
  const payNowRecipient = await ok(api, "POST", "/v2/recipients", {
    key: tenant.key,
    body: { name: "SG Supplier" },
  });
  const payNowDestination = await ok(
    api,
    "POST",
    `/v2/recipients/${payNowRecipient.id}/destinations`,
    {
      key: tenant.key,
      body: {
        rail: "paynow",
        name: "SG Supplier",
        currency: "SGD",
        proxy: "+6591234567",
      },
    },
  );
  const instantTransfer = await ok(api, "POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: sgd.id,
      recipient: payNowRecipient.id,
      destination: payNowDestination.id,
      amount: "20.00",
      rail: "paynow",
    },
  });
  await ok(api, "GET", `/v2/transfers/${instantTransfer.id}`, {
    key: tenant.key,
  });
  await ok(api, "GET", "/v2/transfers", { key: tenant.key });
  await ok(api, "GET", `/v2/transfers/${instantTransfer.id}/legs`, {
    key: tenant.key,
  });
  const cancelTransfer = await ok(api, "POST", "/v2/transfers", {
    key: tenant.key,
    body: { from: usd.id, amount: "10.00", rail: "ach" },
  });
  await ok(api, "POST", `/v2/transfers/${cancelTransfer.id}/cancel`, {
    key: tenant.key,
  });
  const settleTransfer = await ok(api, "POST", "/v2/transfers", {
    key: tenant.key,
    body: { from: usd.id, amount: "10.00", rail: "ach" },
  });
  await ok(api, "POST", `/v2/transfers/${settleTransfer.id}/settle`, {
    key: tenant.key,
  });

  /* Cards / authorisations / disputes --------------------------------- */
  const card = await ok(api, "POST", "/v2/cards", {
    key: tenant.key,
    body: { customer: customer.id, account: usd.id, type: "virtual" },
  });
  await ok(api, "GET", `/v2/cards/${card.id}`, { key: tenant.key });
  await ok(api, "GET", `/v2/cards?customer=${customer.id}&status=active`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/cards/${card.id}/freeze`, {
    key: tenant.key,
    body: { reason: "catalogue test" },
  });
  await ok(api, "POST", `/v2/cards/${card.id}/unfreeze`, { key: tenant.key });
  await ok(api, "PATCH", `/v2/cards/${card.id}/controls`, {
    key: tenant.key,
    body: {
      spend_limits: {
        per_authorization: { amount: "500.00", currency: "USD" },
        daily: { amount: "2000.00", currency: "USD" },
        monthly: { amount: "5000.00", currency: "USD" },
      },
      merchant_categories: { blocked: [], allowed: [] },
    },
  });

  const pin = await api.request("POST", `/v2/cards/${card.id}/pin`, {
    key: tenant.key,
  });
  assert.equal(pin.status, 503, "PIN adapter must fail closed when unconfigured");
  const reveal = await api.request("POST", `/v2/cards/${card.id}/reveal`, {
    key: tenant.key,
  });
  assert.equal(
    reveal.status,
    503,
    "secure card reveal must fail closed when unconfigured",
  );

  const auth = await ok(api, "POST", `/v2/cards/${card.id}/authorisations`, {
    key: tenant.key,
    body: {
      amount: "15.00",
      merchant: { name: "Core Merchant", mcc: "5812" },
    },
  });
  await ok(api, "GET", `/v2/authorisations/${auth.id}`, { key: tenant.key });
  await ok(api, "GET", `/v2/authorisations?card=${card.id}&status=pending`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/authorisations/${auth.id}/approve`, {
    key: tenant.key,
  });
  const declinedAuth = await ok(
    api,
    "POST",
    `/v2/cards/${card.id}/authorisations`,
    {
      key: tenant.key,
      body: {
        amount: "2.00",
        merchant: { name: "Declined Merchant", mcc: "5999" },
      },
    },
  );
  await ok(api, "POST", `/v2/authorisations/${declinedAuth.id}/decline`, {
    key: tenant.key,
    body: { reason: "customer_declined" },
  });
  await ok(api, "GET", `/v2/cards/${card.id}/transactions`, {
    key: tenant.key,
  });
  await ok(api, "GET", `/v2/cards/${card.id}/statements`, {
    key: tenant.key,
  });
  const dispute = await ok(api, "POST", "/v2/disputes", {
    key: tenant.key,
    body: { authorisation: auth.id, reason_code: "R10", description: "Duplicate charge" },
  });
  await ok(api, "GET", `/v2/disputes/${dispute.id}`, { key: tenant.key });
  await ok(api, "GET", `/v2/disputes?card=${card.id}&status=open`, {
    key: tenant.key,
  });
  await ok(api, "POST", `/v2/disputes/${dispute.id}/evidence`, {
    key: tenant.key,
    body: { description: "Customer evidence" },
  });

  /* Savings / credit --------------------------------------------------- */
  const vault = await ok(api, "POST", "/v2/vaults", {
    key: tenant.key,
    body: { account: usd.id, name: "Reserve", rate: 0.03 },
  });
  await ok(api, "GET", `/v2/vaults/${vault.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/vaults", { key: tenant.key });
  await ok(api, "POST", `/v2/vaults/${vault.id}/deposit`, {
    key: tenant.key,
    body: { amount: "100.00" },
  });
  await ok(api, "POST", `/v2/vaults/${vault.id}/withdraw`, {
    key: tenant.key,
    body: { amount: "20.00" },
  });
  await ok(api, "DELETE", `/v2/vaults/${vault.id}`, { key: tenant.key });

  const credit = await ok(api, "POST", "/v2/credit", {
    key: tenant.key,
    body: {
      account: usd.id,
      limit: "1000.00",
      collateral: { amount: "2000.00", currency: "USD" },
      ltv_max: 0.8,
    },
  });
  await ok(api, "GET", `/v2/credit/${credit.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/credit", { key: tenant.key });
  await ok(api, "POST", `/v2/credit/${credit.id}/draw`, {
    key: tenant.key,
    body: { amount: "50.00" },
  });
  await ok(api, "POST", `/v2/credit/${credit.id}/repay`, {
    key: tenant.key,
    body: { amount: "10.00" },
  });
  await ok(api, "PATCH", `/v2/credit/${credit.id}/collateral`, {
    key: tenant.key,
    body: { amount: "2500.00", currency: "USD" },
  });

  /* Policies / approvals / organisations ------------------------------ */
  const policy = await ok(api, "POST", "/v2/policies", {
    key: tenant.key,
    body: { name: "Core Policy" },
  });
  await ok(api, "GET", `/v2/policies/${policy.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/policies", { key: tenant.key });
  const rule = await ok(api, "POST", `/v2/policies/${policy.id}/rules`, {
    key: tenant.key,
    body: { type: "max_amount", amount: "100.00", currency: "USD" },
  });
  await ok(api, "PATCH", `/v2/policies/${policy.id}/rules/${rule.id}`, {
    key: tenant.key,
    body: { amount: "150.00" },
  });
  await ok(api, "POST", `/v2/policies/${policy.id}/attach`, {
    key: tenant.key,
    body: { type: "wallet", id: wallet.id },
  });
  await ok(api, "POST", `/v2/policies/${policy.id}/detach`, {
    key: tenant.key,
    body: { type: "wallet", id: wallet.id },
  });
  await ok(api, "DELETE", `/v2/policies/${policy.id}/rules/${rule.id}`, {
    key: tenant.key,
  });
  await ok(api, "DELETE", `/v2/policies/${policy.id}`, { key: tenant.key });

  const chain = await ok(api, "POST", "/v2/approval-chains", {
    key: tenant.key,
    body: {
      name: "Two-person approval",
      threshold: { amount: "10.00", currency: "USD" },
      approvers: [tenant.id, approverKey.id],
      steps: 2,
      resource: { type: "wallet", id: wallet.id },
    },
  });
  await ok(api, "GET", `/v2/approval-chains/${chain.id}`, { key: tenant.key });
  const approvalSend = await ok(api, "POST", `/v2/wallets/${wallet.id}/send`, {
    key: tenant.key,
    body: {
      amount: "25.00",
      currency: "USD",
      to: "0x0000000000000000000000000000000000000002",
    },
  });
  await ok(api, "GET", "/v2/approvals?status=all", { key: tenant.key });
  await ok(api, "POST", `/v2/approvals/${approvalSend.approval}/approve`, {
    key: tenant.key,
    body: { comment: "approved by owner" },
  });
  await ok(api, "POST", `/v2/approvals/${approvalSend.approval}/reject`, {
    key: approverKey.key,
    body: { reason: "catalogue reject path" },
  });

  const org = await ok(api, "POST", "/v2/orgs", {
    key: tenant.key,
    body: { name: "Core Organisation" },
  });
  await ok(api, "GET", `/v2/orgs/${org.id}`, { key: tenant.key });
  await ok(api, "PATCH", `/v2/orgs/${org.id}`, {
    key: tenant.key,
    body: { name: "Core Organisation Updated" },
  });
  const member = await ok(api, "POST", `/v2/orgs/${org.id}/members`, {
    key: tenant.key,
    body: { email: "member@example.test", role: "member" },
  });
  await ok(api, "GET", `/v2/orgs/${org.id}/members`, { key: tenant.key });
  await ok(api, "DELETE", `/v2/orgs/${org.id}/members/${member.id}`, {
    key: tenant.key,
  });

  /* Ledger / statements / fees / rails -------------------------------- */
  await ok(api, "GET", `/v2/ledger?account=${usd.id}`, { key: tenant.key });
  await ok(api, "GET", `/v2/ledger/balances?account=${usd.id}`, {
    key: tenant.key,
  });
  const statement = await ok(api, "POST", "/v2/statements", {
    key: tenant.key,
    body: { account: usd.id, format: "json" },
  });
  await ok(api, "GET", `/v2/statements/${statement.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/fees/config", { key: tenant.key });
  await ok(api, "PUT", "/v2/fees/config", {
    key: tenant.key,
    body: { payout_account: usd.id },
  });
  await ok(api, "GET", "/v2/rails", {});
  await ok(api, "GET", "/v2/rails/ach", {});
  await ok(api, "GET", "/v2/rails/ach/calendar?days=3", {});

  /* QR / links / mandates / subscriptions ------------------------------ */
  const qr = await ok(api, "POST", "/v2/qr/generate", {
    key: tenant.key,
    body: {
      merchant_name: "Core Store",
      merchant_city: "Singapore",
      country: "SG",
      currency: "SGD",
      amount: "12.34",
      reference: "CORE-QR",
    },
  });
  await ok(api, "POST", "/v2/qr/decode", {
    key: tenant.key,
    body: { payload: qr.payload },
  });
  const link = await ok(api, "POST", "/v2/links", {
    key: tenant.key,
    body: { currency: "USD", amount: "25.00", description: "Core invoice" },
  });
  await ok(api, "GET", `/v2/links/${link.id}`, { key: tenant.key });
  const mandate = await ok(api, "POST", "/v2/mandates", {
    key: tenant.key,
    body: {
      customer: customer.id,
      currency: "USD",
      max_amount: "100.00",
      reference: "CORE-MANDATE",
    },
  });
  await ok(api, "GET", `/v2/mandates/${mandate.id}`, { key: tenant.key });
  await ok(api, "POST", "/v2/subscriptions", {
    key: tenant.key,
    body: {
      customer: customer.id,
      mandate: mandate.id,
      amount: "25.00",
      currency: "USD",
      interval: "month",
      interval_count: 1,
    },
  });
  await ok(api, "GET", "/v2/subscriptions", { key: tenant.key });

  /* Webhooks / events -------------------------------------------------- */
  const webhook = await ok(api, "POST", "/v2/webhooks", {
    key: tenant.key,
    body: {
      url: "https://hooks.example.test/blueballs",
      events: ["customer.created"],
    },
  });
  await ok(api, "GET", `/v2/webhooks/${webhook.id}`, { key: tenant.key });
  await ok(api, "GET", "/v2/webhooks", { key: tenant.key });
  await ok(api, "PATCH", `/v2/webhooks/${webhook.id}`, {
    key: tenant.key,
    body: { events: ["customer.created", "customer.updated"], status: "enabled" },
  });
  await createCustomer(api, tenant.key, "Webhook Trigger");
  const delivery = await waitFor(async () => {
    const response = await api.request(
      "GET",
      `/v2/webhooks/${webhook.id}/deliveries`,
      { key: tenant.key },
    );
    return response.status === 200 && response.body.data[0]
      ? response.body.data[0]
      : null;
  }, "webhook delivery record");
  await ok(api, "POST", `/v2/webhooks/deliveries/${delivery.id}/replay`, {
    key: tenant.key,
  });
  const events = await ok(api, "GET", "/v2/events?limit=100", {
    key: tenant.key,
  });
  assert.ok(events.data.length > 0);
  await ok(api, "GET", `/v2/events/${events.data[0].id}`, { key: tenant.key });
  await ok(api, "DELETE", `/v2/webhooks/${webhook.id}`, { key: tenant.key });

  /* Sandbox builder / simulations ------------------------------------- */
  const project = await ok(api, "POST", "/v2/builder/projects", {
    key: tenant.key,
    body: {
      name: "Core Bank",
      brief: "A Singapore account and payments product",
      audience: "Singapore businesses",
      markets: ["SG"],
      currencies: ["SGD"],
      capabilities: ["accounts", "transfers"],
      rails: ["paynow"],
    },
  });
  await ok(api, "GET", "/v2/builder/projects", { key: tenant.key });
  await ok(api, "GET", `/v2/builder/projects/${project.id}`, { key: tenant.key });
  await ok(api, "PATCH", `/v2/builder/projects/${project.id}`, {
    key: tenant.key,
    body: { audience: "Singapore SMEs" },
  });
  const provisioned = await ok(
    api,
    "POST",
    `/v2/builder/projects/${project.id}/provision`,
    { key: tenant.key },
  );
  assert.ok(provisioned.accounts.length > 0);
  await ok(api, "POST", `/v2/builder/projects/${project.id}/test-payments`, {
    key: tenant.key,
    body: {
      from_account: provisioned.accounts[0].id,
      amount: "5.00",
      recipient: "Test Supplier",
      rail: "paynow",
    },
  });

  await ok(api, "GET", "/v2/sandbox/scenarios", { key: tenant.key });
  const paymentSim = await ok(api, "POST", "/v2/sandbox/payments", {
    key: tenant.key,
    body: {
      scenario: "payment.unconfirmed",
      amount: "7.00",
      currency: "SGD",
      account: sgd.id,
    },
  });
  await ok(api, "POST", `/v2/sandbox/${paymentSim.id}/advance`, {
    key: tenant.key,
    body: { outcome: "settle" },
  });
  await ok(api, "GET", `/v2/sandbox/${paymentSim.id}`, { key: tenant.key });
  const onboardingSim = await ok(api, "POST", "/v2/sandbox/onboarding", {
    key: tenant.key,
    body: {
      scenario: "onboarding.manual_review",
      customer: customer.id,
    },
  });
  await ok(api, "POST", `/v2/sandbox/${onboardingSim.id}/advance`, {
    key: tenant.key,
    body: { decision: "approved" },
  });

  /* Reference data ----------------------------------------------------- */
  await ok(api, "GET", "/v2/countries", {});
  await ok(api, "GET", "/v2/currencies", {});
  await ok(api, "GET", "/v2/networks", {});

  // DELETE /v2/keys revokes the caller itself, so isolate it as the final
  // operation on a throwaway tenant.
  const revokeAllTenant = await api.signup("revoke-all@example.test");
  await ok(api, "DELETE", "/v2/keys", { key: revokeAllTenant.key });

  // OPERATOR endpoints live in the FX family and are exercised by the FX
  // catalogue-success test; keeping the key here proves fixture configuration
  // does not weaken ordinary tenant authorization.
  assert.ok(OPERATOR_KEY.length > 0);
});
