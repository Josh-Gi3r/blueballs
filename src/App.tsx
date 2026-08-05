import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePath } from "./router";
import { FAMILIES, TOTAL_ENDPOINTS } from "./endpoints";
import PhoneScreen, { type Screen } from "./PhoneScreen";

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

const products = [
  { glyph: "AC", screen: "accounts" as Screen, tag: "ACCOUNTS", endpoint: "POST /v2/accounts", title: "Accounts", short: "Multi-currency accounts with real IBANs and sortcodes.",
    body: "Open personal, business or sub-accounts in seconds. Each carries its own IBAN, account number and balance across thirty-four currencies, all reconciled on one ledger.",
    rows: [{ k: "CURRENCIES", v: "34" }, { k: "IDENTIFIERS", v: "IBAN · SORT · ROUTING" }, { k: "SUB-ACCOUNTS", v: "UNLIMITED" }, { k: "OPEN TIME", v: "INSTANT" }],
    code: 'await bb.accounts.create({\n  holder: "usr_41c",\n  currency: "EUR",\n  type: "personal"\n});\n\n// → { iban: "DE89…", balance: 0 }' },
  { glyph: "CD", screen: "cards" as Screen, tag: "CARDS", endpoint: "POST /v2/cards", title: "Cards", short: "Issue virtual and physical cards with per-card rules.",
    body: "Issue a virtual card instantly or order physical plastic. Freeze, set spend limits, restrict merchant categories and stream authorisations as they happen.",
    rows: [{ k: "TYPES", v: "VIRTUAL · PHYSICAL" }, { k: "CONTROLS", v: "LIMITS · MCC · FREEZE" }, { k: "WALLETS", v: "APPLE · GOOGLE" }, { k: "AUTH STREAM", v: "WEBHOOK" }],
    code: 'await bb.cards.issue({\n  account: "acc_92f",\n  form: "virtual",\n  limits: { daily: 500_00 }\n});\n\n// → { last4: "4417", state: "active" }' },
  { glyph: "TR", screen: "transfers" as Screen, tag: "TRANSFERS", endpoint: "POST /v2/transfers", title: "Transfers", short: "Local rails, SWIFT and on-chain from one call.",
    body: "Send on SEPA Instant, Faster Payments, ACH, wire or stablecoin rails with a single payload. Blueballs picks the cheapest route that meets your deadline.",
    rows: [{ k: "RAILS", v: "11" }, { k: "SETTLEMENT", v: "FROM 4 SECONDS" }, { k: "BATCHING", v: "UP TO 10,000" }, { k: "RETURNS", v: "AUTO-RECONCILED" }],
    code: 'await bb.transfers.send({\n  from: "acc_92f",\n  to: { iban: "FR76…" },\n  amount: 2_400_00, rail: "sepa_instant"\n});' },
  { glyph: "FX", screen: "exchange" as Screen, tag: "EXCHANGE", endpoint: "POST /v2/exchange", title: "Exchange", short: "FX and crypto conversion at interbank rates.",
    body: "Convert between currencies and stablecoins at interbank mid plus four basis points. Quotes hold for thirty seconds and settle atomically against the balance.",
    rows: [{ k: "PAIRS", v: "340+" }, { k: "SPREAD", v: "4 BPS" }, { k: "QUOTE HOLD", v: "30 SECONDS" }, { k: "WEEKEND FX", v: "SUPPORTED" }],
    code: 'await bb.exchange.quote({\n  from: "USD", to: "EUR",\n  amount: 10_000_00\n});\n\n// → { rate: 0.9234, expires_in: 30 }' },
  { glyph: "VT", screen: "vaults" as Screen, tag: "VAULTS", endpoint: "POST /v2/vaults", title: "Savings vaults", short: "Goal-based savings paying daily interest.",
    body: "Ring-fence money into named vaults with round-ups, recurring deposits and daily accrual. Balances stay withdrawable on demand with no notice period.",
    rows: [{ k: "RATE", v: "3.9 – 7.2% AER" }, { k: "ACCRUAL", v: "DAILY" }, { k: "ROUND-UPS", v: "OPTIONAL" }, { k: "WITHDRAWAL", v: "INSTANT" }],
    code: 'await bb.vaults.create({\n  account: "acc_92f",\n  name: "Deposit",\n  target: 20_000_00, roundups: true\n});' },
  { glyph: "CR", screen: "credit" as Screen, tag: "CREDIT", endpoint: "POST /v2/credit", title: "Credit lines", short: "Overdrafts and collateralised borrowing.",
    body: "Extend revolving credit against deposits or crypto collateral. Limits, pricing and liquidation thresholds are configured per programme, with margin calls delivered by webhook.",
    rows: [{ k: "COLLATERAL", v: "CASH · BTC · ETH" }, { k: "MAX LTV", v: "62%" }, { k: "APR", v: "FROM 5.9%" }, { k: "CALLS", v: "WEBHOOK + GRACE" }],
    code: 'await bb.credit.open({\n  account: "acc_92f",\n  limit: 25_000_00,\n  collateral: { asset: "BTC", qty: 0.5 }\n});' },
  { glyph: "BZ", screen: "business" as Screen, tag: "BUSINESS", endpoint: "POST /v2/orgs", title: "Business banking", short: "Teams, roles, approvals and expense rules.",
    body: "Give organisations member roles, spend policies, multi-step approvals and per-team cards. Every action is written to an immutable audit log.",
    rows: [{ k: "ROLES", v: "OWNER · ADMIN · MEMBER" }, { k: "APPROVALS", v: "MULTI-STEP" }, { k: "POLICIES", v: "PER TEAM" }, { k: "AUDIT LOG", v: "IMMUTABLE" }],
    code: 'await bb.orgs.policy({\n  org: "org_7a2",\n  rule: { over: 1_000_00, approvals: 2 }\n});' },
  { glyph: "LG", screen: "ledger" as Screen, tag: "LEDGER", endpoint: "GET /v2/ledger", title: "Statements", short: "Double-entry ledger with exports and webhooks.",
    body: "Every movement lands in a double-entry ledger you can query, stream or export. Statements are produced as CSV, PDF or signed JSON for auditors.",
    rows: [{ k: "MODEL", v: "DOUBLE-ENTRY" }, { k: "EXPORTS", v: "CSV · PDF · JSON" }, { k: "EVENTS", v: "SIGNED WEBHOOKS" }, { k: "RETENTION", v: "10 YEARS" }],
    code: 'await bb.ledger.statement({\n  account: "acc_92f",\n  from: "2026-07-01", to: "2026-07-31"\n});' },
];

