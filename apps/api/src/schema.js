/** Versioned persistent schema for the Blueballs banking runtime. */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";
import { migrate } from "../../../packages/sqlite-compat/src/migrations.js";
import { bankingEnv, bankingFlag } from "./runtime-env.js";

const V1_COLLECTION_TABLES = Object.freeze([
  "tenants",
  "keys",
  "customers",
  "accounts",
  "recipients",
  "quotes",
  "transfers",
  "idempotency",
  "builderProjects",
  "builderJourneys",
  "policies",
  "chains",
  "approvalQueue",
  "orgs",
  "wallets",
  "cards",
  "authorisations",
  "disputes",
  "applications",
  "details",
  "links",
  "mandates",
  "subscriptions",
  "webhooks",
  "deliveries",
  "simulations",
  "statements",
  "feeConfigs",
  "vaults",
  "creditLines",
  "fxLpPositions",
  "fxLpEarnings",
  "fxIntents",
  "fxFills",
  "fxBatches",
  "ramps",
]);

const V4_FX_COLLECTION_TABLES = Object.freeze(["fxAppetite", "fxRfqs"]);
const V5_PROVIDER_COLLECTION_TABLES = Object.freeze([
  "providerOutbox",
  "providerAttempts",
  "reconciliationCases",
]);
const V6_PROVIDER_INBOUND_TABLES = Object.freeze(["providerInboundEvents"]);

export const BANKING_COLLECTION_TABLES = Object.freeze([
  ...V1_COLLECTION_TABLES,
  "webhookOutbox",
  "auditRecords",
  ...V4_FX_COLLECTION_TABLES,
  ...V5_PROVIDER_COLLECTION_TABLES,
  ...V6_PROVIDER_INBOUND_TABLES,
]);

export const BANKING_COLLECTION_TABLE_SET = new Set(BANKING_COLLECTION_TABLES);

function createJsonCollection(database, table) {
  if (!BANKING_COLLECTION_TABLE_SET.has(table)) {
    throw new Error(`Refusing to migrate unknown banking collection ${table}`);
  }
  database.exec(
    `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  );
}

function addColumnIfMissing(database, table, column, sqlType) {
  const columns = database.prepare(`PRAGMA table_info("${table}")`).all();
  if (!columns.some((candidate) => candidate.name === column)) {
    database.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${sqlType}`);
  }
}

export const BANKING_SCHEMA_MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "initial-banking-schema",
    up(database) {
      for (const table of V1_COLLECTION_TABLES) createJsonCollection(database, table);

      database.exec(`CREATE TABLE IF NOT EXISTS ledger (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        txn TEXT NOT NULL,
        at TEXT NOT NULL,
        account TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount TEXT NOT NULL,
        memo TEXT
      )`);

      database.exec(`CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL,
        tenant_id TEXT
      )`);

      addColumnIfMissing(database, "events", "tenant_id", "TEXT");
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_ledger_account_currency_seq ON ledger(account, currency, seq)",
      );
      database.exec("CREATE INDEX IF NOT EXISTS idx_ledger_txn ON ledger(txn)");
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_events_tenant_seq ON events(tenant_id, seq)",
      );
    },
  },
  {
    version: 2,
    name: "durable-webhook-outbox",
    up(database) {
      createJsonCollection(database, "webhookOutbox");
    },
  },
  {
    version: 3,
    name: "command-audit-correlation",
    up(database) {
      createJsonCollection(database, "auditRecords");
      addColumnIfMissing(database, "ledger", "command_id", "TEXT");
      addColumnIfMissing(database, "events", "command_id", "TEXT");
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_ledger_command ON ledger(command_id, seq)",
      );
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_events_command ON events(command_id, seq)",
      );
    },
  },
  {
    version: 4,
    name: "complete-legacy-fx-durable-schema",
    up(database) {
      for (const table of V4_FX_COLLECTION_TABLES) {
        createJsonCollection(database, table);
      }
    },
  },
  {
    version: 5,
    name: "durable-provider-operations",
    up(database) {
      for (const table of V5_PROVIDER_COLLECTION_TABLES) {
        createJsonCollection(database, table);
      }
    },
  },
  {
    version: 6,
    name: "durable-provider-inbound-evidence",
    up(database) {
      for (const table of V6_PROVIDER_INBOUND_TABLES) {
        createJsonCollection(database, table);
      }
    },
  },
]);

function databasePath() {
  return (
    bankingEnv("DB_PATH") ||
    (bankingFlag("CLOUDFLARE_WORKER", false)
      ? ":memory:"
      : join(dirname(fileURLToPath(import.meta.url)), "..", "blueballs.sqlite"))
  );
}

export function migrateBankingSchema() {
  const database = new DatabaseSync(databasePath());
  try {
    return migrate(database, "banking", BANKING_SCHEMA_MIGRATIONS);
  } finally {
    database.close();
  }
}
