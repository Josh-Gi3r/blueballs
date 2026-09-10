import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("documented query parameters are validated and filtered responses keep one schema", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("query-contracts@example.test");

  const filteredRate = await api.request(
    "GET",
    "/v2/rates?from=USD&to=EUR",
  );
  assert.equal(filteredRate.status, 200);
  assert.equal(filteredRate.body.object, "list");
  assert.equal(filteredRate.body.data.length, 1);
  assert.equal(filteredRate.body.data[0].from, "USD");
  assert.equal(filteredRate.body.data[0].to, "EUR");

  const halfRateFilter = await api.request("GET", "/v2/rates?from=USD");
  assert.equal(halfRateFilter.status, 400);
  assert.equal(halfRateFilter.body.type, "validation-error");

  const missingFxPriceSide = await api.request(
    "GET",
    "/v2/fx/price?from=USDC",
  );
  assert.equal(missingFxPriceSide.status, 400);

  const price = await api.request(
    "GET",
    "/v2/fx/price?from=USDC&to=EURC&size=100.00",
  );
  assert.equal(price.status, 200);
  assert.equal(price.body.pair, "USDC/EURC");

  const unknown = await api.request("GET", "/v2/customers?banana=yes", {
    key: tenant.key,
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.errors[0].code, "unknown_parameter");

  const duplicate = await api.request(
    "GET",
    "/v2/customers?limit=1&limit=2",
    { key: tenant.key },
  );
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.errors[0].code, "duplicate_parameter");

  const invalidLimit = await api.request("GET", "/v2/customers?limit=101", {
    key: tenant.key,
  });
  assert.equal(invalidLimit.status, 400);

  const invalidDays = await api.request("GET", "/v2/rails/ach/calendar?days=91");
  assert.equal(invalidDays.status, 400);

  const calendar = await api.request("GET", "/v2/rails/ach/calendar?days=2");
  assert.equal(calendar.status, 200);
  assert.equal(calendar.body.data.length, 2);
});
