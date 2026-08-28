#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const suites = [
  "packages/sqlite-compat",
  "packages/fx-market",
  "packages/fx-pricing",
  "packages/fx-liquidity",
  "packages/fx-policy",
  "packages/fx-fiat",
  "packages/fx-monetary",
  "packages/fx-sdk",
  "packages/fx-simulator",
  "apps/fx-node",
];

for (const cwd of suites) {
  console.log(`\n== ${cwd} ==`);
  const result = spawnSync("npm", ["run", "test:ci"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
