import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Device from "./Device";
import { FAMILIES, TOTAL_ENDPOINTS } from "./endpoints";
import FxPage from "./FxPage";
import { call, getStats, type SiteStats } from "./api";
import {
  PrimaryHeader,
  SiteFooter,
  SiteTicker,
  type Navigate,
} from "./SiteChrome";
import { ApiStatus, KeyIssuer, TryIt } from "./TryIt";

const MONO = "'IBM Plex Mono', monospace";

type Page = "home" | "products" | "fx" | "dev" | "contact";
type Product = {
  glyph: string;
  title: string;
  endpoint: string;
  summary: string;
  proof: string[];
  screen?: string;
  route?: string;
};

const PATH_TO_PAGE: Record<string, Page> = {
  "/home": "home",
  "/products": "products",
  "/fx": "fx",
  "/developers": "dev",
  "/contact": "contact",
};

const PRODUCTS: Product[] = [
  {
    glyph: "AC",
    title: "Accounts",
    endpoint: "POST /v2/accounts",
    summary:
      "Multi-currency account state, receiving details and ledger-backed balances behind one API contract.",
    proof: ["Exact money", "Ledger-backed balances", "Tenant isolation"],
    screen: "accounts",
  },
  {
    glyph: "CD",
    title: "Cards",
    endpoint: "POST /v2/cards",
    summary:
      "Card lifecycle, limits, merchant controls and authorisation decisions with provider execution behind a capability boundary.",
    proof: ["Virtual + physical", "Limits + MCC policy", "Provider orchestration"],
    screen: "cards",
    route: "/cards",
  },
  {
    glyph: "TR",
    title: "Transfers",
    endpoint: "POST /v2/transfers",
    summary:
      "Durable payment intents across configured rails with explicit state, retries, reconciliation and ledger finality.",
    proof: ["Durable jobs", "Idempotent submission", "Reconciliation"],
    screen: "transfers",
  },
  {
    glyph: "FX",
    title: "Stablecoin FX",
    endpoint: "POST /v1/quotes",
    summary:
      "Policy-aware, multi-source FX spanning pricing, liquidity reservation, fiat evidence and atomic token settlement.",
    proof: ["Policy before price", "Reserved liquidity", "Explicit finality"],
    screen: "exchange",
    route: "/fx",
  },
  {
    glyph: "VT",
    title: "Vaults",
    endpoint: "POST /v2/vaults",
    summary:
      "Named balances and rule-driven movement built on the same exact ledger and command boundary as core accounts.",
    proof: ["Exact ledger", "Rule-driven movement", "Atomic commands"],
    screen: "vaults",
  },
  {
    glyph: "CR",
    title: "Credit",
    endpoint: "POST /v2/credit",
    summary:
      "Credit-line state, limits, draws, repayments and collateral policy that a deployment can connect to its chosen capital provider.",
    proof: ["Limit checks", "Collateral policy", "Auditable state"],
    screen: "credit",
  },
  {
    glyph: "BZ",
    title: "Business banking",
    endpoint: "POST /v2/orgs",
    summary:
      "Organisations, members, permissions, policies and approval chains for multi-user financial operations.",
    proof: ["Scoped roles", "Approvals", "Human attribution"],
    screen: "business",
  },
  {
    glyph: "LG",
    title: "Ledger + statements",
    endpoint: "GET /v2/ledger",
    summary:
      "Balanced double-entry postings, point-in-time balances and statement-ready financial history.",
    proof: ["Double-entry", "Balanced postings", "Derived balances"],
    screen: "ledger",
  },
  {
    glyph: "KY",
    title: "Identity + onboarding",
    endpoint: "POST /v2/applications",
    summary:
      "KYC and KYB workflow state, documents, associated people and due-diligence decisions behind a provider-neutral contract.",
    proof: ["KYC + KYB", "Document lifecycle", "Provider-neutral"],
  },
  {
    glyph: "WL",
    title: "Wallets + custody",
    endpoint: "POST /v2/wallets",
    summary:
      "Wallet records, asset balances, approvals and policy-gated sends with custody supplied through the provider layer.",
    proof: ["Multi-asset", "Policy-gated sends", "Custody adapters"],
    screen: "wallet-product",
  },
  {
    glyph: "QR",
    title: "QR + payment links",
    endpoint: "POST /v2/qr/generate",
    summary:
      "EMVCo merchant-presented QR payloads, CRC validation and payment-link state for programmable acceptance flows.",
    proof: ["EMVCo MPM", "CRC-16", "Tamper validation"],
    screen: "merchant-qr",
  },
  {
    glyph: "WH",
    title: "Webhooks + events",
    endpoint: "POST /v2/webhooks",
    summary:
      "Durable at-least-once event delivery with signatures, stable delivery IDs, leases, retries and replay tooling.",
    proof: ["HMAC signatures", "Durable outbox", "Replayable delivery"],
  },
  {
    glyph: "PV",
    title: "Provider orchestration",
    endpoint: "PROVIDER CAPABILITY CONTRACT",
    summary:
      "A durable boundary for issuers, processors, payment rails, identity vendors, custodians and other regulated infrastructure.",
    proof: ["Encrypted payloads", "Leases + retries", "Safe reconciliation"],
    route: "/ecosystem",
  },
  {
    glyph: "SB",
    title: "Sandbox Builder",
    endpoint: "POST /v2/builder/session",
    summary:
      "A scoped institution builder for composing products against the same API contracts used by the core platform.",
    proof: ["Self-serve", "Scoped tenant", "API-backed"],
    route: "/sandbox",
  },
];

