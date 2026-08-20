import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("all 174 catalogue operations have an explicit access class", async () => {
  const source = await readFile(new URL("../../../src/endpoints.ts", import.meta.url), "utf8");
  const rows = [...source.matchAll(/verb:\s*"([A-Z]+)"\s*,\s*path:\s*"([^"]+)"[^\n]+access:\s*"(\w+)"/g)];
  assert.equal(rows.length, 174);
  const allowed = new Set(["PUBLIC", "TENANT", "OPERATOR", "GLOBAL_READ"]);
  for (const [, method, path, access] of rows) {
    assert.ok(allowed.has(access), `${method} ${path} has invalid access ${access}`);
  }
  assert.equal(rows.some((row) => row[0].includes("auth:")), false);
});

test("operator state never accepts a self-serve key", async (t) => {
  const operatorKey = "operator-test-secret";
  const operatorHash = createHash("sha256").update(operatorKey).digest("hex");
  const api = await createApiFixture({ env: { OPERATOR_API_KEY_HASH: operatorHash } });
  t.after(() => api.close());
  const sandbox = await api.signup("operator-boundary@example.test");

  assert.equal((await api.request("PUT", "/v2/fx/appetite", {
    key: sandbox.key, body: { pair: "USDX/EURX", max_notional: "1000.00" },
  })).status, 403);
  assert.equal((await api.request("PUT", "/v2/fx/appetite", {
    key: operatorKey, body: { pair: "USDX/EURX", max_notional: "1000.00" },
  })).status, 200);
  assert.equal((await api.request("GET", "/v2/fx/appetite", { key: sandbox.key })).status, 200);
  assert.equal((await api.request("GET", "/v2/fx/appetite")).status, 401);
  assert.equal((await api.request("GET", "/v2/rates")).status, 200);
});
