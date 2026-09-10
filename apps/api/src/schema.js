/** Versioned persistent schema for the Blueballs banking runtime.
 *
 * This is application-data schema versioning. It is deliberately separate from
 * Cloudflare Durable Object class migrations in wrangler.api.jsonc.
 *
 * Every durable JSON collection used by the banking API must be listed here.
 * New collections require an append-only schema migration before route code may
 * open them. Ledger and event tables are explicit because their columns are
 * financial/audit contracts rather than opaque JSON resources.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "../../../packages/sqlite-compat/src/index.js";
import { migrate } from "../../../packages/sqlite-compat/src/migrations.js";

export const BANKING_COLLECTION_TABLES = Object.freeze([
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

export const BANKING_COLLECTION_TABLE_SET = new Set(BANKING_COLLECTION_TABLES);

function createJsonCollection(database, table) {
  if (!BANKING_COLLECTION_TABLE_SET.has(table)) {
    throw new Error(`Refusing to migrate unknown banking collection ${table}`);
  }
  database.exec(
    `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  );
}

export const BANKING_SCHEMA_MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "initial-banking-schema",
    up(database) {
      for (const table of BANKING_COLLECTION_TABLES) {
        createJsonCollection(database, table);
      }

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

      // Upgrade pre-versioned databases whose events table predates tenant
      // ownership. Existing unowned events remain inaccessible because every
      // authenticated event read filters by tenant_id.
      const eventColumns = database.prepare("PRAGMA table_info(events)").all();
      if (!eventColumns.some((column) => column.name === "tenant_id")) {
        database.exec("ALTER TABLE events ADD COLUMN tenant_id TEXT");
      }

      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_ledger_account_currency_seq ON ledger(account, currency, seq)",
      );
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_ledger_txn ON ledger(txn)",
      );
      database.exec(
        "CREATE INDEX IF NOT EXISTS idx_events_tenant_seq ON events(tenant_id, seq)",
      );
    },
  },
]);

function databasePath() {
  return (
    process.env.DB_PATH ||
    (process.env.CLOUDFLARE_WORKER === "true"
      ? ":memory:"
      : join(dirname(fileURLToPath(import.meta.url)), "..", "blueballs.sqlite"))
  );
}

/** Apply/validate the banking schema before route families initialise. */
export function migrateBankingSchema() {
  const database = new DatabaseSync(databasePath());
  try {
    return migrate(database, "banking", BANKING_SCHEMA_MIGRATIONS);
  } finally {
    database.close();
  }
}
