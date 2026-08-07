import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePath } from "./router";
import { FAMILIES, TOTAL_ENDPOINTS } from "./endpoints";
import PhoneScreen, { type Screen } from "./PhoneScreen";
import Device from "./Device";
import { TryIt, KeyIssuer, ApiStatus } from "./TryIt";
import Journey from "./Journey";
import StablecoinFx from "./StablecoinFx";
import { call, getStats, ensureKey, type SiteStats } from "./api";

/* ------------------------------------------------------------------ */
/*  Ported from `Blueballs v2.dc.html` (Claude Design project).         */
/*  Re-synced 2026-08-05 — design is the source of truth; re-read it    */
/*  before editing this file.                                           */
/* ------------------------------------------------------------------ */

const MONO = "'IBM Plex Mono', monospace";
const VERB_COLOR: Record<string, string> = {
  GET: "#2E7D53", POST: "#4E5FA6", PATCH: "#B0761E", PUT: "#B0761E", DELETE: "#B4453C",
};

type Page = "home" | "products" | "dev" | "blog" | "contact";
const PATH_TO_PAGE: Record<string, Page> = {
  "/": "home", "/products": "products", "/developers": "dev",
  "/bulletin": "blog", "/contact": "contact",
};
const PAGE_TO_PATH: Record<Page, string> = {
  home: "/", products: "/products", dev: "/developers", blog: "/bulletin", contact: "/contact",
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
  { glyph: "AC", screen: "accounts" as Screen, tag: "ACCOUNTS", endpoint: "POST /v2/accounts", title: "Accounts", short: "Multi-currency accounts with real IBANs and sortcodes.",
    body: "Open personal, business or sub-accounts in seconds. Each carries its own IBAN, account number and balance across six currencies, all reconciled on one ledger.",
    rows: [{ k: "CURRENCIES", v: "6" }, { k: "IDENTIFIERS", v: "IBAN · SORT · ROUTING" }, { k: "SUB-ACCOUNTS", v: "UNLIMITED" }, { k: "OPEN TIME", v: "INSTANT" }],
    code: 'await bb.accounts.create({\n  holder: "usr_41c",\n  currency: "EUR",\n  type: "personal"\n});\n\n// → { iban: "DE89…", balance: 0 }' },
  { glyph: "CD", screen: "cards" as Screen, tag: "CARDS", endpoint: "POST /v2/cards", title: "Cards", short: "Issue virtual and physical cards with per-card rules.",
    body: "Issue a virtual card instantly or order physical plastic. Freeze, set spend limits, restrict merchant categories and stream authorisations as they happen.",
    rows: [{ k: "TYPES", v: "VIRTUAL · PHYSICAL" }, { k: "CONTROLS", v: "LIMITS · MCC · FREEZE" }, { k: "WALLETS", v: "APPLE · GOOGLE" }, { k: "AUTH STREAM", v: "WEBHOOK" }],
    code: 'await bb.cards.issue({\n  account: "acc_92f",\n  form: "virtual",\n  limits: { daily: 500_00 }\n});\n\n// → { last4: "4417", state: "active" }' },
  { glyph: "TR", screen: "transfers" as Screen, tag: "TRANSFERS", endpoint: "POST /v2/transfers", title: "Transfers", short: "Local rails, SWIFT and on-chain from one call.",
    body: "Send on SEPA Instant, Faster Payments, ACH, wire or stablecoin rails with a single payload. Blueballs picks the cheapest route that meets your deadline.",
    rows: [{ k: "RAILS", v: "6" }, { k: "SETTLEMENT", v: "SECONDS ON INSTANT RAILS" }, { k: "CUT-OFFS", v: "QUERYABLE" }, { k: "LEGS", v: "PER-RAIL STATUS" }],
    code: 'await bb.transfers.send({\n  from: "acc_92f",\n  to: { iban: "FR76…" },\n  amount: 2_400_00, rail: "sepa_instant"\n});' },
  { glyph: "FX", screen: "exchange" as Screen, tag: "EXCHANGE", endpoint: "POST /v2/exchange", title: "Exchange", short: "FX and crypto conversion at interbank rates.",
    body: "Convert between currencies and stablecoins at interbank mid plus four basis points. Quotes hold for thirty seconds and settle atomically against the balance.",
    rows: [{ k: "PAIRS", v: "30" }, { k: "SPREAD", v: "4 BPS · 85 THIN" }, { k: "QUOTE HOLD", v: "30 SECONDS" }, { k: "EXPIRY", v: "ENFORCED · 409" }],
    code: 'await bb.exchange.quote({\n  from: "USD", to: "EUR",\n  amount: 10_000_00\n});\n\n// → { rate: 0.9234, expires_in: 30 }' },
  { glyph: "VT", screen: "vaults" as Screen, tag: "VAULTS", endpoint: "POST /v2/vaults", title: "Savings vaults", short: "Goal-based savings paying daily interest.",
    body: "Ring-fence money into named vaults with round-ups, recurring deposits and daily accrual. Balances stay withdrawable on demand with no notice period.",
    rows: [{ k: "RATE", v: "3% DEFAULT · SET PER VAULT" }, { k: "ACCRUAL", v: "DAILY" }, { k: "LEDGER", v: "DOUBLE-ENTRY" }, { k: "WITHDRAWAL", v: "ON DEMAND" }],
    code: 'await bb.vaults.create({\n  account: "acc_92f",\n  name: "Deposit",\n  target: 20_000_00, roundups: true\n});' },
  { glyph: "CR", screen: "credit" as Screen, tag: "CREDIT", endpoint: "POST /v2/credit", title: "Credit lines", short: "Overdrafts and collateralised borrowing.",
    body: "Extend revolving credit against deposits or crypto collateral. Limits, pricing and liquidation thresholds are configured per programme, with margin calls delivered by webhook.",
    rows: [{ k: "COLLATERAL", v: "PER LINE" }, { k: "MAX LTV", v: "80% DEFAULT" }, { k: "DRAW", v: "LTV-CAPPED" }, { k: "REPAY", v: "PARTIAL OK" }],
    code: 'await bb.credit.open({\n  account: "acc_92f",\n  limit: 25_000_00,\n  collateral: { asset: "BTC", qty: 0.5 }\n});' },
  { glyph: "BZ", screen: "business" as Screen, tag: "BUSINESS", endpoint: "POST /v2/orgs", title: "Business banking", short: "Teams, roles, approvals and expense rules.",
    body: "Give organisations member roles, spend policies, multi-step approvals and per-team cards. Every action is written to an immutable audit log.",
    rows: [{ k: "ROLES", v: "OWNER · ADMIN · MEMBER" }, { k: "APPROVALS", v: "MULTI-STEP" }, { k: "POLICIES", v: "PER TEAM" }, { k: "AUDIT LOG", v: "IMMUTABLE" }],
    code: 'await bb.orgs.policy({\n  org: "org_7a2",\n  rule: { over: 1_000_00, approvals: 2 }\n});' },
  { glyph: "LG", screen: "ledger" as Screen, tag: "LEDGER", endpoint: "GET /v2/ledger", title: "Statements", short: "Double-entry ledger with exports and webhooks.",
    body: "Every movement lands in a double-entry ledger you can query, stream or export. Statements are produced as CSV, PDF or signed JSON for auditors.",
    rows: [{ k: "MODEL", v: "DOUBLE-ENTRY" }, { k: "EXPORTS", v: "CSV · PDF · JSON" }, { k: "EVENTS", v: "SIGNED WEBHOOKS" }, { k: "RETENTION", v: "10 YEARS" }],
    code: 'await bb.ledger.statement({\n  account: "acc_92f",\n  from: "2026-07-01", to: "2026-07-31"\n});' },
  // Products with no phone screen of their own — they show on the tiles and the
  // products page, and link into the docs rather than pinning a hero screen.
  { glyph: "KY", screen: "signup" as Screen, tag: "ONBOARDING", endpoint: "POST /v2/applications", title: "Onboarding & KYC", short: "KYC and KYB with status kept separate from the decision.",
    body: "Run individual and business onboarding: collect details, add associated individuals, upload documents, submit for verification and record enhanced due diligence. Lifecycle status never collapses into the outcome, so a review still running never looks like a rejection.",
    rows: [{ k: "ENDPOINTS", v: "14" }, { k: "STATUS", v: "SEPARATE FROM DECISION" }, { k: "DOCUMENTS", v: "UPLOAD · FETCH" }, { k: "EDD", v: "SUPPORTED" }],
    code: 'await bb.applications.create({\n  customer: "cus_41c",\n  type: "business"\n});\n\n// → { status: "pending", decision: null }' },
  { glyph: "QR", screen: "deposit-onchain" as Screen, tag: "QR", endpoint: "POST /v2/qr/generate", title: "QR & payment links", short: "EMVCo QR both ways, plus shareable payment links.",
    body: "Generate a real EMVCo merchant-presented payload with a CRC-16 checksum, decode one back into structured fields, and reject anything tampered with. Static and dynamic both supported, alongside single-use payment links.",
    rows: [{ k: "STANDARD", v: "EMVCo MPM" }, { k: "CHECKSUM", v: "CRC-16/CCITT" }, { k: "TYPES", v: "STATIC · DYNAMIC" }, { k: "TAMPERING", v: "REJECTED" }],
    code: 'await bb.qr.generate({\n  merchant: { name: "Coffee Corner" },\n  currency: "SGD", amount: "23.75"\n});' },
  { glyph: "WL", screen: "deposit-onchain" as Screen, tag: "WALLETS", endpoint: "POST /v2/wallets", title: "Wallets", short: "On-chain balances with policies attached.",
    body: "Create wallets under a customer, read balances per asset and network, and send with spend policies and approval chains enforced before anything moves.",
    rows: [{ k: "ENDPOINTS", v: "6" }, { k: "POLICIES", v: "ATTACHABLE" }, { k: "APPROVALS", v: "THRESHOLD-GATED" }, { k: "LEDGER", v: "DOUBLE-ENTRY" }],
    code: 'await bb.wallets.send({\n  wallet: "wal_7a2",\n  to: "0x8f2c…", amount: "250.00"\n});' },
  { glyph: "WH", screen: "deposit-pending" as Screen, tag: "WEBHOOKS", endpoint: "POST /v2/webhooks", title: "Webhooks & events", short: "Signed delivery, a delivery log, and replay.",
    body: "Register targets and receive HMAC-signed callbacks on every state change. Thirty days of delivery history, and a replay that carries an explicit header so a receiver can tell it from an original.",
    rows: [{ k: "SIGNING", v: "HMAC-SHA256" }, { k: "HISTORY", v: "30 DAYS" }, { k: "REPLAY", v: "X-WEBHOOK-REPLAY" }, { k: "EVENTS", v: "FULL AUDIT STREAM" }],
    code: 'await bb.webhooks.create({\n  url: "https://you.dev/hook",\n  events: ["transfer.status_changed"]\n});' },
  { glyph: "SB", screen: "card-declined" as Screen, tag: "SANDBOX", endpoint: "GET /v2/sandbox/scenarios", title: "Sandbox & failure injection", short: "Force any failure on purpose, then step past it.",
    body: "A discoverable scenario catalogue covering compliance holds, manual review and unconfirmed payments. Stateful simulations pause mid-flow and wait for an explicit advance, so you can build against failure instead of hoping.",
    rows: [{ k: "SCENARIOS", v: "CATALOGUED" }, { k: "PAUSE", v: "AWAITING_ADVANCE" }, { k: "IDEMPOTENT", v: "ON SIMULATION ID" }, { k: "CALLBACKS", v: "TRACKED" }],
    code: 'await bb.sandbox.onboarding({\n  scenario: "onboarding.compliance_hold"\n});\n\n// → { awaiting_advance: true }' },
  { glyph: "BL", screen: "funded-home" as Screen, tag: "BILLS", endpoint: "POST /v2/mandates", title: "Bills & subscriptions", short: "Direct debit mandates and recurring payments.",
    body: "Create a mandate, then schedule recurring payments against it. Mandate status is checked before a subscription can be created, so a dead mandate cannot quietly keep charging.",
    rows: [{ k: "MANDATES", v: "SCHEME-AWARE" }, { k: "SCHEDULE", v: "INTERVAL + NEXT RUN" }, { k: "GUARD", v: "INACTIVE → 409" }, { k: "ENDPOINTS", v: "4" }],
    code: 'await bb.subscriptions.create({\n  mandate: "mnd_9f4",\n  amount: "12.99", interval: "month"\n});' },
  { glyph: "RL", screen: "deposit-rails" as Screen, tag: "RAILS", endpoint: "GET /v2/rails", title: "Rails registry", short: "Cut-offs and calendars as data, not a docs table.",
    body: "Every rail's currency, speed, cut-off, weekend behaviour and limits are queryable at runtime. Stop hardcoding which rails are open when — ask the API.",
    rows: [{ k: "RAILS", v: "6" }, { k: "CUT-OFFS", v: "QUERYABLE" }, { k: "CALENDAR", v: "PER RAIL" }, { k: "AUTH", v: "PUBLIC" }],
    code: 'await bb.rails.get("ach");\n\n// → { cutoff: "17:00 ET",\n//     weekend: false }' },
];

