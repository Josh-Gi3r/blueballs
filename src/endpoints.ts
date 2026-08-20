/** The full Blueballs API surface — every endpoint, grouped by resource family.
 *  Matches spec/conventions.md. This is what the docs render. */

export type Endpoint = { verb: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; does: string; access: "PUBLIC" | "TENANT" | "OPERATOR" | "GLOBAL_READ" };
export type Family = { name: string; blurb: string; endpoints: Endpoint[] };

export const FAMILIES: Family[] = [
  {
    name: "Auth & API keys", blurb: "Create and manage sandbox API keys.",
    endpoints: [
      { verb: "POST", path: "/v2/auth/signup", does: "Create an account and issue a sandbox key", access: "PUBLIC" },
      { verb: "POST", path: "/v2/keys", does: "Issue a new API key", access: "TENANT" },
      { verb: "GET", path: "/v2/keys", does: "List keys", access: "TENANT" },
      { verb: "GET", path: "/v2/keys/:id", does: "Key detail and scope", access: "TENANT" },
      { verb: "DELETE", path: "/v2/keys/:id", does: "Revoke one key", access: "TENANT" },
      { verb: "DELETE", path: "/v2/keys", does: "Revoke every key — incident response", access: "TENANT" },
    ],
  },
  {
    name: "Customers", blurb: "Create customer records and inspect their configured capabilities.",
    endpoints: [
      { verb: "POST", path: "/v2/customers", does: "Create a customer", access: "TENANT" },
      { verb: "GET", path: "/v2/customers/:id", does: "Retrieve a customer", access: "TENANT" },
      { verb: "GET", path: "/v2/customers", does: "List and search customers", access: "TENANT" },
      { verb: "PATCH", path: "/v2/customers/:id", does: "Update a customer", access: "TENANT" },
      { verb: "DELETE", path: "/v2/customers/:id", does: "Soft delete — blocked while accounts exist", access: "TENANT" },
      { verb: "GET", path: "/v2/customers/:id/capabilities", does: "Per-rail status and outstanding requirements", access: "TENANT" },
      { verb: "POST", path: "/v2/customers/:id/verify", does: "Resolve verification in the sandbox without waiting on a queue", access: "TENANT" },
    ],
  },
  {
    name: "Onboarding applications", blurb: "Model application states, documents, attestations and due-diligence records.",
    endpoints: [
      { verb: "POST", path: "/v2/applications", does: "Start an application", access: "TENANT" },
      { verb: "GET", path: "/v2/applications/:id", does: "Application with status and decision", access: "TENANT" },
      { verb: "GET", path: "/v2/applications", does: "List applications", access: "TENANT" },
      { verb: "PATCH", path: "/v2/applications/:id/business", does: "Update business details", access: "TENANT" },
      { verb: "PATCH", path: "/v2/applications/:id/individual", does: "Update individual details", access: "TENANT" },
      { verb: "POST", path: "/v2/applications/:id/individuals", does: "Add an associated individual", access: "TENANT" },
      { verb: "PATCH", path: "/v2/applications/:id/individuals/:iid", does: "Update an individual", access: "TENANT" },
      { verb: "DELETE", path: "/v2/applications/:id/individuals/:iid", does: "Remove an individual", access: "TENANT" },
      { verb: "POST", path: "/v2/applications/:id/documents", does: "Upload a document", access: "TENANT" },
      { verb: "GET", path: "/v2/applications/:id/documents/:did", does: "Download a document", access: "TENANT" },
      { verb: "DELETE", path: "/v2/applications/:id/documents/:did", does: "Delete a document", access: "TENANT" },
      { verb: "POST", path: "/v2/applications/:id/submit", does: "Submit for verification", access: "TENANT" },
      { verb: "POST", path: "/v2/applications/:id/attestation", does: "Submit an attestation", access: "TENANT" },
      { verb: "POST", path: "/v2/applications/:id/edd", does: "Create or update enhanced due diligence", access: "TENANT" },
    ],
  },
  {
    name: "Accounts", blurb: "Create multi-currency sandbox accounts and query their balances.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts", does: "Create a sandbox account", access: "TENANT" },
      { verb: "GET", path: "/v2/accounts/:id", does: "Balance and identifiers", access: "TENANT" },
      { verb: "GET", path: "/v2/accounts", does: "List accounts", access: "TENANT" },
      { verb: "PATCH", path: "/v2/accounts/:id", does: "Update an account", access: "TENANT" },
      { verb: "DELETE", path: "/v2/accounts/:id", does: "Close an account", access: "TENANT" },
      { verb: "POST", path: "/v2/accounts/:id/credit", does: "Credit an account directly — sandbox funding", access: "TENANT" },
    ],
  },
  {
    name: "Receiving details", blurb: "Generate reference receiving details for a sandbox account.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts/:id/details", does: "Issue receiving details for a rail", access: "TENANT" },
      { verb: "GET", path: "/v2/accounts/:id/details", does: "List receiving details", access: "TENANT" },
      { verb: "GET", path: "/v2/details/:id", does: "Retrieve one instrument", access: "TENANT" },
    ],
  },
  {
    name: "Wallets", blurb: "Create sandbox wallet records, balances and policy-gated sends.",
    endpoints: [
      { verb: "POST", path: "/v2/wallets", does: "Create a wallet", access: "TENANT" },
      { verb: "GET", path: "/v2/wallets/:id", does: "Retrieve a wallet", access: "TENANT" },
      { verb: "GET", path: "/v2/wallets", does: "List wallets", access: "TENANT" },
      { verb: "GET", path: "/v2/wallets/:id/balances", does: "Balances across networks", access: "TENANT" },
      { verb: "POST", path: "/v2/wallets/:id/credit", does: "Credit a wallet directly — sandbox funding", access: "TENANT" },
      { verb: "POST", path: "/v2/wallets/:id/send", does: "Send from a wallet", access: "TENANT" },
      { verb: "GET", path: "/v2/wallets/:id/policies", does: "Policies attached to a wallet", access: "TENANT" },
    ],
  },
  {
    name: "Recipients", blurb: "Store recipients separately from their payment destinations.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients", does: "Create a recipient", access: "TENANT" },
      { verb: "GET", path: "/v2/recipients/:id", does: "Retrieve a recipient", access: "TENANT" },
      { verb: "GET", path: "/v2/recipients", does: "List recipients", access: "TENANT" },
      { verb: "PATCH", path: "/v2/recipients/:id", does: "Update a recipient", access: "TENANT" },
      { verb: "DELETE", path: "/v2/recipients/:id", does: "Delete a recipient", access: "TENANT" },
    ],
  },
  {
    name: "Destinations", blurb: "Store rail-specific details and run sandbox name checks.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients/:id/destinations", does: "Add a destination", access: "TENANT" },
      { verb: "GET", path: "/v2/destinations/:id", does: "Retrieve a destination", access: "TENANT" },
      { verb: "PATCH", path: "/v2/destinations/:id", does: "Update a destination", access: "TENANT" },
      { verb: "DELETE", path: "/v2/destinations/:id", does: "Remove a destination", access: "TENANT" },
      { verb: "POST", path: "/v2/destinations/:id/verify", does: "Confirmation of Payee name check", access: "TENANT" },
    ],
  },
  {
    name: "Quotes & exchange", blurb: "Create expiring reference quotes and inspect indicative rates.",
    endpoints: [
      { verb: "POST", path: "/v2/quotes", does: "Create a quote, held for 30 seconds", access: "TENANT" },
      { verb: "GET", path: "/v2/quotes/:id", does: "Retrieve a quote and its expiry", access: "TENANT" },
      { verb: "POST", path: "/v2/quotes/:id/execute", does: "Execute a held quote", access: "TENANT" },
      { verb: "GET", path: "/v2/rates", does: "Indicative rate, not lockable", access: "PUBLIC" },
      { verb: "GET", path: "/v2/pairs", does: "Configured pairs and reference depth", access: "PUBLIC" },
    ],
  },
  {
    name: "Stablecoin FX", blurb: "Legacy compatibility endpoints. Use the canonical FX node for new FX work.",
    endpoints: [
      { verb: "GET", path: "/v2/assets", does: "Configured fiat and stablecoin assets and their reference pegs", access: "PUBLIC" },
      { verb: "GET", path: "/v2/corridors", does: "Corridor depth, spread and settlement per pair", access: "PUBLIC" },
      { verb: "POST", path: "/v2/fx/quote", does: "Price one leg — on-ramp, corridor or off-ramp", access: "TENANT" },
      { verb: "POST", path: "/v2/fx/route", does: "The full cross-border route, leg by leg", access: "TENANT" },
      { verb: "POST", path: "/v2/ramps/on", does: "Model a reference fiat-to-stablecoin ramp", access: "TENANT" },
      { verb: "POST", path: "/v2/ramps/off", does: "Model a reference stablecoin-to-fiat ramp", access: "TENANT" },
      { verb: "GET", path: "/v2/ramps", does: "Ramp history", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/depth", does: "Aggregate reference depth without maker identities", access: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/price", does: "Imbalance-derived price for a corridor", access: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/pricing-model", does: "The constants and formula, so any quote can be rechecked", access: "PUBLIC" },
      { verb: "POST", path: "/v2/fx/rfq", does: "A firm price for your own size, binding for a window — the integrator tier", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/rfq", does: "Your firm quotes, and nobody else's", access: "TENANT" },
      { verb: "POST", path: "/v2/fx/rfq/:id/accept", does: "Execute at the locked rate even if the corridor has moved", access: "TENANT" },
      { verb: "POST", path: "/v2/fx/intents", does: "Submit a signed swap intent as maker or taker", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/intents", does: "Your intents", access: "TENANT" },
      { verb: "POST", path: "/v2/fx/intents/:id/cancel", does: "Cancel a resting intent", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/fills", does: "Settled fills, counterparties pseudonymous", access: "GLOBAL_READ" },
      { verb: "POST", path: "/v2/fx/net", does: "Net the corridor and settle the residual", access: "OPERATOR" },
      { verb: "GET", path: "/v2/fx/batches", does: "Netting runs", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/appetite", does: "Principal backstop limits", access: "GLOBAL_READ" },
      { verb: "PUT", path: "/v2/fx/appetite", does: "Set the backstop limit for a corridor", access: "OPERATOR" },
      { verb: "POST", path: "/v2/fx/lp", does: "Commit liquidity to a corridor — bank or member", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/lp", does: "Your positions and what they have earned", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/lp/earnings", does: "Spread earned, fill by fill", access: "TENANT" },
      { verb: "POST", path: "/v2/fx/lp/:id/withdraw", does: "Pull liquidity back out", access: "TENANT" },
      { verb: "GET", path: "/v2/fx/lp/pools", does: "Aggregate committed liquidity per corridor", access: "PUBLIC" },


    ],
  },
  {
    name: "Transfers", blurb: "Create sandbox transfers with rail-specific legs and statuses.",
    endpoints: [
      { verb: "POST", path: "/v2/transfers", does: "Create a transfer on a configured reference rail", access: "TENANT" },
      { verb: "GET", path: "/v2/transfers/:id", does: "Transfer with legs and status", access: "TENANT" },
      { verb: "GET", path: "/v2/transfers", does: "List transfers", access: "TENANT" },
      { verb: "POST", path: "/v2/transfers/:id/cancel", does: "Cancel before funding", access: "TENANT" },
      { verb: "GET", path: "/v2/transfers/:id/legs", does: "Legs with their own rail and status", access: "TENANT" },
    ],
  },
  {
    name: "Cards", blurb: "Create sandbox card records and test controls and authorisation flows.",
    endpoints: [
      { verb: "POST", path: "/v2/cards", does: "Create a virtual or physical sandbox card", access: "TENANT" },
      { verb: "GET", path: "/v2/cards/:id", does: "Card with status and reason", access: "TENANT" },
      { verb: "GET", path: "/v2/cards", does: "List cards", access: "TENANT" },
      { verb: "POST", path: "/v2/cards/:id/freeze", does: "Freeze a card", access: "TENANT" },
      { verb: "POST", path: "/v2/cards/:id/unfreeze", does: "Unfreeze a card", access: "TENANT" },
      { verb: "POST", path: "/v2/cards/:id/pin", does: "Request a temporary PIN update link", access: "TENANT" },
      { verb: "POST", path: "/v2/cards/:id/reveal", does: "Create a temporary card-reveal token", access: "TENANT" },
      { verb: "PATCH", path: "/v2/cards/:id/controls", does: "Limits and merchant categories", access: "TENANT" },
      { verb: "GET", path: "/v2/cards/:id/transactions", does: "Card transactions", access: "TENANT" },
      { verb: "GET", path: "/v2/cards/:id/statements", does: "Card statements", access: "TENANT" },
    ],
  },
  {
    name: "Authorisations", blurb: "Simulate card authorisations and record approve or decline decisions.",
    endpoints: [
      { verb: "GET", path: "/v2/authorisations/:id", does: "Retrieve an authorisation", access: "TENANT" },
      { verb: "GET", path: "/v2/authorisations", does: "List pending and cleared", access: "TENANT" },
      { verb: "POST", path: "/v2/authorisations/:id/approve", does: "Record an approval decision", access: "TENANT" },
      { verb: "POST", path: "/v2/authorisations/:id/decline", does: "Record a decline decision", access: "TENANT" },
      { verb: "POST", path: "/v2/cards/:id/authorisations", does: "Simulate an authorisation against a card", access: "TENANT" },
    ],
  },
  {
    name: "Disputes", blurb: "Model disputes, reason codes, deadlines and evidence.",
    endpoints: [
      { verb: "POST", path: "/v2/disputes", does: "Raise a dispute", access: "TENANT" },
      { verb: "GET", path: "/v2/disputes/:id", does: "Dispute with reason code and deadline", access: "TENANT" },
      { verb: "GET", path: "/v2/disputes", does: "List disputes", access: "TENANT" },
      { verb: "POST", path: "/v2/disputes/:id/evidence", does: "Submit evidence", access: "TENANT" },
    ],
  },
  {
    name: "Savings vaults", blurb: "Create sandbox vaults and test deposits, withdrawals and accrual.",
    endpoints: [
      { verb: "POST", path: "/v2/vaults", does: "Create a vault", access: "TENANT" },
      { verb: "GET", path: "/v2/vaults/:id", does: "Vault and accrued interest", access: "TENANT" },
      { verb: "GET", path: "/v2/vaults", does: "List vaults", access: "TENANT" },
      { verb: "POST", path: "/v2/vaults/:id/deposit", does: "Deposit into a vault", access: "TENANT" },
      { verb: "POST", path: "/v2/vaults/:id/withdraw", does: "Withdraw on demand", access: "TENANT" },
      { verb: "DELETE", path: "/v2/vaults/:id", does: "Close a vault", access: "TENANT" },
    ],
  },
  {
    name: "Credit lines", blurb: "Model credit lines, draws, repayments and collateral checks.",
    endpoints: [
      { verb: "POST", path: "/v2/credit", does: "Open a credit line", access: "TENANT" },
      { verb: "GET", path: "/v2/credit/:id", does: "Limit, drawn balance and LTV", access: "TENANT" },
      { verb: "GET", path: "/v2/credit", does: "List credit lines", access: "TENANT" },
      { verb: "POST", path: "/v2/credit/:id/draw", does: "Draw down", access: "TENANT" },
      { verb: "POST", path: "/v2/credit/:id/repay", does: "Repay", access: "TENANT" },
      { verb: "PATCH", path: "/v2/credit/:id/collateral", does: "Adjust collateral", access: "TENANT" },
    ],
  },
  {
    name: "Policies", blurb: "Create rules and attach them to accounts, wallets or cards.",
    endpoints: [
      { verb: "POST", path: "/v2/policies", does: "Create a policy", access: "TENANT" },
      { verb: "GET", path: "/v2/policies/:id", does: "Retrieve a policy", access: "TENANT" },
      { verb: "GET", path: "/v2/policies", does: "List policies", access: "TENANT" },
      { verb: "DELETE", path: "/v2/policies/:id", does: "Delete a policy", access: "TENANT" },
      { verb: "POST", path: "/v2/policies/:id/rules", does: "Add a rule", access: "TENANT" },
      { verb: "PATCH", path: "/v2/policies/:id/rules/:rid", does: "Update a rule", access: "TENANT" },
      { verb: "DELETE", path: "/v2/policies/:id/rules/:rid", does: "Remove a rule", access: "TENANT" },
      { verb: "POST", path: "/v2/policies/:id/attach", does: "Attach to a resource", access: "TENANT" },
      { verb: "POST", path: "/v2/policies/:id/detach", does: "Detach from a resource", access: "TENANT" },
    ],
  },
  {
    name: "Approval chains", blurb: "Create threshold-based approval workflows.",
    endpoints: [
      { verb: "POST", path: "/v2/approval-chains", does: "Create a chain", access: "TENANT" },
      { verb: "GET", path: "/v2/approval-chains/:id", does: "Retrieve a chain", access: "TENANT" },
      { verb: "GET", path: "/v2/approvals", does: "Pending approvals inbox", access: "TENANT" },
      { verb: "POST", path: "/v2/approvals/:id/approve", does: "Approve a step", access: "TENANT" },
      { verb: "POST", path: "/v2/approvals/:id/reject", does: "Reject a step", access: "TENANT" },
    ],
  },
  {
    name: "Organisations", blurb: "Create organisations, members and roles.",
    endpoints: [
      { verb: "POST", path: "/v2/orgs", does: "Create an organisation", access: "TENANT" },
      { verb: "GET", path: "/v2/orgs/:id", does: "Retrieve an organisation", access: "TENANT" },
      { verb: "PATCH", path: "/v2/orgs/:id", does: "Update an organisation", access: "TENANT" },
      { verb: "POST", path: "/v2/orgs/:id/members", does: "Invite a member with a role", access: "TENANT" },
      { verb: "GET", path: "/v2/orgs/:id/members", does: "List members and roles", access: "TENANT" },
      { verb: "DELETE", path: "/v2/orgs/:id/members/:mid", does: "Remove a member", access: "TENANT" },
    ],
  },
  {
    name: "Ledger & statements", blurb: "Query reference ledger entries and balances, and create sandbox statements.",
    endpoints: [
      { verb: "GET", path: "/v2/ledger", does: "Double-entry entries", access: "TENANT" },
      { verb: "GET", path: "/v2/ledger/balances", does: "Balances at a point in time", access: "TENANT" },
      { verb: "POST", path: "/v2/statements", does: "Generate a statement", access: "TENANT" },
      { verb: "GET", path: "/v2/statements/:id", does: "Retrieve a reference statement export", access: "TENANT" },
    ],
  },
  {
    name: "Fees", blurb: "Read and update sandbox fee configuration.",
    endpoints: [
      { verb: "GET", path: "/v2/fees/config", does: "Current fee configuration", access: "TENANT" },
      { verb: "PUT", path: "/v2/fees/config", does: "Set the fee payout destination", access: "TENANT" },
    ],
  },
  {
    name: "Rails registry", blurb: "Query six configured rails, limits, cut-offs and calendars.",
    endpoints: [
      { verb: "GET", path: "/v2/rails", does: "Rail availability and cut-offs", access: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id", does: "Field schema and limits for a rail", access: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id/calendar", does: "Business days and holidays", access: "PUBLIC" },
    ],
  },
  {
    name: "QR & payment links", blurb: "Generate and decode EMVCo payloads and create payment-link records.",
    endpoints: [
      { verb: "POST", path: "/v2/qr/decode", does: "Decode a merchant or consumer QR", access: "TENANT" },
      { verb: "POST", path: "/v2/qr/generate", does: "Generate an EMVCo QR payload", access: "TENANT" },
      { verb: "POST", path: "/v2/links", does: "Create a payment link", access: "TENANT" },
      { verb: "GET", path: "/v2/links/:id", does: "Link status and payments", access: "TENANT" },
    ],
  },
  {
    name: "Bills & subscriptions", blurb: "Create mandate records and recurring payment schedules in the sandbox.",
    endpoints: [
      { verb: "POST", path: "/v2/mandates", does: "Create a sandbox mandate record", access: "TENANT" },
      { verb: "GET", path: "/v2/mandates/:id", does: "Mandate status", access: "TENANT" },
      { verb: "POST", path: "/v2/subscriptions", does: "Create a recurring payment", access: "TENANT" },
      { verb: "GET", path: "/v2/subscriptions", does: "List subscriptions", access: "TENANT" },
    ],
  },
  {
    name: "Webhooks", blurb: "Create targets, inspect deliveries and replay signed callbacks.",
    endpoints: [
      { verb: "POST", path: "/v2/webhooks", does: "Create a target", access: "TENANT" },
      { verb: "GET", path: "/v2/webhooks/:id", does: "Retrieve a target", access: "TENANT" },
      { verb: "GET", path: "/v2/webhooks", does: "List targets", access: "TENANT" },
      { verb: "PATCH", path: "/v2/webhooks/:id", does: "Update a target", access: "TENANT" },
      { verb: "DELETE", path: "/v2/webhooks/:id", does: "Delete a target", access: "TENANT" },
      { verb: "GET", path: "/v2/webhooks/:id/deliveries", does: "Delivery history", access: "TENANT" },
      { verb: "POST", path: "/v2/webhooks/deliveries/:did/replay", does: "Replay a delivery", access: "TENANT" },
    ],
  },
  {
    name: "Events", blurb: "Query API event records.",
    endpoints: [
      { verb: "GET", path: "/v2/events", does: "Paginated event stream", access: "TENANT" },
      { verb: "GET", path: "/v2/events/:id", does: "Retrieve one event", access: "TENANT" },
    ],
  },
  {
    name: "Sandbox", blurb: "Trigger predefined scenarios and advance paused simulations.",
    endpoints: [
      { verb: "GET", path: "/v2/sandbox/scenarios", does: "Scenario catalogue", access: "TENANT" },
      { verb: "POST", path: "/v2/sandbox/payments", does: "Simulate an inbound payment", access: "TENANT" },
      { verb: "POST", path: "/v2/sandbox/onboarding", does: "Simulate an onboarding transition", access: "TENANT" },
      { verb: "POST", path: "/v2/sandbox/:id/advance", does: "Advance a paused simulation", access: "TENANT" },
      { verb: "GET", path: "/v2/sandbox/:id", does: "Simulation and callback history", access: "TENANT" },
    ],
  },
  {
    name: "Reference data", blurb: "Query countries, currencies and networks configured in this reference API.",
    endpoints: [
      { verb: "GET", path: "/v2/countries", does: "Configured countries", access: "PUBLIC" },
      { verb: "GET", path: "/v2/currencies", does: "Configured currencies", access: "PUBLIC" },
      { verb: "GET", path: "/v2/networks", does: "Configured blockchain networks", access: "PUBLIC" },
    ],
  },
];

export const TOTAL_ENDPOINTS = FAMILIES.reduce((n, f) => n + f.endpoints.length, 0);
