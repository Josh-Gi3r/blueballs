import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePath } from "./router";
import { FAMILIES, TOTAL_ENDPOINTS } from "./endpoints";
import PhoneScreen, { type Screen } from "./PhoneScreen";
import Device from "./Device";
import { TryIt, KeyIssuer, ApiStatus } from "./TryIt";
import Journey from "./Journey";
import FxPage from "./FxPage";
import { call, getStats, ensureKey, type SiteStats } from "./api";
import { BrandLockup } from "./Brand";

/* ------------------------------------------------------------------ */
/*  Ported from `Blueballs v2.dc.html` (Claude Design project).         */
/*  Re-synced 2026-08-05 — design is the source of truth; re-read it    */
/*  before editing this file.                                           */
/* ------------------------------------------------------------------ */

/** Stable dom id for a family section, so the contents list can actually reach it. */
const docSlug = (name: string) => "doc-fam-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const MONO = "'IBM Plex Mono', monospace";
const VERB_COLOR: Record<string, string> = {
  GET: "#2E7D53", POST: "#0647E8", PATCH: "#B0761E", PUT: "#B0761E", DELETE: "#B4453C",
};

type Page = "home" | "products" | "fx" | "dev" | "blog" | "contact";
const PATH_TO_PAGE: Record<string, Page> = {
  "/": "home", "/products": "products", "/fx": "fx", "/developers": "dev",
  "/bulletin": "blog", "/contact": "contact",
};
const PAGE_TO_PATH: Record<Page, string> = {
  home: "/", products: "/products", fx: "/fx", dev: "/developers", blog: "/bulletin", contact: "/contact",
};

/* Hover/focus wrapper — inline styles can't express :hover. */
function H({ as = "div", style, hover, focus, children, onClick, type, ...rest }: {
  as?: "div" | "button" | "a" | "input" | "textarea";
  style?: CSSProperties; hover?: CSSProperties; focus?: CSSProperties;
  children?: ReactNode; onClick?: () => void; type?: "button" | "submit"; [k: string]: unknown;
}) {
  const [h, setH] = useState(false);
  const [f, setF] = useState(false);
  const As = as as any;
  return (
    <As style={{ ...style, ...(h ? hover : {}), ...(f ? focus : {}) }}
      onClick={onClick} type={type}
      onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      onFocus={() => focus && setF(true)} onBlur={() => focus && setF(false)}
      {...rest}>{children}</As>
  );
}

const SCREENS: Screen[] = ["accounts", "cards", "transfers", "exchange", "vaults", "credit", "business", "ledger"];
// Every product renders its own phone screen alongside the call behind it.

