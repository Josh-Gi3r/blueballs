/** Fail when catalogue operations and success-response contracts drift. */
import { readFileSync } from "node:fs";
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  RESPONSE_SCHEMA_OVERRIDES,
  responseContractFor,
} from "../spec/banking/openapi/response-contracts.mjs";

const source = readFileSync("src/endpoints.ts", "utf8");
const familyRe = /name:\s*"([^"]+)",\s*blurb:\s*"[^"]*"\s*,?\s*\n\s*endpoints:\s*\[([\s\S]*?)\n\s*\],/g;
const endpointRe = /\{\s*verb:\s*"([A-Z]+)",\s*path:\s*"([^"]+)",\s*does:\s*"(?:[^"\\]|\\.)*",\s*access:\s*"[A-Z_]+"\s*\}/g;
const opId = (verb, path) =>
  verb.toLowerCase() + path.replace(/^\/v2/, "").replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");

const operations = new Map();
const failures = [];
for (const [, family, body] of source.matchAll(familyRe)) {
  for (const [, verb, path] of body.matchAll(endpointRe)) {
    const operationId = opId(verb, path);
    const contract = responseContractFor({ operationId, verb, family });
    operations.set(operationId, { verb, path, family, contract });
    if (!contract?.schema || contract.example === undefined) failures.push(`${operationId}: missing response schema or example`);
    if (!contract?.description) failures.push(`${operationId}: missing response description`);
    if (RESPONSE_LIST_OPERATIONS.has(operationId) && contract.schema?.properties?.data?.type !== "array") {
      failures.push(`${operationId}: classified as a collection without an array data envelope`);
    }
  }
}

for (const operationId of RESPONSE_LIST_OPERATIONS) {
  if (!operations.has(operationId)) failures.push(`${operationId}: list contract exists for no catalogue operation`);
}
for (const operationId of PAGINATED_RESPONSE_OPERATIONS) {
  if (!RESPONSE_LIST_OPERATIONS.has(operationId)) failures.push(`${operationId}: paginated response is not classified as a list`);
}
for (const operationId of Object.keys(RESPONSE_SCHEMA_OVERRIDES)) {
  if (!operations.has(operationId)) failures.push(`${operationId}: response override exists for no catalogue operation`);
}

const expectedTransitions = {
  postApplicationsIdSubmit: "Application",
  postTransfersIdCancel: "Transfer",
  postCardsIdUnfreeze: "Card",
  postAuthorisationsIdApprove: "Authorisation",
  postWebhooksDeliveriesDidReplay: "WebhookDelivery",
  postWalletsIdSend: "WalletSend",
  postQrGenerate: "QrCode",
  postQrDecode: "QrDecode",
  postMandates: "Mandate",
};
for (const [operationId, schema] of Object.entries(expectedTransitions)) {
  const actual = operations.get(operationId)?.contract.schema?.$ref?.split("/").at(-1);
  if (actual !== schema) failures.push(`${operationId}: expected ${schema}, got ${actual ?? "inline/none"}`);
}

if (failures.length) {
  console.error(`response-contract drift (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`response contracts: ${operations.size} success schemas · ${operations.size} examples · ${RESPONSE_LIST_OPERATIONS.size} typed collections`);