const CORE_TICKER = [
  `${TOTAL_ENDPOINTS} BANKING OPERATIONS`,
  "EXACT DOUBLE-ENTRY LEDGER",
  "ATOMIC FINANCIAL COMMANDS",
  "DURABLE PROVIDER ORCHESTRATION",
  "POLICY-AWARE FX",
  "ATOMIC TOKEN SETTLEMENT",
  "NODE + CLOUDFLARE",
  "MIT LICENSED",
  "SELF-HOSTABLE",
];

const card: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #D7DBE4",
  borderRadius: 18,
};

const primaryButton: CSSProperties = {
  fontSize: 14,
  fontWeight: 650,
  padding: "13px 20px",
  cursor: "pointer",
  border: "1px solid #07144F",
  borderRadius: 10,
  background: "#07144F",
  color: "#FFFFFF",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "#FFFFFF",
  color: "#07144F",
  borderColor: "#D7DBE4",
};

function Pill({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: ".11em",
        color: "#5B6376",
        border: "1px solid #D7DBE4",
        borderRadius: 999,
        padding: "5px 9px",
        background: "#F7F8FB",
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div style={{ maxWidth: 820 }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          letterSpacing: ".17em",
          color: "#0868FF",
          fontWeight: 700,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: "12px 0 12px",
          fontSize: "clamp(30px, 4vw, 52px)",
          lineHeight: 1.02,
          letterSpacing: "-.045em",
          fontWeight: 640,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: "#50586B",
          fontSize: 16,
          lineHeight: 1.65,
          maxWidth: "70ch",
        }}
      >
        {copy}
      </p>
    </div>
  );
}

