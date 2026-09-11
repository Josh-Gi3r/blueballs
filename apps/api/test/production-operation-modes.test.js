import assert from "node:assert/strict";
import test from "node:test";
import { SANDBOX_ONLY_OPERATIONS } from "../../../spec/banking/operation-modes.mjs";
import { FAMILIES } from "../../../src/endpoints.ts";
import { createApiFixture } from "./helpers/api-process.js";

const BOOTSTRAP_KEY = "bb_mode_matrix_bootstrap_1234567890abcdef123456";
const BODY_METHODS = new Set(["POST", "PATCH", "PUT"]);

function concretePath(pattern) {
  return pattern.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "reference");
}

test("every sandbox-only catalogue operation is rejected before its handler in production", async (t) => {
  const api = await createApiFixture({
    env: {
      BANK_API_MODE: "production",
      BANK_BOOTSTRAP_API_KEY: BOOTSTRAP_KEY,
      BANK_BOOTSTRAP_EMAIL: "mode-matrix@example.test",
    },
  });
  t.after(() => api.close());

  const catalogue = new Set(
    FAMILIES.flatMap((family) =>
      family.endpoints.map((endpoint) => `${endpoint.verb} ${endpoint.path}`),
    ),
  );
  assert.ok(SANDBOX_ONLY_OPERATIONS.size > 0);

  for (const operation of [...SANDBOX_ONLY_OPERATIONS].sort()) {
    assert.ok(catalogue.has(operation), `${operation} is not in the public catalogue`);
    const space = operation.indexOf(" ");
    const method = operation.slice(0, space);
    const pattern = operation.slice(space + 1);
    const response = await api.request(method, concretePath(pattern), {
      key: BOOTSTRAP_KEY,
      ...(BODY_METHODS.has(method) ? { body: {} } : {}),
    });
    assert.equal(
      response.status,
      403,
      `${operation} reached validation/domain code instead of failing at the production mode boundary: ${JSON.stringify(response.body)}`,
    );
    assert.match(response.body.detail, /sandbox-only/);
  }
});
