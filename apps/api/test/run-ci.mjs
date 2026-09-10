#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FAMILIES } from "../../../src/endpoints.ts";
import { ADAPTER_REQUIRED_OPERATIONS } from "../../../spec/banking/openapi/contracts.mjs";

const root = resolve(new URL("..", import.meta.url).pathname, "..");
const workspaceRoot = resolve(root, "../..");
const temp = await mkdtemp(join(tmpdir(), "blueballs-operation-coverage-"));
const coverageFile = join(temp, "success.ndjson");

const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const catalogue = FAMILIES.flatMap(({ name: family, endpoints }) =>
  endpoints.map((endpoint) => ({
    family,
    ...endpoint,
    operationId: opId(endpoint.verb, endpoint.path),
  })),
);

function run(command, args, options = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        OPERATION_COVERAGE_FILE: coverageFile,
        ...options.env,
      },
      stdio: "inherit",
    });
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

try {
  const files = (await readdir(join(root, "test")))
    .filter((name) => name.endsWith(".test.js"))
    .sort()
    .map((name) => join("test", name));

  const result = await run(process.execPath, ["--test", ...files]);
  if (result.code !== 0) process.exit(result.code ?? 1);

  let rows = [];
  try {
    rows = (await readFile(coverageFile, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const successes = new Map();
  for (const row of rows) successes.set(row.operationId, row);

  const successRequired = catalogue.filter(
    ({ operationId }) => !ADAPTER_REQUIRED_OPERATIONS.has(operationId),
  );
  const missingSuccess = successRequired.filter(
    ({ operationId }) => !successes.has(operationId),
  );

  // Adapter-required operations are proven by the dedicated catalogue/runtime
  // and product tests returning 503, not by fabricating a successful card-vault
  // response. Their explicit classification is part of the report.
  const report = {
    generated_at: new Date().toISOString(),
    catalogue_operations: catalogue.length,
    success_required: successRequired.length,
    adapter_required: [...ADAPTER_REQUIRED_OPERATIONS].sort(),
    successful_operations: [...successes.keys()].sort(),
    successful_count: successes.size,
    missing_success: missingSuccess.map(({ operationId, verb, path, family }) => ({
      operationId,
      verb,
      path,
      family,
    })),
  };

  const artifactDir = join(workspaceRoot, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const artifact = join(artifactDir, "api-operation-coverage.json");
  await writeFile(artifact, JSON.stringify(report, null, 2) + "\n");

  if (missingSuccess.length) {
    console.error(
      `\nAPI success coverage incomplete: ${successes.size}/${successRequired.length} non-adapter operations produced a successful validated response.`,
    );
    for (const row of missingSuccess)
      console.error(`  ${row.operationId} — ${row.verb} ${row.path}`);
    console.error(`Coverage artifact: ${artifact}`);
    process.exit(1);
  }

  console.log(
    `\nAPI operation proof: ${successRequired.length}/${successRequired.length} success-required operations returned schema-valid 2xx responses; ${ADAPTER_REQUIRED_OPERATIONS.size} adapter-required operations remain fail-closed by contract.`,
  );
  console.log(`Coverage artifact: ${artifact}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
