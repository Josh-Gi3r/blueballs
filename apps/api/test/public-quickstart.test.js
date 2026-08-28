import assert from "node:assert/strict";
import test from "node:test";
import { runBankingQuickstart } from "../../../examples/banking-quickstart.mjs";
import { createApiFixture } from "./helpers/api-process.js";

test("the public banking quickstart executes against a clean API", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());
  const result = await runBankingQuickstart({
    baseUrl: api.baseUrl,
    email: "public-quickstart@example.test",
  });
  assert.match(result.tenant_id, /^ten_/);
  assert.match(result.customer, /^cus_/);
  assert.equal(result.settlement_status, "settled");
  assert.equal(result.balances.USD, "400.00");
  assert.notEqual(result.balances.EUR, "0.00");
  assert.ok(result.usd_ledger_entries >= 2);
});
