/** Final production request contracts consumed by OpenAPI generation/checks. */
import { REQUEST_BODIES as LEGACY_REQUEST_BODIES } from "./request-contracts.mjs";
import { KEY_PERMISSIONS } from "../key-permission-catalog.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const string = (description, extra = {}) => ({ type: "string", description, ...extra });
const integer = (description, extra = {}) => ({ type: "integer", description, ...extra });
const array = (items, description) => ({
  type: "array",
  items,
  ...(description ? { description } : {}),
});
const obj = (properties = {}, required = [], additionalProperties = false) => ({
  type: "object",
  additionalProperties,
  properties,
  ...(required.length ? { required } : {}),
});

export const REQUEST_BODIES = {
  ...LEGACY_REQUEST_BODIES,

  postKeys: {
    required: false,
    schema: obj({
      scope: string("Requested key scope; cannot exceed the caller scope"),
      lifetime_hours: integer("Key lifetime in hours", {
        minimum: 1,
        maximum: 168,
        default: 24,
      }),
      permissions: array(
        {
          type: "string",
          enum: ["*", ...KEY_PERMISSIONS],
        },
        "Least-privilege permissions. Omit to inherit the parent key; a restricted key cannot grant permissions it does not hold.",
      ),
    }),
  },

  postStatements: {
    required: true,
    schema: obj(
      {
        account: ref("Identifier"),
        format: { type: "string", enum: ["json", "csv", "pdf"] },
        from: ref("Timestamp"),
        to: ref("Timestamp"),
      },
      ["account"],
    ),
  },

  postFxLp: {
    required: true,
    schema: obj(
      {
        account: ref("Identifier"),
        currency: ref("CurrencyCode"),
        amount: ref("DecimalAmount"),
        pair: string("Configured asset pair, for example USDC/EURC", {
          pattern: "^[A-Z0-9]{3,12}/[A-Z0-9]{3,12}$",
        }),
        class: {
          type: "string",
          enum: ["issuer", "bank", "member"],
          description:
            "Optional self-declared liquidity class. The runtime derives the maximum eligible class from the verified customer and never trusts an upward claim.",
        },
      },
      ["account", "currency", "amount", "pair"],
    ),
  },
};
