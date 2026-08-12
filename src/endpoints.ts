/** The full Greenbar API surface — every endpoint, grouped by resource family.
 *  Matches spec/conventions.md. This is what the docs render. */

export type Endpoint = { verb: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; does: string; auth: "KEY" | "PUBLIC" };
export type Family = { name: string; blurb: string; endpoints: Endpoint[] };

export const FAMILIES: Family[] = [
  {
    name: "Auth & API keys", blurb: "Create and manage sandbox API keys.",
    endpoints: [
      { verb: "POST", path: "/v2/auth/signup", does: "Create an account and issue a sandbox key", auth: "PUBLIC" },
      { verb: "POST", path: "/v2/keys", does: "Issue a new API key", auth: "KEY" },
      { verb: "GET", path: "/v2/keys", does: "List keys", auth: "KEY" },
      { verb: "GET", path: "/v2/keys/:id", does: "Key detail and scope", auth: "KEY" },
      { verb: "DELETE", path: "/v2/keys/:id", does: "Revoke one key", auth: "KEY" },
      { verb: "DELETE", path: "/v2/keys", does: "Revoke every key — incident response", auth: "KEY" },
    ],
  },
  {
    name: "Customers", blurb: "Create customer records and inspect their configured capabilities.",
    endpoints: [
      { verb: "POST", path: "/v2/customers", does: "Create a customer", auth: "KEY" },
      { verb: "GET", path: "/v2/customers/:id", does: "Retrieve a customer", auth: "KEY" },
      { verb: "GET", path: "/v2/customers", does: "List and search customers", auth: "KEY" },
      { verb: "PATCH", path: "/v2/customers/:id", does: "Update a customer", auth: "KEY" },
      { verb: "DELETE", path: "/v2/customers/:id", does: "Soft delete — blocked while accounts exist", auth: "KEY" },
      { verb: "GET", path: "/v2/customers/:id/capabilities", does: "Per-rail status and outstanding requirements", auth: "KEY" },
      { verb: "POST", path: "/v2/customers/:id/verify", does: "Resolve verification in the sandbox without waiting on a queue", auth: "KEY" },
    ],
  },
  {
    name: "Onboarding applications", blurb: "Model application states, documents, attestations and due-diligence records.",
    endpoints: [
      { verb: "POST", path: "/v2/applications", does: "Start an application", auth: "KEY" },
      { verb: "GET", path: "/v2/applications/:id", does: "Application with status and decision", auth: "KEY" },
      { verb: "GET", path: "/v2/applications", does: "List applications", auth: "KEY" },
      { verb: "PATCH", path: "/v2/applications/:id/business", does: "Update business details", auth: "KEY" },
      { verb: "PATCH", path: "/v2/applications/:id/individual", does: "Update individual details", auth: "KEY" },
      { verb: "POST", path: "/v2/applications/:id/individuals", does: "Add an associated individual", auth: "KEY" },
      { verb: "PATCH", path: "/v2/applications/:id/individuals/:iid", does: "Update an individual", auth: "KEY" },
      { verb: "DELETE", path: "/v2/applications/:id/individuals/:iid", does: "Remove an individual", auth: "KEY" },
      { verb: "POST", path: "/v2/applications/:id/documents", does: "Upload a document", auth: "KEY" },
      { verb: "GET", path: "/v2/applications/:id/documents/:did", does: "Download a document", auth: "KEY" },
      { verb: "DELETE", path: "/v2/applications/:id/documents/:did", does: "Delete a document", auth: "KEY" },
      { verb: "POST", path: "/v2/applications/:id/submit", does: "Submit for verification", auth: "KEY" },
      { verb: "POST", path: "/v2/applications/:id/attestation", does: "Submit an attestation", auth: "KEY" },
      { verb: "POST", path: "/v2/applications/:id/edd", does: "Create or update enhanced due diligence", auth: "KEY" },
    ],
  },
  {
    name: "Accounts", blurb: "Create multi-currency sandbox accounts and query their balances.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts", does: "Create a sandbox account", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts/:id", does: "Balance and identifiers", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts", does: "List accounts", auth: "KEY" },
      { verb: "PATCH", path: "/v2/accounts/:id", does: "Update an account", auth: "KEY" },
      { verb: "DELETE", path: "/v2/accounts/:id", does: "Close an account", auth: "KEY" },
      { verb: "POST", path: "/v2/accounts/:id/credit", does: "Credit an account directly — sandbox funding", auth: "KEY" },
    ],
  },
  {
    name: "Receiving details", blurb: "Generate reference receiving details for a sandbox account.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts/:id/details", does: "Issue receiving details for a rail", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts/:id/details", does: "List receiving details", auth: "KEY" },
      { verb: "GET", path: "/v2/details/:id", does: "Retrieve one instrument", auth: "KEY" },
    ],
  },
  {
    name: "Wallets", blurb: "Create sandbox wallet records, balances and policy-gated sends.",
    endpoints: [
      { verb: "POST", path: "/v2/wallets", does: "Create a wallet", auth: "KEY" },
      { verb: "GET", path: "/v2/wallets/:id", does: "Retrieve a wallet", auth: "KEY" },
      { verb: "GET", path: "/v2/wallets", does: "List wallets", auth: "KEY" },
      { verb: "GET", path: "/v2/wallets/:id/balances", does: "Balances across networks", auth: "KEY" },
      { verb: "POST", path: "/v2/wallets/:id/send", does: "Send from a wallet", auth: "KEY" },
      { verb: "GET", path: "/v2/wallets/:id/policies", does: "Policies attached to a wallet", auth: "KEY" },
    ],
  },
  {
    name: "Recipients", blurb: "Store recipients separately from their payment destinations.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients", does: "Create a recipient", auth: "KEY" },
      { verb: "GET", path: "/v2/recipients/:id", does: "Retrieve a recipient", auth: "KEY" },
      { verb: "GET", path: "/v2/recipients", does: "List recipients", auth: "KEY" },
      { verb: "PATCH", path: "/v2/recipients/:id", does: "Update a recipient", auth: "KEY" },
      { verb: "DELETE", path: "/v2/recipients/:id", does: "Delete a recipient", auth: "KEY" },
    ],
  },
  {
    name: "Destinations", blurb: "Store rail-specific details and run sandbox name checks.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients/:id/destinations", does: "Add a destination", auth: "KEY" },
      { verb: "GET", path: "/v2/destinations/:id", does: "Retrieve a destination", auth: "KEY" },
      { verb: "PATCH", path: "/v2/destinations/:id", does: "Update a destination", auth: "KEY" },
      { verb: "DELETE", path: "/v2/destinations/:id", does: "Remove a destination", auth: "KEY" },
      { verb: "POST", path: "/v2/destinations/:id/verify", does: "Confirmation of Payee name check", auth: "KEY" },
    ],
  },
  {
    name: "Quotes & exchange", blurb: "Create expiring reference quotes and inspect indicative rates.",
    endpoints: [
      { verb: "POST", path: "/v2/quotes", does: "Create a quote, held for 30 seconds", auth: "KEY" },
      { verb: "GET", path: "/v2/quotes/:id", does: "Retrieve a quote and its expiry", auth: "KEY" },
      { verb: "POST", path: "/v2/quotes/:id/execute", does: "Execute a held quote", auth: "KEY" },
      { verb: "GET", path: "/v2/rates", does: "Indicative rate, not lockable", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/pairs", does: "Configured pairs and reference depth", auth: "PUBLIC" },
    ],
  },
  {
    name: "Stablecoin FX", blurb: "Legacy compatibility endpoints. Use the canonical FX node for new FX work.",
    endpoints: [
      { verb: "GET", path: "/v2/assets", does: "Configured fiat and stablecoin assets and their reference pegs", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/corridors", does: "Corridor depth, spread and settlement per pair", auth: "PUBLIC" },
      { verb: "POST", path: "/v2/fx/quote", does: "Price one leg — on-ramp, corridor or off-ramp", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/route", does: "The full cross-border route, leg by leg", auth: "KEY" },
      { verb: "POST", path: "/v2/ramps/on", does: "Model a reference fiat-to-stablecoin ramp", auth: "KEY" },
      { verb: "POST", path: "/v2/ramps/off", does: "Model a reference stablecoin-to-fiat ramp", auth: "KEY" },
      { verb: "GET", path: "/v2/ramps", does: "Ramp history", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/depth", does: "Aggregate reference depth without maker identities", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/price", does: "Imbalance-derived price for a corridor", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/pricing-model", does: "The constants and formula, so any quote can be rechecked", auth: "PUBLIC" },
      { verb: "POST", path: "/v2/fx/rfq", does: "A firm price for your own size, binding for a window — the integrator tier", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/rfq", does: "Your firm quotes, and nobody else's", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/rfq/:id/accept", does: "Execute at the locked rate even if the corridor has moved", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/intents", does: "Submit a signed swap intent as maker or taker", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/intents", does: "Your intents", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/intents/:id/cancel", does: "Cancel a resting intent", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/fills", does: "Settled fills, counterparties pseudonymous", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/net", does: "Net the corridor and settle the residual", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/batches", does: "Netting runs", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/appetite", does: "Principal backstop limits", auth: "KEY" },
      { verb: "PUT", path: "/v2/fx/appetite", does: "Set the backstop limit for a corridor", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/lp", does: "Commit liquidity to a corridor — bank or member", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/lp", does: "Your positions and what they have earned", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/lp/earnings", does: "Spread earned, fill by fill", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/lp/:id/withdraw", does: "Pull liquidity back out", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/lp/pools", does: "Aggregate committed liquidity per corridor", auth: "PUBLIC" },


    ],
  },
  {
    name: "Transfers", blurb: "Create sandbox transfers with rail-specific legs and statuses.",
    endpoints: [
      { verb: "POST", path: "/v2/transfers", does: "Create a transfer on a configured reference rail", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers/:id", does: "Transfer with legs and status", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers", does: "List transfers", auth: "KEY" },
      { verb: "POST", path: "/v2/transfers/:id/cancel", does: "Cancel before funding", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers/:id/legs", does: "Legs with their own rail and status", auth: "KEY" },
    ],
  },
  {
    name: "Cards", blurb: "Create sandbox card records and test controls and authorisation flows.",
    endpoints: [
      { verb: "POST", path: "/v2/cards", does: "Create a virtual or physical sandbox card", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id", does: "Card with status and reason", auth: "KEY" },
      { verb: "GET", path: "/v2/cards", does: "List cards", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/freeze", does: "Freeze a card", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/unfreeze", does: "Unfreeze a card", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/pin", does: "Request a temporary PIN update link", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/reveal", does: "Create a temporary card-reveal token", auth: "KEY" },
      { verb: "PATCH", path: "/v2/cards/:id/controls", does: "Limits and merchant categories", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id/transactions", does: "Card transactions", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id/statements", does: "Card statements", auth: "KEY" },
    ],
  },
  {
    name: "Authorisations", blurb: "Simulate card authorisations and record approve or decline decisions.",
    endpoints: [
      { verb: "GET", path: "/v2/authorisations/:id", does: "Retrieve an authorisation", auth: "KEY" },
      { verb: "GET", path: "/v2/authorisations", does: "List pending and cleared", auth: "KEY" },
      { verb: "POST", path: "/v2/authorisations/:id/approve", does: "Record an approval decision", auth: "KEY" },
      { verb: "POST", path: "/v2/authorisations/:id/decline", does: "Record a decline decision", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/authorisations", does: "Simulate an authorisation against a card", auth: "KEY" },
    ],
  },
  {
    name: "Disputes", blurb: "Model disputes, reason codes, deadlines and evidence.",
    endpoints: [
      { verb: "POST", path: "/v2/disputes", does: "Raise a dispute", auth: "KEY" },
      { verb: "GET", path: "/v2/disputes/:id", does: "Dispute with reason code and deadline", auth: "KEY" },
      { verb: "GET", path: "/v2/disputes", does: "List disputes", auth: "KEY" },
      { verb: "POST", path: "/v2/disputes/:id/evidence", does: "Submit evidence", auth: "KEY" },
    ],
  },
  {
    name: "Savings vaults", blurb: "Create sandbox vaults and test deposits, withdrawals and accrual.",
    endpoints: [
      { verb: "POST", path: "/v2/vaults", does: "Create a vault", auth: "KEY" },
      { verb: "GET", path: "/v2/vaults/:id", does: "Vault and accrued interest", auth: "KEY" },
      { verb: "GET", path: "/v2/vaults", does: "List vaults", auth: "KEY" },
      { verb: "POST", path: "/v2/vaults/:id/deposit", does: "Deposit into a vault", auth: "KEY" },
      { verb: "POST", path: "/v2/vaults/:id/withdraw", does: "Withdraw on demand", auth: "KEY" },
      { verb: "DELETE", path: "/v2/vaults/:id", does: "Close a vault", auth: "KEY" },
    ],
  },
  {
    name: "Credit lines", blurb: "Model credit lines, draws, repayments and collateral checks.",
    endpoints: [
      { verb: "POST", path: "/v2/credit", does: "Open a credit line", auth: "KEY" },
      { verb: "GET", path: "/v2/credit/:id", does: "Limit, drawn balance and LTV", auth: "KEY" },
      { verb: "GET", path: "/v2/credit", does: "List credit lines", auth: "KEY" },
      { verb: "POST", path: "/v2/credit/:id/draw", does: "Draw down", auth: "KEY" },
      { verb: "POST", path: "/v2/credit/:id/repay", does: "Repay", auth: "KEY" },
      { verb: "PATCH", path: "/v2/credit/:id/collateral", does: "Adjust collateral", auth: "KEY" },
    ],
  },
  {
    name: "Policies", blurb: "Create rules and attach them to accounts, wallets or cards.",
    endpoints: [
      { verb: "POST", path: "/v2/policies", does: "Create a policy", auth: "KEY" },
      { verb: "GET", path: "/v2/policies/:id", does: "Retrieve a policy", auth: "KEY" },
      { verb: "GET", path: "/v2/policies", does: "List policies", auth: "KEY" },
      { verb: "DELETE", path: "/v2/policies/:id", does: "Delete a policy", auth: "KEY" },
      { verb: "POST", path: "/v2/policies/:id/rules", does: "Add a rule", auth: "KEY" },
      { verb: "PATCH", path: "/v2/policies/:id/rules/:rid", does: "Update a rule", auth: "KEY" },
      { verb: "DELETE", path: "/v2/policies/:id/rules/:rid", does: "Remove a rule", auth: "KEY" },
      { verb: "POST", path: "/v2/policies/:id/attach", does: "Attach to a resource", auth: "KEY" },
      { verb: "POST", path: "/v2/policies/:id/detach", does: "Detach from a resource", auth: "KEY" },
    ],
  },
  {
    name: "Approval chains", blurb: "Create threshold-based approval workflows.",
    endpoints: [
      { verb: "POST", path: "/v2/approval-chains", does: "Create a chain", auth: "KEY" },
      { verb: "GET", path: "/v2/approval-chains/:id", does: "Retrieve a chain", auth: "KEY" },
      { verb: "GET", path: "/v2/approvals", does: "Pending approvals inbox", auth: "KEY" },
      { verb: "POST", path: "/v2/approvals/:id/approve", does: "Approve a step", auth: "KEY" },
      { verb: "POST", path: "/v2/approvals/:id/reject", does: "Reject a step", auth: "KEY" },
    ],
  },
  {
    name: "Organisations", blurb: "Create organisations, members and roles.",
    endpoints: [
      { verb: "POST", path: "/v2/orgs", does: "Create an organisation", auth: "KEY" },
      { verb: "GET", path: "/v2/orgs/:id", does: "Retrieve an organisation", auth: "KEY" },
      { verb: "PATCH", path: "/v2/orgs/:id", does: "Update an organisation", auth: "KEY" },
      { verb: "POST", path: "/v2/orgs/:id/members", does: "Invite a member with a role", auth: "KEY" },
      { verb: "GET", path: "/v2/orgs/:id/members", does: "List members and roles", auth: "KEY" },
      { verb: "DELETE", path: "/v2/orgs/:id/members/:mid", does: "Remove a member", auth: "KEY" },
    ],
  },
  {
    name: "Ledger & statements", blurb: "Query reference ledger entries and balances, and create sandbox statements.",
    endpoints: [
      { verb: "GET", path: "/v2/ledger", does: "Double-entry entries", auth: "KEY" },
      { verb: "GET", path: "/v2/ledger/balances", does: "Balances at a point in time", auth: "KEY" },
      { verb: "POST", path: "/v2/statements", does: "Generate a statement", auth: "KEY" },
      { verb: "GET", path: "/v2/statements/:id", does: "Retrieve a reference statement export", auth: "KEY" },
    ],
  },
  {
    name: "Fees", blurb: "Read and update sandbox fee configuration.",
    endpoints: [
      { verb: "GET", path: "/v2/fees/config", does: "Current fee configuration", auth: "KEY" },
      { verb: "PUT", path: "/v2/fees/config", does: "Set the fee payout destination", auth: "KEY" },
    ],
  },
  {
    name: "Rails registry", blurb: "Query six configured rails, limits, cut-offs and calendars.",
    endpoints: [
      { verb: "GET", path: "/v2/rails", does: "Rail availability and cut-offs", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id", does: "Field schema and limits for a rail", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id/calendar", does: "Business days and holidays", auth: "PUBLIC" },
    ],
  },
  {
    name: "QR & payment links", blurb: "Generate and decode EMVCo payloads and create payment-link records.",
    endpoints: [
      { verb: "POST", path: "/v2/qr/decode", does: "Decode a merchant or consumer QR", auth: "KEY" },
      { verb: "POST", path: "/v2/qr/generate", does: "Generate an EMVCo QR payload", auth: "KEY" },
      { verb: "POST", path: "/v2/links", does: "Create a payment link", auth: "KEY" },
      { verb: "GET", path: "/v2/links/:id", does: "Link status and payments", auth: "KEY" },
    ],
  },
  {
    name: "Bills & subscriptions", blurb: "Create mandate records and recurring payment schedules in the sandbox.",
    endpoints: [
      { verb: "POST", path: "/v2/mandates", does: "Create a sandbox mandate record", auth: "KEY" },
      { verb: "GET", path: "/v2/mandates/:id", does: "Mandate status", auth: "KEY" },
      { verb: "POST", path: "/v2/subscriptions", does: "Create a recurring payment", auth: "KEY" },
      { verb: "GET", path: "/v2/subscriptions", does: "List subscriptions", auth: "KEY" },
    ],
  },
  {
    name: "Webhooks", blurb: "Create targets, inspect deliveries and replay signed callbacks.",
    endpoints: [
      { verb: "POST", path: "/v2/webhooks", does: "Create a target", auth: "KEY" },
      { verb: "GET", path: "/v2/webhooks/:id", does: "Retrieve a target", auth: "KEY" },
      { verb: "GET", path: "/v2/webhooks", does: "List targets", auth: "KEY" },
      { verb: "PATCH", path: "/v2/webhooks/:id", does: "Update a target", auth: "KEY" },
      { verb: "DELETE", path: "/v2/webhooks/:id", does: "Delete a target", auth: "KEY" },
      { verb: "GET", path: "/v2/webhooks/:id/deliveries", does: "Delivery history", auth: "KEY" },
      { verb: "POST", path: "/v2/webhooks/deliveries/:did/replay", does: "Replay a delivery", auth: "KEY" },
    ],
  },
  {
    name: "Events", blurb: "Query API event records.",
    endpoints: [
      { verb: "GET", path: "/v2/events", does: "Paginated event stream", auth: "KEY" },
      { verb: "GET", path: "/v2/events/:id", does: "Retrieve one event", auth: "KEY" },
    ],
  },
  {
    name: "Sandbox", blurb: "Trigger predefined scenarios and advance paused simulations.",
    endpoints: [
      { verb: "GET", path: "/v2/sandbox/scenarios", does: "Scenario catalogue", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/payments", does: "Simulate an inbound payment", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/onboarding", does: "Simulate an onboarding transition", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/:id/advance", does: "Advance a paused simulation", auth: "KEY" },
      { verb: "GET", path: "/v2/sandbox/:id", does: "Simulation and callback history", auth: "KEY" },
    ],
  },
  {
    name: "Reference data", blurb: "Query countries, currencies and networks configured in this reference API.",
    endpoints: [
      { verb: "GET", path: "/v2/countries", does: "Configured countries", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/currencies", does: "Configured currencies", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/networks", does: "Configured blockchain networks", auth: "PUBLIC" },
    ],
  },
];

export const TOTAL_ENDPOINTS = FAMILIES.reduce((n, f) => n + f.endpoints.length, 0);