const products = [
  { glyph: "AC", screen: "accounts" as Screen, tag: "ACCOUNTS", endpoint: "POST /v2/accounts", title: "Accounts", short: "Create multi-currency sandbox accounts and receiving details.",
    body: "Model personal and business accounts across six configured currencies. The sandbox generates sample identifiers and records every balance change on its ledger.",
    rows: [{ k: "CURRENCIES", v: "6 CONFIGURED" }, { k: "DETAILS", v: "SAMPLE IBAN · SORT · ROUTING" }, { k: "BALANCES", v: "LEDGER-BACKED" }, { k: "MODE", v: "SANDBOX" }],
    code: 'fetch("/v2/accounts", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ customer: "cus_41c", currency: "EUR" })\n});' },
  { glyph: "CD", screen: "cards" as Screen, tag: "CARDS", endpoint: "POST /v2/cards", title: "Cards", short: "Create sandbox cards and test controls and decisions.",
    body: "Create virtual or physical card records, freeze them, set limits, block merchant categories and test authorisation outcomes in the sandbox.",
    rows: [{ k: "TYPES", v: "VIRTUAL · PHYSICAL RECORDS" }, { k: "CONTROLS", v: "LIMITS · MCC · FREEZE" }, { k: "AUTHORISATIONS", v: "SANDBOX" }, { k: "PROVIDER", v: "NOT INCLUDED" }],
    code: 'fetch("/v2/cards", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ account: "acc_92f", form: "virtual" })\n});' },
  { glyph: "TR", screen: "transfers" as Screen, tag: "TRANSFERS", endpoint: "POST /v2/transfers", title: "Transfers", short: "Model transfers across six configured payment rails.",
    body: "Create sandbox transfers on SEPA Instant, Faster Payments, ACH, wire and other configured rails. Each leg keeps its own status so failures are visible.",
    rows: [{ k: "RAILS", v: "6 REFERENCE" }, { k: "STATUS", v: "PER LEG" }, { k: "CUT-OFFS", v: "QUERYABLE" }, { k: "REAL MONEY", v: "NONE" }],
    code: 'fetch("/v2/transfers", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ from: "acc_92f", amount: "2400.00", rail: "sepa_instant" })\n});' },
  { glyph: "FX", screen: "exchange" as Screen, tag: "EXCHANGE", endpoint: "POST /v2/quotes", title: "Exchange", short: "Create expiring quotes for configured currency pairs.",
    body: "Request a reference quote, inspect its rate and expiry, then test what happens when a client executes it before or after the hold ends.",
    rows: [{ k: "PRICES", v: "REFERENCE DATA" }, { k: "QUOTE HOLD", v: "30 SECONDS" }, { k: "EXPIRY", v: "ENFORCED" }, { k: "LIVE MARKET", v: "NOT INCLUDED" }],
    code: 'fetch("/v2/quotes", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ from: "USD", to: "EUR", amount: "10000.00" })\n});' },
  { glyph: "VT", screen: "vaults" as Screen, tag: "VAULTS", endpoint: "POST /v2/vaults", title: "Savings vaults", short: "Model named balances, deposits, withdrawals and accrual.",
    body: "Create a sandbox vault, move ledger balances in and out, and test round-up and accrual rules without presenting it as a live savings product.",
    rows: [{ k: "RATE", v: "CONFIGURABLE" }, { k: "ACCRUAL", v: "REFERENCE LOGIC" }, { k: "LEDGER", v: "DOUBLE-ENTRY" }, { k: "MODE", v: "SANDBOX" }],
    code: 'fetch("/v2/vaults", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ account: "acc_92f", name: "Deposit", target: "20000.00" })\n});' },
  { glyph: "CR", screen: "credit" as Screen, tag: "CREDIT", endpoint: "POST /v2/credit", title: "Credit lines", short: "Test limits, draws, repayments and collateral checks.",
    body: "Model a revolving credit line in the sandbox. Configure its limit and collateral, then test draws, repayments and loan-to-value checks.",
    rows: [{ k: "COLLATERAL", v: "PER LINE" }, { k: "MAX LTV", v: "CONFIGURABLE" }, { k: "DRAW", v: "LIMIT-CHECKED" }, { k: "LENDER", v: "NOT INCLUDED" }],
    code: 'fetch("/v2/credit", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ account: "acc_92f", limit: "25000.00" })\n});' },
  { glyph: "BZ", screen: "business" as Screen, tag: "BUSINESS", endpoint: "POST /v2/orgs", title: "Business banking", short: "Model organisations, roles, policies and approvals.",
    body: "Create organisations, add members and test role-based policies and approval chains. Actions appear in the reference event history.",
    rows: [{ k: "ROLES", v: "OWNER · ADMIN · MEMBER" }, { k: "APPROVALS", v: "MULTI-STEP" }, { k: "POLICIES", v: "ATTACHABLE" }, { k: "HISTORY", v: "EVENT RECORDS" }],
    code: 'fetch("/v2/orgs", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ name: "Kessler Ltd" })\n});' },
  { glyph: "LG", screen: "ledger" as Screen, tag: "LEDGER", endpoint: "GET /v2/ledger", title: "Ledger & statements", short: "Query double-entry records and create sandbox statements.",
    body: "Inspect ledger entries and point-in-time balances, then generate reference statement exports. The included PDF format is a development stand-in.",
    rows: [{ k: "MODEL", v: "DOUBLE-ENTRY" }, { k: "EXPORTS", v: "REFERENCE FORMATS" }, { k: "EVENTS", v: "QUERYABLE" }, { k: "MODE", v: "SANDBOX" }],
    code: 'fetch("/v2/ledger?account=acc_92f", {\n  headers: { "x-api-key": key }\n});' },
  // Products with no phone screen of their own — they show on the tiles and the
  // products page, and link into the docs rather than pinning a hero screen.
  { glyph: "KY", screen: "signup" as Screen, tag: "ONBOARDING", endpoint: "POST /v2/applications", title: "Onboarding & KYC", short: "Model KYC and KYB application states and decisions.",
    body: "Collect application data, documents, associated people and due-diligence records. Blueballs models the workflow; a production deployment supplies the verification provider.",
    rows: [{ k: "ENDPOINTS", v: "14" }, { k: "STATUS", v: "SEPARATE FROM DECISION" }, { k: "DOCUMENTS", v: "UPLOAD · FETCH" }, { k: "EDD", v: "MODELLED" }],
    code: 'fetch("/v2/applications", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ customer: "cus_41c", type: "business" })\n});' },
  { glyph: "QR", screen: "deposit-onchain" as Screen, tag: "QR", endpoint: "POST /v2/qr/generate", title: "QR & payment links", short: "Generate and validate EMVCo QR payloads and link records.",
    body: "Build merchant-presented QR payloads with CRC-16 checksums, decode them into fields, reject changed payloads and create sandbox payment-link records.",
    rows: [{ k: "STANDARD", v: "EMVCo MPM" }, { k: "CHECKSUM", v: "CRC-16/CCITT" }, { k: "TYPES", v: "STATIC · DYNAMIC" }, { k: "TAMPERING", v: "REJECTED" }],
    code: 'fetch("/v2/qr/generate", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ merchant: { name: "Coffee Corner", city: "Singapore", country: "SG" }, currency: "SGD", amount: "23.75" })\n});' },
  { glyph: "WL", screen: "deposit-onchain" as Screen, tag: "WALLETS", endpoint: "POST /v2/wallets", title: "Wallets", short: "Track sandbox balances and test policy-gated sends.",
    body: "Create wallet records, read balances by asset and network, and test policy and approval checks. No blockchain or custody provider is connected.",
    rows: [{ k: "ENDPOINTS", v: "6" }, { k: "POLICIES", v: "ATTACHABLE" }, { k: "APPROVALS", v: "THRESHOLD-GATED" }, { k: "LEDGER", v: "DOUBLE-ENTRY" }],
    code: 'fetch("/v2/wallets/wal_7a2/send", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ to: "0x8f2c…", amount: "250.00" })\n});' },
  { glyph: "WH", screen: "deposit-pending" as Screen, tag: "WEBHOOKS", endpoint: "POST /v2/webhooks", title: "Webhooks & events", short: "Send signed callbacks, inspect deliveries and replay them.",
    body: "Register a target for reference events, inspect delivery records and replay a callback with a header that distinguishes it from the original.",
    rows: [{ k: "SIGNING", v: "HMAC-SHA256" }, { k: "HISTORY", v: "30 DAYS" }, { k: "REPLAY", v: "X-WEBHOOK-REPLAY" }, { k: "EVENTS", v: "REFERENCE RECORDS" }],
    code: 'fetch("/v2/webhooks", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ url: "https://you.dev/hook", events: ["transfer.status_changed"] })\n});' },
  { glyph: "SB", screen: "card-declined" as Screen, tag: "SANDBOX", endpoint: "GET /v2/sandbox/scenarios", title: "Sandbox scenarios", short: "Trigger predefined failures and advance paused simulations.",
    body: "Use the scenario catalogue to test compliance holds, manual review and unconfirmed payments. Paused simulations continue only when you advance them.",
    rows: [{ k: "SCENARIOS", v: "CATALOGUED" }, { k: "PAUSE", v: "AWAITING_ADVANCE" }, { k: "IDEMPOTENT", v: "ON SIMULATION ID" }, { k: "CALLBACKS", v: "TRACKED" }],
    code: 'fetch("/v2/sandbox/onboarding", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ scenario: "onboarding.compliance_hold" })\n});' },
  { glyph: "BL", screen: "funded-home" as Screen, tag: "BILLS", endpoint: "POST /v2/mandates", title: "Bills & subscriptions", short: "Model mandates and recurring payment schedules.",
    body: "Create mandate records and schedule recurring payments against active mandates. The sandbox does not collect a live direct debit.",
    rows: [{ k: "MANDATES", v: "SCHEME-AWARE" }, { k: "SCHEDULE", v: "INTERVAL + NEXT RUN" }, { k: "GUARD", v: "INACTIVE → 409" }, { k: "ENDPOINTS", v: "4" }],
    code: 'fetch("/v2/subscriptions", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ mandate: "mnd_9f4", amount: "12.99", interval: "month" })\n});' },
  { glyph: "RL", screen: "deposit-rails" as Screen, tag: "RAILS", endpoint: "GET /v2/rails", title: "Rails registry", short: "Query six reference rails, limits, cut-offs and calendars.",
    body: "Read the configured currency, speed, cut-off, weekend behaviour and limits for each reference rail from the API.",
    rows: [{ k: "RAILS", v: "6" }, { k: "CUT-OFFS", v: "QUERYABLE" }, { k: "CALENDAR", v: "PER RAIL" }, { k: "AUTH", v: "PUBLIC" }],
    code: 'fetch("/v2/rails/ach").then((response) => response.json());' },
];

