#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const output = resolve(process.argv[2] ?? "artifacts/blueballs-sbom.cdx.json");

function run(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    if (optional) return null;
    process.stderr.write(
      result.stderr || result.stdout || `${command} failed\n`,
    );
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

function versionFromNode(node) {
  if (!node || typeof node !== "object") return "unknown";
  return String(node.version ?? node.resolved ?? "unknown").replace(
    /^link:/,
    "workspace:",
  );
}

const listed = JSON.parse(
  run("pnpm", ["list", "-r", "--json", "--depth", "Infinity"]) || "[]",
);
const components = new Map();

function add(name, version, type = "library", properties = []) {
  if (!name) return;
  const key = `${type}:${name}@${version}`;
  if (components.has(key)) return;
  const encoded = encodeURIComponent(name).replace(/%2F/g, "/");
  components.set(key, {
    type,
    name,
    version,
    ...(type === "library" && !version.startsWith("workspace:")
      ? { purl: `pkg:npm/${encoded}@${encodeURIComponent(version)}` }
      : {}),
    ...(properties.length ? { properties } : {}),
  });
}

function walkDependencies(group, scope) {
  if (!group || typeof group !== "object") return;
  for (const [name, node] of Object.entries(group)) {
    const version = versionFromNode(node);
    add(name, version, "library", [{ name: "blueballs:scope", value: scope }]);
    if (node && typeof node === "object") {
      walkDependencies(node.dependencies, "runtime");
      walkDependencies(node.optionalDependencies, "optional");
    }
  }
}

for (const project of listed) {
  const name = project.name ?? project.path ?? "blueballs-workspace";
  add(name, String(project.version ?? "0.0.0"), "application", [
    { name: "blueballs:path", value: String(project.path ?? "") },
  ]);
  walkDependencies(project.dependencies, "runtime");
  walkDependencies(project.optionalDependencies, "optional");
  walkDependencies(project.devDependencies, "development");
}

let makefile = "";
try {
  makefile = readFileSync("packages/fx-contracts/Makefile", "utf8");
} catch {
  // JavaScript inventory remains usable when the contract package is absent.
}
const oz = makefile.match(/^OZ_VERSION\s*:=\s*(.+)$/m)?.[1]?.trim();
const forgeStd = makefile
  .match(/^FORGE_STD_VERSION\s*:=\s*(.+)$/m)?.[1]
  ?.trim();
if (oz)
  add("openzeppelin-contracts", oz, "library", [
    { name: "blueballs:ecosystem", value: "solidity" },
  ]);
if (forgeStd)
  add("forge-std", forgeStd, "library", [
    { name: "blueballs:ecosystem", value: "foundry" },
  ]);

const gitCommit =
  run("git", ["rev-parse", "HEAD"], { optional: true }) ?? "unknown";
const gitTimestamp =
  run("git", ["show", "-s", "--format=%cI", "HEAD"], { optional: true }) ??
  new Date(0).toISOString();
const forgeVersion = run("forge", ["--version"], { optional: true });
const serialHex = createHash("sha256")
  .update(`blueballs:${gitCommit}`)
  .digest("hex")
  .slice(0, 32);
const serialUuid = `${serialHex.slice(0, 8)}-${serialHex.slice(8, 12)}-${serialHex.slice(12, 16)}-${serialHex.slice(16, 20)}-${serialHex.slice(20)}`;

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${serialUuid}`,
  version: 1,
  metadata: {
    timestamp: gitTimestamp,
    tools: {
      components: [
        { type: "application", name: "node", version: process.version },
        ...(forgeVersion
          ? [{ type: "application", name: "foundry", version: forgeVersion }]
          : []),
      ],
    },
    component: {
      type: "application",
      name: "blueballs",
      version: "0.1.0",
      properties: [
        { name: "blueballs:git-commit", value: gitCommit },
        {
          name: "blueballs:inventory-source",
          value: "pnpm locked workspace plus pinned Foundry libraries",
        },
      ],
    },
  },
  components: [...components.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  ),
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(bom, null, 2)}\n`);
console.log(output);
