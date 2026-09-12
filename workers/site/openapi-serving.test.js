import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const siteWorker = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const generator = readFileSync(
  new URL("../../scripts/build-bank-openapi.mjs", import.meta.url),
  "utf8",
);
const gitignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");

test("banking OpenAPI is generated once and served from the canonical public asset", () => {
  assert.match(generator, /writeFileSync\(fileURLToPath\(new URL\("public\/openapi\.yaml"/);
  assert.doesNotMatch(generator, /workers\/site\/openapi\.generated\.js/);
  assert.match(gitignore, /^public\/openapi\.yaml$/m);
  assert.equal(
    existsSync(new URL("./openapi.generated.js", import.meta.url)),
    false,
    "the Site Worker must not carry a second embedded banking OpenAPI copy",
  );
});

test("the Site Worker serves /openapi.yaml from the generated asset binding", () => {
  assert.doesNotMatch(siteWorker, /BANK_OPENAPI_YAML/);
  assert.doesNotMatch(siteWorker, /\.\/openapi\.generated\.js/);
  assert.match(
    siteWorker,
    /url\.pathname === "\/openapi\.yaml"[\s\S]*?env\.ASSETS\.fetch/,
  );
  assert.match(siteWorker, /application\/yaml; charset=utf-8/);
});

test("adapter-required operations cannot emit duplicate 503 response keys", () => {
  assert.match(generator, /const adapterRequired = ADAPTER_REQUIRED_OPERATIONS\.has\(operationId\)/);
  assert.match(generator, /if \(adapterRequired && status === "503"\) continue;/);
});
