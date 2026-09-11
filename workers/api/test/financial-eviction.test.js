import { env, evictDurableObject } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const INSTANCE = "blueballs-public-sandbox-v2";

async function request(method, path, { key, body } = {}) {
  const response = await exports.default.fetch(
    new Request(`https://worker.test${path}`, {
      method,
      headers: {
        ...(key ? { "x-api-key": key } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

async function signup(email) {
  const response = await request("POST", "/v2/auth/signup", {
    body: { email },
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function evictBank() {
  const stub = env.BANK_API.getByName(INSTANCE);
  await evictDurableObject(stub);
}

describe("banking financial state across Durable Object eviction", () => {
  it("preserves account, vault, transfer, card and wallet money exactly", async () => {
    const tenant = await signup("eviction-money@example.test");
    const customer = await request("POST", "/v2/customers", {
      key: tenant.key,
      body: { type: "individual", name: "Eviction Customer" },
    });
    expect(customer.status).toBe(201);
    await request("POST", `/v2/customers/${customer.body.id}/verify`, {
      key: tenant.key,
      body: {},
    });

    const eur = await request("POST", "/v2/accounts", {
      key: tenant.key,
      body: { customer: customer.body.id, currency: "EUR" },
    });
    expect(eur.status).toBe(201);
    await request("POST", `/v2/accounts/${eur.body.id}/credit`, {
      key: tenant.key,
      body: { amount: "100.00" },
    });

    const vault = await request("POST", "/v2/vaults", {
      key: tenant.key,
      body: { account: eur.body.id, name: "Eviction Vault" },
    });
    expect(vault.status).toBe(201);
    const deposited = await request(
      "POST",
      `/v2/vaults/${vault.body.id}/deposit`,
      { key: tenant.key, body: { amount: "30.00" } },
    );
    expect(deposited.status).toBe(200);
    expect(deposited.body.balance.amount).toBe("30.00");

    await evictBank();

    const afterVaultEviction = await request(
      "GET",
      `/v2/vaults/${vault.body.id}`,
      { key: tenant.key },
    );
    expect(afterVaultEviction.status).toBe(200);
    expect(afterVaultEviction.body.balance.amount).toBe("30.00");
    const afterVaultAccount = await request("GET", `/v2/accounts/${eur.body.id}`, {
      key: tenant.key,
    });
    expect(afterVaultAccount.body.balance.amount).toBe("70.00");

    const transfer = await request("POST", "/v2/transfers", {
      key: tenant.key,
      body: { from: eur.body.id, amount: "10.00", rail: "sepa_instant" },
    });
    expect(transfer.status).toBe(201);
    expect(transfer.body.status).toBe("settled");

    await evictBank();

    const persistedTransfer = await request(
      "GET",
      `/v2/transfers/${transfer.body.id}`,
      { key: tenant.key },
    );
    expect(persistedTransfer.status).toBe(200);
    expect(persistedTransfer.body.status).toBe("settled");
    const afterTransfer = await request("GET", `/v2/accounts/${eur.body.id}`, {
      key: tenant.key,
    });
    expect(afterTransfer.body.balance.amount).toBe("60.00");

    const usd = await request("POST", "/v2/accounts", {
      key: tenant.key,
      body: { customer: customer.body.id, currency: "USD" },
    });
    await request("POST", `/v2/accounts/${usd.body.id}/credit`, {
      key: tenant.key,
      body: { amount: "100.00" },
    });
    const card = await request("POST", "/v2/cards", {
      key: tenant.key,
      body: { customer: customer.body.id, account: usd.body.id, type: "virtual" },
    });
    expect(card.status).toBe(201);
    const authorisation = await request(
      "POST",
      `/v2/cards/${card.body.id}/authorisations`,
      {
        key: tenant.key,
        body: { amount: "12.34", merchant: { name: "Eviction Merchant" } },
      },
    );
    expect(authorisation.status).toBe(201);

    await evictBank();

    const persistedAuthorisation = await request(
      "GET",
      `/v2/authorisations/${authorisation.body.id}`,
      { key: tenant.key },
    );
    expect(persistedAuthorisation.status).toBe(200);
    expect(persistedAuthorisation.body.amount.amount).toBe("12.34");

    const wallet = await request("POST", "/v2/wallets", {
      key: tenant.key,
      body: { customer: customer.body.id, currency: "USD", network: "base" },
    });
    expect(wallet.status).toBe(201);
    await request("POST", `/v2/wallets/${wallet.body.id}/credit`, {
      key: tenant.key,
      body: { amount: "50.00", currency: "USD" },
    });
    const send = await request("POST", `/v2/wallets/${wallet.body.id}/send`, {
      key: tenant.key,
      body: {
        amount: "10.00",
        currency: "USD",
        to: "0x0000000000000000000000000000000000000001",
      },
    });
    expect(send.status).toBe(200);
    expect(send.body.status).toBe("sent");

    await evictBank();

    const persistedWallet = await request("GET", `/v2/wallets/${wallet.body.id}`, {
      key: tenant.key,
    });
    expect(persistedWallet.status).toBe(200);
    expect(persistedWallet.body.balance.amount).toBe("40.00");
  });
});
