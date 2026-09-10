/** Final production schema layer consumed by generated OpenAPI and runtime validation. */
import { EFFECTIVE_SCHEMAS } from "./effective-contracts.mjs";
import { KEY_PERMISSIONS } from "../key-permission-catalog.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const open = (properties = {}, required = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  ...(required.length ? { required } : {}),
});
const permissionArray = {
  type: "array",
  items: { type: "string", enum: ["*", ...KEY_PERMISSIONS] },
  minItems: 1,
};

export const PRODUCTION_SCHEMAS = {
  ...EFFECTIVE_SCHEMAS,
  KeyPrincipal: open(
    {
      id: ref("Identifier"),
      tenant_id: ref("Identifier"),
      email: { type: ["string", "null"], format: "email" },
      scope: { type: "string" },
      permissions: permissionArray,
      created_at: ref("Timestamp"),
      expires: ref("Timestamp"),
    },
    ["id", "tenant_id", "scope", "permissions", "created_at"],
  ),
  KeySecret: open(
    {
      id: ref("Identifier"),
      tenant_id: ref("Identifier"),
      key: { type: "string" },
      scope: { type: "string" },
      permissions: permissionArray,
      created_at: ref("Timestamp"),
      expires: ref("Timestamp"),
      note: { type: "string" },
    },
    ["id", "tenant_id", "key", "scope", "permissions", "created_at", "expires"],
  ),
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
