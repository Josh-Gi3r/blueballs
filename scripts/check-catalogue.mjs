/** The docs page renders src/endpoints.ts, not the router. When they drift, the site
 *  quietly under-reports what the API actually serves — which is how three RFQ
 *  endpoints shipped without appearing anywhere a developer looks.
 *
 *  Run: node scripts/check-catalogue.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CREATED_OPERATIONS } from "../spec/banking/openapi/contracts.mjs";

const ROUTE_DIR = "apps/api/src/routes";
const served = new Set();
const runtimeCreated = new Set();
const opId = (verb, path) =>
  verb.toLowerCase() + path.replace(/^\/v2/, "").replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
for (const f of [...readdirSync(ROUTE_DIR).map((n) => join(ROUTE_DIR, n)), "apps/api/src/server.js"]) {
  if (!f.endsWith(".js")) continue;
  const source = readFileSync(f, "utf8");
  const registrations = [...source.matchAll(/route\("([A-Z]+)",\s*"([^"]+)"/g)];
  for (let i = 0; i < registrations.length; i++) {
    const m = registrations[i];
    served.add(`${m[1]} ${m[2]}`);
    const registration = source.slice(m.index, registrations[i + 1]?.index ?? source.length);
    if (/created:\s*true/.test(registration)) runtimeCreated.add(opId(m[1], m[2]));
  }
}

const cat = readFileSync("src/endpoints.ts", "utf8");
const catalogueRows = [...cat.matchAll(/verb:\s*"([A-Z]+)"\s*,\s*path:\s*"([^"]+)"[^\n]+access:\s*"(\w+)"/g)]
  .map((m) => ({ operation: `${m[1]} ${m[2]}`, access: m[3] }));
const listed = new Set(catalogueRows.map((row) => row.operation));
const validAccess = new Set(["PUBLIC", "TENANT", "OPERATOR", "GLOBAL_READ"]);
const invalidAccess = catalogueRows.filter((row) => !validAccess.has(row.access));
const catalogueOperationIds = new Set(catalogueRows.map((row) => {
  const [verb, ...path] = row.operation.split(" ");
  return opId(verb, path.join(" "));
}));
const undocumentedCreated = [...runtimeCreated].filter((operation) => !CREATED_OPERATIONS.has(operation)).sort();
const missingCreated = [...CREATED_OPERATIONS].filter((operation) => !runtimeCreated.has(operation)).sort();
const unknownCreated = [...CREATED_OPERATIONS].filter((operation) => !catalogueOperationIds.has(operation)).sort();

// Infrastructure, not product surface — deliberately absent from the reference.
const INTERNAL = new Set(["GET /v2", "GET /v2/site/stats"]);

const undocumented = [...served].filter((r) => !listed.has(r) && !INTERNAL.has(r)).sort();
const phantom = [...listed].filter((r) => !served.has(r)).sort();

console.log(`served ${served.size} · documented ${listed.size} · internal ${INTERNAL.size}`);
console.log(`access classes ${catalogueRows.length} · ${[...validAccess].map((access) => `${access}=${catalogueRows.filter((row) => row.access === access).length}`).join(" · ")}`);
if (undocumented.length) {
  console.log(`\nSERVED BUT UNDOCUMENTED (${undocumented.length}):`);
  for (const r of undocumented) console.log(`  ${r}`);
}
if (phantom.length) {
  console.log(`\nDOCUMENTED BUT NOT SERVED (${phantom.length}) — worse, this is a promise we do not keep:`);
  for (const r of phantom) console.log(`  ${r}`);
}
if (invalidAccess.length) {
  console.log(`\nINVALID ACCESS CLASS (${invalidAccess.length}):`);
  for (const row of invalidAccess) console.log(`  ${row.operation}: ${row.access}`);
}
if (undocumentedCreated.length || missingCreated.length || unknownCreated.length) {
  console.log("\nSUCCESS STATUS MISMATCH:");
  for (const operation of undocumentedCreated) console.log(`  router returns 201 but OpenAPI returns 200: ${operation}`);
  for (const operation of missingCreated) console.log(`  OpenAPI returns 201 but router returns 200: ${operation}`);
  for (const operation of unknownCreated) console.log(`  OpenAPI declares an unknown created operation: ${operation}`);
}
if (catalogueRows.length !== 174) console.log(`\nEXPECTED 174 ACCESS-CLASSIFIED OPERATIONS, FOUND ${catalogueRows.length}`);
if (!undocumented.length && !phantom.length && !invalidAccess.length && !undocumentedCreated.length && !missingCreated.length && !unknownCreated.length && catalogueRows.length === 174) {
  console.log("\ncatalogue matches the router, including access classes and success statuses");
}
process.exit(undocumented.length || phantom.length || invalidAccess.length || undocumentedCreated.length || missingCreated.length || unknownCreated.length || catalogueRows.length !== 174 ? 1 : 0);