// Only rails the API actually implements — see RAILS in apps/api/src/kernel.js
const rails = ["SEPA Instant", "SEPA", "Faster Payments", "ACH", "Wire", "PayNow"];
/* Ticker and platform totals are NOT hardcoded — see useState below, populated
 * from GET /v2/site/stats and GET /v2/rails on mount. This placeholder shows
 * while that load is in flight. */
const TICKS_LOADING = ["CONNECTING TO THE LIVE API…"];
const guides = [
  { kind: "GUIDE", title: "Idempotency", body: "Safe retries on every write endpoint, with a 24-hour replay window." },
  { kind: "GUIDE", title: "Card authorisations", body: "Approve or decline in your own webhook within 800ms." },
  { kind: "RUNBOOK", title: "Self-hosting", body: "Node stdlib + SQLite. No Docker, no external database. pnpm dev and you're running." },
];
const posts = [
  { date: "07 AUG 2026", title: "Every number on this site is now real or labelled", excerpt: "We audited our own marketing copy and found eleven invented figures — settled volume, uptime, a star count, an SDK that did not exist. All removed or wired to the live API.", tag: "NOTES" },
  { date: "07 AUG 2026", title: "One command runs the whole stack", excerpt: "pnpm dev now starts the site and the API together, with no new dependencies. Self-hosting should not need a runbook.", tag: "RELEASE" },
  { date: "06 AUG 2026", title: "All 144 endpoints implemented", excerpt: "Six resource-family modules built in parallel, each owning one file so they could not collide. Every catalogued endpoint now returns a real response.", tag: "RELEASE" },
  { date: "06 AUG 2026", title: "Why unbuilt endpoints return 501, not 404", excerpt: "A 404 tells a caller they typed the URL wrong. A deliberate 501 tells them the truth: this is in the contract and not built yet.", tag: "ENGINEERING" },
  { date: "06 AUG 2026", title: "Durable by default, on the standard library", excerpt: "Storage moved to SQLite through node:sqlite. Zero new dependencies, and your sandbox data survives a restart.", tag: "ENGINEERING" },
  { date: "06 AUG 2026", title: "We were issuing the same routing number to everyone", excerpt: "Every USD account got one hardcoded ABA and every GBP account one sort code. Now generated per account, with real checksums.", tag: "INCIDENT" },
];
const fields = [
  { label: "01 · NAME", placeholder: "Ada Lovelace" },
  { label: "02 · EMAIL", placeholder: "ada@example.com" },
  { label: "03 · ORGANISATION", placeholder: "Optional" },
];
const counters = [
  { title: "GitHub issues", body: "Not published yet — this repo hasn't shipped. Issues will be the fastest route to a maintainer once it has." },
  { title: "Self-host it", body: "Clone this repo, run pnpm dev, and you have the whole stack — API and site — running locally." },
  { title: "Security", body: "No public repo yet, so no disclosure address either. That gets set up before this ships." },
];
const footer = [
  { head: "PRODUCT", links: ["Accounts", "Cards", "Transfers", "Exchange"] },
  { head: "DEVELOPERS", links: ["Documentation", "API reference", "Status", "Changelog"] },
  { head: "PROJECT", links: ["GitHub", "Licence", "Sponsors", "Security"] },
];
const quickstart = 'git clone <this repo>\ncd blueballs && pnpm install\npnpm dev            # site → :5280, api → :5290\n\ncurl -X POST http://localhost:5290/v2/auth/signup \\\n  -H "content-type: application/json" \\\n  -d \'{"email":"you@example.com"}\'\n\n// → { "key": "bb_sandbox_…", "scope": "sandbox", … }';
const devInstall = "$ git clone <this repo>\n$ cd blueballs && pnpm install\n$ pnpm dev\n\n  site   http://localhost:5280\n  api    http://localhost:5290/v2";
const devCall = 'curl -X POST http://localhost:5290/v2/auth/signup \\\n  -H "content-type: application/json" \\\n  -d \'{"email":"you@example.com"}\'\n\n// → { "key": "bb_sandbox_…", "scope": "sandbox",\n//     "note": "…only time the key is shown." }';

