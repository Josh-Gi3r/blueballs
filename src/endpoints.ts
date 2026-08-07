/** The full Greenbar API surface — every endpoint, grouped by resource family.
 *  Matches spec/conventions.md. This is what the docs render. */

export type Endpoint = { verb: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; does: string; auth: "KEY" | "PUBLIC" };
export type Family = { name: string; blurb: string; endpoints: Endpoint[] };

export const FAMILIES: Family[] = [
  {
    name: "Auth & API keys", blurb: "Self-serve. Sign up and your sandbox key is issued instantly — unmetered, no approval step.",
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
    name: "Customers", blurb: "The person or business. Capabilities tell you which rails they can use and what's still outstanding.",
    endpoints: [
      { verb: "POST", path: "/v2/customers", does: "Create a customer", auth: "KEY" },
      { verb: "GET", path: "/v2/customers/:id", does: "Retrieve a customer", auth: "KEY" },
      { verb: "GET", path: "/v2/customers", does: "List and search customers", auth: "KEY" },
      { verb: "PATCH", path: "/v2/customers/:id", does: "Update a customer", auth: "KEY" },
      { verb: "DELETE", path: "/v2/customers/:id", does: "Soft delete — blocked while accounts exist", auth: "KEY" },
      { verb: "GET", path: "/v2/customers/:id/capabilities", does: "Per-rail status and outstanding requirements", auth: "KEY" },
    ],
  },
  {
    name: "Onboarding applications", blurb: "KYC and KYB. Lifecycle status is separate from the decision, so a running review never looks like a rejection.",
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
    name: "Accounts", blurb: "Multi-currency balances on one ledger. Typed by what the account does, not just what it holds.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts", does: "Open an account", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts/:id", does: "Balance and identifiers", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts", does: "List accounts", auth: "KEY" },
      { verb: "PATCH", path: "/v2/accounts/:id", does: "Update an account", auth: "KEY" },
      { verb: "DELETE", path: "/v2/accounts/:id", does: "Close an account", auth: "KEY" },
    ],
  },
  {
    name: "Receiving details", blurb: "The issued instrument. One account can carry several — an IBAN, a sort code, a PayNow alias.",
    endpoints: [
      { verb: "POST", path: "/v2/accounts/:id/details", does: "Issue receiving details for a rail", auth: "KEY" },
      { verb: "GET", path: "/v2/accounts/:id/details", does: "List receiving details", auth: "KEY" },
      { verb: "GET", path: "/v2/details/:id", does: "Retrieve one instrument", auth: "KEY" },
    ],
  },
  {
    name: "Wallets", blurb: "On-chain balances per asset and network, with policies attached.",
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
    name: "Recipients", blurb: "A person is not an account number. One recipient holds many destinations.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients", does: "Create a recipient", auth: "KEY" },
      { verb: "GET", path: "/v2/recipients/:id", does: "Retrieve a recipient", auth: "KEY" },
      { verb: "GET", path: "/v2/recipients", does: "List recipients", auth: "KEY" },
      { verb: "PATCH", path: "/v2/recipients/:id", does: "Update a recipient", auth: "KEY" },
      { verb: "DELETE", path: "/v2/recipients/:id", does: "Delete a recipient", auth: "KEY" },
    ],
  },
  {
    name: "Destinations", blurb: "Where money actually lands, typed by rail. Includes name checking before you send.",
    endpoints: [
      { verb: "POST", path: "/v2/recipients/:id/destinations", does: "Add a destination", auth: "KEY" },
      { verb: "GET", path: "/v2/destinations/:id", does: "Retrieve a destination", auth: "KEY" },
      { verb: "PATCH", path: "/v2/destinations/:id", does: "Update a destination", auth: "KEY" },
      { verb: "DELETE", path: "/v2/destinations/:id", does: "Remove a destination", auth: "KEY" },
      { verb: "POST", path: "/v2/destinations/:id/verify", does: "Confirmation of Payee name check", auth: "KEY" },
    ],
  },
  {
    name: "Quotes & exchange", blurb: "A quote is an object with an id and an expiry, so the price you showed is the price you can audit.",
    endpoints: [
      { verb: "POST", path: "/v2/quotes", does: "Create a quote, held for 30 seconds", auth: "KEY" },
      { verb: "GET", path: "/v2/quotes/:id", does: "Retrieve a quote and its expiry", auth: "KEY" },
      { verb: "POST", path: "/v2/quotes/:id/execute", does: "Execute a held quote", auth: "KEY" },
      { verb: "GET", path: "/v2/rates", does: "Indicative rate, not lockable", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/pairs", does: "Supported pairs and depth", auth: "PUBLIC" },
    ],
  },
  {
    name: "Stablecoin FX", blurb: "Three legs, priced honestly. The ramps are 1:1 — only the corridor between them carries a spread.",
    endpoints: [
      { verb: "GET", path: "/v2/assets", does: "Every fiat and stablecoin, and what each redeems against", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/corridors", does: "Corridor depth, spread and settlement per pair", auth: "PUBLIC" },
      { verb: "POST", path: "/v2/fx/quote", does: "Price one leg — on-ramp, corridor or off-ramp", auth: "KEY" },
      { verb: "POST", path: "/v2/fx/route", does: "The full cross-border route, leg by leg", auth: "KEY" },
      { verb: "POST", path: "/v2/ramps/on", does: "Fiat in, stablecoin minted 1:1", auth: "KEY" },
      { verb: "POST", path: "/v2/ramps/off", does: "Stablecoin redeemed 1:1 back to fiat", auth: "KEY" },
      { verb: "GET", path: "/v2/ramps", does: "Ramp history", auth: "KEY" },
      { verb: "GET", path: "/v2/fx/depth", does: "Aggregate resting depth — never maker identity", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/price", does: "Imbalance-derived price for a corridor", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/fx/pricing-model", does: "The constants and formula, so any quote can be rechecked", auth: "PUBLIC" },
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
    name: "Transfers", blurb: "One transfer, an ordered list of legs. Status is derived from the legs, never guessed.",
    endpoints: [
      { verb: "POST", path: "/v2/transfers", does: "Send on any rail", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers/:id", does: "Transfer with legs and status", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers", does: "List transfers", auth: "KEY" },
      { verb: "POST", path: "/v2/transfers/:id/cancel", does: "Cancel before funding", auth: "KEY" },
      { verb: "GET", path: "/v2/transfers/:id/legs", does: "Legs with their own rail and status", auth: "KEY" },
    ],
  },
  {
    name: "Cards", blurb: "Issue, control and reveal. Freeze is scoped to whoever set it.",
    endpoints: [
      { verb: "POST", path: "/v2/cards", does: "Issue a virtual or physical card", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id", does: "Card with status and reason", auth: "KEY" },
      { verb: "GET", path: "/v2/cards", does: "List cards", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/freeze", does: "Freeze a card", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/unfreeze", does: "Unfreeze a card", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/pin", does: "Get a secure PIN update link", auth: "KEY" },
      { verb: "POST", path: "/v2/cards/:id/reveal", does: "Ephemeral key for PCI-safe reveal", auth: "KEY" },
      { verb: "PATCH", path: "/v2/cards/:id/controls", does: "Limits and merchant categories", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id/transactions", does: "Card transactions", auth: "KEY" },
      { verb: "GET", path: "/v2/cards/:id/statements", does: "Card statements", auth: "KEY" },
    ],
  },
  {
    name: "Authorisations", blurb: "Approve or decline in your own webhook, inside 800ms.",
    endpoints: [
      { verb: "GET", path: "/v2/authorisations/:id", does: "Retrieve an authorisation", auth: "KEY" },
      { verb: "GET", path: "/v2/authorisations", does: "List pending and cleared", auth: "KEY" },
      { verb: "POST", path: "/v2/authorisations/:id/approve", does: "Approve in real time", auth: "KEY" },
      { verb: "POST", path: "/v2/authorisations/:id/decline", does: "Decline in real time", auth: "KEY" },
    ],
  },
  {
    name: "Disputes", blurb: "Chargebacks with network reason codes and the timers regulators expect.",
    endpoints: [
      { verb: "POST", path: "/v2/disputes", does: "Raise a dispute", auth: "KEY" },
      { verb: "GET", path: "/v2/disputes/:id", does: "Dispute with reason code and deadline", auth: "KEY" },
      { verb: "GET", path: "/v2/disputes", does: "List disputes", auth: "KEY" },
      { verb: "POST", path: "/v2/disputes/:id/evidence", does: "Submit evidence", auth: "KEY" },
    ],
  },
  {
    name: "Savings vaults", blurb: "Ring-fenced balances with daily accrual and round-ups.",
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
    name: "Credit lines", blurb: "Revolving credit against deposits or collateral, with margin calls by webhook.",
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
    name: "Policies", blurb: "Rules attached to accounts, wallets and cards. The spend-control engine.",
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
    name: "Approval chains", blurb: "Procedural approvals with thresholds — distinct from cryptographic signing.",
    endpoints: [
      { verb: "POST", path: "/v2/approval-chains", does: "Create a chain", auth: "KEY" },
      { verb: "GET", path: "/v2/approval-chains/:id", does: "Retrieve a chain", auth: "KEY" },
      { verb: "GET", path: "/v2/approvals", does: "Pending approvals inbox", auth: "KEY" },
      { verb: "POST", path: "/v2/approvals/:id/approve", does: "Approve a step", auth: "KEY" },
      { verb: "POST", path: "/v2/approvals/:id/reject", does: "Reject a step", auth: "KEY" },
    ],
  },
  {
    name: "Organisations", blurb: "Teams, roles and a real permission matrix.",
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
    name: "Ledger & statements", blurb: "Double-entry. Query it, stream it, hand it to an auditor.",
    endpoints: [
      { verb: "GET", path: "/v2/ledger", does: "Double-entry entries", auth: "KEY" },
      { verb: "GET", path: "/v2/ledger/balances", does: "Balances at a point in time", auth: "KEY" },
      { verb: "POST", path: "/v2/statements", does: "Generate a statement", auth: "KEY" },
      { verb: "GET", path: "/v2/statements/:id", does: "CSV, PDF or signed JSON", auth: "KEY" },
    ],
  },
  {
    name: "Fees", blurb: "Configured once, disclosed on every transaction it touches.",
    endpoints: [
      { verb: "GET", path: "/v2/fees/config", does: "Current fee configuration", auth: "KEY" },
      { verb: "PUT", path: "/v2/fees/config", does: "Set the fee payout destination", auth: "KEY" },
    ],
  },
  {
    name: "Rails registry", blurb: "Cut-offs, holidays and field schemas as data you can query — not a table in the docs.",
    endpoints: [
      { verb: "GET", path: "/v2/rails", does: "Rail availability and cut-offs", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id", does: "Field schema and limits for a rail", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/rails/:id/calendar", does: "Business days and holidays", auth: "PUBLIC" },
    ],
  },
  {
    name: "QR & payment links", blurb: "EMVCo QR in both directions, plus shareable payment links.",
    endpoints: [
      { verb: "POST", path: "/v2/qr/decode", does: "Decode a merchant or consumer QR", auth: "KEY" },
      { verb: "POST", path: "/v2/qr/generate", does: "Generate an EMVCo QR payload", auth: "KEY" },
      { verb: "POST", path: "/v2/links", does: "Create a payment link", auth: "KEY" },
      { verb: "GET", path: "/v2/links/:id", does: "Link status and payments", auth: "KEY" },
    ],
  },
  {
    name: "Bills & subscriptions", blurb: "Direct debit mandates and recurring payments.",
    endpoints: [
      { verb: "POST", path: "/v2/mandates", does: "Create a direct debit mandate", auth: "KEY" },
      { verb: "GET", path: "/v2/mandates/:id", does: "Mandate status", auth: "KEY" },
      { verb: "POST", path: "/v2/subscriptions", does: "Create a recurring payment", auth: "KEY" },
      { verb: "GET", path: "/v2/subscriptions", does: "List subscriptions", auth: "KEY" },
    ],
  },
  {
    name: "Webhooks", blurb: "Signed, replayable, with 30 days of delivery history.",
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
    name: "Events", blurb: "The audit stream behind everything above.",
    endpoints: [
      { verb: "GET", path: "/v2/events", does: "Paginated event stream", auth: "KEY" },
      { verb: "GET", path: "/v2/events/:id", does: "Retrieve one event", auth: "KEY" },
    ],
  },
  {
    name: "Sandbox", blurb: "Drive failures on purpose. Pause at a state, then advance past it.",
    endpoints: [
      { verb: "GET", path: "/v2/sandbox/scenarios", does: "Scenario catalogue", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/payments", does: "Simulate an inbound payment", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/onboarding", does: "Simulate an onboarding transition", auth: "KEY" },
      { verb: "POST", path: "/v2/sandbox/:id/advance", does: "Advance a paused simulation", auth: "KEY" },
      { verb: "GET", path: "/v2/sandbox/:id", does: "Simulation and callback history", auth: "KEY" },
    ],
  },
  {
    name: "Reference data", blurb: "Countries, currencies and networks, so you don't hardcode them.",
    endpoints: [
      { verb: "GET", path: "/v2/countries", does: "Supported countries", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/currencies", does: "Supported currencies", auth: "PUBLIC" },
      { verb: "GET", path: "/v2/networks", does: "Supported blockchain networks", auth: "PUBLIC" },
    ],
  },
];

export const TOTAL_ENDPOINTS = FAMILIES.reduce((n, f) => n + f.endpoints.length, 0);
