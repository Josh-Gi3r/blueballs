import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "blueballs-banking-sdk-"));
const output = join(directory, "banking-api.d.ts");
try {
  const generated = spawnSync(
    "pnpm",
    ["exec", "openapi-typescript", "public/openapi.yaml", "--output", output],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (generated.status !== 0)
    throw new Error(
      generated.stderr || generated.stdout || "openapi-typescript failed",
    );
  const declaration = await readFile(output, "utf8");
  for (const requiredOperation of [
    "postAuthSignup",
    "postQuotesIdExecute",
    "postCreditIdDraw",
    "postWalletsIdSend",
  ]) {
    if (!declaration.includes(requiredOperation))
      throw new Error(`generated declarations omit ${requiredOperation}`);
  }
  const checked = spawnSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "--noEmit",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      output,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (checked.status !== 0)
    throw new Error(
      checked.stderr ||
        checked.stdout ||
        "generated declarations do not compile",
    );
  console.log(
    `banking SDK proof: generated and compiled ${declaration.split("\n").length} lines of TypeScript declarations`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
