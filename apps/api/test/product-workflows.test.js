import assert from "node:assert/strict";
import test from "node:test";
import { convertMinor } from "../src/exact-rates.js";
import { fromMinor, toMinor } from "../src/lib.js";
import { createApiFixture } from "./helpers/api-process.js";

async function createCustomerAndAccount(api, key, currency = "USD") {
  const customer = await api.request("POST", "/v2/customers", {
    key,
    body: { type: "individual", name: "Product workflow customer" },
  });
  assert.equal(customer.status, 201);
  const verified = await api.request("POST", `/v2/customers/${customer.body.id}/verify`, {
    key,
    body: { decision: "approved" },
  });
  assert.equal(verified.status, 200);
  const account = await api.request("POST", "/v2/accounts", {
    key,
    body: { customer: customer.body.id, currency },
  });
  assert.equal(account.status, 201);
  return { customer: customer.body, account: account.body };
}

test("cards, policy controls, authorisation settlement and disputes form one usable sandbox journey", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("cards-product@example.test");
  const { customer, account } = await createCustomerAndAccount(api, tenant.key);

  const funded = await api.request("POST", `/v2/accounts/${account.id}/credit`, {
    key: tenant.key,
    body: { amount: "1000.00" },
  });
  assert.equal(funded.status, 200);

  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: { customer: customer.id, account: account.id, type: "virtual" },
  });
  assert.equal(card.status, 201);

  const policy = await api.request("POST", "/v2/policies", {
    key: tenant.key,
    body: { name: "Card controls", rules: [{ type: "max_amount", amount: "250.00", currency: "USD" }] },
  });
  assert.equal(policy.status, 201);
  const attached = await api.request("POST", `/v2/policies/${policy.body.id}/attach`, {
    key: tenant.key,
    body: { type: "card", id: card.body.id },
  });
  assert.equal(attached.status, 200);
  assert.deepEqual(attached.body.attached.map(({ type, id }) => ({ type, id })), [{ type: "card", id: card.body.id }]);

  const authorisation = await api.request("POST", `/v2/cards/${card.body.id}/authorisations`, {
    key: tenant.key,
    body: { amount: "42.50", merchant: { name: "Example merchant", mcc: "5812" } },
  });
  assert.equal(authorisation.status, 201);
  assert.equal(authorisation.body.status, "pending");
  const settled = await api.request("POST", `/v2/authorisations/${authorisation.body.id}/approve`, {
    key: tenant.key,
  });
  assert.equal(settled.status, 200);
  assert.equal(settled.body.status, "settled");

  const dispute = await api.request("POST", "/v2/disputes", {
    key: tenant.key,
    body: { authorisation: authorisation.body.id, reason_code: "R10" },
  });
  assert.equal(dispute.status, 201);
  assert.equal(dispute.body.status, "open");
});

test("credit collateral math stays exact and each draw and repayment is a coherent four-leg operation", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("credit-product@example.test");
  const { account } = await createCustomerAndAccount(api, tenant.key);

  const collateral = "9007199254740993.00";
  const expectedAvailable = fromMinor((convertMinor(toMinor(collateral), "EUR", "USD") * 8_000n) / 10_000n);
  const credit = await api.request("POST", "/v2/credit", {
    key: tenant.key,
    body: {
      account: account.id,
      limit: "9999999999999999.00",
      collateral: { amount: collateral, currency: "EUR" },
      ltv_max: 0.8,
    },
  });
  assert.equal(credit.status, 201);
  assert.equal(credit.body.available.amount, expectedAvailable);

  const draw = await api.request("POST", `/v2/credit/${credit.body.id}/draw`, {
    key: tenant.key,
    body: { amount: "250.00" },
  });
  assert.equal(draw.status, 200);
  assert.equal(draw.body.drawn.amount, "250.00");

  const repay = await api.request("POST", `/v2/credit/${credit.body.id}/repay`, {
    key: tenant.key,
    body: { amount: "75.00" },
  });
  assert.equal(repay.status, 200);
  assert.equal(repay.body.drawn.amount, "175.00");
});

