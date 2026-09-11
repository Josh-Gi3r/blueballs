import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { BANKING_SCHEMA_MIGRATIONS } from "../../apps/api/src/schema.js";

const LATEST_SCHEMA_VERSION = BANKING_SCHEMA_MIGRATIONS.at(-1)?.version ?? 0;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function quoteSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validateMigrationHistory(database, { requireCurrentSchema }) {
  const applied = database
    .prepare(
      "SELECT version, name FROM blueballs_schema_migrations WHERE component = ? ORDER BY version",
    )
    .all("banking")
    .map((row) => ({ version: Number(row.version), name: row.name }));
  if (!applied.length)
    throw new Error("Backup has no banking schema migration history");

  for (let index = 0; index < applied.length; index += 1) {
    const row = applied[index];
    const expectedVersion = index + 1;
    if (row.version !== expectedVersion) {
      throw new Error(
        `Backup banking migration history is not contiguous; expected version ${expectedVersion}, found ${row.version}`,
      );
    }
    const declared = BANKING_SCHEMA_MIGRATIONS[index];
    if (!declared) {
      throw new Error(
        `Backup contains banking migration ${row.version} (${row.name}) newer than this checkout`,
      );
    }
    if (declared.name !== row.name) {
      throw new Error(
        `Backup banking migration ${row.version} was applied as ${row.name}, but this checkout declares ${declared.name}`,
      );
    }
  }

  const latest = applied.at(-1);
  if (requireCurrentSchema && latest.version !== LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Backup schema is banking/${latest.version}; this checkout requires banking/${LATEST_SCHEMA_VERSION}`,
    );
  }
  return latest;
}

export function validateBankingDatabase(path, { requireCurrentSchema = true } = {}) {
  const database = new DatabaseSync(resolve(path), { readOnly: true });
  try {
    const integrity = database.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
      throw new Error(`SQLite integrity check failed: ${JSON.stringify(integrity)}`);
    }
    const migrationTable = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'blueballs_schema_migrations'",
      )
      .get();
    if (!migrationTable) {
      throw new Error("Backup is not a versioned Blueballs banking database");
    }
    const latest = validateMigrationHistory(database, { requireCurrentSchema });
    return {
      integrity: "ok",
      schema_component: "banking",
      schema_version: latest.version,
      schema_name: latest.name,
    };
  } finally {
    database.close();
  }
}

/** Create a consistent SQLite snapshot. VACUUM INTO reads a transactionally
 * consistent database image even when WAL mode is active. The source process may
 * remain online, but operators should schedule backups away from extreme write
 * pressure and must retain backups outside the primary failure domain. */
export async function backupBankingDatabase({ source, destination }) {
  const sourcePath = resolve(source);
  const destinationPath = resolve(destination);
  if (sourcePath === destinationPath) {
    throw new Error("Backup source and destination must be different paths");
  }
  if (!(await exists(sourcePath)))
    throw new Error(`Banking database not found: ${sourcePath}`);
  if (await exists(destinationPath)) {
    throw new Error(`Backup destination already exists: ${destinationPath}`);
  }
  await mkdir(dirname(destinationPath), { recursive: true });

  const database = new DatabaseSync(sourcePath);
  try {
    database.exec("PRAGMA wal_checkpoint(PASSIVE)");
    database.exec(`VACUUM INTO ${quoteSqlString(destinationPath)}`);
  } finally {
    database.close();
  }

  try {
    const verification = validateBankingDatabase(destinationPath);
    return { source: sourcePath, destination: destinationPath, ...verification };
  } catch (error) {
    await rm(destinationPath, { force: true });
    throw error;
  }
}

/** Restore a validated snapshot to a stopped/fenced Node banking runtime.
 * Copy-then-rename keeps a partial restore from becoming the active database. */
export async function restoreBankingDatabase({ backup, destination, force = false }) {
  const backupPath = resolve(backup);
  const destinationPath = resolve(destination);
  if (backupPath === destinationPath) {
    throw new Error("Backup and restore destination must be different paths");
  }
  if (!(await exists(backupPath)))
    throw new Error(`Backup not found: ${backupPath}`);
  const verification = validateBankingDatabase(backupPath);
  if ((await exists(destinationPath)) && !force) {
    throw new Error(
      `Restore destination already exists: ${destinationPath}; use --force only after fencing/stopping the banking runtime`,
    );
  }
  await mkdir(dirname(destinationPath), { recursive: true });
  const temp = `${destinationPath}.restore-${process.pid}-${randomBytes(6).toString("hex")}`;
  try {
    await copyFile(backupPath, temp);
    validateBankingDatabase(temp);
    if (force) await rm(destinationPath, { force: true });
    await rename(temp, destinationPath);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return { backup: backupPath, destination: destinationPath, ...verification };
}

export const CURRENT_BANKING_SCHEMA_VERSION = LATEST_SCHEMA_VERSION;
