#!/usr/bin/env node
import { backupBankingDatabase } from "./lib/banking-recovery.mjs";

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--db") out.source = argv[++i];
    else if (value === "--out") out.destination = argv[++i];
    else throw new Error(`Unknown argument ${value}`);
  }
  if (!out.source || !out.destination) {
    throw new Error("Usage: node scripts/backup-banking.mjs --db <blueballs.sqlite> --out <backup.sqlite>");
  }
  return out;
}

try {
  const result = await backupBankingDatabase(args(process.argv.slice(2)));
  console.log(JSON.stringify({ operation: "backup", ...result }, null, 2));
} catch (error) {
  console.error(error?.message ?? error);
  process.exit(1);
}
