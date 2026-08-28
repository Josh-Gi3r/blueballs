/** Fail when runtime write routes and OpenAPI request contracts drift. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BODYLESS_OPERATIONS } from "../spec/banking/openapi/contracts.mjs";
import { REQUEST_BODIES } from "../spec/banking/openapi/request-contracts.mjs";

const routeDir = "apps/api/src/routes";
const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
const failures = [];
let writes = 0;
let documentedBodies = 0;
const runtimeOperations = new Set();

for (const file of [
  ...readdirSync(routeDir).map((name) => join(routeDir, name)),
  "apps/api/src/server.js",
]) {
  if (!file.endsWith(".js")) continue;
  const source = readFileSync(file, "utf8");
  const routes = [...source.matchAll(/route\(\s*"([A-Z]+)",\s*"([^"]+)"/g)];
  for (let index = 0; index < routes.length; index++) {
    const [, verb, path] = routes[index];
    const operation = opId(verb, path);
    runtimeOperations.add(operation);
    if (["GET", "DELETE"].includes(verb)) continue;
    writes++;
    const registration = source.slice(
      routes[index].index,
      routes[index + 1]?.index ?? source.length,
    );
    const request = REQUEST_BODIES[operation];
    const bodyless = BODYLESS_OPERATIONS.has(operation);
    if (request && bodyless)
      failures.push(
        `${operation}: declared both bodyless and with a request contract`,
      );
    if (!request && !bodyless)
      failures.push(`${operation}: missing request contract`);
    if (bodyless && /\bbody\s*\./.test(registration))
      failures.push(
        `${operation}: runtime reads body fields but OpenAPI declares no body`,
      );
    if (!request) continue;
    documentedBodies++;
    if (request.schema?.type !== "object")
      failures.push(`${operation}: top-level request schema must be an object`);
    const runtimeRequired = [
      ...registration.matchAll(/need\(body,\s*\[([^\]]*)\]\)/g),
    ].flatMap((match) =>
      [...match[1].matchAll(/"([^"]+)"/g)].map((field) => field[1]),
    );
    const documentedRequired = new Set(request.schema?.required ?? []);
    for (const field of runtimeRequired) {
      if (!documentedRequired.has(field))
        failures.push(
          `${operation}: runtime requires ${field}, request schema does not`,
        );
    }
    if (runtimeRequired.length && request.required === false)
      failures.push(
        `${operation}: runtime requires fields but requestBody is optional`,
      );
  }
}

const classified = new Set([
  ...BODYLESS_OPERATIONS,
  ...Object.keys(REQUEST_BODIES),
]);
for (const operation of classified) {
  if (!runtimeOperations.has(operation))
    failures.push(`${operation}: contract exists for no runtime write route`);
}

if (failures.length) {
  console.error(`request-contract drift (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `request contracts: ${writes} write operations · ${documentedBodies} JSON bodies · ${writes - documentedBodies} bodyless`,
);
