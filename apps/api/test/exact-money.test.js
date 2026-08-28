import assert from "node:assert/strict";
import test from "node:test";
import { convertMinor, rateString } from "../src/exact-rates.js";
import { createApiFixture } from "./helpers/api-process.js";

test("exact reference conversion rounds down without unsafe numbers", () => {
  assert.equal(rateString("EUR", "USD"), "1.083000");
  assert.equal(convertMinor(10_000n, "EUR", "USD", 4), 10_825n);
  assert.equal(
    convertMinor(900_719_925_474_099_300n, "EUR", "USD", 4),
    975_089_487_416_734_162n,
  );
  assert.equal(convertMinor(1n, "MYR", "GBP", 85), 0n);
});

test("HTTP quotes preserve exact decimal strings above Number.MAX_SAFE_INTEGER", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const tenant = await api.signup("exact-money@example.test");

  const quote = await api.request("POST", "/v2/quotes", {
    key: tenant.key,
    body: { from: "EUR", to: "USD", amount: "9007199254740993.00" },
  });
  assert.equal(quote.status, 201);
  assert.equal(quote.body.rate, "1.083000");
  assert.equal(quote.body.receives.amount, "9750894874167341.62");
  assert.match(quote.body.receives.amount, /^\d+\.\d{2}$/);
});
