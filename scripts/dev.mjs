#!/usr/bin/env node
/** One-command dev: starts the site (vite, :5280) and the API (:5290) together,
 *  zero new dependencies. `pnpm dev` from the repo root runs this. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const procs = [
  {
    name: "site",
    color: "\x1b[36m", // cyan
    cmd: "pnpm",
    args: ["exec", "vite"],
    cwd: ROOT,
  },
  {
    name: "api",
    color: "\x1b[35m", // magenta
    cmd: "node",
    args: ["src/server.js"],
    cwd: join(ROOT, "apps", "api"),
    env: { PORT: "5290" },
  },
];

const RESET = "\x1b[0m";
const children = [];
let shuttingDown = false;

function prefixLines(name, color, chunk) {
  const text = chunk.toString();
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => `${color}[${name}]${RESET} ${l}`).join("\n") + "\n";
}

for (const p of procs) {
  const child = spawn(p.cmd, p.args, {
    cwd: p.cwd,
    env: { ...process.env, ...(p.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stdout.on("data", (d) => process.stdout.write(prefixLines(p.name, p.color, d)));
  child.stderr.on("data", (d) => process.stderr.write(prefixLines(p.name, p.color, d)));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(`${p.color}[${p.name}]${RESET} exited (${code}) — stopping the other process too`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) if (!c.killed) c.kill("SIGTERM");
  setTimeout(() => process.exit(code ?? 0), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Site  → http://localhost:5280\nAPI   → http://localhost:5290/v2\n`);
