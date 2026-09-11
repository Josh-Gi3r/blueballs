/** Explicit runtime-mode boundaries for the banking surface.
 *
 * Sandbox exercises product models and operator shortcuts locally. Production
 * external effects cross provider contracts or the canonical FX runtime. Keeping
 * the boundary executable prevents a local teaching/control path from becoming
 * an unintended production authority. */
export const SANDBOX_ONLY_OPERATIONS = Object.freeze(
  new Set([
    // Self-serve sandbox/bootstrap shortcuts.
    "POST /v2/auth/signup",
    "POST /v2/customers/:id/verify",
    "POST /v2/accounts/:id/credit",
    "POST /v2/wallets/:id/credit",
    "POST /v2/transfers/:id/settle",
    "POST /v2/destinations/:id/verify",

    // Production account closure and transfer cancellation require explicit
    // downstream revocation/cancellation evidence before local state can change.
    "DELETE /v2/accounts/:id",
    "POST /v2/transfers/:id/cancel",

    // Document payloads use the local inline document model. Production identity
    // submission itself is provider-backed; document binary storage is delegated
    // to the deployment's encrypted object/document infrastructure.
    "POST /v2/applications/:id/documents",
    "GET /v2/applications/:id/documents/:did",
    "DELETE /v2/applications/:id/documents/:did",

    // Card issuance is provider-backed in production. Network authorisation,
    // processor controls and disputes stay in the sandbox until their dedicated
    // real-time processor capability contracts are configured.
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

    // Savings and credit are institution policy models. Production deployments
    // supply approved rate/accrual/credit-risk engines rather than caller-defined
    // economic terms.
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
    "PATCH /v2/credit/:id/collateral",

    // Statement rendering and commercial fee configuration are sandbox policy
    // surfaces; the ledger underneath them remains the canonical financial truth.
    "POST /v2/statements",
    "GET /v2/statements/:id",
    "GET /v2/fees/config",
    "PUT /v2/fees/config",

    // Payment-link and recurring-collection execution require a deployment-owned
    // collection/mandate provider contract.
    "POST /v2/links",
    "GET /v2/links/:id",
    "POST /v2/mandates",
    "GET /v2/mandates/:id",
    "POST /v2/subscriptions",
    "GET /v2/subscriptions",

    // Banking-runtime FX compatibility mutations. New production FX work uses
    // the canonical FX node, while public market-data reads remain available.
    "POST /v2/quotes",
    "GET /v2/quotes/:id",
    "POST /v2/quotes/:id/execute",
    "POST /v2/fx/quote",
    "POST /v2/fx/route",
    "POST /v2/ramps/on",
    "POST /v2/ramps/off",
    "GET /v2/ramps",
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

    // Institution Builder and deterministic scenario execution.
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
