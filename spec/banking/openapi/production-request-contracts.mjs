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

const fxSettlementAccounts = {
  account: ref("Identifier"),
  receive_account: {
    ...ref("Identifier"),
    description:
      "Target-currency account owned by the same customer. May be omitted only when exactly one eligible target-currency account can be resolved.",
  },
};

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

  postFxIntents: {
    required: true,
    schema: obj(
      {
        ...fxSettlementAccounts,
        from: ref("CurrencyCode"),
        to: ref("CurrencyCode"),
        amount: ref("DecimalAmount"),
        min_receive: ref("DecimalAmount"),
        mode: { type: "string", enum: ["maker", "taker"], default: "taker" },
        signature: string("Optional signed-intent evidence"),
        ttl_seconds: integer("Intent lifetime", {
          minimum: 1,
          maximum: 86400,
          default: 300,
        }),
      },
      ["account", "from", "to", "amount", "min_receive"],
    ),
  },

  postFxRfq: {
    required: true,
    schema: obj(
      {
        ...fxSettlementAccounts,
        from: ref("CurrencyCode"),
        to: ref("CurrencyCode"),
        amount: ref("DecimalAmount"),
      },
      ["account", "from", "to", "amount"],
    ),
  },

  putFxAppetite: {
    required: true,
    schema: obj(
      {
        pair: string("Directional stablecoin pair", {
          pattern: "^[A-Z0-9]{3,12}/[A-Z0-9]{3,12}$",
        }),
        enabled: { type: "boolean" },
        max_position: ref("DecimalAmount"),
        markup_bps: {
          type: "number",
          minimum: 0,
          maximum: 10000,
          description: "Principal markup over the imbalance price",
        },
      },
      ["pair"],
    ),
  },

  postOrgsIdMembers: {
    required: true,
    schema: obj(
      {
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["owner", "admin", "member"] },
      },
      ["email", "role"],
    ),
  },
};
