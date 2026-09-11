/** Executable request validation for the production banking contract. */
import { ApiError } from "./lib.js";
import { BODYLESS_OPERATIONS } from "../../../spec/banking/openapi/contracts.mjs";
import { PRODUCTION_SCHEMAS } from "../../../spec/banking/openapi/production-contracts.mjs";
import { REQUEST_BODIES } from "../../../spec/banking/openapi/production-request-contracts.mjs";
import { schemaErrors } from "./json-schema-lite.js";

const operationId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

function qrTlvEntries(value, context) {
  const input = String(value ?? "");
  const entries = new Map();
  let offset = 0;
  while (offset < input.length) {
    if (offset + 4 > input.length) return null;
    const tag = input.slice(offset, offset + 2);
    const lengthText = input.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) return null;
    const length = Number(lengthText);
    offset += 4;
    if (offset + length > input.length) return null;
    if (entries.has(tag)) {
      throw new ApiError(
        "validation-error",
        400,
        `EMVCo QR contains duplicate tag ${tag} in ${context}; duplicate tags are ambiguous and rejected`,
        [
          {
            field: "payload",
            message: `duplicate EMVCo tag ${tag} in ${context}`,
            code: "duplicate_tag",
          },
        ],
      );
    }
    entries.set(tag, input.slice(offset, offset + length));
    offset += length;
  }
  return entries;
}

function validateQrPayloadUniqueness(payload) {
  const top = qrTlvEntries(payload, "top-level payload");
  if (!top) return;
  for (const tag of ["26", "62"]) {
    const nested = top.get(tag);
    if (nested !== undefined) qrTlvEntries(nested, `tag ${tag}`);
  }
}

export function validateRequestBody(method, pattern, body) {
  if (!["POST", "PATCH", "PUT"].includes(method)) return body;
  const id = operationId(method, pattern);

  if (BODYLESS_OPERATIONS.has(id)) {
    if (body && Object.keys(body).length) {
      throw new ApiError(
        "validation-error",
        400,
        `${method} ${pattern} does not accept a JSON request body`,
      );
    }
    return body;
  }

  const contract = REQUEST_BODIES[id];
  if (!contract) return body; // internal/non-catalogue helper; its handler validates explicitly
  if (contract.required === false && (!body || Object.keys(body).length === 0)) {
    return body;
  }

  const errors = schemaErrors(body ?? {}, contract.schema, PRODUCTION_SCHEMAS);
  if (errors.length) {
    throw new ApiError(
      "validation-error",
      400,
      `Request body does not match the contract for ${method} ${pattern}`,
      errors.slice(0, 20).map((message) => ({
        field: message.split(":", 1)[0].replace(/^\$\.?/, "") || "body",
        message,
        code: "schema_violation",
      })),
    );
  }

  if (method === "POST" && pattern === "/v2/qr/decode") {
    validateQrPayloadUniqueness(body.payload);
  }
  return body;
}
