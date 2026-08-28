#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const target = process.argv[2] ?? "all";
const configs = {
  api: "wrangler.api.jsonc",
  fx: "wrangler.fx.jsonc",
  site: "wrangler.jsonc",
};
if (target !== "all" && !configs[target]) {
  console.error("Usage: node scripts/deploy-cloudflare.mjs [api|fx|site|all]");
  process.exit(1);
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status || 1);
  }
  return capture ? result.stdout.trim() : "";
}

const requiredNode = readFileSync(
  new URL("../.node-version", import.meta.url),
  "utf8",
).trim();
if (process.versions.node !== requiredNode) {
  console.error(
    `Deploy requires Node ${requiredNode}; current runtime is ${process.versions.node}.`,
  );
  process.exit(1);
}
const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const requiredPnpm = String(packageManifest.packageManager ?? "").match(
  /^pnpm@(.+)$/,
)?.[1];
const currentPnpm = run("pnpm", ["--version"], { capture: true });
if (!requiredPnpm || currentPnpm !== requiredPnpm) {
  console.error(
    `Deploy requires pnpm ${requiredPnpm || "declared in package.json"}; current runtime is ${currentPnpm}.`,
  );
  process.exit(1);
}
const dirty = run("git", ["status", "--porcelain"], { capture: true });
if (dirty) {
  console.error("Deploy requires a clean worktree.");
  process.exit(1);
}
const sha = run("git", ["rev-parse", "HEAD"], { capture: true });
const published = run("git", ["rev-parse", "origin/main"], { capture: true });
if (sha !== published) {
  console.error(
    `Deploy requires HEAD to equal origin/main (${sha} != ${published}).`,
  );
  process.exit(1);
}

if (target === "all" || target === "fx") {
  const secrets = JSON.parse(
    run("pnpm", ["exec", "wrangler", "secret", "list", "-c", configs.fx], {
      capture: true,
    }),
  );
  if (!secrets.some((secret) => secret.name === "FX_API_KEY")) {
    console.error(
      "Deploy requires the FX_API_KEY Cloudflare secret for blueballs-fx.",
    );
    process.exit(1);
  }
}

if (target === "all") run("pnpm", ["verify"]);
for (const name of target === "all" ? ["api", "fx", "site"] : [target]) {
  run("pnpm", [
    "exec",
    "wrangler",
    "deploy",
    "-c",
    configs[name],
    "--var",
    `BLUEBALLS_GIT_SHA:${sha}`,
  ]);
}

async function verifyLiveParity(expectedSha) {
  const paths = ["/api/health", "/v2", "/fx-health"];
  let lastFailure = "live endpoints did not answer";
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const responses = await Promise.all(
        paths.map((path) =>
          fetch(`https://blueballs.tech${path}?deploy=${expectedSha}`, {
            headers: { "cache-control": "no-cache" },
            signal: AbortSignal.timeout(10_000),
          }),
        ),
      );
      const bodies = await Promise.all(
        responses.map((response) =>
          response
            .clone()
            .json()
            .catch(() => ({})),
        ),
      );
      const headersMatch = responses.every(
        (response) =>
          response.headers.get("x-blueballs-source-commit") === expectedSha,
      );
      const health = bodies[0];
      const bodiesMatch =
        health.source_commit === expectedSha &&
        health.banking_source_commit === expectedSha &&
        health.fx_source_commit === expectedSha &&
        bodies[1].source_commit === expectedSha &&
        bodies[2].source_commit === expectedSha;
      if (
        responses.every((response) => response.ok) &&
        health.deployment_consistent === true &&
        headersMatch &&
        bodiesMatch
      )
        return;
      lastFailure = JSON.stringify({
        statuses: responses.map((response) => response.status),
        health,
        headersMatch,
        bodiesMatch,
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(
    `Deployment did not converge on ${expectedSha}: ${lastFailure}`,
  );
}

if (target === "all") await verifyLiveParity(sha);
console.log(`Deployed ${target} from ${sha}.`);