test("business wallet funding and approval chains require distinct configured approvers", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("business-product@example.test");
  const secondKey = await api.request("POST", "/v2/keys", { key: tenant.key, body: {} });
  assert.equal(secondKey.status, 201);
  const { customer } = await createCustomerAndAccount(api, tenant.key);

  const wallet = await api.request("POST", "/v2/wallets", {
    key: tenant.key,
    body: { customer: customer.id, currency: "USD", network: "base" },
  });
  assert.equal(wallet.status, 201);
  const funded = await api.request("POST", `/v2/wallets/${wallet.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "100.00" },
  });
  assert.equal(funded.status, 200);
  assert.equal(funded.body.balance.amount, "100.00");

  const chain = await api.request("POST", "/v2/approval-chains", {
    key: tenant.key,
    body: {
      name: "Two-person treasury approval",
      threshold: { amount: "10.00", currency: "USD" },
      approvers: [tenant.id, secondKey.body.id],
      steps: 2,
      resource: { type: "wallet", id: wallet.body.id },
    },
  });
  assert.equal(chain.status, 201);

  const send = await api.request("POST", `/v2/wallets/${wallet.body.id}/send`, {
    key: tenant.key,
    body: { amount: "25.00", currency: "USD", to: "0x0000000000000000000000000000000000000001" },
  });
  assert.equal(send.status, 200);
  assert.equal(send.body.status, "pending_approval");

  const first = await api.request("POST", `/v2/approvals/${send.body.approval}/approve`, {
    key: tenant.key,
    body: { comment: "Treasury reviewed" },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, "pending");
  const duplicate = await api.request("POST", `/v2/approvals/${send.body.approval}/approve`, {
    key: tenant.key,
    body: {},
  });
  assert.equal(duplicate.status, 409);

  const second = await api.request("POST", `/v2/approvals/${send.body.approval}/approve`, {
    key: secondKey.body.key,
    body: { comment: "Finance approved" },
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.status, "executed");
  assert.equal(second.body.decisions.length, 2);

  const balance = await api.request("GET", `/v2/wallets/${wallet.body.id}`, { key: tenant.key });
  assert.equal(balance.status, 200);
  assert.equal(balance.body.balance.amount, "75.00");
});

test("money-moving banking endpoints reject zero and negative amounts", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("positive-money@example.test");
  const { customer, account } = await createCustomerAndAccount(api, tenant.key);

  for (const amount of ["0.00", "-1.00"]) {
    const funding = await api.request("POST", `/v2/accounts/${account.id}/credit`, {
      key: tenant.key,
      body: { amount },
    });
    assert.equal(funding.status, 400);
    assert.equal(funding.body.errors[0].code, "not_positive");

    const quote = await api.request("POST", "/v2/quotes", {
      key: tenant.key,
      body: { from: "USD", to: "EUR", amount },
    });
    assert.equal(quote.status, 400);
  }

  const card = await api.request("POST", "/v2/cards", {
    key: tenant.key,
    body: { customer: customer.id, account: account.id, type: "virtual" },
  });
  const authorisation = await api.request("POST", `/v2/cards/${card.body.id}/authorisations`, {
    key: tenant.key,
    body: { amount: "-10.00", merchant: { name: "Invalid merchant" } },
  });
  assert.equal(authorisation.status, 400);

  const wallet = await api.request("POST", "/v2/wallets", {
    key: tenant.key,
    body: { customer: customer.id, currency: "USD" },
  });
  const walletCredit = await api.request("POST", `/v2/wallets/${wallet.body.id}/credit`, {
    key: tenant.key,
    body: { amount: "-10.00" },
  });
  assert.equal(walletCredit.status, 400);

  const credit = await api.request("POST", "/v2/credit", {
    key: tenant.key,
    body: { account: account.id, limit: "100.00" },
  });
  const draw = await api.request("POST", `/v2/credit/${credit.body.id}/draw`, {
    key: tenant.key,
    body: { amount: "-10.00" },
  });
  assert.equal(draw.status, 400);
});

test("onboarding progresses from application data to an approved completed decision", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("onboarding-product@example.test");

  const application = await api.request("POST", "/v2/applications", {
    key: tenant.key,
    body: { type: "business", client_reference_id: "onboarding-demo" },
  });
  assert.equal(application.status, 201);
  const business = await api.request("PATCH", `/v2/applications/${application.body.id}/business`, {
    key: tenant.key,
    body: { legal_name: "Example Treasury Ltd", country: "GB" },
  });
  assert.equal(business.status, 200);
  const controller = await api.request("POST", `/v2/applications/${application.body.id}/individuals`, {
    key: tenant.key,
    body: { name: "Example Controller", role: "beneficial_owner", ownership_percent: 100 },
  });
  assert.equal(controller.status, 201);
  const document = await api.request("POST", `/v2/applications/${application.body.id}/documents`, {
    key: tenant.key,
    body: { type: "incorporation_certificate", content: Buffer.from("sandbox document").toString("base64") },
  });
  assert.equal(document.status, 201);
  const submitted = await api.request("POST", `/v2/applications/${application.body.id}/submit`, {
    key: tenant.key,
    body: {},
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.status, "submitted");
  const attestation = await api.request("POST", `/v2/applications/${application.body.id}/attestation`, {
    key: tenant.key,
    body: { statement: "Information is complete", agreed: true },
  });
  assert.equal(attestation.status, 200);
  const decision = await api.request("POST", `/v2/applications/${application.body.id}/edd`, {
    key: tenant.key,
    body: { source_of_funds: "operating revenue", decision: "approved" },
  });
  assert.equal(decision.status, 200);
  assert.equal(decision.body.status, "completed");
  assert.equal(decision.body.decision, "approved");
});

test("recipient transfer, savings vault and statement share one balanced account ledger", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("money-products@example.test");
  const { account } = await createCustomerAndAccount(api, tenant.key);
  assert.equal((await api.request("POST", `/v2/accounts/${account.id}/credit`, {
    key: tenant.key,
    body: { amount: "1000.00" },
  })).status, 200);

  const recipient = await api.request("POST", "/v2/recipients", {
    key: tenant.key,
    body: { name: "Example Supplier" },
  });
  const destination = await api.request("POST", `/v2/recipients/${recipient.body.id}/destinations`, {
    key: tenant.key,
    body: { rail: "ach", name: "Example Supplier", currency: "USD", account_number: "000123456789" },
  });
  const transfer = await api.request("POST", "/v2/transfers", {
    key: tenant.key,
    body: {
      from: account.id,
      recipient: recipient.body.id,
      destination: destination.body.id,
      rail: "ach",
      amount: "125.00",
    },
  });
  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.recipient, recipient.body.id);
  assert.equal(transfer.body.destination, destination.body.id);

  const vault = await api.request("POST", "/v2/vaults", {
    key: tenant.key,
    body: { account: account.id, name: "Operating reserve" },
  });
  assert.equal(vault.status, 201);
  const deposited = await api.request("POST", `/v2/vaults/${vault.body.id}/deposit`, {
    key: tenant.key,
    body: { amount: "200.00" },
  });
  assert.equal(deposited.status, 200);
  assert.equal(deposited.body.balance.amount, "200.00");
  const withdrawn = await api.request("POST", `/v2/vaults/${vault.body.id}/withdraw`, {
    key: tenant.key,
    body: { amount: "50.00" },
  });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.balance.amount, "150.00");

  const statement = await api.request("POST", "/v2/statements", {
    key: tenant.key,
    body: { account: account.id, format: "json" },
  });
  assert.equal(statement.status, 201);
  assert.equal(statement.body.balanced, true);
  assert.equal(statement.body.closing_balance, "725.00");
  assert.ok(statement.body.line_items.length >= 6);
});

test("QR, payment link, mandate and subscription form a validated payment-artifact journey", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("payments-product@example.test");
  const { customer } = await createCustomerAndAccount(api, tenant.key);

  const qr = await api.request("POST", "/v2/qr/generate", {
    key: tenant.key,
    body: {
      merchant_name: "Example Store",
      merchant_city: "Singapore",
      country: "SG",
      currency: "SGD",
      amount: "19.95",
      reference: "ORDER-42",
    },
  });
  assert.equal(qr.status, 200);
  const decoded = await api.request("POST", "/v2/qr/decode", {
    key: tenant.key,
    body: { payload: qr.body.payload },
  });
  assert.equal(decoded.status, 200);
  assert.equal(decoded.body.valid, true);
  assert.equal(decoded.body.amount, "19.95");
  assert.equal(decoded.body.reference, "ORDER-42");

  const link = await api.request("POST", "/v2/links", {
    key: tenant.key,
    body: { currency: "USD", amount: "49.00", description: "Invoice 42" },
  });
  assert.equal(link.status, 201);
  assert.equal((await api.request("GET", `/v2/links/${link.body.id}`, { key: tenant.key })).status, 200);

  const mandate = await api.request("POST", "/v2/mandates", {
    key: tenant.key,
    body: { customer: customer.id, currency: "USD", max_amount: "100.00", reference: "PLAN-42" },
  });
  assert.equal(mandate.status, 201);
  const subscription = await api.request("POST", "/v2/subscriptions", {
    key: tenant.key,
    body: {
      customer: customer.id,
      mandate: mandate.body.id,
      amount: "25.00",
      currency: "USD",
      interval: "month",
      interval_count: 1,
    },
  });
  assert.equal(subscription.status, 201);
  assert.equal(subscription.body.status, "active");
  assert.equal(subscription.body.amount.amount, "25.00");

  const aboveMandate = await api.request("POST", "/v2/subscriptions", {
    key: tenant.key,
    body: {
      customer: customer.id,
      mandate: mandate.body.id,
      amount: "125.00",
      currency: "USD",
      interval: "month",
    },
  });
  assert.equal(aboveMandate.status, 400);
});
