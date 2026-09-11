import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FAMILIES } from "../../src/endpoints.ts";
import {
  FX_NODE_PATH_PREFIXES,
  runtimeForPath,
} from "../../spec/runtime-ownership.mjs";

function concretePath(path) {
  return path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "test");
}

const edgeSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("all 181 catalogued /v2 operations have one production edge runtime owner", () => {
  const endpoints = FAMILIES.flatMap((family) => family.endpoints);
  assert.equal(endpoints.length, 181, "edge proof must track the complete catalogue");

  const seen = new Set();
  const runtimeCounts = { banking: 0, fx: 0 };
  for (const endpoint of endpoints) {
    const path = concretePath(endpoint.path);
    const runtime = runtimeForPath(path);
    assert.ok(
      runtime === "banking" || runtime === "fx",
      `${endpoint.verb} ${endpoint.path} has no public API runtime owner`,
    );
    runtimeCounts[runtime] += 1;
    seen.add(`${endpoint.verb} ${endpoint.path}`);
  }

  assert.equal(seen.size, 181);
  assert.ok(runtimeCounts.banking > 0);
  assert.ok(runtimeCounts.fx > 0);
});

test("the production Site Worker consumes the shared ownership contract directly", () => {
  assert.match(
    edgeSource,
    /import\s*\{\s*runtimeForPath\s*\}\s*from\s*["']\.\.\/\.\.\/spec\/runtime-ownership\.mjs["']/,
  );
  assert.match(edgeSource, /runtimeForPath\(url\.pathname\)\s*===\s*["']fx["']/);
  assert.match(edgeSource, /env\.FX\.fetch\(internalRequest\(target,\s*\{\}\)\)/);
  assert.match(edgeSource, /env\.API\.fetch\(internalRequest\(request,\s*\{\}\)\)/);
  assert.doesNotMatch(edgeSource, /FX_NODE_PATHS|FX_PATHS|fxPaths/);
});

test("every canonical FX edge prefix is represented by the public catalogue", () => {
  const concrete = FAMILIES.flatMap((family) => family.endpoints).map((endpoint) =>
    concretePath(endpoint.path),
  );
  for (const prefix of FX_NODE_PATH_PREFIXES) {
    assert.ok(
      concrete.some((path) => path === prefix || path.startsWith(`${prefix}/`)),
      `${prefix} is owned by FX but has no public catalogue operation`,
    );
  }
});

test("edge forwarding preserves caller credentials and never injects an operator key", () => {
  const internalRequest = edgeSource.match(
    /function internalRequest\(request, headers\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(internalRequest, "edge internalRequest helper missing");
  assert.match(internalRequest, /new Headers\(request\.headers\)/);
  assert.doesNotMatch(internalRequest, /OPERATOR|API_KEY|authorization\s*:/i);

  // FX forwarding passes an empty override object, so the caller's Authorization
  // and x-api-key survive while Origin is removed for the internal service hop.
  assert.match(edgeSource, /env\.FX\.fetch\(internalRequest\(target,\s*\{\}\)\)/);
});