// Only rails the API actually implements — see RAILS in apps/api/src/kernel.js
const rails = ["SEPA Instant", "SEPA", "Faster Payments", "ACH", "Wire", "PayNow"];
/* Ticker and platform totals are NOT hardcoded — see useState below, populated
 * from GET /v2/site/stats and GET /v2/rails on mount. This placeholder shows
 * while that load is in flight. */
const TICKS_LOADING = ["CONNECTING TO THE HOSTED SANDBOX…"];
const guides = [
  { kind: "GUIDE", title: "Idempotency", body: "Retry write requests without creating the same sandbox object twice." },
  { kind: "GUIDE", title: "Card authorisations", body: "Simulate an authorisation and record an approve or decline decision." },
  { kind: "RUNBOOK", title: "Run it locally", body: "Install the packages and start the site, banking API and FX node with pnpm dev." },
];
const posts = [
  { date: "07 AUG 2026", title: "Removing claims the code could not support", excerpt: "The site audit removed invented usage figures, package names and performance claims. Reference data is now labelled as reference data.", tag: "NOTES" },
  { date: "07 AUG 2026", title: "One command starts the reference stack", excerpt: "pnpm dev starts the site, banking API and FX node for local development.", tag: "RELEASE" },
  { date: "06 AUG 2026", title: "The full API catalogue now responds", excerpt: "All 144 catalogued routes now return an intentional reference response instead of falling through to an unknown route.", tag: "RELEASE" },
  { date: "06 AUG 2026", title: "Making unfinished routes explicit", excerpt: "The route registry distinguishes an unknown URL from a catalogue entry that still needs an implementation.", tag: "ENGINEERING" },
  { date: "06 AUG 2026", title: "Sandbox data now survives a restart", excerpt: "The local banking API stores reference state in SQLite through node:sqlite.", tag: "ENGINEERING" },
  { date: "06 AUG 2026", title: "Generating separate sample receiving details", excerpt: "Sandbox accounts now receive distinct checksum-valid reference identifiers instead of sharing one fixture value.", tag: "FIX" },
];
const counters = [
  { title: "Issue tracking", body: "Opens with the source release after the publication gate passes." },
  { title: "Run it locally", body: "Clone instructions publish with the source release; the hosted sandbox is available now." },
  { title: "Security", body: "Private vulnerability reporting opens with the source release." },
];
const footer = [
  { head: "PRODUCT", links: [["Products", "/products"], ["Stablecoin FX", "/fx"], ["Providers", "/ecosystem"]] },
  { head: "DEVELOPERS", links: [["Developer guide", "/developers"], ["API reference", "/openapi.yaml"]] },
  { head: "PROJECT", links: [["Source status", "/contact"], ["Security status", "/contact"]] },
];
const GRID_FILLER_COPY = [
  ["OPEN SOURCE", "MIT licensed."],
  ["SELF-HOSTABLE", "Run it locally with pnpm dev."],
  ["REFERENCE API", "175 catalogued endpoints."],
] as const;

