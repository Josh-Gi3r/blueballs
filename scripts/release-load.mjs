#!/usr/bin/env node
/** Self-contained load proof against disposable banking and FX runtimes. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const durationSeconds = Number(process.env.RELEASE_LOAD_DURATION_SECONDS || 15);
const concurrency = Number(process.env.RELEASE_LOAD_CONCURRENCY || 12);
const reportPath = resolve(
  ROOT,
  process.env.RELEASE_LOAD_REPORT || "artifacts/load-report.json",
);

if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
  throw new Error("RELEASE_LOAD_DURATION_SECONDS must be between 1 and 600");
}
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 100) {
  throw new Error("RELEASE_LOAD_CONCURRENCY must be an integer between 1 and 100");
}

function freePort() {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitFor(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Runtime is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runNode(args, { env = {}, capture = false } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
    }
    child.once("exit", (code, signal) =>
      resolveRun({ code: code ?? 1, signal, stdout, stderr }),
    );
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const scratch = mkdtempSync(join(tmpdir(), "blueballs-release-load-"));
const bankPort = await freePort();
const fxPort = await freePort();
const fxKey = "bb_test_release_load_fx";
const bank = spawn(process.execPath, ["apps/api/src/server.js"], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(bankPort),
    DB_PATH: join(scratch, "bank.sqlite"),
    BANK_API_MODE: "sandbox",
    RATE_LIMIT_PER_MIN: "1000000",
    SOURCE_RATE_LIMIT_PER_MIN: "1000000",
    TENANT_RATE_LIMIT_PER_MIN: "1000000",
  },
  stdio: "ignore",
});
const fx = spawn(process.execPath, ["apps/fx-node/src/cli.js"], {
  cwd: ROOT,
  env: {
    ...process.env,
    FX_NODE_MODE: "reference-sandbox",
    FX_NODE_HOST: "127.0.0.1",
    FX_NODE_PORT: String(fxPort),
    FX_NODE_API_KEY: fxKey,
    FX_NODE_DATA_DIR: join(scratch, "fx"),
    FX_NODE_CORS_ORIGINS: "",
  },
  stdio: "ignore",
});

try {
  const bankBase = `http://127.0.0.1:${bankPort}`;
  const fxBase = `http://127.0.0.1:${fxPort}`;
  await Promise.all([waitFor(`${bankBase}/v2`), waitFor(`${fxBase}/health`)]);

  const signup = await request(`${bankBase}/v2/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "release-load@blueballs.local" }),
  });
  const headers = {
    "content-type": "application/json",
    "x-api-key": signup.key,
  };
  const customer = await request(`${bankBase}/v2/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "business", name: "Release Load" }),
  });
  await request(`${bankBase}/v2/customers/${customer.id}/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ decision: "approved" }),
  });
  const account = await request(`${bankBase}/v2/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ customer: customer.id, currency: "EUR" }),
  });
  await request(`${bankBase}/v2/accounts/${account.id}/credit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount: "1000000.00" }),
  });

  const load = await runNode(["scripts/load-financial.mjs"], {
    capture: true,
    env: {
      LOAD_MODE: "both",
      LOAD_DURATION_SECONDS: String(durationSeconds),
      LOAD_CONCURRENCY: String(concurrency),
      LOAD_MAX_ERROR_RATE: "0",
      BANK_BASE_URL: bankBase,
      BANK_API_KEY: signup.key,
      BANK_ACCOUNT_ID: account.id,
      BANK_CURRENCY: "EUR",
      FX_BASE_URL: fxBase,
      FX_API_KEY: fxKey,
      FX_INPUT_AMOUNT: "50000.00",
    },
  });
  if (load.stdout) process.stdout.write(load.stdout);
  if (load.stderr) process.stderr.write(load.stderr);
  if (load.code !== 0) process.exitCode = load.code;

  let report;
  try {
    report = JSON.parse(load.stdout.trim());
  } catch {
    throw new Error("Load harness did not emit a valid JSON report");
  }
  const evidence = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    profile: "disposable-reference-stack",
    ...report,
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(evidence, null, 2) + "\n");
  console.log(`Release load evidence: ${reportPath}`);
  if (load.code !== 0) throw new Error("Release load acceptance criteria failed");
} finally {
  bank.kill("SIGTERM");
  fx.kill("SIGTERM");
  rmSync(scratch, { recursive: true, force: true });
}
