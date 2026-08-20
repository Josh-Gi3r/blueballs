#!/usr/bin/env node
/**
 * `pnpm verify` — the release gate, as a script anyone can run.
 *
 * Deliberately not a CI workflow: it must be runnable by a forker with no
 * account, no runner minutes and no service to sign up for. Everything a
 * pipeline would check is here, it exits non-zero on the first real failure,
 * and it prints what it actually observed rather than a tick.
 *
 * The isolation and rollback checks boot a real API on a scratch port with a
 * throwaway database and make real HTTP calls, because the defects they guard
 * against were both invisible to source inspection: one was a route ordering
 * decision in a different file, the other only appeared once money had moved.
 */

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const results = [];
let failed = 0;

const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const step = (title) => console.log(`\n${title}`);

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
}

const freePort = () =>
  new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

async function waitFor(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/* ---------------------------------------------------------------- 1. build */
step("Build and types");
{
  const r = run("pnpm", ["build"]);
  record("tsc -b && vite build", r.status === 0, r.status === 0 ? "clean" : (r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | "));
}

/* ----------------------------------------------------------------- 2. syntax */
step("Syntax");
{
  const files = run("git", ["ls-files", "*.js", "*.mjs"]).stdout.trim().split("\n").filter(Boolean)
    .filter((f) => !f.startsWith("packages/fx-contracts/"));
  const bad = files.filter((f) => run("node", ["--check", f]).status !== 0);
  record(`node --check on ${files.length} JS files`, bad.length === 0, bad.length ? bad.join(", ") : "all parse");
}

/* ------------------------------------------------------------------ 3. tests */
step("Test suites");
{
  const api = run("pnpm", ["test:api"]);
  record(
    "banking API suite",
    api.status === 0,
    api.status === 0 ? "passed" : (api.stderr || api.stdout).trim().split("\n").slice(-3).join(" | "),
  );

  const r = run("node", ["scripts/test-fx.mjs"]);
  const fail = [...r.stdout.matchAll(/^ℹ fail (\d+)$/gm)].reduce((n, m) => n + Number(m[1]), 0);
  record("FX suites", r.status === 0 && fail === 0, r.status === 0 ? "all 9 package suites passed" : `${fail} failed`);

  const workers = run("pnpm", ["test:workers"]);
  record(
    "Cloudflare Workers runtime suites",
    workers.status === 0,
    workers.status === 0 ? "passed, including Durable Object eviction" : (workers.stderr || workers.stdout).trim().split("\n").slice(-3).join(" | "),
  );

  const sdk = run("pnpm", ["sdk:pack"]);
  const packedFiles = (sdk.stderr.match(/^npm notice total files: (\d+)$/m) ?? [])[1];
  record(
    "FX SDK package boundary",
    sdk.status === 0 && packedFiles === "5",
    sdk.status === 0 ? `${packedFiles ?? "unknown"} files in dry-run tarball` : (sdk.stderr || sdk.stdout).trim().split("\n").slice(-3).join(" | "),
  );

  const contracts = run("make", ["-C", "packages/fx-contracts", "ci"]);
  const contractSummary = contracts.status === 0
    ? ((contracts.stdout.match(/Ran \d+ test suites[^\n]*/g) ?? []).at(-1) ?? "format, build, fuzz and invariants passed")
    : (contracts.stderr || contracts.stdout).trim().split("\n").slice(-3).join(" | ");
  record("Foundry contract gate", contracts.status === 0, contractSummary);

  const compose = run("docker", ["compose", "-f", "compose.reference.yml", "config", "--quiet"]);
  record(
    "reference Compose configuration",
    compose.status === 0,
    compose.status === 0 ? "valid" : (compose.stderr || compose.stdout).trim().split("\n").slice(-3).join(" | "),
  );
}

/* -------------------------------------------------------------- 4. catalogue */
step("API catalogue");
{
  const r = run("node", ["scripts/check-catalogue.mjs"]);
  record("router vs documented catalogue", r.status === 0, (r.stdout || r.stderr).trim().split("\n").pop());
}

/* ----------------------------------------------------------- 4a. product UI */
step("Product and publication truth");
{
  const checks = [
    ["site routes", "scripts/check-site-routes.mjs"],
    ["card provenance", "scripts/check-card-provenance.mjs"],
    ["copy ownership", "scripts/check-no-copy-bridge.mjs"],
    ["page claims", "scripts/check-page-truth.mjs"],
    ["sandbox signup single-flight", "scripts/check-single-flight.mjs"],
    ["provider relationship truth", "scripts/check-provider-truth.mjs"],
    ["browser screenshot evidence", "scripts/check-doc-evidence.mjs"],
    ["reference image contents", "scripts/check-reference-image.mjs"],
  ];
  for (const [name, file] of checks) {
    const r = run("node", [file]);
    record(name, r.status === 0, (r.stdout || r.stderr).trim().split("\n").pop());
  }
}

/* ------------------------------------------------------------ 4b. contracts */
step("Machine-readable contracts");
{
  const before = run("git", ["status", "--porcelain", "--", "public/openapi.yaml", "workers/site/openapi.generated.js", "apps/fx-node/src/openapi.generated.js"]).stdout;
  run("node", ["scripts/build-openapi.mjs"]);
  run("node", ["scripts/build-bank-openapi.mjs"]);
  const after = run("git", ["status", "--porcelain", "--", "public/openapi.yaml", "workers/site/openapi.generated.js", "apps/fx-node/src/openapi.generated.js"]).stdout;
  record("generated OpenAPI is in sync with its sources", before === after, before === after ? "no drift" : "regenerating changed files — commit them");

  const bank = readFileSync(new URL("../public/openapi.yaml", import.meta.url), "utf8");
  const ops = (bank.match(/^      operationId:/gm) || []).length;
  const requestBodies = (bank.match(/^      requestBody:/gm) || []).length;
  record("banking OpenAPI describes the catalogue", ops === 174, `${ops} operations, ${requestBodies} typed request bodies`);

  const requestContracts = run("node", ["scripts/check-openapi-requests.mjs"]);
  record(
    "banking request contracts match runtime",
    requestContracts.status === 0,
    (requestContracts.stdout || requestContracts.stderr).trim().split("\n").pop(),
  );

  const responseContracts = run("node", ["scripts/check-openapi-responses.mjs"]);
  record(
    "banking response contracts match catalogue",
    responseContracts.status === 0,
    (responseContracts.stdout || responseContracts.stderr).trim().split("\n").pop(),
  );

  const bankingSdk = run("node", ["scripts/check-banking-sdk.mjs"]);
  record(
    "banking OpenAPI generates compilable TypeScript",
    bankingSdk.status === 0,
    (bankingSdk.stdout || bankingSdk.stderr).trim().split("\n").pop(),
  );

  const lint = run("pnpm", ["lint:openapi"]);
  record(
    "OpenAPI contract lint",
    lint.status === 0 && !/warning/i.test(lint.stdout + lint.stderr),
    lint.status === 0 ? "valid with zero warnings" : (lint.stderr || lint.stdout).trim().split("\n").slice(-3).join(" | "),
  );
}

/* ----------------------------------------------------- 5. nothing undisclosed */
step("Publication gate");
{
  // The FX provider this stack was derived from is never named in a public repo.
  const r = run("bash", ["-c",
    `git grep -riIE "sera|serapay|serasor|myrt|xsgd|web3-relayer|unified-rate-model" -- . ':!pnpm-lock.yaml' | grep -viE "useragent|cursor|sortcode|serialis|serializ|series" || true`]);
  const hits = r.stdout.trim() ? r.stdout.trim().split("\n") : [];
  record("no provider name in the tree", hits.length === 0, hits.length ? `${hits.length} hit(s): ${hits[0]}` : "0 hits");

  const ph = run("bash", ["-c",
    `git grep -nIE "<this repo>|lorem ipsum|TODO: fill|TBD" -- . ':!scripts/verify.mjs' || true`]);
  const phHits = ph.stdout.trim() ? ph.stdout.trim().split("\n") : [];
  record("no unfilled placeholders", phHits.length === 0, phHits.length ? `${phHits.length}: ${phHits[0]}` : "none");
}

/* ------------------------------------------- 6. the API, exercised for real */
step("Live API behaviour (scratch instance)");
{
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "bb-verify-"));
  const api = spawn("node", ["apps/api/src/server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_PATH: join(dir, "verify.sqlite"), RATE_LIMIT_PER_MIN: "10000" },
    stdio: "ignore",
  });

  const base = `http://127.0.0.1:${port}/v2`;
  try {
    const up = await waitFor(`${base}`);
    record("API boots on this Node version", up, up ? `${process.version} on :${port}` : `no response (${process.version})`);
    if (!up) throw new Error("api did not start");

    const post = (path, key, body) =>
      fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) },
        body: JSON.stringify(body ?? {}),
      });
    const get = (path, key) => fetch(base + path, { headers: key ? { "x-api-key": key } : {} });
    const signup = async (email) => (await (await post("/auth/signup", null, { email })).json()).key;

    // --- two tenants
    const keyA = await signup("verify-a@example.com");
    const keyB = await signup("verify-b@example.com");

    const cus = await (await post("/customers", keyA, { type: "individual", name: "Verify A" })).json();
    await post(`/customers/${cus.id}/verify`, keyA, {});
    const acc = await (await post("/accounts", keyA, { customer: cus.id, currency: "EUR" })).json();
    await post(`/accounts/${acc.id}/credit`, keyA, { amount: "5000.00" });

    // --- tenant isolation
    const attacks = [
      ["read another tenant's customer", (await get(`/customers/${cus.id}`, keyB)).status],
      ["read another tenant's account", (await get(`/accounts/${acc.id}`, keyB)).status],
      ["approve another tenant's KYC", (await post(`/customers/${cus.id}/verify`, keyB, { decision: "approved" })).status],
      ["credit another tenant's account", (await post(`/accounts/${acc.id}/credit`, keyB, { amount: "1.00" })).status],
      ["debit another tenant's account", (await post("/transfers", keyB, { from: acc.id, amount: "100.00", rail: "sepa_instant" })).status],
    ];
    for (const [label, status] of attacks) record(label, status === 404, `HTTP ${status} (want 404)`);

    const listed = await (await get("/accounts", keyB)).json();
    record("another tenant lists no accounts", (listed.data?.length ?? -1) === 0, `${listed.data?.length} rows`);

    const ledgerB = await (await get("/ledger?limit=500", keyB)).json();
    record("another tenant reads no ledger rows", (ledgerB.data?.length ?? -1) === 0, `${ledgerB.data?.length} rows`);

    // A row created before ownership existed has no owner. It must be invisible,
    // not public: the first version of this exemption left exactly those rows
    // readable by everyone, so the fix did not close the hole it was written for.
    const allA = await (await get("/accounts", keyA)).json();
    const unownedVisible = (allA.data ?? []).filter((r) => r.owner === undefined).length;
    record("no unowned row is visible to anyone", unownedVisible === 0, `${unownedVisible} unowned rows returned`);

    // --- the owner still works
    const own = await post("/transfers", keyA, { from: acc.id, amount: "100.00", rail: "sepa_instant" });
    record("owner can still move their own money", own.status === 201, `HTTP ${own.status}`);

    // --- a refused swap must leave no trace
    const usd = await (await post("/accounts", keyA, { customer: cus.id, currency: "USDX" })).json();
    await post(`/accounts/${usd.id}/credit`, keyA, { amount: "1000.00" });
    const before = (await (await get("/ledger?limit=500", keyA)).json()).data.length;
    const refused = await post("/fx/intents", keyA, {
      account: usd.id, from: "USDX", to: "EURX", amount: "1000.00", min_receive: "99999.00",
    });
    const after = (await (await get("/ledger?limit=500", keyA)).json()).data.length;
    record("swap below min_receive is refused", refused.status === 400, `HTTP ${refused.status}`);
    record("refused swap wrote nothing to the ledger", before === after, `${before} rows before, ${after} after`);

    // --- committed LP capital is the capital that fills a trade
    const lpKey = await signup("verify-lp@example.com");
    const lpCus = await (await post("/customers", lpKey, { type: "business", name: "Verify LP" })).json();
    await post(`/customers/${lpCus.id}/verify`, lpKey, {});
    const lpAcc = await (await post("/accounts", lpKey, { customer: lpCus.id, currency: "EURX" })).json();
    record("an account can be opened in a traded stablecoin", Boolean(lpAcc.id), lpAcc.id ? "EURX" : JSON.stringify(lpAcc).slice(0, 120));
    if (lpAcc.id) {
      await post(`/accounts/${lpAcc.id}/credit`, lpKey, { amount: "50000.00" });
      const commit = await post("/fx/lp", lpKey, { account: lpAcc.id, currency: "EURX", amount: "20000.00", pair: "USDX/EURX" });
      record("liquidity can be committed to a corridor", commit.status === 201, `HTTP ${commit.status}`);

      const swap = await (await post("/fx/intents", keyA, {
        account: usd.id, from: "USDX", to: "EURX", amount: "100.00", min_receive: "1.00",
      })).json();
      const filled = (swap.fill_legs ?? []).filter((l) => !l.declined).map((l) => l.source);
      record("a trade fills from the committed pool", filled.includes("lp"), filled.join(",") || "no fill");

      const earnings = await (await get("/fx/lp/earnings", lpKey)).json();
      record("the provider earned from that fill", (earnings.data?.length ?? 0) > 0, `${earnings.data?.length ?? 0} earning rows`);
    }

    // --- rate limit headers describe a real counter
    const h1 = await get("", keyA);
    const h2 = await get("", keyA);
    const r1 = Number(h1.headers.get("x-ratelimit-remaining"));
    const r2 = Number(h2.headers.get("x-ratelimit-remaining"));
    record("rate limit counter decrements", Number.isFinite(r1) && r2 < r1, `${r1} → ${r2}`);
  } catch (err) {
    record("live API checks", false, err.message);
  } finally {
    api.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ summary */
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (failed) {
  console.log(`\n${failed} FAILED — this is not releasable.`);
  process.exit(1);
}
console.log("All checks green.");
