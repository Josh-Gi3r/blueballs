const SITE = "https://blueballs.tech";

const NAV = [
  ["Cover", "/"],
  ["Home", "/home"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Cards", "/cards"],
  ["Providers", "/ecosystem"],
  ["Sandbox", "/sandbox"],
  ["Developers", "/developers"],
];

const PRODUCTS = [
  "Accounts and receiving details",
  "Cards and authorisation controls",
  "Transfers and payment rails",
  "Identity and onboarding",
  "Wallets and custody orchestration",
  "Double-entry ledger and statements",
  "Vaults and credit",
  "Business banking, roles and approvals",
  "QR payments and payment links",
  "Webhooks and durable events",
  "Provider orchestration",
  "Policy-aware stablecoin FX",
  "Sandbox Builder",
];

const API_FAMILIES = [
  "Authentication and scoped keys",
  "Customers and onboarding",
  "Accounts and receiving details",
  "Wallets, recipients and destinations",
  "Quotes and stablecoin FX",
  "Transfers and payment rails",
  "Cards, authorisations and disputes",
  "Vaults and credit",
  "Policies and approvals",
  "Organisations and business banking",
  "Ledger and fees",
  "QR payments",
  "Bills and subscriptions",
  "Webhooks and events",
  "Sandbox and reference data",
];

const PROVIDER_CATEGORIES = [
  "Sponsor banking and safeguarding",
  "KYC, KYB, AML and fraud",
  "Accounts and virtual accounts",
  "Fiat pay-ins and payouts",
  "Stablecoins and on/off ramps",
  "Wallets and custody",
  "Card issuing and processing",
  "FX liquidity, market data and treasury",
  "Open banking and account verification",
  "Reconciliation, operations and security",
];

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

const PAGES = {
  "/": {
    title: "Blueballs — build the financial institution your market needs",
    description:
      "Open-source financial infrastructure for banking, provider orchestration and policy-aware FX.",
    body: `<h1>Build the financial institution your market needs.</h1><p>Blueballs is the open-source operating system for modern financial institutions: banking, provider orchestration and policy-aware FX in one institution-owned stack.</p><p><a href="/home">Enter Blueballs</a> or <a href="/sandbox">launch the sandbox</a>.</p>`,
  },
  "/home": {
    title: "Blueballs — open-source operating system for modern financial institutions",
    description:
      "A 181-operation banking API, exact double-entry ledger, durable provider orchestration and policy-aware FX in one institution-owned stack.",
    body: `<h1>The operating system for modern financial institutions.</h1><p>Blueballs combines a 181-operation banking API, exact double-entry ledger, atomic financial commands, durable provider orchestration and policy-aware FX. Run it, inspect it and extend it under the MIT license.</p><h2>One financial core, many products</h2>${list(PRODUCTS)}<p><a href="/sandbox">Launch the sandbox</a>, <a href="/developers">inspect the API</a> or <a href="https://github.com/Josh-Gi3r/blueballs">read the source</a>.</p>`,
  },
  "/products": {
    title: "Financial products — Blueballs",
    description:
      "Accounts, cards, payments, identity, wallets, business banking, ledger and FX on one exact financial core.",
    body: `<h1>Banking, cards, providers and FX on one financial core.</h1><p>Product surfaces share tenant identity, exact money, double-entry ledger semantics, idempotency, durable events and audit. Provider-specific execution stays behind explicit capability contracts so institutions can compose the regulated infrastructure their markets require without rewriting the financial core.</p>${list(PRODUCTS)}<p><a href="/developers">Inspect the API contract</a></p>`,
  },
  "/fx": {
    title: "Policy-aware stablecoin FX — Blueballs",
    description:
      "Multi-source FX infrastructure spanning participant policy, pricing, liquidity reservation, fiat evidence and atomic token settlement.",
    body: `<h1>Policy-aware FX for institution-owned money movement.</h1><p>Blueballs FX spans pricing, liquidity, reservation, settlement and on-chain atomic execution. Participation policy runs before pricing; selected liquidity is reserved before firm execution; fiat evidence is distinct from token finality; and adapter-driven production composition lets institutions connect their own liquidity venues, banking rails, custodians and settlement infrastructure without changing the FX kernel.</p><h2>Execution stack</h2>${list(["Participant and corridor policy", "Market and principal pricing", "Multi-source liquidity routing", "Firm reservation and rollback", "Fiat settlement intents and evidence", "Atomic token settlement contracts", "Explicit submission, reconciliation and finality", "JavaScript SDK and OpenAPI contract"])}<p>The public market lab uses deterministic inputs to make routing and policy decisions inspectable; the canonical FX runtime and production adapter contract ship in the repository.</p>`,
  },
  "/cards": {
    title: "Card intelligence and programme architecture — Blueballs",
    description:
      "Sourced card-programme intelligence paired with Blueballs card, ledger, policy and provider-orchestration primitives.",
    body: `<h1>Understand the card market. Design the programme behind it.</h1><p>Blueballs maps public card-programme models, funding patterns, custody boundaries, networks, geographies and disclosed infrastructure, then connects that intelligence to the product, ledger, policy and provider contracts required to build a card programme.</p><h2>Evidence and composition</h2><p>Programme records carry source URLs, as-of dates, jurisdictions and confidence labels. Commercial availability and regulated programme relationships are established by each deployment; the provider-neutral Blueballs core remains unchanged.</p><p><a href="/developers">Inspect the Cards API</a> or <a href="/ecosystem">explore provider capabilities</a>.</p>`,
  },
  "/ecosystem": {
    title: "Financial infrastructure provider directory — Blueballs",
    description:
      "Sourced provider capabilities across banking, identity, payments, cards, custody, liquidity and financial operations.",
    body: `<h1>Compose the regulated infrastructure behind your product.</h1><p>Blueballs keeps provider-specific execution behind capability contracts. The directory maps official provider capabilities across banking, identity, payments, cards, custody, liquidity and operations so deployers can evaluate the infrastructure appropriate to their markets.</p>${list(PROVIDER_CATEGORIES)}<p>Capabilities are sourced from official materials. Each deployment establishes its own commercial, regulatory and operational relationships while keeping the Blueballs financial core provider-neutral.</p>`,
  },
  "/sandbox": {
    title: "Build a financial institution sandbox — Blueballs",
    description:
      "Turn a product brief into a structured institution blueprint, provision isolated test state and exercise the protected double-entry ledger.",
    body: `<h1>Build a working financial institution sandbox.</h1><p>Describe the people you serve, choose markets, currencies, capabilities and rails, then provision isolated test customers, accounts and balances against the same banking contracts used throughout Blueballs.</p><h2>What the builder creates</h2>${list(["Structured institution blueprint", "Tenant-isolated test environment", "Verified test customers", "Multi-currency accounts", "Seeded test balances", "Protected-ledger payment journeys"])}`,
  },
  "/developers": {
    title: "Developers — Blueballs",
    description:
      "Inspect the 181-operation banking contract, FX OpenAPI, scoped sandbox keys and source for the Blueballs financial operating system.",
    body: `<h1>Inspect the financial core end to end.</h1><p>Issue a scoped sandbox key, open the machine-readable API contracts or run the stack yourself: <code>git clone https://github.com/Josh-Gi3r/blueballs.git &amp;&amp; pnpm install &amp;&amp; pnpm dev</code>.</p><h2>API families</h2>${list(API_FAMILIES)}<p><a href="/openapi.yaml">Banking OpenAPI</a> · <a href="/openapi.fx.yaml">FX OpenAPI</a> · <a href="https://github.com/Josh-Gi3r/blueballs">Source</a></p>`,
  },
  "/contact": {
    title: "Project and security — Blueballs",
    description:
      "Source, issue tracking and private vulnerability reporting for the Blueballs open-source project.",
    body: `<h1>Build on it, inspect it, challenge it.</h1><p>Blueballs is MIT licensed. Source, implementation history and issue tracking are public at <a href="https://github.com/Josh-Gi3r/blueballs">github.com/Josh-Gi3r/blueballs</a>; private vulnerability reporting is available through GitHub Security Advisories.</p>`,
  },
};

export const PUBLIC_PATHS = Object.keys(PAGES);

export function crawlerDocument(pathname) {
  const page = PAGES[pathname] ?? PAGES["/"];
  const canonical = `${SITE}${pathname === "/" ? "" : pathname}`;
  return `<div id="root" data-server-content="true"><header><a href="/home">Blueballs</a><nav>${NAV.map(([label, path]) => `<a href="${path}">${label}</a>`).join(" ")}</nav></header><main>${page.body}</main><footer><p>Blueballs is the MIT-licensed open-source operating system for modern financial institutions.</p></footer></div><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": pathname === "/" ? "SoftwareApplication" : "WebPage", name: page.title, description: page.description, url: canonical, isPartOf: { "@type": "WebSite", name: "Blueballs", url: SITE } })}</script>`;
}

export function pageMetadata(pathname) {
  return PAGES[pathname] ?? PAGES["/"];
}

export function robotsText() {
  return `# Blueballs is public and may be indexed, quoted and used by search and AI systems.\nUser-agent: *\nAllow: /\n\nContent-Signal: search=yes, ai-input=yes, ai-train=yes, use=full\nSitemap: ${SITE}/sitemap.xml\n`;
}

export function sitemapXml() {
  const entries = PUBLIC_PATHS.map(
    (path) => `<url><loc>${SITE}${path === "/" ? "" : path}</loc></url>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export function llmsText(full = false) {
  const intro = `# Blueballs\n\nBlueballs is the MIT-licensed, self-hostable open-source operating system for modern financial institutions. It combines a 181-operation banking API, exact double-entry ledger, atomic financial commands, durable provider orchestration and policy-aware stablecoin FX. Institutions keep the financial core while composing their own regulated providers, liquidity venues, banking rails, custodians and settlement infrastructure through explicit capability contracts.\n\n## Public pages\n${NAV.map(([label, path]) => `- [${label}](${SITE}${path})`).join("\n")}\n\n## Machine-readable contracts and source\n- [Banking OpenAPI](${SITE}/openapi.yaml)\n- [FX OpenAPI](${SITE}/openapi.fx.yaml)\n- [Source](https://github.com/Josh-Gi3r/blueballs) — MIT licensed and self-hostable.\n`;
  if (!full) return intro;
  return `${intro}\n## Page summaries\n${PUBLIC_PATHS.map((path) => {
    const page = PAGES[path];
    return `\n### ${page.title}\n${page.description}\nURL: ${SITE}${path}`;
  }).join("\n")}\n`;
}
