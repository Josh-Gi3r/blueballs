#!/usr/bin/env node
import { FAMILIES } from "../src/endpoints.ts";
import { SANDBOX_ONLY_OPERATIONS } from "../spec/banking/operation-modes.mjs";

const catalogue = new Set(
  FAMILIES.flatMap((family) =>
    family.endpoints.map((endpoint) => `${endpoint.verb} ${endpoint.path}`),
  ),
);

/**
 * High-risk local authority must fail closed in production. This list is
 * deliberately independent from SANDBOX_ONLY_OPERATIONS: if a route is added to
 * the runtime but omitted from the production boundary, this check must fail
 * instead of congratulating the same source of truth for agreeing with itself.
 */
const REQUIRED_SANDBOX_BOUNDARIES = new Set([
  "POST /v2/auth/signup",
  "POST /v2/customers/:id/verify",
  "POST /v2/accounts/:id/credit",
  "POST /v2/wallets/:id/credit",
  "POST /v2/transfers/:id/settle",
  "POST /v2/transfers/:id/cancel",
  "DELETE /v2/accounts/:id",
  "POST /v2/destinations/:id/verify",
  "POST /v2/applications/:id/edd",
  "POST /v2/applications/:id/documents",
  "DELETE /v2/applications/:id/documents/:did",
  "POST /v2/cards/:id/freeze",
  "POST /v2/cards/:id/unfreeze",
  "PATCH /v2/cards/:id/controls",
  "POST /v2/cards/:id/authorisations",
  "POST /v2/authorisations/:id/approve",
  "POST /v2/authorisations/:id/decline",
  "POST /v2/disputes",
  "POST /v2/disputes/:id/evidence",
  "POST /v2/vaults",
  "POST /v2/vaults/:id/deposit",
  "POST /v2/vaults/:id/withdraw",
  "DELETE /v2/vaults/:id",
  "POST /v2/credit",
  "POST /v2/credit/:id/draw",
  "POST /v2/credit/:id/repay",
  "PATCH /v2/credit/:id/collateral",
  "POST /v2/statements",
  "PUT /v2/fees/config",
  "POST /v2/links",
  "POST /v2/mandates",
  "POST /v2/subscriptions",
  "POST /v2/quotes",
  "POST /v2/quotes/:id/execute",
  "POST /v2/fx/quote",
  "POST /v2/fx/route",
  "POST /v2/ramps/on",
  "POST /v2/ramps/off",
  "POST /v2/fx/rfq",
  "POST /v2/fx/rfq/:id/accept",
  "POST /v2/fx/intents",
  "POST /v2/fx/intents/:id/cancel",
  "POST /v2/fx/net",
  "PUT /v2/fx/appetite",
  "POST /v2/fx/lp",
  "POST /v2/fx/lp/:id/withdraw",
  "POST /v2/builder/projects/:id/provision",
  "POST /v2/builder/projects/:id/test-payments",
  "POST /v2/sandbox/payments",
  "POST /v2/sandbox/onboarding",
  "POST /v2/sandbox/:id/advance",
]);

const failures = [];
for (const operation of SANDBOX_ONLY_OPERATIONS) {
  if (!catalogue.has(operation)) failures.push(`${operation}: not in catalogue`);
}
for (const operation of REQUIRED_SANDBOX_BOUNDARIES) {
  if (!catalogue.has(operation)) {
    failures.push(`${operation}: required production boundary is not in catalogue`);
  } else if (!SANDBOX_ONLY_OPERATIONS.has(operation)) {
    failures.push(`${operation}: high-risk local authority is not fail-closed in production`);
  }
}

if (failures.length) {
  console.error(`operation-mode contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `operation modes: ${SANDBOX_ONLY_OPERATIONS.size} sandbox-only catalogue operations, including ${REQUIRED_SANDBOX_BOUNDARIES.size} independently required production boundaries`,
);
