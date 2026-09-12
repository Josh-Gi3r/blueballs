const SITE = "https://blueballs.tech";
const NAV = [
  ["Cover", "/"],
  ["Home", "/home"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Cards", "/cards"],
  ["Providers", "/ecosystem"],
  ["Blueprints", "/blueprint"],
  ["Proof", "/proof"],
  ["Sandbox", "/sandbox"],
  ["Developers", "/developers"],
  ["Build with Blueballs", "/contact"],
];
const PRODUCTS = [
  "Accounts",
  "Cards",
  "Transfers",
  "Exchange",
  "Savings vaults",
  "Credit lines",
  "Business banking",
  "Ledger and statements",
  "Onboarding and KYC",
  "QR and payment links",
  "Wallets",
  "Webhooks and events",
  "Sandbox scenarios",
  "Bills and subscriptions",
  "Rails registry",
];
const API_FAMILIES = [
  "Authentication",
  "Customers",
  "Onboarding",
  "Accounts",
  "Receiving details",
  "Wallets",
  "Recipients",
  "Destinations",
  "Quotes",
  "Stablecoin FX",
  "Transfers",
  "Cards",
  "Authorisations",
  "Disputes",
  "Vaults",
  "Credit",
  "Policies",
  "Approvals",
  "Organisations",
  "Ledger",
  "Fees",
  "Rails",
  "QR payments",
  "Bills",
  "Webhooks",
  "Events",
  "Sandbox",
  "Reference data",
];
const PROVIDER_CATEGORIES = [
  "Sponsor and safeguarding",
  "KYC, KYB, AML and fraud",
  "Accounts and virtual accounts",
  "Fiat pay-ins and payouts",
  "Stablecoins and on/off ramps",
  "Wallets and custody",
  "Card issuing",
  "FX liquidity, data and treasury",
  "Open banking and account verification",
  "Reconciliation, operations and security",
];
const BLUEPRINTS = [
  "Creator Bank Singapore",
  "Freelancer Current Account",
  "Stablecoin Treasury",
  "SEA Remittance Network",
  "Stablecoin Card Programme",
  "Merchant Settlement Network",
  "Community Wallet",
  "Institution-Owned FX Desk",
];
const STANDARD_PROOF = [
  "Build, TypeScript, syntax, lint and formatting",
  "Banking API runtime and the 181-operation OpenAPI contract",
  "Machine-readable request, response and generated-client contract sync",
  "Nine FX package suites and SDK package-boundary checks",
  "Foundry format, build, fuzz and invariant tests",
  "Cloudflare Worker runtime and Durable Object eviction behaviour",
  "Public route, provider, card-provenance and publication truth",
  "Disposable scratch financial behaviour and tenant isolation",
];
const RELEASE_PROOF = [
  "Tracked-secret and production dependency audit",
  "CycloneDX dependency inventory",
  "Financial restart and chaos suite",
  "Disposable banking and FX load proof",
  "Reference-container security scan",
  "Exact-checkout verification evidence tied to commit and tree",
];
function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}
const PAGES = {
  "/": {
    title: "Blueballs — build the financial institution your market needs",
    description:
      "Open financial infrastructure for banking, institution-owned FX, provider orchestration and programmable financial products.",
    body: `<h1>Build the financial institution your market needs.</h1><p>Banking, cards, payments, wallets, ledger, provider orchestration and institution-owned FX in one MIT-licensed stack.</p><p><a href="/home">Explore Blueballs</a>, <a href="/sandbox">build in the sandbox</a> or <a href="https://github.com/Josh-Gi3r/blueballs">inspect the source</a>.</p>`,
  },
  "/home": {
    title: "Blueballs — open financial operating system",
    description:
      "An MIT-licensed financial operating system for banking products, provider orchestration, stablecoin FX and programmable money movement.",
    body: `<h1>Own the financial stack.</h1><p>Blueballs puts the product, ledger, provider composition and FX control plane in the hands of the institution building the experience. Clone it, inspect it, fork it and connect the infrastructure your market needs.</p><h2>Build the financial institution your market needs.</h2><p>A company. A community. A city. An industry. A marketplace. Or something nobody has built yet.</p><h2>What ships in Blueballs</h2>${list(PRODUCTS)}<p><a href="/blueprint">Explore product Blueprints</a>, <a href="/proof">inspect the verification proof</a>, <a href="/sandbox">build in the sandbox</a>, <a href="/developers">inspect the API</a> or <a href="/contact">build with Blueballs</a>.</p>`,
  },
  "/products": {
    title: "Financial products — Blueballs",
    description:
      "Accounts, cards, transfers, onboarding, wallets, ledger, FX and financial-product primitives built on one open financial core.",
    body: `<h1>Build the financial products your market needs.</h1><p>Start with accounts, cards, transfers, onboarding, wallets, FX, business banking and more. Keep one financial core while the customer experience, providers and market composition evolve around it.</p><h2>See the product and the contract together</h2><p>Walk through onboarding, funding, spending and payouts with the API call behind each experience.</p>${list(PRODUCTS)}<p><a href="/blueprint">Fork a product Blueprint</a>, <a href="/proof">inspect the proof</a>, <a href="/developers">inspect the API</a> or <a href="/contact">build an implementation</a>.</p>`,
  },
  "/fx": {
    title: "Build and operate your own FX market — Blueballs",
    description:
      "Open-source FX control plane for policy, pricing, liquidity, treasury, routing, reservations, execution and settlement.",
    body: `<h1>Build and operate your own FX market.</h1><p>Blueballs treats stablecoin FX as an institution-owned market and control plane. Combine private orders, issuer inventory, professional makers, treasury or principal capacity and external venues behind one policy and lifecycle model.</p><h2>Included components</h2>${list(["Canonical FX node and JavaScript SDK", "Participant and corridor policy", "Exact market and principal pricing", "Multi-source liquidity routing", "Capacity reservation", "Fiat settlement evidence", "Atomic token settlement contracts", "Failure and reconciliation simulation"])}<p>The interactive architecture lab uses deterministic reference data so its behaviour is reproducible from source. Production deployments connect market, liquidity, fiat and execution infrastructure through the FX runtime adapter.</p><p><a href="/proof">Inspect the release and deployment proof</a>, <a href="/contact">build an FX implementation</a> or <a href="https://github.com/Josh-Gi3r/blueballs">inspect the source</a>.</p>`,
  },
  "/cards": {
    title: "The stablecoin card market, mapped — Blueballs",
    description:
      "Independent, sourced market intelligence for stablecoin and crypto card programmes, funding models, custody, networks and infrastructure.",
    body: `<h1>The stablecoin card market, mapped.</h1><p>Compare public card-programme models, funding patterns, custody boundaries, networks and disclosed infrastructure, then use the research to design your own card product on Blueballs.</p><h2>Research standard</h2><p>Each programme carries source, jurisdiction and confidence information. Relationship and technical status are shown explicitly so market research stays separate from claimed Blueballs integrations.</p><p><a href="/developers">Inspect the Blueballs Cards API</a> or <a href="/contact">build a card programme</a>.</p>`,
  },
  "/ecosystem": {
    title: "Financial infrastructure provider directory — Blueballs",
    description:
      "Compare banking, identity, payments, cards, custody, stablecoin, FX and operations infrastructure by capability and region.",
    body: `<h1>Choose the infrastructure behind your product.</h1><p>Blueballs keeps the software core provider-neutral. Use the directory to compare banking, identity, payments, cards, custody, liquidity and other infrastructure while keeping provider relationships outside the canonical financial model.</p>${list(PROVIDER_CATEGORIES)}<p>Listings link to official sources. Relationship and technical status are shown explicitly; a listing does not by itself claim a Blueballs partnership or production integration.</p><p><a href="/contact">Build an adapter or add a provider</a>.</p>`,
  },
  "/sandbox": {
    title: "Build a fintech sandbox — Blueballs",
    description:
      "Turn a financial-product brief into a structured blueprint, isolated test environment and protected-ledger product journey.",
    body: `<h1>Design the product. Provision the sandbox. Run the money flow.</h1><p>Describe the people you serve, choose markets, currencies, capabilities and rails, then turn the brief into an isolated Blueballs environment with test customers, accounts, balances and ledger-backed payment journeys.</p><h2>What the Builder creates</h2>${list(["Structured product blueprint", "Tenant-isolated test environment", "Approved test customers", "Multi-currency sandbox accounts", "Seeded test balances", "Protected-ledger payment journeys"])}<p><a href="/blueprint">Start from a public Blueprint</a> or <a href="/contact">take a design into implementation</a>.</p>`,
  },
  "/blueprint": {
    title: "Financial product Blueprint library — Blueballs",
    description:
      "Inspect and fork public Blueprints for creator banking, treasury, cards, remittance, merchant finance, community wallets and institutional FX.",
    body: `<h1>Start from a product. Fork the architecture.</h1><p>The Blueballs Blueprint Library turns reusable financial-product architecture into a distribution layer for the open-source stack. Inspect an example, compare matching infrastructure, generate an implementation brief and fork the structure back into Builder.</p><h2>Public Blueprints</h2>${list(BLUEPRINTS)}<h2>Public-safe by design</h2><p>Shared Blueprints contain only name, markets, currencies, capabilities, rails and an optional accent. They exclude sandbox IDs, API keys, customers, balances, transactions, free-text audience descriptions and tenant state. Shared architecture lives in the URL fragment, which browsers do not send to the server as part of the HTTP request.</p><p><a href="/sandbox">Build from scratch</a> or <a href="/ecosystem">explore providers</a>.</p>`,
  },
  "/proof": {
    title: "Technical proof and deployment parity — Blueballs",
    description:
      "Inspect the verification, release and deployment gates behind Blueballs and see whether the live site, banking and FX stack report the same source commit.",
    body: `<h1>Financial infrastructure should show its work.</h1><p>Blueballs keeps verification inspectable. The live Proof product reads source parity from <code>/api/health</code>, while the repository publishes the standard verification, full release and deployment-promotion gates.</p><h2>Standard verification</h2>${list(STANDARD_PROOF)}<h2>Full release profile</h2>${list(RELEASE_PROOF)}<h2>Deployment promotion</h2><p>Deployment requires a clean checkout where HEAD equals origin/main, the full release proof runs before publication, the exact source commit is injected as <code>BLUEBALLS_GIT_SHA</code>, and a full-stack promotion checks that site, banking and FX converge on the same exact source SHA.</p><p>The page does not claim a third-party audit or fabricate a pass badge. <a href="/proof">Open live Proof</a> or <a href="https://github.com/Josh-Gi3r/blueballs">inspect the source</a>.</p>`,
  },
  "/developers": {
    title: "Build with the Blueballs API",
    description:
      "Create a sandbox key, inspect the financial contracts and run the complete open-source banking and FX stack yourself.",
    body: `<h1>Inspect it. Run it. Build on it.</h1><p>Create a sandbox key without applying for access and inspect the contract now. Or run the complete stack yourself: <code>git clone https://github.com/Josh-Gi3r/blueballs.git &amp;&amp; pnpm install &amp;&amp; pnpm dev</code>.</p><p>The hosted environment uses isolated test state. Production deployments connect their own provider adapters, credentials and operating policy around the same core contracts.</p><h2>API families</h2>${list(API_FAMILIES)}<p><a href="/openapi.yaml">OpenAPI specification</a> · <a href="/proof">Verification proof</a> · <a href="/contact">Build an implementation</a></p>`,
  },
  "/contact": {
    title: "Build with Blueballs",
    description:
      "Design partner, implementation and provider routes for teams taking Blueballs from open source into a financial product or institution.",
    body: `<h1>Take Blueballs from open source to your market.</h1><p>Blueballs is free to use. Teams that want the project involved in product design, architecture, provider adapters, deployment or operating design can start a public non-confidential brief.</p><h2>Ways to build together</h2>${list(["Design a financial product with Blueballs", "Implement and adapt the open-source stack", "Connect a financial-infrastructure provider", "Contribute code, adapters, research or new primitives"])}<p><a href="https://github.com/Josh-Gi3r/blueballs/issues/new?template=design_partner.yml">Start a design-partner brief</a> or <a href="https://github.com/Josh-Gi3r/blueballs/issues/new?template=implementation.yml">discuss an implementation</a>.</p>`,
  },
};
export const PUBLIC_PATHS = Object.keys(PAGES);
export function crawlerDocument(pathname) {
  const page = PAGES[pathname] ?? PAGES["/"];
  const canonical = `${SITE}${pathname === "/" ? "" : pathname}`;
  return `<div id="root" data-server-content="true"><header><a href="/">Blueballs</a><nav>${NAV.map(([label, path]) => `<a href="${path}">${label}</a>`).join(" ")}</nav></header><main>${page.body}</main><footer><p>Blueballs is an MIT-licensed open financial operating system.</p></footer></div><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": pathname === "/" ? "SoftwareApplication" : "WebPage", name: page.title, description: page.description, url: canonical, isPartOf: { "@type": "WebSite", name: "Blueballs", url: SITE } })}</script>`;
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
  const intro = `# Blueballs\n\nBlueballs is a free, MIT-licensed, self-hostable financial operating system for banking products, provider orchestration, institution-owned stablecoin FX and programmable financial infrastructure. The repository combines product interfaces, banking and ledger contracts, provider boundaries, FX policy/pricing/routing, settlement primitives and release proof. Production deployments connect the regulated providers, credentials and jurisdiction-specific operating policy they require.\n\n## Public pages\n${NAV.map(([label, path]) => `- [${label}](${SITE}${path})`).join("\n")}\n\n## Contract and source status\n- [Banking OpenAPI specification](${SITE}/openapi.yaml)\n- [FX OpenAPI specification](${SITE}/openapi.fx.yaml)\n- [Technical proof and live deployment parity](${SITE}/proof)\n- [Source](https://github.com/Josh-Gi3r/blueballs) — MIT licensed. Clone, inspect, fork and run it.\n- [Build with Blueballs](${SITE}/contact) — design partner, implementation and provider routes.\n`;
  if (!full) return intro;
  return `${intro}\n## Page summaries\n${PUBLIC_PATHS.map((path) => {
    const page = PAGES[path];
    return `\n### ${page.title}\n${page.description}\nURL: ${SITE}${path}`;
  }).join("\n")}\n`;
}