function GridFillers({ count }: { count: number }) {
  return <>{([2, 3, 4] as const).flatMap((columns) => {
    const missing = (columns - (count % columns)) % columns;
    return Array.from({ length: missing }, (_, index) => {
      const [label, copy] = GRID_FILLER_COPY[index % GRID_FILLER_COPY.length];
      return <div aria-hidden="true" className={`bb-grid-filler bb-fill-cols-${columns}`} key={`${columns}-${index}`}>
        <span>{label}</span><strong>{copy}</strong><small>BLUEBALLS · MIT LICENCE</small>
      </div>;
    });
  })}</>;
}
const quickstart = 'Source is private until the reference release passes its publication gate.\n\nHosted sandbox:\n\ncurl -X POST https://blueballs.tech/v2/auth/signup \\\n  -H "content-type: application/json" \\\n  -d \'{"email":"you@example.com"}\'\n\n// → { "key": "bb_sandbox_…", "scope": "sandbox", … }';
const devInstall = "Source is private until the reference release passes its publication gate.\n\nUse the hosted sandbox and OpenAPI contract while release hardening is in progress.";
const devCall = 'curl -X POST http://localhost:5290/v2/auth/signup \\\n  -H "content-type: application/json" \\\n  -d \'{"email":"you@example.com"}\'\n\n// → { "key": "bb_sandbox_…", "scope": "sandbox",\n//     "note": "…only time the key is shown." }';

