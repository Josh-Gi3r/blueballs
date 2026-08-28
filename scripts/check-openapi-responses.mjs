/** Fail when catalogue operations and success-response contracts drift. */
import { FAMILIES } from "../src/endpoints.ts";
import {
  PAGINATED_RESPONSE_OPERATIONS,
  RESPONSE_LIST_OPERATIONS,
  RESPONSE_SCHEMA_OVERRIDES,
  responseContractFor,
} from "../spec/banking/openapi/response-contracts.mjs";
import { ADAPTER_REQUIRED_OPERATIONS } from "../spec/banking/openapi/contracts.mjs";

const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const operations = new Map();
const failures = [];
for (const { name: family, endpoints } of FAMILIES) {
  for (const { verb, path } of endpoints) {
    const operationId = opId(verb, path);
    if (ADAPTER_REQUIRED_OPERATIONS.has(operationId)) {
      operations.set(operationId, {
        verb,
        path,
        family,
        adapterRequired: true,
      });
      continue;
    }
    const contract = responseContractFor({ operationId, verb, family });
    operations.set(operationId, { verb, path, family, contract });
    if (!contract?.schema || contract.example === undefined)
      failures.push(`${operationId}: missing response schema or example`);
    if (!contract?.description)
      failures.push(`${operationId}: missing response description`);
    if (
      RESPONSE_LIST_OPERATIONS.has(operationId) &&
      contract.schema?.properties?.data?.type !== "array"
    ) {
      failures.push(
        `${operationId}: classified as a collection without an array data envelope`,
      );
    }
  }
}

for (const operationId of RESPONSE_LIST_OPERATIONS) {
  if (!operations.has(operationId))
    failures.push(
      `${operationId}: list contract exists for no catalogue operation`,
    );
}
for (const operationId of PAGINATED_RESPONSE_OPERATIONS) {
  if (!RESPONSE_LIST_OPERATIONS.has(operationId))
    failures.push(
      `${operationId}: paginated response is not classified as a list`,
    );
}
for (const operationId of Object.keys(RESPONSE_SCHEMA_OVERRIDES)) {
  if (!operations.has(operationId))
    failures.push(
      `${operationId}: response override exists for no catalogue operation`,
    );
}
for (const operationId of ADAPTER_REQUIRED_OPERATIONS) {
  if (!operations.has(operationId))
    failures.push(
      `${operationId}: adapter-required contract exists for no catalogue operation`,
    );
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
  const actual = operations
    .get(operationId)
    ?.contract.schema?.$ref?.split("/")
    .at(-1);
  if (actual !== schema)
    failures.push(
      `${operationId}: expected ${schema}, got ${actual ?? "inline/none"}`,
    );
}

if (failures.length) {
  console.error(`response-contract drift (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

const successCount = operations.size - ADAPTER_REQUIRED_OPERATIONS.size;
console.log(
  `response contracts: ${successCount} success schemas · ${ADAPTER_REQUIRED_OPERATIONS.size} fail-closed adapter contracts · ${RESPONSE_LIST_OPERATIONS.size} typed collections`,
);
