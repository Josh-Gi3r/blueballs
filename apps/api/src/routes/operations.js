/** Internal production operations surface.
 *
 * Liveness/readiness are intentionally outside the 181-operation product
 * catalogue. Detailed metrics require the operator credential and expose only
 * aggregate operational state, never customer names, secrets or provider
 * payloads.
 */
import {
  ApiError,
  BANK_API_MODE,
  balanceOf,
  db,
  fromMinor,
  route,
} from "../kernel.js";
import { BANKING_SCHEMA_MIGRATIONS } from "../schema.js";
import {
  providerAttempts,
  providerOutboxStatus,
  reconciliationCases,
} from "../provider-outbox.js";
import { providerTransportAvailable } from "../provider-transport.js";
import { providerPayloadEncryptionReady } from "../provider-payload-crypto.js";
import { webhookOutboxStatus } from "../webhook-outbox.js";
import { bankingEnv } from "../runtime-env.js";

const STARTED_AT_MS = Date.now();
const STARTED_AT = new Date(STARTED_AT_MS).toISOString();
const SCHEMA_VERSION = BANKING_SCHEMA_MIGRATIONS.at(-1)?.version ?? 0;

function aggregateBalances(rows) {
  const totals = new Map();
  for (const row of rows ?? []) {
    if (!row?.id || !row?.currency || row.status === "closed") continue;
    const current = totals.get(row.currency) ?? 0n;
    totals.set(row.currency, current + balanceOf(row.id, row.currency));
  }
  return Object.fromEntries(
    [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => [currency, fromMinor(amount)]),
  );
}

function finishedAttemptLatency() {
  const durations = [];
  for (const attempt of providerAttempts.values()) {
    if (!attempt.started_at || !attempt.finished_at) continue;
    const start = Date.parse(attempt.started_at);
    const end = Date.parse(attempt.finished_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durations.push(end - start);
    }
  }
  durations.sort((a, b) => a - b);
  if (!durations.length) {
    return { samples: 0, avg_ms: null, p95_ms: null, max_ms: null };
  }
  const sum = durations.reduce((total, value) => total + value, 0);
  return {
    samples: durations.length,
    avg_ms: Math.round(sum / durations.length),
    p95_ms:
      durations[
        Math.min(
          durations.length - 1,
          Math.ceil(durations.length * 0.95) - 1,
        )
      ],
    max_ms: durations.at(-1),
  };
}

function auditMetrics() {
  const records = db.audit.values();
  let failedCommands = 0;
  let failedFinancialCommands = 0;
  let idempotencyReplays = 0;
  for (const record of records) {
    if (record.outcome === "failed") {
      failedCommands += 1;
      if (
        Array.isArray(record.ledger_transactions) &&
        record.ledger_transactions.length
      ) {
        failedFinancialCommands += 1;
      }
    }
    if (record.idempotent_replay) idempotencyReplays += 1;
  }
  return {
    records: records.length,
    failed_commands: failedCommands,
    failed_financial_commands: failedFinancialCommands,
    idempotency_replays: idempotencyReplays,
  };
}

function safeCheck(check) {
  try {
    return !!check();
  } catch {
    return false;
  }
}

function readiness() {
  const checks = {
    database_schema: SCHEMA_VERSION > 0,
    provider_transport:
      BANK_API_MODE !== "production" ||
      safeCheck(() => providerTransportAvailable()),
    provider_payload_encryption:
      BANK_API_MODE !== "production" ||
      safeCheck(() => providerPayloadEncryptionReady()),
    provider_inbound_auth:
      BANK_API_MODE !== "production" ||
      String(bankingEnv("BANK_PROVIDER_INBOUND_SECRET", "")).length >= 32,
  };
  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}

route(
  "GET",
  "/v2/_health",
  () => ({
    status: "ok",
    mode: BANK_API_MODE,
    started_at: STARTED_AT,
    uptime_seconds: Math.max(
      0,
      Math.floor((Date.now() - STARTED_AT_MS) / 1000),
    ),
    schema_version: SCHEMA_VERSION,
    source_commit: bankingEnv("BLUEBALLS_GIT_SHA", "development"),
  }),
  { public: true },
);

route(
  "GET",
  "/v2/_ready",
  () => {
    const state = readiness();
    if (!state.ready) {
      throw new ApiError(
        "service-unavailable",
        503,
        `Banking runtime is not ready: ${Object.entries(state.checks)
          .filter(([, ok]) => !ok)
          .map(([name]) => name)
          .join(", ")}`,
      );
    }
    return {
      status: "ready",
      mode: BANK_API_MODE,
      schema_version: SCHEMA_VERSION,
      checks: state.checks,
    };
  },
  { public: true },
);

route(
  "GET",
  "/v2/_ops/metrics",
  () => {
    const provider = providerOutboxStatus();
    const webhook = webhookOutboxStatus();
    const reconciliation = [...reconciliationCases.values()];
    const openReconciliation = reconciliation.filter(
      (record) => record.status === "open",
    );
    return {
      object: "operational_metrics",
      generated_at: new Date().toISOString(),
      mode: BANK_API_MODE,
      schema_version: SCHEMA_VERSION,
      source_commit: bankingEnv("BLUEBALLS_GIT_SHA", "development"),
      resources: {
        tenants: db.tenants.size,
        customers: db.customers.size,
        accounts: db.accounts.size,
        wallets: db.wallets?.size ?? 0,
        transfers: db.transfers.size,
        cards: db.cards?.size ?? 0,
      },
      balances: {
        accounts: aggregateBalances([...db.accounts.values()]),
        wallets: aggregateBalances(
          db.wallets ? [...db.wallets.values()] : [],
        ),
      },
      audit: auditMetrics(),
      provider: {
        ...provider,
        latency: finishedAttemptLatency(),
      },
      webhooks: webhook,
      reconciliation: {
        total: reconciliation.length,
        open: openReconciliation.length,
        oldest_open_at:
          openReconciliation
            .map((record) => record.opened_at)
            .filter(Boolean)
            .sort()[0] ?? null,
      },
    };
  },
  { access: "OPERATOR" },
);