const rails = ["SEPA", "SEPA Instant", "Faster Payments", "ACH", "Fedwire", "SWIFT", "CHAPS", "Zengin", "Interac", "PIX", "Visa", "Mastercard", "Base", "Arbitrum"];
const ticks = ["EUR/USD 1.0830", "GBP/USD 1.2710", "USD VAULT 4.82% AER", "SEPA INSTANT 4S", "CARDS ISSUED TODAY 12,408", "FX SPREAD 4 BPS", "UPTIME 99.98%", "SETTLED TODAY $12.4M", "ACH CUT-OFF 17:00 ET"];
const totals = [
  { label: "Settled to date", value: "$4.2B" }, { label: "Accounts open", value: "318k" },
  { label: "Currencies", value: "34" }, { label: "Uptime, 90 days", value: "99.98%" },
];
const guides = [
  { kind: "GUIDE", title: "Idempotency", body: "Safe retries on every write endpoint, with a 24-hour replay window." },
  { kind: "GUIDE", title: "Card authorisations", body: "Approve or decline in your own webhook within 800ms." },
  { kind: "RUNBOOK", title: "Self-hosting", body: "Docker compose, one Postgres, one rail provider. Roughly twenty minutes." },
];
const posts = [
  { date: "26 JUL 2026", title: "Why the ledger is double-entry", excerpt: "Single-entry balances hide reconciliation bugs until withdrawal. Here is what we record instead.", tag: "ENGINEERING" },
  { date: "19 JUL 2026", title: "Card authorisations in 800ms", excerpt: "How we budget the round trip so your webhook can decide without timing out.", tag: "ENGINEERING" },
  { date: "12 JUL 2026", title: "SEPA Instant, end to end", excerpt: "What actually happens in the four seconds between call and settlement.", tag: "RAILS" },
  { date: "05 JUL 2026", title: "What open source costs us", excerpt: "A short account of hosting bills, maintainer hours and where funding comes from.", tag: "NOTES" },
  { date: "28 JUN 2026", title: "Designing spend policies", excerpt: "Approval chains that stay legible when a company grows past fifty people.", tag: "PRODUCT" },
  { date: "21 JUN 2026", title: "Reading the statement export", excerpt: "Every column in the CSV, what it means, and how to hand it to an accountant.", tag: "GUIDE" },
  { date: "14 JUN 2026", title: "Four rails added this month", excerpt: "PIX, Interac, CHAPS and Zengin are live in sandbox and production.", tag: "RELEASE" },
  { date: "07 JUN 2026", title: "Postmortem: the 40-minute FX outage", excerpt: "A rate provider silently rate-limited us. Timeline, cause and the fix.", tag: "INCIDENT" },
];
const fields = [
  { label: "01 · NAME", placeholder: "Ada Lovelace" },
  { label: "02 · EMAIL", placeholder: "ada@example.com" },
  { label: "03 · ORGANISATION", placeholder: "Optional" },
];
const counters = [
  { title: "GitHub issues", body: "Bugs, feature requests and integration questions. Fastest route to a maintainer." },
  { title: "Discord", body: "Informal help from other integrators. Roughly 2,300 members." },
  { title: "Security", body: "Disclose privately to security@blueballs.dev. PGP key on the docs site." },
  { title: "Sponsorship", body: "Infrastructure costs are covered by sponsors. Tiers listed on GitHub." },
];
const footer = [
  { head: "PRODUCT", links: ["Accounts", "Cards", "Transfers", "Exchange"] },
  { head: "DEVELOPERS", links: ["Documentation", "API reference", "Status", "Changelog"] },
  { head: "PROJECT", links: ["GitHub", "Licence", "Sponsors", "Security"] },
];
const quickstart = 'npm i @blueballs/sdk\n\nimport { Blueballs } from "@blueballs/sdk";\nconst bb = new Blueballs(process.env.BB_KEY);\n\nconst account = await bb.accounts.create({\n  holder: "usr_41c",\n  currency: "EUR"\n});\n\nawait bb.cards.issue({ account: account.id });';
const devInstall = "$ npm i @blueballs/sdk\n$ blueballs auth login\n\n  key issued  bb_sandbox_9f4c…\n  scope       sandbox, unmetered\n  expires     never";
const devCall = 'curl https://api.blueballs.dev/v2/rails \\\n  -H "Authorization: Bearer $BB_KEY"\n\n[ { "id": "sepa_instant", "status": "ok" },\n  { "id": "ach", "cutoff": "17:00 ET" } ]';

