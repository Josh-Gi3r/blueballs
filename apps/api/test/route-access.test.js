import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { FAMILIES } from "../../../src/endpoints.ts";
import { createApiFixture } from "./helpers/api-process.js";

test("all 181 catalogue operations have an explicit access class", async () => {
  const rows = FAMILIES.flatMap((family) => family.endpoints);
  assert.equal(rows.length, 181);
  const allowed = new Set(["PUBLIC", "TENANT", "OPERATOR", "GLOBAL_READ"]);
  for (const { verb: method, path, access } of rows) {
    assert.ok(
      allowed.has(access),
      `${method} ${path} has invalid access ${access}`,
    );
  }
  assert.equal(
    rows.some((row) => "auth" in row),
    false,
  );
});

test("operator state never accepts a self-serve key", async (t) => {
  const operatorKey = "operator-test-secret";
  const operatorHash = createHash("sha256").update(operatorKey).digest("hex");
  const api = await createApiFixture({
    env: { OPERATOR_API_KEY_HASH: operatorHash },
  });
  t.after(() => api.close());
  const sandbox = await api.signup("operator-boundary@example.test");

  assert.equal(
    (
      await api.request("PUT", "/v2/fx/appetite", {
        key: sandbox.key,
        body: { pair: "USDC/EURC", max_notional: "1000.00" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api.request("PUT", "/v2/fx/appetite", {
        key: operatorKey,
        body: { pair: "USDC/EURC", max_notional: "1000.00" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await api.request("GET", "/v2/fx/appetite", { key: sandbox.key })).status,
    200,
  );
  assert.equal((await api.request("GET", "/v2/fx/appetite")).status, 401);
  assert.equal((await api.request("GET", "/v2/rates")).status, 200);
});