function HomePage({
  navigate,
  stats,
  statsError,
}: {
  navigate: Navigate;
  stats: SiteStats | null;
  statsError: boolean;
}) {
  const previewable = PRODUCTS.filter((product) => product.screen);
  const [active, setActive] = useState(previewable[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section
        data-col
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.25fr) minmax(330px,.75fr)",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <div
          data-pad
          style={{
            ...card,
            padding: "54px 46px 42px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#EAF4FF",
              border: "1px solid #CCE6FF",
              color: "#0647E8",
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: ".13em",
              fontWeight: 700,
            }}
          >
            OPEN SOURCE · INSTITUTION OWNED · PROVIDER NEUTRAL
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(42px, 5.4vw, 72px)",
              lineHeight: .98,
              letterSpacing: "-.055em",
              fontWeight: 650,
              maxWidth: "12ch",
            }}
          >
            The operating system for modern financial institutions.
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "62ch",
              color: "#454B5C",
              fontSize: 17,
              lineHeight: 1.68,
            }}
          >
            Blueballs combines a {TOTAL_ENDPOINTS}-operation banking API, exact
            double-entry ledger, durable provider orchestration and policy-aware
            FX into one stack your institution can run, inspect and extend.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={primaryButton} onClick={() => navigate("/sandbox")}>
              Launch sandbox
            </button>
            <button type="button" style={secondaryButton} onClick={() => navigate("/developers")}>
              Inspect the API
            </button>
            <a
              href="https://github.com/Josh-Gi3r/blueballs"
              style={{ ...secondaryButton, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Read the source
            </a>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,minmax(0,1fr))",
              gap: 1,
              background: "#D7DBE4",
              borderTop: "1px solid #D7DBE4",
              marginTop: "auto",
            }}
          >
            {[
              ["BANKING API", String(TOTAL_ENDPOINTS)],
              ["MONEY MODEL", "EXACT"],
              ["LEDGER", "DOUBLE-ENTRY"],
              ["LICENSE", "MIT"],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#fff", padding: "16px 14px" }}>
                <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".12em", color: "#7A8296" }}>
                  {label}
                </div>
                <strong style={{ display: "block", marginTop: 5, fontSize: 15 }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            ...card,
            background: "#EEF1F6",
            padding: "22px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".13em", color: "#7A8296" }}>
                PRODUCT SURFACE
              </div>
              <strong style={{ display: "block", marginTop: 3 }}>{active.title}</strong>
            </div>
            <ApiStatus />
          </div>
          <div style={{ transform: "scale(.78)", transformOrigin: "center", height: 540 }}>
            <Device id={active.screen!} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {previewable.map((product) => (
              <button
                key={product.title}
                type="button"
                onClick={() => setActive(product)}
                style={{
                  border: `1px solid ${active.title === product.title ? "#07144F" : "#D7DBE4"}`,
                  background: active.title === product.title ? "#07144F" : "#fff",
                  color: active.title === product.title ? "#fff" : "#5B6376",
                  borderRadius: 999,
                  padding: "7px 10px",
                  fontSize: 10.5,
                  cursor: "pointer",
                }}
              >
                {product.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section data-pad style={{ ...card, padding: "38px 42px" }}>
        <SectionHead
          eyebrow="FINANCIAL CORE"
          title="One command boundary. One ledger truth. Many products."
          copy="Accounts, cards, transfers, credit, wallets and FX do not live as disconnected demos. They share tenant identity, exact money, financial-command semantics, durable events and provider orchestration."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginTop: 28,
          }}
        >
          {[
            ["01", "Exact money", "Decimal inputs become integer minor units before financial state changes. Ledger postings remain balanced and balances are derived from postings."],
            ["02", "Atomic commands", "Resource state, ledger postings, events, idempotency and audit commit together inside one transaction boundary."],
            ["03", "Provider orchestration", "Durable jobs, stable external idempotency keys, leases, encrypted payloads and reconciliation make external execution explicit."],
            ["04", "Policy-aware FX", "Participation policy runs before pricing; selected liquidity is reserved before a firm quote and settlement carries explicit finality."],
          ].map(([n, title, copy]) => (
            <article key={title} style={{ border: "1px solid #E1E4EA", borderRadius: 14, padding: 20, background: "#FAFBFC" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#0868FF", letterSpacing: ".14em" }}>{n}</div>
              <h3 style={{ margin: "14px 0 8px", fontSize: 18 }}>{title}</h3>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#5B6376" }}>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section data-pad style={{ ...card, padding: "38px 42px" }}>
        <SectionHead
          eyebrow="LIVE SURFACE"
          title="The public site is a window into the same contracts."
          copy="Health and aggregate platform statistics can be read without creating a tenant. Credentials are only created when you explicitly launch the sandbox or issue a key."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 24 }}>
          {stats ? (
            [
              ["ACCOUNTS", String(stats.accounts)],
              ["CUSTOMERS", String(stats.customers)],
              ["TRANSFERS", String(stats.transfers)],
              ["CURRENCIES", String(stats.currencies)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#07144F", color: "#fff", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".13em", color: "#9AA5C2" }}>{label}</div>
                <strong style={{ display: "block", fontSize: 30, marginTop: 7 }}>{value}</strong>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1/-1", padding: 18, border: "1px solid #D7DBE4", borderRadius: 12, color: "#5B6376" }}>
              {statsError
                ? "The public API is not responding to the aggregate-statistics check right now. The product pages remain available and the sandbox exposes its own runtime status."
                : "Reading aggregate platform statistics…"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductsPage({ navigate }: { navigate: Navigate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section data-pad style={{ ...card, padding: "46px" }}>
        <SectionHead
          eyebrow="PRODUCT SYSTEM"
          title="Banking, cards, providers and FX on one financial core."
          copy="Each product surface inherits the same tenant, money, ledger, idempotency, event and audit contracts. Provider-specific execution stays behind explicit adapters instead of leaking into product logic."
        />
      </section>
      <section
        className="bb-product-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}
      >
        {PRODUCTS.map((product) => (
          <article
            key={product.title}
            style={{ ...card, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 10,
                    background: "#EAF4FF",
                    color: "#0647E8",
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {product.glyph}
                </span>
                <h3 style={{ margin: 0, fontSize: 18 }}>{product.title}</h3>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#5B6376" }}>{product.summary}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {product.proof.map((item) => <Pill key={item}>{item.toUpperCase()}</Pill>)}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #E7EAF0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: "#7A8296" }}>{product.endpoint}</span>
              <button
                type="button"
                onClick={() => navigate(product.route ?? "/developers")}
                style={{ border: 0, background: "transparent", color: "#0647E8", fontWeight: 700, cursor: "pointer", fontSize: 11 }}
              >
                {product.route ? "OPEN →" : "API →"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function DevelopersPage({ navigate }: { navigate: Navigate }) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const families = useMemo(
    () =>
      !q
        ? FAMILIES
        : FAMILIES.map((family) => ({
            ...family,
            endpoints: family.endpoints.filter(
              (endpoint) =>
                family.name.toLowerCase().includes(q) ||
                endpoint.path.toLowerCase().includes(q) ||
                endpoint.does.toLowerCase().includes(q),
            ),
          })).filter((family) => family.endpoints.length),
    [q],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section data-pad style={{ ...card, padding: "46px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <SectionHead
            eyebrow="DEVELOPER SURFACE"
            title={`${TOTAL_ENDPOINTS} banking operations. Inspectable end to end.`}
            copy="Clone the stack, run it locally, or issue a scoped sandbox key here. The catalogue below is generated from the same operation model used by the runtime and OpenAPI surface."
          />
          <ApiStatus />
        </div>
        <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: "#F5F7FB", border: "1px solid #D7DBE4" }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".13em", color: "#7A8296", marginBottom: 10 }}>
            ISSUE A TAB-SCOPED SANDBOX KEY
          </div>
          <KeyIssuer />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <a href="/openapi.yaml" style={{ ...secondaryButton, textDecoration: "none" }}>Banking OpenAPI</a>
          <a href="/openapi.fx.yaml" style={{ ...secondaryButton, textDecoration: "none" }}>FX OpenAPI</a>
          <a href="https://github.com/Josh-Gi3r/blueballs" style={{ ...secondaryButton, textDecoration: "none" }}>Source</a>
          <button type="button" style={primaryButton} onClick={() => navigate("/sandbox")}>Launch sandbox</button>
        </div>
      </section>

      <section data-pad style={{ ...card, padding: "34px 38px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".15em", color: "#0868FF" }}>API CATALOGUE</div>
            <h2 style={{ margin: "8px 0 0", fontSize: 30 }}>{TOTAL_ENDPOINTS} operations</h2>
          </div>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search endpoint or capability"
            aria-label="Search API operations"
            style={{ width: 320, maxWidth: "100%", padding: "11px 13px", border: "1px solid #D7DBE4", borderRadius: 10, background: "#F7F8FB" }}
          />
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 26 }}>
          {families.map((family) => (
            <section key={family.name} style={{ borderTop: "1px solid #E7EAF0", paddingTop: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{family.name}</h3>
                  <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 9.5, color: "#7A8296" }}>
                    {family.endpoints.length} OPERATIONS
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {family.endpoints.map((endpoint) => (
                    <details key={`${endpoint.verb}-${endpoint.path}`} style={{ border: "1px solid #E1E4EA", borderRadius: 11, padding: "11px 13px", background: "#FAFBFC" }}>
                      <summary style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "58px minmax(0,1fr) minmax(180px,.8fr)", gap: 10, alignItems: "center" }}>
                        <strong style={{ fontFamily: MONO, fontSize: 10, color: endpoint.verb === "GET" ? "#2E7D53" : endpoint.verb === "DELETE" ? "#B4453C" : "#0647E8" }}>{endpoint.verb}</strong>
                        <code style={{ fontFamily: MONO, fontSize: 11.5 }}>{endpoint.path}</code>
                        <span style={{ fontSize: 12, color: "#5B6376" }}>{endpoint.does}</span>
                      </summary>
                      <div style={{ marginTop: 12 }}>
                        <TryIt verb={endpoint.verb} path={endpoint.path} />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function ContactPage() {
  return (
    <section data-pad style={{ ...card, padding: "48px" }}>
      <SectionHead
        eyebrow="OPEN PROJECT"
        title="Build on it, inspect it, challenge it."
        copy="Blueballs is MIT licensed. Product discussion, implementation work and vulnerability reporting live alongside the source so the operating model stays inspectable."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 28 }}>
        {[
          ["SOURCE", "Repository, issues and implementation history", "https://github.com/Josh-Gi3r/blueballs"],
          ["SECURITY", "Private vulnerability reporting", "https://github.com/Josh-Gi3r/blueballs/security/advisories/new"],
          ["DOCUMENTATION", "Architecture, operations and API contracts", "/developers"],
        ].map(([label, copy, href]) => (
          <a key={label} href={href} style={{ ...card, padding: 20, textDecoration: "none", color: "#07144F" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: "#0868FF" }}>{label}</div>
            <strong style={{ display: "block", marginTop: 10, fontSize: 16 }}>{copy}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function App({
  path,
  navigate,
}: {
  path: string;
  navigate: Navigate;
}) {
  const page = PATH_TO_PAGE[path] ?? "home";
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [rails, setRails] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getStats().then((value) => {
      if (!alive) return;
      if (value) setStats(value);
      else setStatsError(true);
    });
    call("GET", "/v2/rails", undefined, false).then((result) => {
      if (!alive || !result.ok) return;
      const data = (result.body as { data?: Array<{ id: string }> })?.data ?? [];
      setRails(data.slice(0, 4).map((rail) => rail.id.toUpperCase().replace(/_/g, " ")));
    });
    return () => {
      alive = false;
    };
  }, []);

  const ticker = [
    ...CORE_TICKER,
    ...rails.map((rail) => `${rail} RAIL`),
    ...(stats ? [`${stats.currencies} CURRENCIES CONFIGURED`] : []),
  ];

  return (
    <div
      className="bb-app-shell"
      style={{
        fontFamily: "Archivo, system-ui, sans-serif",
        color: "#07144F",
        background: "#E8EAEF",
        minHeight: "100vh",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <PrimaryHeader path={path} navigate={navigate} />
      <main
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <SiteTicker items={ticker} />
        {page === "home" && <HomePage navigate={navigate} stats={stats} statsError={statsError} />}
        {page === "products" && <ProductsPage navigate={navigate} />}
        {page === "fx" && <FxPage />}
        {page === "dev" && <DevelopersPage navigate={navigate} />}
        {page === "contact" && <ContactPage />}
        <SiteFooter navigate={navigate} />
      </main>
    </div>
  );
}