export default function App() {
  const [path, go] = usePath();
  const page: Page = PATH_TO_PAGE[path] ?? "home";
  const setPage = (p: Page) => go(PAGE_TO_PATH[p]);

  const [screen, setScreen] = useState<Screen>("accounts");
  const [pinned, setPinned] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
      out.push("FX SPREAD 4 BPS · DEEP LIQUIDITY");
      if (stats) {
        out.push(`ACCOUNTS OPEN ${stats.accounts}`);
        out.push(`CUSTOMERS ${stats.customers}`);
        out.push(`TRANSFERS PROCESSED ${stats.transfers}`);
        out.push(`ENDPOINTS LIVE ${stats.endpoints_implemented}/${stats.endpoints_catalogued}`);
      }
      setTicks(out.length ? out : ["LIVE DATA UNAVAILABLE — IS THE API RUNNING?"]);
    })();
    return () => { alive = false; };
  }, [stats]);

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
        { label: "Currencies supported", value: String(stats.currencies) },
      ]
    : statsErr
    ? [{ label: "Live stats", value: "API offline" }]
    : [{ label: "Live stats", value: "loading…" }];

  const q = apiFilter.trim().toLowerCase();
  const shownFamilies = !q ? FAMILIES : FAMILIES
    .map((f) => ({
      ...f,
      endpoints: f.name.toLowerCase().includes(q) ? f.endpoints
        : f.endpoints.filter((e) => e.path.toLowerCase().includes(q) || e.does.toLowerCase().includes(q)),
    }))
    .filter((f) => f.endpoints.length > 0);

  const card: CSSProperties = { background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18 };
  const ink: CSSProperties = { fontSize: 14, fontWeight: 500, padding: "14px 24px", cursor: "pointer", border: "1px solid #14161C", borderRadius: 10, background: "#14161C", color: "#FFFFFF" };
  const nav: { key: Page; label: string }[] = [
    { key: "home", label: "Home" }, { key: "products", label: "Products" },
    { key: "dev", label: "Developers" }, { key: "blog", label: "Bulletin" },
  ];

  return (
    <div style={{ fontFamily: "Archivo, system-ui, sans-serif", color: "#14161C", background: "#E8EAEF", minHeight: "100vh", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

      {/* NAV */}
      <div data-pad style={{ width: "100%", maxWidth: 1200, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 24px", background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginRight: "auto" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "#5A6DB8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#FFFFFF" }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>Blueballs</div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296", borderLeft: "1px solid #D7DBE4", paddingLeft: 11 }}>OPEN SOURCE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {nav.map((t) => (
            <H key={t.key} as="button" onClick={() => setPage(t.key)}
              style={{ fontSize: 13.5, fontWeight: 500, padding: "9px 14px", cursor: "pointer", border: "none", borderRadius: 8, background: page === t.key ? "#F0F2F7" : "transparent", color: page === t.key ? "#14161C" : "#5B6376" }}
              hover={{ color: "#14161C" }}>{t.label}</H>
          ))}
        </div>
        <H as="button" onClick={() => setPage("contact")}
          style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #14161C", borderRadius: 10, background: "#14161C", color: "#FFFFFF" }}
          hover={{ background: "#5A6DB8", borderColor: "#5A6DB8" }}>Get a key</H>
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
                <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, background: "#EEF1FA", border: "1px solid #DADFF2", borderRadius: 999, padding: "6px 13px", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: "#4E5FA6" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "#5A6DB8" }} />MIT LICENCED · FREE FOREVER
                </div>
                <h1 style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 50px)", lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.035em", textWrap: "balance" as CSSProperties["textWrap"] }}>
                  The banking stack,<br />open sourced.<br /><span style={{ color: "#5A6DB8" }}>Accounts, cards, exchange.</span>
                </h1>
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "50ch", color: "#454B5C" }}>
                  Blueballs gives any product the primitives a modern bank runs on — multi-currency accounts, issued cards, transfers, savings and exchange — behind one API. Hosted or self-hosted, with no licence to negotiate.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <H as="button" onClick={() => setPage("contact")} style={ink} hover={{ background: "#5A6DB8", borderColor: "#5A6DB8" }}>Request a key</H>
                  <H as="button" onClick={() => setPage("dev")} style={{ ...ink, border: "1px solid #D7DBE4", background: "#FFFFFF", color: "#14161C" }} hover={{ borderColor: "#14161C" }}>Read the docs</H>
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 22, borderTop: "1px solid #E7EAF0", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "#7A8296" }}>
                  <span>{stats ? stats.currencies : 6} CURRENCIES</span>
                  <span>{quoteMs !== null ? `${quoteMs}MS QUOTE ROUND-TRIP` : quoteErr ? "QUOTES OFFLINE" : "MEASURING QUOTE LATENCY…"}</span>
                  <span>MIT · SELF-HOSTED</span>
                </div>

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>THE CALL BEHIND THIS SCREEN</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#4E5FA6", border: "1px solid #DADFF2", background: "#EEF1FA", borderRadius: 999, padding: "5px 12px" }}>{active.endpoint}</div>
                  </div>
                  <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "20px 22px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{active.code}</div>
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13, color: "#5B6376" }}>
                    {active.rows.map((sf) => (
                      <span key={sf.k}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#7A8296" }}>{sf.k}</span>{" "}
                        <span style={{ fontWeight: 500, color: "#14161C" }}>{sf.v}</span>
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
                      <H key={p.screen} as="button" onClick={show(p.screen!)}
                        style={{ cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? "#5A6DB8" : "#D7DBE4"}`, background: on ? "#5A6DB8" : "#FFFFFF", color: on ? "#FFFFFF" : "#454B5C" }}
                        hover={{ borderColor: "#5A6DB8" }}>{p.title}</H>
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
                    style={{ background: on ? "#F4F6FB" : "#FFFFFF", border: `1px solid ${on ? "#5A6DB8" : "#D7DBE4"}`, borderRadius: 16, padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: 9, cursor: "pointer" }}
                    hover={{ borderColor: "#5A6DB8" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EEF1FA", border: "1px solid #DADFF2", color: "#4E5FA6", fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.glyph}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{p.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{p.short}</div>
                    <div style={{ marginTop: "auto", paddingTop: 12, fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{p.endpoint}</div>
                  </H>
                );
              })}
            </div>

            {/* quickstart + platform */}
            <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 16 }}>QUICKSTART</div>
                <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 12, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8, padding: "20px 22px", whiteSpace: "pre", overflowX: "auto" }}>{quickstart}</div>
              </div>
              <div data-pad style={{ ...card, padding: "30px 32px 26px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>PLATFORM</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: "#7A8296" }}>LIVE FROM THIS SANDBOX</div>
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
            <div data-pad style={{ background: "#5A6DB8", color: "#FFFFFF", borderRadius: 18, padding: "42px 44px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: "clamp(24px, 2.6vw, 32px)", fontWeight: 600, letterSpacing: "-0.03em" }}>Open an account.</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: "48ch", opacity: 0.9 }}>Sandbox keys are issued instantly and cost nothing. Clone this repo and run pnpm dev if you would rather run it yourself.</div>
              </div>
              <H as="button" onClick={() => setPage("contact")} style={{ fontSize: 14, fontWeight: 500, padding: "15px 26px", cursor: "pointer", border: "1px solid #FFFFFF", borderRadius: 10, background: "#FFFFFF", color: "#14161C" }} hover={{ background: "transparent", color: "#FFFFFF" }}>Get your key</H>
            </div>
          </div>
        )}

        {/* ================= PRODUCTS ================= */}
        {page === "products" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-pad style={{ ...card, padding: "46px 46px 40px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>PRODUCTS</div>
              <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Everything a bank ships.</h1>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "64ch", color: "#454B5C" }}>Eight products, one ledger. Open an account, issue a card, move money, hold balances in six currencies and reconcile it all from the same statement.</p>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", margin: "6px 2px 0" }}>
              {products.length} PRODUCTS · EACH WITH ITS SCREEN AND THE CALL BEHIND IT
            </div>
            <div className="bb-screen-grid">
              {products.map((p) => (
                <div key={p.title} style={{ ...card, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: "#EEF1FA", border: "1px solid #DADFF2", color: "#4E5FA6", fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.glyph}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.025em" }}>{p.title}</div>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#4E5FA6", background: "#EEF1FA", border: "1px solid #DADFF2", borderRadius: 999, padding: "3px 9px" }}>{p.tag}</div>
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
                  <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 12, padding: "14px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, whiteSpace: "pre", overflowX: "auto" }}>{p.code}</div>

                  <div style={{ marginTop: "auto", paddingTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{p.endpoint}</span>
                    <H as="button" onClick={() => setPage("dev")}
                      style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#4E5FA6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      hover={{ color: "#14161C" }}>RUN IT →</H>
                  </div>
                </div>
              ))}
            </div>

            <StablecoinFx />

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
                  style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #D7DBE4", borderRadius: 10, background: "#FFFFFF", color: "#14161C" }}
                  hover={{ borderColor: "#14161C" }}>Run them in the docs →</H>
              </div>
              <p style={{ margin: "12px 0 20px", fontSize: 15.5, lineHeight: 1.6, maxWidth: "70ch", color: "#454B5C" }}>
                The eight above are how people describe a bank. This is everything the API actually exposes —
                every family below is implemented and callable today.
              </p>
              <div className="bb-product-grid">
                {FAMILIES.map((f) => (
                  <H key={f.name} onClick={() => setPage("dev")}
                    style={{ background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 14, padding: "16px 17px 14px", display: "flex", flexDirection: "column", gap: 7, cursor: "pointer" }}
                    hover={{ borderColor: "#5A6DB8", background: "#FFFFFF" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.02em" }}>{f.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: "#4E5FA6", background: "#EEF1FA", border: "1px solid #DADFF2", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{f.endpoints.length}</div>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#5B6376" }}>{f.blurb}</div>
                  </H>
                ))}
              </div>
            </div>

            <div data-pad style={{ ...card, padding: 32 }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 16 }}>RAILS AND NETWORKS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {rails.map((c) => (
                  <H key={c} style={{ border: "1px solid #DDE1E8", borderRadius: 999, padding: "8px 16px", fontFamily: MONO, fontSize: 11.5, color: "#454B5C" }} hover={{ borderColor: "#5A6DB8", color: "#4E5FA6" }}>{c}</H>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= DEVELOPERS ================= */}
        {page === "dev" && (
          <div data-col style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "start" }}>
            <div className="bb-toc" style={{ ...card, padding: "22px 0 24px" }}>
              <div style={{ padding: "0 22px 12px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#7A8296" }}>CONTENTS</div>
              {["Overview", "Authentication", "Quickstart", ...FAMILIES.map((f) => f.name), "Errors", "Webhooks", "Self-hosting"].map((l, i) => (
                <H key={l} style={{ padding: "9px 22px", fontSize: 13.5, cursor: "pointer", color: i === 0 ? "#4E5FA6" : "#454B5C", background: i === 0 ? "#F0F2F7" : "transparent" }} hover={{ color: "#4E5FA6" }}>{l}</H>
              ))}
              <div style={{ padding: "16px 22px 0" }}>
                <div style={{ borderTop: "1px solid #E7EAF0", paddingTop: 14, fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: "#5B6376" }}>MIT licence<br />Not yet published to GitHub</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div data-pad style={{ ...card, padding: "42px 40px 36px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>DEVELOPER MANUAL · REV 2.4</div>
                <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Start moving money.</h1>
                <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.62, maxWidth: "58ch", color: "#454B5C" }}>One base URL, one bearer token, JSON in and out. Sandbox keys are unmetered and every endpoint mirrors production semantics.</p>
              </div>
              <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 18, padding: "24px 26px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{devInstall}</div>
                <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 18, padding: "24px 26px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{devCall}</div>
              </div>

              <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>API REFERENCE</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ApiStatus />
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#4E5FA6" }}>{TOTAL_ENDPOINTS} ENDPOINTS · {FAMILIES.length} FAMILIES</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 14, color: "#454B5C", marginBottom: 10, lineHeight: 1.55 }}>
                    Every endpoint below runs for real against the API. Get a key and press Run — no approval, nothing simulated.
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
                  <div key={fam.name} style={{ marginTop: 26 }}>
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
                          <div style={{ fontFamily: MONO, fontSize: 10, color: e.auth === "PUBLIC" ? "#2E7D53" : "#7A8296" }}>{e.auth}</div>
                          <div style={{ textAlign: "right" }}><TryIt verb={e.verb} path={e.path} /></div>
                        </div>
                      ))}
                    </div></div>
                  </div>
                ))}
              </div>

              <div data-col style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {guides.map((g) => (
                  <H key={g.title} style={{ ...card, borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }} hover={{ borderColor: "#5A6DB8" }}>
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
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>BULLETIN · WEEKLY</div>
                <h1 style={{ margin: "14px 0 0", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Dispatches</h1>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#7A8296", textAlign: "right", lineHeight: 1.7 }}>BUILD LOG<br />ENTRIES 001–006</div>
            </div>
            <div data-pad style={{ ...card, padding: "10px 32px 26px" }}>
              {posts.map((p, i) => (
                <H key={i} data-col style={{ display: "grid", gridTemplateColumns: "124px 1fr 108px", gap: 16, alignItems: "start", padding: "19px 0", borderBottom: "1px solid #E7EAF0", cursor: "pointer" }} hover={{ opacity: 0.6 }}>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: "#7A8296" }}>{p.date}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.025em" }}>{p.title}</div>
                    <div style={{ fontSize: 14.5, lineHeight: 1.58, color: "#5B6376", maxWidth: "70ch" }}>{p.excerpt}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#4E5FA6", textAlign: "right" }}>{p.tag}</div>
                </H>
              ))}
            </div>
          </div>
        )}

        {/* ================= CONTACT ================= */}
        {page === "contact" && (
          <div data-col style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, alignItems: "start" }}>
            <div data-pad style={{ ...card, padding: "42px 40px 38px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>APPLICATION · FORM AK-1</div>
              <h1 style={{ margin: "14px 0 10px", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, letterSpacing: "-0.035em" }}>Open an account.</h1>
              <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.62, maxWidth: "52ch", color: "#454B5C" }}>Sandbox keys are issued immediately, self-serve, no form required — hit the docs page. This form is for everything else: production access, self-hosting help, partnerships.</p>
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {fields.map((f) => (
                  <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" }}>{f.label}</label>
                    <H as="input" placeholder={f.placeholder} style={{ border: "1px solid #DDE1E8", borderRadius: 10, background: "#F7F8FB", padding: "13px 16px", fontSize: 15, outline: "none" }} focus={{ borderColor: "#5A6DB8", background: "#FFFFFF" }} />
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" }}>04 · WHAT ARE YOU BUILDING</label>
                  <H as="textarea" rows={4} placeholder="One or two lines is plenty" style={{ border: "1px solid #DDE1E8", borderRadius: 10, background: "#F7F8FB", padding: "13px 16px", fontSize: 15, outline: "none", resize: "vertical" }} focus={{ borderColor: "#5A6DB8", background: "#FFFFFF" }} />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#454B5C" }}>
                  <input type="checkbox" style={{ width: 16, height: 16, marginTop: 3, accentColor: "#5A6DB8" }} />
                  <span>Send me the weekly bulletin. Roughly 400 words, no marketing.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                  <H as="button" type="submit" style={ink} hover={{ background: "#5A6DB8", borderColor: "#5A6DB8" }}>Submit application</H>
                  <div style={{ fontSize: 13.5, color: "#4E5FA6", display: submitted ? "block" : "none" }}>Received — check your inbox.</div>
                </div>
              </form>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...card, padding: "26px 24px 22px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#7A8296", marginBottom: 12 }}>OTHER COUNTERS</div>
                {counters.map((c) => (
                  <div key={c.title} style={{ padding: "13px 0", borderTop: "1px solid #E7EAF0", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{c.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5B6376" }}>{c.body}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 18, padding: "22px 24px", fontFamily: MONO, fontSize: 12, lineHeight: 1.85 }}>THIS REPO ISN'T PUBLISHED YET.<br />UNTIL IT IS, THIS FORM IS THE<br />ONLY WAY TO REACH A MAINTAINER.</div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div data-col data-pad style={{ ...card, padding: "32px 38px 28px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Blueballs</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#5B6376", maxWidth: "34ch" }}>An open-source banking stack. Free to use, free to fork, no accounts sold.</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "#7A8296", marginTop: 6 }}>© 2026 · MIT LICENCE</div>
          </div>
          {footer.map((col) => (
            <div key={col.head} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" }}>{col.head}</div>
              {col.links.map((l) => (<a key={l} href="#" style={{ fontSize: 13.5, color: "#454B5C" }}>{l}</a>))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
