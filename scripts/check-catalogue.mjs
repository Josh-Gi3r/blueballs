/** The docs page renders src/endpoints.ts, not the router. When they drift, the site
 *  quietly under-reports what the API actually serves — which is how three RFQ
 *  endpoints shipped without appearing anywhere a developer looks.
 *
 *  Run: node scripts/check-catalogue.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTE_DIR = "apps/api/src/routes";
const served = new Set();
for (const f of [...readdirSync(ROUTE_DIR).map((n) => join(ROUTE_DIR, n)), "apps/api/src/server.js"]) {
  if (!f.endsWith(".js")) continue;
  for (const m of readFileSync(f, "utf8").matchAll(/route\("([A-Z]+)",\s*"([^"]+)"/g)) {
    served.add(`${m[1]} ${m[2]}`);
  }
}

const cat = readFileSync("src/endpoints.ts", "utf8");
const listed = new Set(
  [...cat.matchAll(/verb:\s*"([A-Z]+)"\s*,\s*path:\s*"([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`)
);

// Infrastructure, not product surface — deliberately absent from the reference.
const INTERNAL = new Set(["GET /v2", "GET /v2/site/stats"]);

const undocumented = [...served].filter((r) => !listed.has(r) && !INTERNAL.has(r)).sort();
const phantom = [...listed].filter((r) => !served.has(r)).sort();

console.log(`served ${served.size} · documented ${listed.size} · internal ${INTERNAL.size}`);
if (undocumented.length) {
  console.log(`\nSERVED BUT UNDOCUMENTED (${undocumented.length}):`);
  for (const r of undocumented) console.log(`  ${r}`);
}
if (phantom.length) {
  console.log(`\nDOCUMENTED BUT NOT SERVED (${phantom.length}) — worse, this is a promise we do not keep:`);
  for (const r of phantom) console.log(`  ${r}`);
}
if (!undocumented.length && !phantom.length) console.log("\ncatalogue matches the router exactly");
process.exit(undocumented.length || phantom.length ? 1 : 0);
