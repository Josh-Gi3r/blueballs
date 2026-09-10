import assert from "node:assert/strict";
import test from "node:test";
import { FAMILIES } from "../../../src/endpoints.ts";
import { createApiFixture } from "./helpers/api-process.js";

const operations = FAMILIES.flatMap((family) =>
  family.endpoints.map((endpoint) => ({ family: family.name, ...endpoint })),
);

const concretePath = (pattern) =>
  pattern.replace(/:([A-Za-z0-9_]+)/g, (_match, name) => `missing_${name}`);

const hasBody = (verb) => ["POST", "PATCH", "PUT"].includes(verb);

function label(operation) {
  return `${operation.verb} ${operation.path} [${operation.access}]`;
}

test("all 181 catalogued banking operations are reachable and respect their runtime access boundary", async (t) => {
  assert.equal(operations.length, 181, "the production catalogue must stay at the declared count until intentionally versioned");

  const api = await createApiFixture();
  t.after(() => api.close());

  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index];
    const path = concretePath(operation.path);
    const request = {
      ...(hasBody(operation.verb) ? { body: {} } : {}),
    };

    if (operation.access === "PUBLIC") {
      const response = await api.request(operation.verb, path, request);
      assert.notEqual(response.status, 401, `${label(operation)} unexpectedly requires authentication`);
      assert.notEqual(response.status, 403, `${label(operation)} unexpectedly forbids an anonymous caller`);
      assert.notEqual(response.status, 500, `${label(operation)} crashed the runtime: ${JSON.stringify(response.body)}`);
      assert.notEqual(response.status, 501, `${label(operation)} is documented but only stubbed`);
      continue;
    }

    const anonymous = await api.request(operation.verb, path, request);
    assert.equal(anonymous.status, 401, `${label(operation)} did not reject an anonymous caller`);
    assert.match(
      anonymous.headers.get("content-type") ?? "",
      /^application\/problem\+json/,
      `${label(operation)} authentication failures must use RFC 9457 problem details`,
    );
    assert.equal(anonymous.body?.status, 401, `${label(operation)} problem body disagrees with HTTP status`);
    assert.ok(anonymous.body?.request_id, `${label(operation)} authentication failure has no request_id`);

    if (operation.access === "OPERATOR") continue;

    // Use a fresh tenant for every operation. Some valid operations revoke keys,
    // delete resources or mutate global-looking sandbox state; no probe is
    // allowed to influence the next operation's authentication result.
    const tenant = await api.signup(`catalogue-runtime-${index}@example.test`);
    const authenticated = await api.request(operation.verb, path, {
      ...request,
      key: tenant.key,
    });
    assert.notEqual(authenticated.status, 401, `${label(operation)} rejected a valid tenant key`);
    assert.notEqual(authenticated.status, 403, `${label(operation)} rejected its declared tenant/global-read caller`);
    assert.notEqual(authenticated.status, 500, `${label(operation)} crashed the runtime: ${JSON.stringify(authenticated.body)}`);
    assert.notEqual(authenticated.status, 501, `${label(operation)} is documented but only stubbed`);

    if (authenticated.status >= 400) {
      assert.match(
        authenticated.headers.get("content-type") ?? "",
        /^application\/problem\+json/,
        `${label(operation)} domain errors must use RFC 9457 problem details`,
      );
      assert.equal(
        authenticated.body?.status,
        authenticated.status,
        `${label(operation)} problem body disagrees with HTTP status`,
      );
      assert.ok(authenticated.body?.request_id, `${label(operation)} domain error has no request_id`);
    }
  }
});
