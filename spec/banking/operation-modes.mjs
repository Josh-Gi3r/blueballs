/** Operations that exist to make the public/local sandbox or historical
 * compatibility surfaces executable and must never become an accidental
 * production control plane. Production external effects live behind the
 * provider gateway or canonical FX node instead. */
export const SANDBOX_ONLY_OPERATIONS = Object.freeze(
  new Set([
    // Public sandbox/bootstrap shortcuts.
    "POST /v2/auth/signup",
    "POST /v2/customers/:id/verify",
    "POST /v2/accounts/:id/credit",
    "POST /v2/wallets/:id/credit",
    "POST /v2/transfers/:id/settle",
    "POST /v2/destinations/:id/verify",

    // Card issuance itself is provider-backed in production. Network
    // authorisation/transaction ingestion, controls and disputes are still
    // reference workflows and must not pretend a local state change reached a
    // real processor.
    "POST /v2/cards/:id/freeze",
    "POST /v2/cards/:id/unfreeze",
    "PATCH /v2/cards/:id/controls",
    "GET /v2/cards/:id/transactions",
    "GET /v2/cards/:id/statements",
    "POST /v2/cards/:id/authorisations",
    "GET /v2/authorisations/:id",
    "GET /v2/authorisations",
    "POST /v2/authorisations/:id/approve",
    "POST /v2/authorisations/:id/decline",
    "POST /v2/disputes",
    "GET /v2/disputes/:id",
    "GET /v2/disputes",
    "POST /v2/disputes/:id/evidence",

    // Savings/credit economics are reference product models until a deployment
    // supplies institution-approved rate, accrual/posting and credit-risk
    // policy rather than caller-configured/reference terms.
    "POST /v2/vaults",
    "GET /v2/vaults/:id",
    "GET /v2/vaults",
    "POST /v2/vaults/:id/deposit",
    "POST /v2/vaults/:id/withdraw",
    "DELETE /v2/vaults/:id",
    "POST /v2/credit",
    "GET /v2/credit/:id",
    "GET /v2/credit",
    "POST /v2/credit/:id/draw",
    "POST /v2/credit/:id/repay",

    // Payment-link and recurring-payment fixtures do not execute through a
    // connected production collection/mandate provider yet.
    "POST /v2/links",
    "GET /v2/links/:id",
    "POST /v2/mandates",
    "GET /v2/mandates/:id",
    "POST /v2/subscriptions",
    "GET /v2/subscriptions",

    // Historical banking-runtime FX/reference compatibility. Production FX is
    // owned by the canonical FX node/provider integrations, never these fixture
    // prices, local LP pools or manual settlement controls.
    "POST /v2/quotes",
    "GET /v2/quotes/:id",
    "POST /v2/quotes/:id/execute",
    "GET /v2/rates",
    "GET /v2/pairs",
    "GET /v2/assets",
    "GET /v2/corridors",
    "POST /v2/fx/quote",
    "POST /v2/fx/route",
    "POST /v2/ramps/on",
    "POST /v2/ramps/off",
    "GET /v2/ramps",
    "GET /v2/fx/depth",
    "GET /v2/fx/price",
    "GET /v2/fx/pricing-model",
    "POST /v2/fx/rfq",
    "GET /v2/fx/rfq",
    "POST /v2/fx/rfq/:id/accept",
    "POST /v2/fx/intents",
    "GET /v2/fx/intents",
    "POST /v2/fx/intents/:id/cancel",
    "GET /v2/fx/fills",
    "POST /v2/fx/net",
    "GET /v2/fx/batches",
    "GET /v2/fx/appetite",
    "PUT /v2/fx/appetite",
    "POST /v2/fx/lp",
    "GET /v2/fx/lp",
    "GET /v2/fx/lp/earnings",
    "POST /v2/fx/lp/:id/withdraw",
    "GET /v2/fx/lp/pools",

    // Builder/reference simulation surfaces.
    "POST /v2/builder/projects",
    "GET /v2/builder/projects",
    "GET /v2/builder/projects/:id",
    "PATCH /v2/builder/projects/:id",
    "POST /v2/builder/projects/:id/provision",
    "POST /v2/builder/projects/:id/test-payments",
    "GET /v2/sandbox/scenarios",
    "POST /v2/sandbox/payments",
    "POST /v2/sandbox/onboarding",
    "POST /v2/sandbox/:id/advance",
    "GET /v2/sandbox/:id",
  ]),
);

export function isSandboxOnlyOperation(method, pattern) {
  return SANDBOX_ONLY_OPERATIONS.has(`${method} ${pattern}`);
}

export function bankingApiMode(env = process.env) {
  const mode = env.BANK_API_MODE ?? "sandbox";
  if (!new Set(["sandbox", "production"]).has(mode)) {
    throw new Error("BANK_API_MODE must be sandbox or production");
  }
  return mode;
}
