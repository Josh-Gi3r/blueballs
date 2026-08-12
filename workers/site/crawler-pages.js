const SITE = "https://blueballs.tech";

const NAV = [
  ["Home", "/"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Providers", "/ecosystem"],
  ["Developers", "/developers"],
  ["Build notes", "/bulletin"],
];

const PRODUCTS = [
  "Accounts", "Cards", "Transfers", "Exchange", "Savings vaults",
  "Credit lines", "Business banking", "Ledger and statements",
  "Onboarding and KYC", "QR and payment links", "Wallets",
  "Webhooks and events", "Sandbox scenarios", "Bills and subscriptions",
  "Rails registry",
];

const API_FAMILIES = [
  "Authentication", "Customers", "Onboarding", "Accounts", "Receiving details",
  "Wallets", "Recipients", "Destinations", "Quotes", "Stablecoin FX",
  "Transfers", "Cards", "Authorisations", "Disputes", "Vaults", "Credit",
  "Policies", "Approvals", "Organisations", "Ledger", "Fees", "Rails",
  "QR payments", "Bills", "Webhooks", "Events", "Sandbox", "Reference data",
];

const PROVIDER_CATEGORIES = [
  "Sponsor and safeguarding", "KYC, KYB, AML and fraud",
  "Accounts and virtual accounts", "Fiat pay-ins and payouts",
  "Stablecoins and on/off ramps", "Wallets and custody", "Card issuing",
  "FX liquidity, data and treasury", "Open banking and account verification",
  "Reconciliation, operations and security",
];

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

const PAGES = {
  "/": {
    title: "Blueballs — open-source software for building a neobank",
    description: "Blueballs is free, MIT-licensed software for building accounts, cards, transfers, onboarding, ledger and FX into a financial product.",
    body: `<h1>Open-source software for building a neobank.</h1>
      <p>Blueballs is a self-hostable banking software stack. It includes APIs and sandbox workflows for accounts, cards, transfers, onboarding, ledger, wallets and FX.</p>
      <p>You can run it locally, create a sandbox key without applying, and connect the regulated providers required by your own deployment.</p>
      <h2>What is included</h2>${list(PRODUCTS)}
      <p><a href="/developers">Use the sandbox API</a> or <a href="https://github.com/Josh-Gi3r/blueballs">view the source on GitHub</a>.</p>`,
  },
  "/products": {
    title: "Products — Blueballs",
    description: "Accounts, cards, transfers, onboarding, ledger, wallets and other banking product software included in Blueballs.",
    body: `<h1>Products</h1>
      <p>Blueballs provides software and sandbox APIs for common parts of a neobank or embedded-finance product.</p>
      ${list(PRODUCTS)}
      <p>The included sandbox does not move real money. A production deployment connects its own banks, payment rails, identity services, card processors and other providers.</p>
      <p><a href="/developers">See the API</a></p>`,
  },
  "/fx": {
    title: "Stablecoin FX — Blueballs",
    description: "Open-source FX software for quotes, pricing policy, liquidity routing, risk limits and settlement tracking.",
    body: `<h1>FX software for financial products</h1>
      <p>The Blueballs FX packages cover customer quotes, pricing policy, liquidity selection, reservation, treasury limits and settlement records.</p>
      <p>The page includes an interactive BRL-to-EUR example to demonstrate the software. BRL and EUR are an example corridor, not the scope of the FX product.</p>
      <h2>Included components</h2>
      ${list(["FX node and JavaScript SDK", "Participant and corridor policy", "Reference and principal pricing", "Liquidity routing", "Fiat settlement intents", "Settlement contracts", "Deterministic failure simulator"])}
      <p>The public demo uses deterministic data and does not execute production payments or connect to a live liquidity provider.</p>
      <p><a href="https://github.com/Josh-Gi3r/blueballs/tree/main/apps/fx-node">View the FX node source</a></p>`,
  },
  "/ecosystem": {
    title: "Provider directory — Blueballs",
    description: "A filterable directory of services a neobank deployment may need, grouped by function and region.",
    body: `<h1>Provider directory</h1>
      <p>This directory groups companies by the services they provide. It is a research tool, not a ranking or a list of recommendations.</p>
      ${list(PROVIDER_CATEGORIES)}
      <p>Blueballs does not include provider accounts or credentials. Builders obtain those directly from the companies they choose.</p>
      <p>No listing implies a partnership, endorsement or existing Blueballs integration.</p>`,
  },
  "/developers": {
    title: "Developers — Blueballs",
    description: "Create a Blueballs sandbox key and use the reference API without applying for access.",
    body: `<h1>Blueballs API</h1>
      <p>Create a sandbox key directly on this page. No application or approval is required.</p>
      <p>The hosted API creates sandbox state and does not move real money or call production providers.</p>
      <h2>API families</h2>${list(API_FAMILIES)}
      <p><a href="/openapi.yaml">OpenAPI specification</a> · <a href="https://github.com/Josh-Gi3r/blueballs">GitHub repository</a></p>`,
  },
  "/bulletin": {
    title: "Build notes — Blueballs",
    description: "Development notes and changes to the Blueballs open-source neobank software stack.",
    body: `<h1>Build notes</h1><p>Notes about changes to the Blueballs software, API and website.</p><p><a href="https://github.com/Josh-Gi3r/blueballs/commits/main">View the current commit history on GitHub</a>.</p>`,
  },
  "/contact": {
    title: "Project contact — Blueballs",
    description: "Project links for Blueballs, including GitHub issues and security reporting.",
    body: `<h1>Project contact</h1><p>Sandbox keys are available directly from the <a href="/developers">developer page</a>.</p><p>For project questions, use <a href="https://github.com/Josh-Gi3r/blueballs/issues">GitHub Issues</a>. For security reports, see the repository security policy.</p>`,
  },
};

export const PUBLIC_PATHS = Object.keys(PAGES);

export function crawlerDocument(pathname) {
  const page = PAGES[pathname] ?? PAGES["/"];
  const canonical = `${SITE}${pathname === "/" ? "" : pathname}`;
  return `<div id="root" data-server-content="true">
    <header><a href="/">Blueballs</a><nav>${NAV.map(([label, path]) => `<a href="${path}">${label}</a>`).join(" ")}</nav></header>
    <main>${page.body}</main>
    <footer><p>Blueballs is MIT-licensed open-source software.</p></footer>
  </div>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": pathname === "/" ? "SoftwareApplication" : "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Blueballs", url: SITE },
  })}</script>`;
}

export function pageMetadata(pathname) {
  return PAGES[pathname] ?? PAGES["/"];
}

export function robotsText() {
  return `# Blueballs is public and may be indexed, quoted and used by search and AI systems.
User-agent: *
Allow: /

Content-Signal: search=yes, ai-input=yes, ai-train=yes, use=full
Sitemap: ${SITE}/sitemap.xml
`;
}

export function sitemapXml() {
  const entries = PUBLIC_PATHS.map((path) => `<url><loc>${SITE}${path === "/" ? "" : path}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export function llmsText(full = false) {
  const intro = `# Blueballs

Blueballs is free, MIT-licensed, self-hostable software for building neobank and embedded-finance products. It includes sandbox APIs for accounts, cards, transfers, onboarding, ledger, wallets and FX. It is software, not a bank or regulated financial provider.

## Public pages
${NAV.map(([label, path]) => `- [${label}](${SITE}${path})`).join("\n")}

## Source
- [GitHub repository](https://github.com/Josh-Gi3r/blueballs)
- [OpenAPI specification](${SITE}/openapi.yaml)
`;
  if (!full) return intro;
  return `${intro}\n## Page summaries\n${PUBLIC_PATHS.map((path) => {
    const page = PAGES[path];
    return `\n### ${page.title}\n${page.description}\nURL: ${SITE}${path}`;
  }).join("\n")}\n`;
}