export default function App() {
  const [path, go] = usePath();
  const page: Page = PATH_TO_PAGE[path] ?? "home";
  const setPage = (p: Page) => go(PAGE_TO_PATH[p]);

  const [screen, setScreen] = useState<Screen>("accounts");
  const [pinned, setPinned] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiFilter, setApiFilter] = useState("");

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
                  <span>34 CURRENCIES</span><span>SOC 2 CONTROLS</span><span>340MS QUOTES</span><span>4.1K STARS</span>
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
                  {products.map((p) => {
                    const on = p.screen === screen;
                    return (
                      <H key={p.screen} as="button" onClick={show(p.screen)}
                        style={{ cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? "#5A6DB8" : "#D7DBE4"}`, background: on ? "#5A6DB8" : "#FFFFFF", color: on ? "#FFFFFF" : "#454B5C" }}
                        hover={{ borderColor: "#5A6DB8" }}>{p.title}</H>
                    );
                  })}
                </div>
                <div style={{ flex: 1 }}><PhoneScreen screen={screen} /></div>
              </div>
            </div>

            {/* product tiles */}
            <div data-col style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {products.map((p) => {
                const on = p.screen === screen;
                return (
                  <H key={p.title} onClick={show(p.screen)}
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
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 10 }}>PLATFORM</div>
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
                <div style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: "48ch", opacity: 0.9 }}>Sandbox keys are issued instantly and cost nothing. The full stack is on GitHub if you would rather run it yourself.</div>
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
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "64ch", color: "#454B5C" }}>Eight products, one ledger. Open an account, issue a card, move money, hold balances in thirty-four currencies and reconcile it all from the same statement.</p>
            </div>
            {products.map((p) => (
              <div key={p.title} data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div data-pad style={{ ...card, padding: "34px 32px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ border: "1px solid #DADFF2", background: "#EEF1FA", color: "#4E5FA6", borderRadius: 999, padding: "5px 13px", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em" }}>{p.tag}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#7A8296" }}>{p.endpoint}</div>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>{p.title}</h2>
                  <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.62, color: "#454B5C", maxWidth: "48ch" }}>{p.body}</p>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {p.rows.map((r) => (
                      <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "11px 0", borderTop: "1px solid #E7EAF0", fontSize: 13.5 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "#7A8296" }}>{r.k}</span><span style={{ fontWeight: 500 }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "auto", background: "#14161C", color: "#E4E7EE", borderRadius: 12, padding: "18px 20px", fontFamily: MONO, fontSize: 12, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{p.code}</div>
                </div>
                <div style={{ background: "#EDEFF4", border: "1px solid #D7DBE4", borderRadius: 18, padding: "24px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PhoneScreen screen={p.screen} />
                </div>
              </div>
            ))}
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
            <div style={{ ...card, padding: "22px 0 24px" }}>
              <div style={{ padding: "0 22px 12px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#7A8296" }}>CONTENTS</div>
              {["Overview", "Authentication", "Quickstart", ...FAMILIES.map((f) => f.name), "Errors", "Webhooks", "Self-hosting"].map((l, i) => (
                <H key={l} style={{ padding: "9px 22px", fontSize: 13.5, cursor: "pointer", color: i === 0 ? "#4E5FA6" : "#454B5C", background: i === 0 ? "#F0F2F7" : "transparent" }} hover={{ color: "#4E5FA6" }}>{l}</H>
              ))}
              <div style={{ padding: "16px 22px 0" }}>
                <div style={{ borderTop: "1px solid #E7EAF0", paddingTop: 14, fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: "#5B6376" }}>github.com/blueballs<br />MIT · 4.1k ★</div>
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
                  <div style={{ fontFamily: MONO, fontSize: 11, color: "#4E5FA6" }}>{TOTAL_ENDPOINTS} ENDPOINTS · {FAMILIES.length} FAMILIES</div>
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
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "62px 1.5fr 1.5fr 74px", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #E7EAF0" }}>
                          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", color: VERB_COLOR[e.verb] }}>{e.verb}</div>
                          <div style={{ fontFamily: MONO, fontSize: 12.5 }}>{e.path}</div>
                          <div style={{ fontSize: 13.5, color: "#454B5C" }}>{e.does}</div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: e.auth === "PUBLIC" ? "#2E7D53" : "#7A8296", textAlign: "right" }}>{e.auth}</div>
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
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#7A8296", textAlign: "right", lineHeight: 1.7 }}>VOL. IV · NO. 26<br />ENTRIES 001–008</div>
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
              <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.62, maxWidth: "52ch", color: "#454B5C" }}>Sandbox keys are issued immediately. Production keys within one business day.</p>
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
              <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 18, padding: "22px 24px", fontFamily: MONO, fontSize: 12, lineHeight: 1.85 }}>MAINTAINERS RESPOND MON–FRI.<br />ISSUES ARE ANSWERED FASTEST ON<br />GITHUB, NOT BY EMAIL.</div>
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
