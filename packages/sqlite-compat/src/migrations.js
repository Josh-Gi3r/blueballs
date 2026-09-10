/**
 * Small, synchronous migration runner shared by Node SQLite and Durable Object
 * SQLite. Migrations are append-only and identified by a monotonically
 * increasing integer version within a named component.
 *
 * The runner deliberately owns only migration bookkeeping. Domain packages
 * provide the SQL/callback for each version so application schema changes stay
 * reviewable next to the data model they modify.
 */

const IDENTIFIER = /^[a-z][a-z0-9_-]{0,63}$/;
const MIGRATION_NAME = /^[a-z][a-z0-9_]{0,95}$/;

function assertComponent(component) {
  if (!IDENTIFIER.test(component)) {
    throw new Error(
      `Invalid migration component ${JSON.stringify(component)}; use lowercase letters, digits, _ or -`,
    );
  }
}

function normalizeMigrations(migrations) {
  if (!Array.isArray(migrations)) throw new TypeError("migrations must be an array");
  let previous = 0;
  return migrations.map((migration) => {
    if (!migration || !Number.isSafeInteger(migration.version) || migration.version < 1) {
      throw new TypeError("every migration needs a positive integer version");
    }
    if (migration.version !== previous + 1) {
      throw new Error(
        `migrations must be contiguous from version 1; expected ${previous + 1}, found ${migration.version}`,
      );
    }
    if (typeof migration.name !== "string" || !MIGRATION_NAME.test(migration.name)) {
      throw new TypeError(
        `migration ${migration.version} needs a stable lowercase snake_case name`,
      );
    }
    if (typeof migration.up !== "function") {
      throw new TypeError(`migration ${migration.version} needs an up(database) function`);
    }
    previous = migration.version;
    return migration;
  });
}

export function ensureMigrationTable(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS blueballs_schema_migrations (
    component TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (component, version)
  )`);
}

export function appliedMigrations(database, component) {
  assertComponent(component);
  ensureMigrationTable(database);
  return database
    .prepare(
      "SELECT version, name, applied_at FROM blueballs_schema_migrations WHERE component = ? ORDER BY version",
    )
    .all(component);
}

/**
 * Apply every missing migration in order. Each migration and its bookkeeping
 * row commit in the same SQLite transaction. If `up()` throws, neither the
 * schema/data change nor its version marker may survive.
 *
 * A database newer than the running code fails closed. Starting an older
 * binary against newer financial data is never treated as a valid rollback.
 */
export function migrate(database, component, migrations) {
  assertComponent(component);
  const declared = normalizeMigrations(migrations);
  ensureMigrationTable(database);

  const applied = appliedMigrations(database, component);
  const appliedByVersion = new Map(applied.map((row) => [Number(row.version), row]));
  const latestDeclared = declared.at(-1)?.version ?? 0;
  const latestApplied = applied.length ? Number(applied.at(-1).version) : 0;

  if (latestApplied > latestDeclared) {
    throw new Error(
      `${component} schema is version ${latestApplied}, but this binary only knows version ${latestDeclared}`,
    );
  }

  for (const row of applied) {
    const migration = declared.find((candidate) => candidate.version === Number(row.version));
    if (!migration) {
      throw new Error(
        `${component} schema contains applied migration ${row.version} (${row.name}) that this binary does not declare`,
      );
    }
    if (migration.name !== row.name) {
      throw new Error(
        `${component} migration ${row.version} was applied as ${row.name} but source declares ${migration.name}; applied migrations are immutable`,
      );
    }
  }

  for (const migration of declared) {
    if (appliedByVersion.has(migration.version)) continue;
    database.transactionSync(() => {
      migration.up(database);
      database
        .prepare(
          "INSERT INTO blueballs_schema_migrations (component, version, name, applied_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          component,
          migration.version,
          migration.name,
          new Date().toISOString(),
        );
    });
  }

  return appliedMigrations(database, component);
}
