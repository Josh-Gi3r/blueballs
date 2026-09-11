import assert from "node:assert/strict";
import test from "node:test";
import siteWorker from "./index.js";
import { FAMILIES } from "../../src/endpoints.ts";
import { runtimeForPath } from "../../spec/runtime-ownership.mjs";

function concretePath(path) {
  return path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "test");
}

function upstream(name) {
  return {
    async fetch(request) {
      return new Response(JSON.stringify({ upstream: name, path: new URL(request.url).pathname }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-blueballs-test-upstream": name,
        },
      });
    },
  };
}

const env = {
  LOCAL_DEV: "true",
  BLUEBALLS_GIT_SHA: "edge-routing-test",
  API: upstream("banking"),
  FX: upstream("fx"),
  ASSETS: upstream("assets"),
};

test("every catalogued public /v2 operation traverses the production edge to its declared runtime", async () => {
  const endpoints = FAMILIES.flatMap((family) => family.endpoints);
  assert.equal(endpoints.length, 181, "edge proof must track the full banking catalogue");

  const seen = new Set();
  for (const endpoint of endpoints) {
    const path = concretePath(endpoint.path);
    const expected = runtimeForPath(path);
    assert.notEqual(expected, "site", `${endpoint.verb} ${endpoint.path} unexpectedly resolves to site runtime`);

    const response = await siteWorker.fetch(
      new Request(`https://blueballs.tech${path}`, {
        method: endpoint.verb,
        headers: {
          "x-api-key": "bb_edge_route_test",
          authorization: "Bearer edge-route-test",
        },
      }),
      env,
    );

    assert.equal(response.status, 200, `${endpoint.verb} ${endpoint.path} failed at edge`);
    assert.equal(
      response.headers.get("x-blueballs-test-upstream"),
      expected,
      `${endpoint.verb} ${endpoint.path} routed to wrong runtime`,
    );
    assert.equal(
      response.headers.get("x-blueballs-source-commit"),
      "edge-routing-test",
      `${endpoint.verb} ${endpoint.path} lost edge response metadata`,
    );
    assert.equal(
      response.headers.get("cache-control"),
      "no-store",
      `${endpoint.verb} ${endpoint.path} must not be cached by the public edge`,
    );
    seen.add(`${endpoint.verb} ${endpoint.path}`);
  }

  assert.equal(seen.size, 181);
});

test("edge preserves caller credentials rather than injecting operator credentials", async () => {
  let observed = null;
  const checkingEnv = {
    ...env,
    FX: {
      async fetch(request) {
        observed = {
          apiKey: request.headers.get("x-api-key"),
          authorization: request.headers.get("authorization"),
        };
        return new Response("{}", {
          status: 200,
          headers: { "x-blueballs-test-upstream": "fx" },
        });
      },
    },
  };

  const response = await siteWorker.fetch(
    new Request("https://blueballs.tech/v2/fx/depth", {
      headers: {
        "x-api-key": "caller-key",
        authorization: "Bearer caller-token",
      },
    }),
    checkingEnv,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    apiKey: "caller-key",
    authorization: "Bearer caller-token",
  });
});
