#!/usr/bin/env node
import { spawn } from "node:child_process";

const commands = [
  [
    "banking",
    [
      "exec",
      "wrangler",
      "dev",
      "-c",
      "wrangler.api.jsonc",
      "--port",
      "5381",
      "--inspector-port",
      "9331",
      "--local",
      "--persist-to",
      ".wrangler/state/banking",
    ],
  ],
  [
    "fx",
    [
      "exec",
      "wrangler",
      "dev",
      "-c",
      "wrangler.fx.jsonc",
      "--port",
      "5382",
      "--inspector-port",
      "9332",
      "--local",
      "--persist-to",
      ".wrangler/state/fx",
      "--var",
      `FX_API_KEY:${process.env.FX_API_KEY ?? "bb_test_local_fx"}`,
    ],
  ],
];
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(code), 250).unref();
}

function start(label, args) {
  const child = spawn("pnpm", args, { stdio: "inherit", env: process.env });
  children.push(child);
  child.once("exit", (code, signal) => {
    if (stopping || signal === "SIGINT") return;
    console.error(`${label} Cloudflare preview exited (${code ?? signal})`);
    stop(code || 1);
  });
}

for (const [label, args] of commands) start(label, args);

// Wrangler's local service registry connects the site binding to the two named
// Workers above. Staggering the site avoids a transient not-connected state.
setTimeout(
  () =>
    start("site", [
      "exec",
      "wrangler",
      "dev",
      "-c",
      "wrangler.jsonc",
      "--port",
      "5380",
      "--inspector-port",
      "9330",
      "--persist-to",
      ".wrangler/state/site",
      "--var",
      "LOCAL_DEV:true",
    ]),
  750,
);

console.log("Cloudflare preview → http://localhost:5380");
console.log("Banking Worker    → http://localhost:5381");
console.log("FX Worker         → http://localhost:5382");
console.log(
  "Local FX key      →",
  process.env.FX_API_KEY ? "from FX_API_KEY" : "bb_test_local_fx",
);

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
