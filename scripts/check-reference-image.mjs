/** Static guard for files and commands required by the reference container. */
import { readFileSync } from "node:fs";

const dockerfile = readFileSync("Dockerfile.reference", "utf8");
const compose = readFileSync("compose.reference.yml", "utf8");
const failures = [];

for (const directory of ["apps", "packages", "scripts", "spec", "src", "public"]) {
  if (!dockerfile.includes(`COPY ${directory} ./${directory}`)) {
    failures.push(`Dockerfile.reference does not copy ${directory}/`);
  }
}
for (const command of [
  'command: ["node", "apps/fx-node/src/cli.js"]',
  'command: ["node", "apps/api/src/server.js"]',
  'command: ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "5280"]',
]) {
  if (!compose.includes(command)) failures.push(`compose.reference.yml omits ${command}`);
}
if (!compose.includes("Dockerfile.reference") || !compose.includes("condition: service_healthy")) {
  failures.push("reference Compose does not build the pinned image or gate the site on healthy APIs");
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("reference image contract: API, FX, site and public assets are packaged; service health ordering is explicit");
