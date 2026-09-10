/** Operations that exist to make the public/local sandbox executable and must
 * never become an accidental production control plane. */
export const SANDBOX_ONLY_OPERATIONS = Object.freeze(
  new Set([
    "POST /v2/auth/signup",
    "POST /v2/customers/:id/verify",
    "POST /v2/accounts/:id/credit",
    "POST /v2/wallets/:id/credit",
    "POST /v2/cards/:id/authorisations",
    "POST /v2/transfers/:id/settle",
    "POST /v2/ramps/on",
    "POST /v2/ramps/off",
    "POST /v2/mandates",
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
