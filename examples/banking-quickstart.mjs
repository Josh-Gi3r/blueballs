#!/usr/bin/env node
/** A complete local banking journey using only the public HTTP contract. */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

async function call(baseUrl, method, path, { key, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(key ? { "x-api-key": key } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

export async function runBankingQuickstart({
  baseUrl = "http://127.0.0.1:5281",
  email = `builder-${Date.now()}@example.test`,
} = {}) {
  const principal = await call(baseUrl, "POST", "/v2/auth/signup", { body: { email } });
  const key = principal.key;
  const customer = await call(baseUrl, "POST", "/v2/customers", {
    key,
    body: { type: "business", name: "Example Treasury Ltd", client_reference_id: "quickstart-customer" },
  });
  const usd = await call(baseUrl, "POST", "/v2/accounts", {
    key, body: { customer: customer.id, currency: "USD", type: "holding" },
  });
  const eur = await call(baseUrl, "POST", "/v2/accounts", {
    key, body: { customer: customer.id, currency: "EUR", type: "holding" },
  });
  await call(baseUrl, "POST", `/v2/accounts/${usd.id}/credit`, { key, body: { amount: "500.00" } });
  const quote = await call(baseUrl, "POST", "/v2/quotes", {
    key, body: { from: "USD", to: "EUR", amount: "100.00" },
  });
  const executed = await call(baseUrl, "POST", `/v2/quotes/${quote.id}/execute`, {
    key, body: { from_account: usd.id, to_account: eur.id },
  });
  const [usdAfter, eurAfter, ledger] = await Promise.all([
    call(baseUrl, "GET", `/v2/accounts/${usd.id}`, { key }),
    call(baseUrl, "GET", `/v2/accounts/${eur.id}`, { key }),
    call(baseUrl, "GET", `/v2/ledger?account=${usd.id}`, { key }),
  ]);
  return {
    tenant_id: principal.tenant_id,
    customer: customer.id,
    accounts: { USD: usd.id, EUR: eur.id },
    quote: quote.id,
    settlement_status: executed.settlement_status,
    balances: { USD: usdAfter.balance.amount, EUR: eurAfter.balance.amount },
    usd_ledger_entries: ledger.data.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await runBankingQuickstart({ baseUrl: process.argv[2] });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
