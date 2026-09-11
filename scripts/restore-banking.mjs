#!/usr/bin/env node
import { restoreBankingDatabase } from "./lib/banking-recovery.mjs";

function args(argv) {
  const out = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--backup") out.backup = argv[++i];
    else if (value === "--db" || value === "--destination")
      out.destination = argv[++i];
    else if (value === "--force") out.force = true;
    else throw new Error(`Unknown argument ${value}`);
  }
  if (!out.backup || !out.destination) {
    throw new Error(
      "Usage: node scripts/restore-banking.mjs --backup <backup.sqlite> (--db|--destination) <blueballs.sqlite> [--force]",
    );
  }
  return out;
}

try {
  const result = await restoreBankingDatabase(args(process.argv.slice(2)));
  console.log(JSON.stringify({ operation: "restore", ...result }, null, 2));
} catch (error) {
  console.error(error?.message ?? error);
  process.exit(1);
}
