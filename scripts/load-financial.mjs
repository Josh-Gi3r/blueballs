#!/usr/bin/env node
/**
 * Small dependency-free load/soak harness for disposable Blueballs environments.
 *
 * Banking mode exercises the sandbox payment command so the full resource ->
 * ledger -> event/idempotency boundary is involved. FX mode exercises the
 * canonical live-capacity preview pipeline. Do not point banking mutation mode
 * at customer production data.
 */

const mode = process.env.LOAD_MODE || "both";
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || 30);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE || 0);
const bankBase = (process.env.BANK_BASE_URL || "http://127.0.0.1:5290").replace(/\/$/, "");
const bankKey = process.env.BANK_API_KEY || "";
const bankAccount = process.env.BANK_ACCOUNT_ID || "";
const bankCurrency = (process.env.BANK_CURRENCY || "EUR").toUpperCase();
const fxBase = (process.env.FX_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const fxKey = process.env.FX_API_KEY || "bb_test_local_fx";
const fxAmount = process.env.FX_INPUT_AMOUNT || "50000.00";

if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86_400) {
  throw new Error("LOAD_DURATION_SECONDS must be > 0 and <= 86400");
}
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 500) {
  throw new Error("LOAD_CONCURRENCY must be an integer between 1 and 500");
}
if (!Number.isFinite(maxErrorRate) || maxErrorRate < 0 || maxErrorRate > 1) {
  throw new Error("LOAD_MAX_ERROR_RATE must be between 0 and 1");
}
if (!["banking", "fx", "both"].includes(mode)) {
  throw new Error("LOAD_MODE must be banking, fx or both");
}
if ((mode === "banking" || mode === "both") && (!bankKey || !bankAccount)) {
  throw new Error(
    "Banking load requires BANK_API_KEY and BANK_ACCOUNT_ID for a disposable sandbox account",
  );
}

const deadline = Date.now() + durationSeconds * 1000;
const latencies = [];
let requests = 0;
let failures = 0;
const failuresByStatus = new Map();

function record(started, status, ok) {
  requests += 1;
  latencies.push(Date.now() - started);
  if (!ok) {
    failures += 1;
    failuresByStatus.set(status, (failuresByStatus.get(status) || 0) + 1);
  }
}

async function bankingIteration(worker, sequence) {
  const id = `load-${process.pid}-${worker}-${sequence}-${Date.now()}`;
  const started = Date.now();
  let status = "network";
  try {
    const response = await fetch(`${bankBase}/v2/sandbox/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": bankKey,
        "x-idempotency-key": id,
      },
      body: JSON.stringify({
        scenario: "payment.success",
        simulation_id: id,
        account: bankAccount,
        amount: "0.01",
        currency: bankCurrency,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    status = response.status;
    await response.arrayBuffer();
    record(started, status, response.ok);
  } catch {
    record(started, status, false);
  }
}

async function fxIteration() {
  const started = Date.now();
  let status = "network";
  try {
    const response = await fetch(`${fxBase}/v2/fx/reference/trades/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fxKey}`,
      },
      body: JSON.stringify({ inputAmount: fxAmount }),
      signal: AbortSignal.timeout(15_000),
    });
    status = response.status;
    await response.arrayBuffer();
    record(started, status, response.ok);
  } catch {
    record(started, status, false);
  }
}

async function worker(id) {
  let sequence = 0;
  while (Date.now() < deadline) {
    if (mode === "banking") await bankingIteration(id, sequence++);
    else if (mode === "fx") await fxIteration();
    else if ((sequence++ + id) % 2 === 0) await bankingIteration(id, sequence);
    else await fxIteration();
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
const elapsedMs = Math.max(1, Date.now() - startedAt);
latencies.sort((a, b) => a - b);
const percentile = (p) =>
  latencies.length
    ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)]
    : null;
const errorRate = requests ? failures / requests : 1;

const report = {
  mode,
  duration_seconds: Math.round(elapsedMs / 100) / 10,
  concurrency,
  requests,
  requests_per_second: Math.round((requests / elapsedMs) * 100_000) / 100,
  failures,
  error_rate: Math.round(errorRate * 100_000) / 1000,
  failures_by_status: Object.fromEntries(failuresByStatus),
  latency_ms: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: latencies.at(-1) ?? null,
  },
};
console.log(JSON.stringify(report, null, 2));

if (!requests || errorRate > maxErrorRate) process.exit(1);