export default function App() {
  const [path, go] = usePath();
  const page: Page = PATH_TO_PAGE[path] ?? "home";
  const setPage = (p: Page) => go(PAGE_TO_PATH[p]);
  const openSandbox = () => {
    window.history.pushState({}, "", "/sandbox");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  };

  const [screen, setScreen] = useState<Screen>("accounts");
  const [pinned, setPinned] = useState(false);
  const [apiFilter, setApiFilter] = useState("");

  // Real platform counts — GET /v2/site/stats. No invented numbers on this page.
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  useEffect(() => {
    let alive = true;
    getStats().then((s) => { if (alive) (s ? setStats(s) : setStatsErr(true)); });
    return () => { alive = false; };
  }, []);

  // Ticker: rail cut-offs from GET /v2/rails + the same live stats above.
  const [ticks, setTicks] = useState<string[]>(TICKS_LOADING);
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await call("GET", "/v2/rails", undefined, false);
      if (!alive) return;
      const out: string[] = [];
      if (r.ok) {
        for (const rail of (r.body as any).data as Array<{ id: string; speed: string; cutoff: string | null }>) {
          const label = rail.id.toUpperCase().replace(/_/g, " ");
          out.push(rail.cutoff ? `${label} CUT-OFF ${rail.cutoff}` : `${label} · ${rail.speed.toUpperCase()}`);
        }
      }
      out.push(page === "fx" ? "OPEN SOURCE · RUN LOCALLY" : "REFERENCE SANDBOX · NO REAL MONEY MOVES");
      if (stats) {
        out.push(`ACCOUNTS OPEN ${stats.accounts}`);
        out.push(`CUSTOMERS ${stats.customers}`);
        out.push(`TRANSFERS PROCESSED ${stats.transfers}`);
        out.push(`ENDPOINTS AVAILABLE ${stats.endpoints_implemented}/${stats.endpoints_catalogued}`);
      }
      setTicks(out.length ? out : ["SANDBOX DATA UNAVAILABLE — IS THE API RUNNING?"]);
    })();
    return () => { alive = false; };
  }, [page, stats]);

  // Real quote round-trip — replaces the invented "340MS QUOTES" fact.
  const [quoteMs, setQuoteMs] = useState<number | null>(null);
  const [quoteErr, setQuoteErr] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await ensureKey();
      if (!key) { if (alive) setQuoteErr(true); return; }
      const r = await call("POST", "/v2/quotes", { from: "EUR", to: "USD", amount: "1000.00" });
      if (!alive) return;
      if (r.ok) setQuoteMs(r.ms); else setQuoteErr(true);
    })();
    return () => { alive = false; };
  }, []);

  // Hero FX widget — a real POST /v2/quotes result, not a hardcoded rate table.
  type FxQuote = {
    rate: string; spread_bps: number; settlement: string; expires_at: string;
    receives: { amount: string; currency: string };
  };
  const [fxQuote, setFxQuote] = useState<FxQuote | null>(null);
  const [fxErr, setFxErr] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await ensureKey();
      if (!key) { if (alive) setFxErr(true); return; }
      const r = await call("POST", "/v2/quotes", { from: "EUR", to: "GBP", amount: "10000.00" });
      if (!alive) return;
      if (r.ok) setFxQuote(r.body as FxQuote); else setFxErr(true);
    })();
    return () => { alive = false; };
  }, []);

  // auto-rotate the phone screen on home until the visitor pins one
  useEffect(() => {
    if (pinned || page !== "home") return;
    const t = setInterval(() => {
      setScreen((s) => SCREENS[(SCREENS.indexOf(s) + 1) % SCREENS.length]);
    }, 4200);
    return () => clearInterval(t);
  }, [pinned, page]);

  const show = (s: Screen) => () => { setScreen(s); setPinned(true); };
  const active = products.find((p) => p.screen === screen) ?? products[0];

  const totals = stats
    ? [
        { label: "Accounts open", value: String(stats.accounts) },
        { label: "Customers signed up", value: String(stats.customers) },
        { label: "Transfers processed", value: String(stats.transfers) },
        { label: "Currencies configured", value: String(stats.currencies) },
      ]
    : statsErr
    ? [{ label: "Sandbox stats", value: "API offline" }]
    : [{ label: "Sandbox stats", value: "loading…" }];

  const q = apiFilter.trim().toLowerCase();
  const shownFamilies = !q ? FAMILIES : FAMILIES
    .map((f) => ({
      ...f,
      endpoints: f.name.toLowerCase().includes(q) ? f.endpoints
        : f.endpoints.filter((e) => e.path.toLowerCase().includes(q) || e.does.toLowerCase().includes(q)),
    }))
    .filter((f) => f.endpoints.length > 0);

  const card: CSSProperties = { background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18 };
  const ink: CSSProperties = { fontSize: 14, fontWeight: 500, padding: "14px 24px", cursor: "pointer", border: "1px solid #07144F", borderRadius: 10, background: "#07144F", color: "#FFFFFF" };
  const nav: { key: Page; label: string }[] = [
    { key: "home", label: "Home" }, { key: "products", label: "Products" }, { key: "fx", label: "Stablecoin FX" },
    { key: "dev", label: "Developers" },
  ];

  return (
    <div className="bb-app-shell" style={{ fontFamily: "Archivo, system-ui, sans-serif", color: "#07144F", background: "#E8EAEF", minHeight: "100vh", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

      {/* NAV */}
      <div data-pad style={{ width: "100%", maxWidth: 1200, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 24px", background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginRight: "auto" }}>
          <BrandLockup />
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296", borderLeft: "1px solid #D7DBE4", paddingLeft: 11 }}>OPEN SOURCE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {nav.map((t) => (
            <H key={t.key} as="button" onClick={() => setPage(t.key)}
              style={{ fontSize: 13.5, fontWeight: 500, padding: "9px 14px", cursor: "pointer", border: "none", borderRadius: 8, background: page === t.key ? "#F0F2F7" : "transparent", color: page === t.key ? "#07144F" : "#5B6376" }}
              hover={{ color: "#07144F" }}>{t.label}</H>
          ))}
        </div>
        <H as="button" onClick={openSandbox}
          style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #07144F", borderRadius: 10, background: "#07144F", color: "#FFFFFF" }}
          hover={{ background: "#0868FF", border: "1px solid #0868FF" }}>Try the sandbox</H>
      </div>

      <div style={{ width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* TICKER */}
        <div style={{ border: "1px solid #D7DBE4", borderRadius: 12, overflow: "hidden", padding: "9px 0", background: "#FFFFFF" }}>
          <div style={{ display: "flex", width: "max-content", animation: "gb-marquee 52s linear infinite", fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "#5B6376" }}>
            {[0, 1].map((d) => (
              <div key={d} style={{ display: "flex", gap: 34, paddingRight: 34 }}>
                {ticks.map((t, i) => <span key={i}>{t}</span>)}
              </div>
            ))}
          </div>
        </div>

        {/* ================= HOME ================= */}
        {page === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 470px", gap: 14, alignItems: "stretch" }}>

              {/* hero + the call behind this screen */}
              <div data-pad style={{ ...card, padding: "56px 46px 44px", display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, background: "#EAF4FF", border: "1px solid #CCE6FF", borderRadius: 999, padding: "6px 13px", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: "#0647E8" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "#0868FF" }} />FREE · MIT LICENSED · SELF-HOSTABLE
                </div>
                <h1 style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 50px)", lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.035em", textWrap: "balance" as CSSProperties["textWrap"] }}>
                  Open-source software<br />for building a neobank.<br /><span style={{ color: "#0868FF" }}>Run it. Read it. Extend it.</span>
                </h1>
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "50ch", color: "#454B5C" }}>
                  Blueballs is free, MIT-licensed software for accounts, cards, transfers, onboarding, ledger and FX. Create a sandbox key yourself, run the code locally and connect the services your production deployment needs. The goal is to lower the cost of building financial products so more teams can serve people traditional banks overlook or exclude.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <H as="button" onClick={openSandbox} style={ink} hover={{ background: "#0868FF", border: "1px solid #0868FF" }}>Try the sandbox</H>
                  <H as="button" onClick={() => setPage("dev")} style={{ ...ink, border: "1px solid #D7DBE4", background: "#FFFFFF", color: "#07144F" }} hover={{ boxShadow: "inset 0 0 0 1px #07144F" }}>Read the docs</H>
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 22, borderTop: "1px solid #E7EAF0", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "#7A8296" }}>
                  <span>{stats ? stats.currencies : 6} CURRENCIES</span>
                  <span>{quoteMs !== null ? `${quoteMs}MS QUOTE ROUND-TRIP` : quoteErr ? "QUOTES OFFLINE" : "MEASURING QUOTE LATENCY…"}</span>
                  <span>MIT LICENSE · SELF-HOSTABLE</span>
                </div>

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>EXAMPLE REQUEST</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#0647E8", border: "1px solid #CCE6FF", background: "#EAF4FF", borderRadius: 999, padding: "5px 12px" }}>{active.endpoint}</div>
                  </div>
                  <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 14, padding: "20px 22px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{active.code}</div>
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13, color: "#5B6376" }}>
                    {active.rows.map((sf) => (
                      <span key={sf.k}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#7A8296" }}>{sf.k}</span>{" "}
                        <span style={{ fontWeight: 500, color: "#07144F" }}>{sf.v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* live phone screen */}
              <div style={{ background: "#EDEFF4", border: "1px solid #D7DBE4", borderRadius: 18, padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{active.title}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#5B6376", maxWidth: "34ch" }}>{active.short}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296", whiteSpace: "nowrap", paddingTop: 3 }}>
                    {String(SCREENS.indexOf(screen) + 1).padStart(2, "0")} / 08
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {products.filter((p) => p.screen).map((p) => {
                    const on = p.screen === screen;
                    return (
                      <H key={`${p.screen}-${p.title}`} as="button" onClick={show(p.screen!)}
                        style={{ cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? "#0868FF" : "#D7DBE4"}`, background: on ? "#0868FF" : "#FFFFFF", color: on ? "#FFFFFF" : "#454B5C" }}
                        hover={{ boxShadow: "inset 0 0 0 1px #0868FF" }}>{p.title}</H>
                    );
                  })}
                </div>
                <div style={{ flex: 1 }}><PhoneScreen screen={screen} fxQuote={fxQuote} fxErr={fxErr} /></div>
              </div>
            </div>

            {/* product tiles */}
            <div className="bb-product-grid">
              {products.map((p) => {
                const on = p.screen === screen;
                return (
                  <H key={p.title} onClick={() => { if (p.screen) show(p.screen)(); else setPage("dev"); }}
                    style={{ background: on ? "#F4F6FB" : "#FFFFFF", border: `1px solid ${on ? "#0868FF" : "#D7DBE4"}`, borderRadius: 16, padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: 9, cursor: "pointer" }}
                    hover={{ boxShadow: "inset 0 0 0 1px #0868FF" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EAF4FF", border: "1px solid #CCE6FF", color: "#0647E8", fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.glyph}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{p.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{p.short}</div>
                    <div style={{ marginTop: "auto", paddingTop: 12, fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{p.endpoint}</div>
                  </H>
                );
              })}
              <GridFillers count={products.length} />
            </div>

            {/* quickstart + platform */}
            <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 16 }}>QUICKSTART</div>
                <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 12, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8, padding: "20px 22px", whiteSpace: "pre", overflowX: "auto" }}>{quickstart}</div>
              </div>
              <div data-pad style={{ ...card, padding: "30px 32px 26px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>PLATFORM</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: "#7A8296" }}>CURRENT HOSTED SANDBOX</div>
                </div>
                {totals.map((t) => (
                  <div key={t.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, padding: "14px 0", borderBottom: "1px solid #E7EAF0" }}>
                    <div style={{ fontSize: 14.5, color: "#454B5C" }}>{t.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em" }}>{t.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div data-pad style={{ background: "#0868FF", color: "#FFFFFF", borderRadius: 18, padding: "42px 44px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: "clamp(24px, 2.6vw, 32px)", fontWeight: 600, letterSpacing: "-0.03em" }}>Try the reference API.</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: "48ch", opacity: 0.9 }}>Create a sandbox key here, or clone the repository and run the full reference stack locally.</div>
              </div>
              <H as="button" onClick={() => setPage("dev")} style={{ fontSize: 14, fontWeight: 500, padding: "15px 26px", cursor: "pointer", border: "1px solid #FFFFFF", borderRadius: 10, background: "#FFFFFF", color: "#07144F" }} hover={{ background: "transparent", color: "#FFFFFF" }}>Get a sandbox key</H>
            </div>
          </div>
        )}

        {/* ================= PRODUCTS ================= */}
        {page === "products" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-pad style={{ ...card, padding: "46px 46px 40px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>PRODUCTS</div>
              <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Banking product models you can run and inspect.</h1>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "64ch", color: "#454B5C" }}>The repository models accounts, cards, transfers, onboarding, ledger, wallets and more behind one reference API. Use these flows as a starting point, then connect the services and controls required for production.</p>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", margin: "6px 2px 0" }}>
              {products.length} REFERENCE MODULES · EXAMPLE SCREEN + API REQUEST
            </div>
            <div className="bb-screen-grid">
              {products.map((p) => (
                <div key={p.title} style={{ ...card, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: "#EAF4FF", border: "1px solid #CCE6FF", color: "#0647E8", fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.glyph}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.025em" }}>{p.title}</div>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#0647E8", background: "#EAF4FF", border: "1px solid #CCE6FF", borderRadius: 999, padding: "3px 9px" }}>{p.tag}</div>
                  </div>

                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{p.short}</div>

                  {/* the screen itself */}
                  {/* PhoneScreen ships its own device frame and status bar — never wrap it in another */}
                  <div style={{ background: "#EDEFF4", border: "1px solid #D7DBE4", borderRadius: 14, padding: "16px 0" }}>
                    <div className="bb-screen-scale">
                      <Device id={p.screen} fxQuote={fxQuote} fxErr={fxErr} />
                    </div>
                  </div>

                  {/* specs */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {p.rows.slice(0, 3).map((r) => (
                      <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: "1px solid #E7EAF0", fontSize: 12.5 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "#7A8296" }}>{r.k}</span>
                        <span style={{ fontWeight: 500, textAlign: "right" }}>{r.v}</span>
                      </div>
                    ))}
                  </div>

                  {/* the call behind this screen */}
                  <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 12, padding: "14px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, whiteSpace: "pre", overflowX: "auto" }}>{p.code}</div>

                  <div style={{ marginTop: "auto", paddingTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{p.endpoint}</span>
                    <H as="button" onClick={() => setPage("dev")}
                      style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#0647E8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      hover={{ color: "#07144F" }}>VIEW ENDPOINT →</H>
                  </div>
                </div>
              ))}
              <GridFillers count={products.length} />
            </div>

            <H onClick={() => setPage("fx")}
              style={{ ...card, padding: "26px 28px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}
              hover={{ boxShadow: "inset 0 0 0 1px #0868FF" }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>STABLECOIN FX</div>
                <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.025em", margin: "8px 0 6px" }}>Inspect the canonical FX reference flow.</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#5B6376", maxWidth: "60ch" }}>
                  Follow one BRL-to-EUR request through policy checks, source selection, reservation and mixed-finality settlement.
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#0647E8", whiteSpace: "nowrap" }}>OPEN FX DEMO →</div>
            </H>

            <Journey />

            {/* EVERY RESOURCE FAMILY — the full surface, not just the headline eight */}
            <div data-pad style={{ ...card, padding: "34px 34px 30px", marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>THE FULL SURFACE</div>
                  <h2 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>
                    {FAMILIES.length} resource families. {TOTAL_ENDPOINTS} endpoints.
                  </h2>
                </div>
                <H as="button" onClick={() => setPage("dev")}
                  style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #D7DBE4", borderRadius: 10, background: "#FFFFFF", color: "#07144F" }}
                  hover={{ boxShadow: "inset 0 0 0 1px #07144F" }}>View the API reference →</H>
              </div>
              <p style={{ margin: "12px 0 20px", fontSize: 15.5, lineHeight: 1.6, maxWidth: "70ch", color: "#454B5C" }}>
                The API groups {TOTAL_ENDPOINTS} catalogued endpoints into {FAMILIES.length} resource families. Each one is available in the hosted reference sandbox.
              </p>
              <div className="bb-product-grid">
                {FAMILIES.map((f) => (
                  <H key={f.name} onClick={() => setPage("dev")}
                    style={{ background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 14, padding: "16px 17px 14px", display: "flex", flexDirection: "column", gap: 7, cursor: "pointer" }}
                    hover={{ boxShadow: "inset 0 0 0 1px #0868FF", background: "#FFFFFF" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.02em" }}>{f.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: "#0647E8", background: "#EAF4FF", border: "1px solid #CCE6FF", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{f.endpoints.length}</div>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#5B6376" }}>{f.blurb}</div>
                  </H>
                ))}
                <GridFillers count={FAMILIES.length} />
              </div>
            </div>

            <div data-pad style={{ ...card, padding: 32 }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 16 }}>REFERENCE RAILS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {rails.map((c) => (
                  <H key={c} style={{ border: "1px solid #DDE1E8", borderRadius: 999, padding: "8px 16px", fontFamily: MONO, fontSize: 11.5, color: "#454B5C" }} hover={{ boxShadow: "inset 0 0 0 1px #0868FF", color: "#0647E8" }}>{c}</H>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === "fx" && <FxPage />}

        {/* ================= DEVELOPERS ================= */}
        {page === "dev" && (
          <div data-col style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "start" }}>
            <div className="bb-toc" style={{ ...card, padding: "22px 0 24px" }}>
              <div style={{ padding: "0 22px 12px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#7A8296" }}>CONTENTS</div>
              {/* Every entry here points at a section that exists on this page. A
                  contents list of things that aren't below it is decoration, not
                  navigation. */}
              {[{ label: "Overview", id: "doc-overview" },
                { label: "API reference", id: "doc-api" },
                ...FAMILIES.map((f) => ({ label: f.name, id: docSlug(f.name) })),
                { label: "Guides & runbooks", id: "doc-guides" }].map((item) => (
                <H key={item.id}
                  // "smooth" silently no-ops on a long jump in some engines — verified
                  // here, it moved 0px while "auto" moved the full 9,939. A contents
                  // list that doesn't move the page is the bug we are fixing.
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "auto", block: "start" })}
                  style={{ padding: "9px 22px", fontSize: 13.5, cursor: "pointer", color: "#454B5C" }}
                  hover={{ color: "#0647E8", background: "#F0F2F7" }}>{item.label}</H>
              ))}
              <div style={{ padding: "16px 22px 0" }}>
                <div style={{ borderTop: "1px solid #E7EAF0", paddingTop: 14, fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: "#5B6376" }}>MIT licence<br />Public reference repository</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div id="doc-overview" data-pad style={{ ...card, padding: "42px 40px 36px", scrollMarginTop: 90 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>DEVELOPER GUIDE</div>
                <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Use the reference API.</h1>
                <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.62, maxWidth: "58ch", color: "#454B5C" }}>Create a sandbox key, send JSON requests with the x-api-key header and inspect the responses. This is reference behaviour, not a production banking service.</p>
              </div>
              <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 18, padding: "24px 26px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{devInstall}</div>
                <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 18, padding: "24px 26px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{devCall}</div>
              </div>

              <div id="doc-api" data-pad style={{ ...card, padding: "30px 32px 28px", scrollMarginTop: 90 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>API REFERENCE</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ApiStatus />
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#0647E8" }}>{TOTAL_ENDPOINTS} ENDPOINTS · {FAMILIES.length} FAMILIES</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 14, color: "#454B5C", marginBottom: 10, lineHeight: 1.55 }}>
                    These endpoints run against the hosted sandbox. They create reference data and never move real money or call production providers.
                  </div>
                  <KeyIssuer />
                </div>
                <input value={apiFilter} onChange={(e) => setApiFilter(e.target.value)}
                  placeholder="Filter endpoints — try transfers, card, qr, sandbox…"
                  style={{ width: "100%", marginTop: 12, border: "1px solid #DDE1E8", borderRadius: 10, background: "#F7F8FB", padding: "11px 14px", fontSize: 14.5, outline: "none" }} />
                {shownFamilies.length === 0 && (
                  <div style={{ padding: "26px 0", color: "#7A8296", fontSize: 14.5 }}>Nothing matches “{apiFilter}”.</div>
                )}
                {shownFamilies.map((fam) => (
                  <div key={fam.name} id={docSlug(fam.name)} style={{ marginTop: 26, scrollMarginTop: 90 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{fam.name}</h3>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{fam.endpoints.length} ENDPOINTS</span>
                    </div>
                    <p style={{ margin: "6px 0 10px", fontSize: 14, lineHeight: 1.55, color: "#5B6376", maxWidth: "70ch" }}>{fam.blurb}</p>
                    <div data-scroll><div>
                      {fam.endpoints.map((e, i) => (
                        <div key={i} className="bb-endpoint" style={{ display: "grid", gridTemplateColumns: "62px 1.4fr 1.4fr 62px 74px", alignItems: "center", gap: 10, padding: "10px 6px", borderTop: "1px solid #E7EAF0", borderRadius: 6 }}>
                          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", color: VERB_COLOR[e.verb] }}>{e.verb}</div>
                          <div style={{ fontFamily: MONO, fontSize: 12.5 }}>{e.path}</div>
                          <div style={{ fontSize: 13.5, color: "#454B5C" }}>{e.does}</div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: e.access === "PUBLIC" ? "#2E7D53" : "#7A8296" }}>{e.access}</div>
                          <div style={{ textAlign: "right" }}><TryIt verb={e.verb} path={e.path} /></div>
                        </div>
                      ))}
                    </div></div>
                  </div>
                ))}
              </div>

              <div id="doc-guides" data-col style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, scrollMarginTop: 90 }}>
                {guides.map((g) => (
                  <H key={g.title} style={{ ...card, borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }} hover={{ boxShadow: "inset 0 0 0 1px #0868FF" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" }}>{g.kind}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{g.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{g.body}</div>
                  </H>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= BULLETIN ================= */}
        {page === "blog" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-pad style={{ ...card, padding: "42px 46px 36px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>BUILD NOTES</div>
                  <h1 style={{ margin: "14px 0 0", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 600, letterSpacing: "-0.035em" }}>What changed and why.</h1>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#7A8296", textAlign: "right", lineHeight: 1.7 }}>BUILD LOG<br />6 ENTRIES</div>
            </div>
            <div data-pad style={{ ...card, padding: "10px 32px 26px" }}>
              {posts.map((p, i) => (
                <H key={i} data-col style={{ display: "grid", gridTemplateColumns: "124px 1fr 108px", gap: 16, alignItems: "start", padding: "19px 0", borderBottom: "1px solid #E7EAF0", cursor: "pointer" }} hover={{ opacity: 0.6 }}>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: "#7A8296" }}>{p.date}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.025em" }}>{p.title}</div>
                    <div style={{ fontSize: 14.5, lineHeight: 1.58, color: "#5B6376", maxWidth: "70ch" }}>{p.excerpt}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#0647E8", textAlign: "right" }}>{p.tag}</div>
                </H>
              ))}
            </div>
          </div>
        )}

        {/* ================= CONTACT ================= */}
        {page === "contact" && (
          <div data-col style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, alignItems: "start" }}>
            <div data-pad style={{ ...card, padding: "42px 40px 38px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>PROJECT CONTACT</div>
              <h1 style={{ margin: "14px 0 10px", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Talk to the project.</h1>
              <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.62, maxWidth: "52ch", color: "#454B5C" }}>Sandbox keys are available in the developer guide. Source, issue tracking and private security reporting open together when the reference release passes its publication gate.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/developers" style={{ ...ink, display: "inline-block" }}>Use the sandbox</a>
                <a href="/openapi.yaml" style={{ ...ink, display: "inline-block", border: "1px solid #D7DBE4", background: "#FFFFFF", color: "#07144F" }}>Read the API contract</a>
              </div>
              <p style={{ margin: "22px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "#7A8296" }}>There is no contact form or mailing list on this site yet.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...card, padding: "26px 24px 22px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#7A8296", marginBottom: 12 }}>OTHER ROUTES</div>
                {counters.map((c) => (
                  <div key={c.title} style={{ padding: "13px 0", borderTop: "1px solid #E7EAF0", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{c.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{c.body}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "block", background: "#07144F", color: "#E4E7EE", borderRadius: 18, padding: "22px 24px", fontFamily: MONO, fontSize: 12, lineHeight: 1.85 }}>SECURITY REPORTING<br />OPENS WITH THE SOURCE RELEASE</div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div data-pad className="bb-footer" style={{ padding: "26px", display: "grid", gap: 12, background: "#07144F", color: "#FFFFFF", borderRadius: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BrandLockup compact inverse />
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#C5CAD7", maxWidth: "34ch" }}>MIT-licensed reference software for building neobank products.</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "#8F98AC", marginTop: 6 }}>© 2026 · MIT LICENCE</div>
          </div>
          {footer.map((col) => (
            <div key={col.head} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8F98AC" }}>{col.head}</div>
              {col.links.map(([label, href]) => (<a key={label} href={href} style={{ fontSize: 13.5, color: "#E4E7EE" }}>{label}</a>))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
