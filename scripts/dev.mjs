#!/usr/bin/env node
/** One-command development stack.
 *
 * `pnpm dev` starts:
 *   - the Blueballs site on :5280;
 *   - the general banking API on :5290;
 *   - the canonical FX reference node on :8788.
 *
 * The Vite process receives only the local sandbox FX credential. Production
 * credentials must never be embedded into a browser build.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) loadEnvFile(envFile);
const FX_KEY = process.env.FX_NODE_API_KEY ?? "bb_test_local_fx";
const FX_BASE = process.env.VITE_FX_NODE_BASE ?? "http://127.0.0.1:8788";

const procs = [
  {
    name: "site",
    color: "\x1b[36m", // cyan
    cmd: "pnpm",
    args: ["exec", "vite"],
    cwd: ROOT,
    env: {
      VITE_FX_NODE_BASE: FX_BASE,
      VITE_FX_NODE_KEY: FX_KEY,
    },
  },
  {
    name: "api",
    color: "\x1b[35m", // magenta
    cmd: "node",
    args: ["src/server.js"],
    cwd: join(ROOT, "apps", "api"),
    env: {
      PORT: process.env.PORT ?? "5290",
      CORS_ORIGINS:
        process.env.CORS_ORIGINS ??
        "http://localhost:5280,http://127.0.0.1:5280",
      RATE_LIMIT_PER_MIN: process.env.RATE_LIMIT_PER_MIN ?? "300",
    },
  },
  {
    name: "fx",
    color: "\x1b[33m", // yellow
    cmd: "node",
    args: ["src/cli.js"],
    cwd: join(ROOT, "apps", "fx-node"),
    env: {
      FX_NODE_MODE: process.env.FX_NODE_MODE ?? "reference-sandbox",
      FX_NODE_HOST: process.env.FX_NODE_HOST ?? "127.0.0.1",
      FX_NODE_PORT: process.env.FX_NODE_PORT ?? "8788",
      FX_NODE_API_KEY: FX_KEY,
      FX_NODE_DATA_DIR:
        process.env.FX_NODE_DATA_DIR ?? join(ROOT, ".data", "fx-reference"),
    },
  },
];

const RESET = "\x1b[0m";
const children = [];
let shuttingDown = false;

function prefixLines(name, color, chunk) {
  const text = chunk.toString();
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return (
    lines.map((line) => `${color}[${name}]${RESET} ${line}`).join("\n") + "\n"
  );
}

for (const processConfig of procs) {
  const child = spawn(processConfig.cmd, processConfig.args, {
    cwd: processConfig.cwd,
    env: { ...process.env, ...(processConfig.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stdout.on("data", (data) =>
    process.stdout.write(
      prefixLines(processConfig.name, processConfig.color, data),
    ),
  );
  child.stderr.on("data", (data) =>
    process.stderr.write(
      prefixLines(processConfig.name, processConfig.color, data),
    ),
  );
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(
        `${processConfig.color}[${processConfig.name}]${RESET} exited (${code}) — stopping the other processes too`,
      );
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code ?? 0), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(
  `Site  → http://localhost:5280\n` +
    `API   → http://localhost:5290/v2\n` +
    `FX    → http://localhost:8788\n` +
    `FX key→ ${FX_KEY}\n`,
);
