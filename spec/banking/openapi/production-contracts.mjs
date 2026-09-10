/** Final production schema layer consumed by generated OpenAPI and runtime validation. */
import { EFFECTIVE_SCHEMAS } from "./effective-contracts.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const open = (properties = {}, required = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  ...(required.length ? { required } : {}),
});

export const PRODUCTION_SCHEMAS = {
  ...EFFECTIVE_SCHEMAS,
  Attestation: open(
    {
      id: ref("Identifier"),
      statement: { type: "string" },
      agreed: { type: "boolean", const: true },
      agreed_at: ref("Timestamp"),
    },
    ["id", "statement", "agreed", "agreed_at"],
  ),
  ApprovalChain: open(
    {
      id: ref("Identifier"),
      name: { type: "string" },
      threshold: ref("Money"),
      approvers: { type: "array", items: ref("Identifier") },
      steps: { type: "integer", minimum: 1 },
      resource: { type: ["object", "null"], additionalProperties: true },
      created_at: ref("Timestamp"),
    },
    ["id", "name", "threshold", "approvers", "steps", "created_at"],
  ),
};
