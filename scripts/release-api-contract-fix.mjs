#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  const index = source.indexOf(from);
  assert.notEqual(index, -1, `${path}: expected source fragment missing`);
  assert.equal(
    source.indexOf(from, index + from.length),
    -1,
    `${path}: expected source fragment is not unique`,
  );
  fs.writeFileSync(path, source.slice(0, index) + to + source.slice(index + from.length));
  console.log(`patched ${path}`);
}

// API CI must not make unrelated test files contend for one process-global
// SQLite database. Each test file gets its own DB and executes deterministically.
replaceOnce(
  "apps/api/test/run-ci.mjs",
  `  const result = await run(process.execPath, ["--test", ...files]);\n  if (result.code !== 0) process.exit(result.code ?? 1);`,
  `  let failed = false;\n  for (const file of files) {\n    const databasePath = join(\n      temp,\n      file.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".sqlite",\n    );\n    const result = await run(process.execPath, ["--test", file], {\n      env: { DB_PATH: databasePath },\n    });\n    if (result.code !== 0) failed = true;\n  }\n  if (failed) process.exit(1);`,
);

// node:sqlite rows intentionally have a null prototype. This test is about the
// migration values and order, not the engine's row prototype implementation.
replaceOnce(
  "apps/api/test/banking-schema.test.js",
  `      .all("banking");`,
  `      .all("banking")\n      .map((row) => ({ ...row }));`,
);

// Account collection responses must expose the same derived balance as create
// and detail responses. Stored account records never persist a mutable balance.
replaceOnce(
  "apps/api/src/server.js",
  `route("GET", "/v2/accounts", ({ url, key }) =>\n  paginate(visibleTo([...db.accounts.values()], key), url),\n);`,
  `route("GET", "/v2/accounts", ({ url, key }) =>\n  paginate(\n    visibleTo([...db.accounts.values()], key).map((account) => ({\n      ...account,\n      balance: {\n        amount: fromMinor(balanceOf(account.id, account.currency)),\n        currency: account.currency,\n      },\n    })),\n    url,\n  ),\n);`,
);

// fx/batches already uses the shared cursor paginator, so its published query
// contract must advertise the same pagination parameters it actually accepts.
replaceOnce(
  "spec/banking/openapi/response-contracts.mjs",
  `  "getRecipients",\n  "getTransfers",`,
  `  "getRecipients",\n  "getFxBatches",\n  "getTransfers",`,
);

// Keep the pure gateway signing helper available from the provider auth module
// alongside the canonicalization helper used by the verifier.
replaceOnce(
  "apps/api/src/provider-inbound-auth.js",
  `import { canonicalProviderInboundBody } from "../../../spec/provider-inbound-signing.mjs";`,
  `import {\n  canonicalProviderInboundBody,\n  signProviderInboundBody,\n} from "../../../spec/provider-inbound-signing.mjs";`,
);
replaceOnce(
  "apps/api/src/provider-inbound-auth.js",
  `export { canonicalProviderInboundBody };`,
  `export { canonicalProviderInboundBody, signProviderInboundBody };`,
);

// Runtime-mode denial is a request-boundary control. Evaluate it after command
// audit context exists but before tenant/operator authentication, then retain the
// kernel preflight check as defense in depth.
replaceOnce(
  "apps/api/src/kernel.js",
  `function assertRuntimeMode(method, pattern, body) {`,
  `export function assertRuntimeMode(method, pattern, body) {`,
);
replaceOnce(
  "apps/api/src/server.js",
  `  BANK_API_MODE,\n} from "./kernel.js";`,
  `  BANK_API_MODE,\n  assertRuntimeMode,\n} from "./kernel.js";`,
);
replaceOnce(
  "apps/api/src/server.js",
  `        const key =\n          hit.r.access === "PUBLIC"`,
  `        assertRuntimeMode(req.method, hit.r.pattern, body);\n\n        const key =\n          hit.r.access === "PUBLIC"`,
);

// The request contract intentionally models merchant metadata as an object.
// Persistence tests should exercise that public contract instead of the old
// pre-contract string shorthand.
const restartPath = "apps/api/test/restart-persistence.test.js";
let restart = fs.readFileSync(restartPath, "utf8");
const oldMerchant = `merchant: "Example Store"`;
const occurrences = restart.split(oldMerchant).length - 1;
assert.equal(occurrences, 2, `expected two stale merchant string fixtures, found ${occurrences}`);
restart = restart.split(oldMerchant).join(`merchant: { name: "Example Store" }`);
fs.writeFileSync(restartPath, restart);
console.log(`patched ${restartPath}`);

console.log("API contract hardening edits applied");
