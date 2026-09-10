import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

const OPERATOR_KEY = "bb_operator_fx_catalogue_success_key_123456";

async function ok(api, method, path, options = {}) {
  const response = await api.request(method, path, options);
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${method} ${path} expected 2xx, got ${response.status}: ${JSON.stringify(response.body)}\n${api.output}`,
  );
  return response.body;
}

async function account(api, key, customer, currency, amount = null) {
  const created = await ok(api, "POST", "/v2/accounts", {
    key,
    body: { customer: customer.id, currency },
  });
  if (amount) {
    await ok(api, "POST", `/v2/accounts/${created.id}/credit`, {
      key,
      body: { amount },
    });
  }
  return created;
}

test("all 26 compatibility FX catalogue operations have explicit successful lifecycle coverage", async (t) => {
  const api = await createApiFixture({
    env: {
      OPERATOR_API_KEY_HASH: createHash("sha256")
        .update(OPERATOR_KEY)
        .digest("hex"),
    },
  });
  t.after(() => api.close());

  const tenant = await api.signup("fx-catalogue@example.test");
  const business = await ok(api, "POST", "/v2/customers", {
    key: tenant.key,
    body: {
      type: "business",
      name: "FX Catalogue Institution",
      email: "treasury@example.test",
    },
  });
  await ok(api, "POST", `/v2/customers/${business.id}/verify`, {
    key: tenant.key,
    body: { decision: "approved" },
  });

  // Fiat accounts exercise 1:1 mint/redeem ramps. Stablecoin-denominated
  // accounts exercise the actual compatibility market settlement contract.
  const usd = await account(api, tenant.key, business, "USD", "5000.00");
  const eur = await account(api, tenant.key, business, "EUR", "5000.00");
  const usdc = await account(api, tenant.key, business, "USDC", "5000.00");
  const eurc = await account(api, tenant.key, business, "EURC", "5000.00");

  /* Public asset/corridor model --------------------------------------- */
  const assets = await ok(api, "GET", "/v2/assets");
  assert.ok(assets.data.some((asset) => asset.code === "USDC"));
  assert.ok(assets.data.some((asset) => asset.code === "EURC"));
  const corridors = await ok(api, "GET", "/v2/corridors");
  assert.ok(corridors.data.some((corridor) => corridor.pair === "USDC/EURC"));

  /* Compatibility quote/route ---------------------------------------- */
  const quote = await ok(api, "POST", "/v2/fx/quote", {
    key: tenant.key,
    body: { from: "USDC", to: "EURC", amount: "250.00" },
  });
  assert.equal(quote.leg, "fx");
  assert.equal(quote.amount.currency, "USDC");
  assert.equal(quote.receives.currency, "EURC");

  const route = await ok(api, "POST", "/v2/fx/route", {
    key: tenant.key,
    body: { from: "USD", to: "EUR", amount: "1000.00" },
  });
  assert.equal(route.legs.length, 3);
  assert.equal(route.legs[0].kind, "on_ramp");
  assert.equal(route.legs[1].kind, "fx");
  assert.equal(route.legs[2].kind, "off_ramp");

  /* Fiat ↔ stable ramps ----------------------------------------------- */
  const rampOn = await ok(api, "POST", "/v2/ramps/on", {
    key: tenant.key,
    body: { account: usd.id, amount: "500.00", to: "USDC" },
  });
  assert.equal(rampOn.status, "settled");
  const rampOff = await ok(api, "POST", "/v2/ramps/off", {
    key: tenant.key,
    body: { account: usd.id, amount: "100.00", from: "USDC" },
  });
  assert.equal(rampOff.status, "settled");
  const rampHistory = await ok(api, "GET", "/v2/ramps?limit=10", {
    key: tenant.key,
  });
  assert.ok(rampHistory.data.length >= 2);

  // Also prove the EUR side's 1:1 asset relationship independently.
  await ok(api, "POST", "/v2/ramps/on", {
    key: tenant.key,
    body: { account: eur.id, amount: "100.00", to: "EURC" },
  });

  /* Operator principal appetite -------------------------------------- */
  const appetiteBefore = await ok(api, "GET", "/v2/fx/appetite", {
    key: tenant.key,
  });
  assert.ok(appetiteBefore.data.length >= 1);
  const appetite = await ok(api, "PUT", "/v2/fx/appetite", {
    key: OPERATOR_KEY,
    body: {
      pair: "USDC/EURC",
      enabled: true,
      max_position: "1000000.00",
      markup_bps: 25,
    },
  });
  assert.equal(appetite.pair, "USDC/EURC");

  /* LP liquidity ------------------------------------------------------ */
  const lp = await ok(api, "POST", "/v2/fx/lp", {
    key: tenant.key,
    body: {
      account: eurc.id,
      currency: "EURC",
      amount: "1000.00",
      pair: "USDC/EURC",
      class: "bank",
    },
  });
  assert.equal(lp.status, "active");
  const positions = await ok(api, "GET", "/v2/fx/lp", {
    key: tenant.key,
  });
  assert.ok(positions.data.some((position) => position.id === lp.id));
  const pools = await ok(api, "GET", "/v2/fx/lp/pools");
  assert.ok(pools.data.some((pool) => pool.pair === "USDC/EURC"));

  /* Resting depth + cancellation ------------------------------------- */
  const maker = await ok(api, "POST", "/v2/fx/intents", {
    key: tenant.key,
    body: {
      account: usdc.id,
      receive_account: eurc.id,
      from: "USDC",
      to: "EURC",
      amount: "50.00",
      min_receive: "1.00",
      mode: "maker",
      ttl_seconds: 300,
    },
  });
  assert.equal(maker.resting, true);

  const depth = await ok(api, "GET", "/v2/fx/depth?pair=USDC/EURC");
  assert.ok(depth.data.some((row) => row.pair === "USDC/EURC"));
  const price = await ok(
    api,
    "GET",
    "/v2/fx/price?from=USDC&to=EURC&size=100.00",
  );
  assert.equal(price.pair, "USDC/EURC");
  await ok(api, "GET", "/v2/fx/pricing-model");

  const ownIntents = await ok(api, "GET", "/v2/fx/intents?limit=10", {
    key: tenant.key,
  });
  assert.ok(ownIntents.data.some((intent) => intent.id === maker.id));
  const cancelled = await ok(api, "POST", `/v2/fx/intents/${maker.id}/cancel`, {
    key: tenant.key,
  });
  assert.equal(cancelled.status, "cancelled");

  /* Taker consumes actual LP output liquidity ------------------------ */
  const taker = await ok(api, "POST", "/v2/fx/intents", {
    key: tenant.key,
    body: {
      account: usdc.id,
      receive_account: eurc.id,
      from: "USDC",
      to: "EURC",
      amount: "100.00",
      min_receive: "1.00",
      mode: "taker",
    },
  });
  assert.equal(taker.filled, true);
  assert.ok(taker.fill_legs.some((leg) => leg.source === "lp" && !leg.declined));

  const fillsAfterLp = await ok(api, "GET", "/v2/fx/fills?limit=20", {
    key: tenant.key,
  });
  assert.ok(fillsAfterLp.data.length >= 1);
  const earnings = await ok(api, "GET", "/v2/fx/lp/earnings?limit=20", {
    key: tenant.key,
  });
  assert.ok(Array.isArray(earnings.data));

  /* Firm RFQ ---------------------------------------------------------- */
  const rfq = await ok(api, "POST", "/v2/fx/rfq", {
    key: tenant.key,
    body: {
      account: usdc.id,
      receive_account: eurc.id,
      from: "USDC",
      to: "EURC",
      amount: "25.00",
    },
  });
  assert.equal(rfq.status, "open");
  const rfqList = await ok(api, "GET", "/v2/fx/rfq?limit=10", {
    key: tenant.key,
  });
  assert.ok(rfqList.data.some((row) => row.id === rfq.id));
  const accepted = await ok(api, "POST", `/v2/fx/rfq/${rfq.id}/accept`, {
    key: tenant.key,
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.filled, true);

  /* Netting / batch visibility --------------------------------------- */
  const batch = await ok(api, "POST", "/v2/fx/net", {
    key: OPERATOR_KEY,
  });
  assert.ok(Number(batch.fills) >= 1);
  const batches = await ok(api, "GET", "/v2/fx/batches?limit=10", {
    key: tenant.key,
  });
  assert.ok(batches.data.some((row) => row.id === batch.id));

  // The global-readable fill surface remains pseudonymous after netting.
  const fills = await ok(api, "GET", "/v2/fx/fills?limit=20", {
    key: tenant.key,
  });
  assert.ok(fills.data.every((fill) => fill.taker_customer === undefined));

  /* LP withdrawal ----------------------------------------------------- */
  const withdrawn = await ok(api, "POST", `/v2/fx/lp/${lp.id}/withdraw`, {
    key: tenant.key,
  });
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.returned.currency, "EURC");
});
