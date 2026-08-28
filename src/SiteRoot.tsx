import { lazy, Suspense, useEffect, useState } from "react";
import App from "./App";
import EcosystemPage from "./EcosystemPage";
import CardsPage from "./CardsPage";
import { BrandLockup } from "./Brand";
import SandboxPage from "./sandbox/SandboxPage";

const CityLanding = lazy(() => import("./city/CityLanding"));

const MONO = "'IBM Plex Mono', monospace";
function navigate(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function DirectoryShell({ page }: { page: "cards" | "ecosystem" }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const go = (path: string) => {
    setMobileNavOpen(false);
    navigate(path);
  };
  const nav = [
    ["Home", "/home"],
    ["Products", "/products"],
    ["Stablecoin FX", "/fx"],
    ["Cards", "/cards"],
    ["Providers", "/ecosystem"],
    ["Developers", "/developers"],
  ] as const;
  const active = page === "cards" ? "/cards" : "/ecosystem";
  const ticker =
    page === "cards"
      ? [
          "CARD MODELS",
          "STABLECOIN FUNDING",
          "CUSTODY",
          "CARD NETWORKS",
          "ISSUERS",
          "REWARDS",
          "FX",
          "GEOGRAPHY",
          "PROGRAM MANAGERS",
          "SETTLEMENT",
        ]
      : [
          "PROVIDER DIRECTORY",
          "ACCOUNTS",
          "IDENTITY AND COMPLIANCE",
          "PAYMENT RAILS",
          "STABLECOINS",
          "WALLETS AND CUSTODY",
          "CARD ISSUING",
          "FX AND LIQUIDITY",
          "OPEN BANKING",
          "OPERATIONS",
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
      <div
        className="bb-site-header"
        data-pad
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          padding: "12px 24px",
          background: "#fff",
          border: "1px solid #D7DBE4",
          borderRadius: 14,
        }}
      >
        <button
          className="bb-site-brand"
          type="button"
          onClick={() => go("/home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            marginRight: "auto",
            border: 0,
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "#07144F",
          }}
        >
          <BrandLockup linked={false} />
          <span
            className="bb-site-brand-tag"
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: ".14em",
              color: "#7A8296",
              borderLeft: "1px solid #D7DBE4",
              paddingLeft: 11,
            }}
          >
            OPEN SOURCE
          </span>
        </button>
        <div
          className="bb-site-nav bb-site-nav-desktop"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {nav.map(([label, path]) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                padding: "9px 14px",
                cursor: "pointer",
                border: "none",
                borderRadius: 8,
                background: path === active ? "#F0F2F7" : "transparent",
                color: path === active ? "#07144F" : "#5B6376",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="bb-site-cta"
          type="button"
          onClick={() => go("/sandbox")}
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            padding: "10px 18px",
            cursor: "pointer",
            border: "1px solid #07144F",
            borderRadius: 10,
            background: "#07144F",
            color: "#fff",
          }}
        >
          Try the sandbox
        </button>
        <button
          className="bb-mobile-menu-button"
          type="button"
          aria-expanded={mobileNavOpen}
          aria-controls="bb-mobile-directory-nav"
          aria-label={
            mobileNavOpen ? "Close navigation menu" : "Open navigation menu"
          }
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        {mobileNavOpen && (
          <nav
            id="bb-mobile-directory-nav"
            className="bb-mobile-nav"
            aria-label="Primary navigation"
          >
            {nav.map(([label, path]) => (
              <button
                key={path}
                type="button"
                aria-current={path === active ? "page" : undefined}
                onClick={() => go(path)}
              >
                {label}
              </button>
            ))}
            <button
              className="bb-mobile-nav-primary"
              type="button"
              onClick={() => go("/sandbox")}
            >
              Try the sandbox
            </button>
          </nav>
        )}
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          className="bb-ticker"
          style={{
            border: "1px solid #D7DBE4",
            borderRadius: 12,
            overflow: "hidden",
            padding: "9px 0",
            background: "#fff",
          }}
        >
          <div
            className="bb-ticker-track"
            style={{
              display: "flex",
              width: "max-content",
              animation: "gb-marquee 52s linear infinite",
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: ".12em",
              color: "#5B6376",
            }}
          >
            {[0, 1].map((copy) => (
              <div
                className="bb-ticker-copy"
                key={copy}
                style={{ display: "flex", gap: 34, paddingRight: 34 }}
              >
                {ticker.map((item) => (
                  <span key={`${copy}-${item}`}>{item}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
        {page === "cards" ? (
          <CardsPage onNavigate={navigate} />
        ) : (
          <EcosystemPage onNavigate={navigate} />
        )}
        <div
          data-pad
          className="eco-shell-footer"
          style={{
            background: "#07144F",
            color: "#fff",
            borderRadius: 18,
            padding: 26,
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <BrandLockup compact inverse />
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "#C5CAD7",
                maxWidth: "36ch",
              }}
            >
              MIT-licensed open-source software for building neobanks and
              financial products.
            </p>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8F98AC" }}>
              © 2026 · MIT LICENCE
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: ".16em",
                color: "#8F98AC",
                marginBottom: 10,
              }}
            >
              PRODUCT
            </div>
            <button
              onClick={() => navigate("/products")}
              className="eco-shell-link"
            >
              Products
            </button>
            <button onClick={() => navigate("/fx")} className="eco-shell-link">
              Stablecoin FX
            </button>
            <button
              onClick={() => navigate("/cards")}
              className="eco-shell-link"
            >
              Cards
            </button>
            <button
              onClick={() => navigate("/ecosystem")}
              className="eco-shell-link"
            >
              Providers
            </button>
          </div>
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: ".16em",
                color: "#8F98AC",
                marginBottom: 10,
              }}
            >
              DEVELOPERS
            </div>
            <button
              onClick={() => navigate("/developers")}
              className="eco-shell-link"
            >
              Documentation
            </button>
            <a
              href="https://github.com/Josh-Gi3r/blueballs"
              className="eco-shell-link"
            >
              Source on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SiteRoot() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (path === "/bulletin") navigate("/developers");
  }, [path]);
  if (path === "/") {
    return (
      <Suspense
        fallback={
          <div
            style={{ width: "100%", minHeight: "100vh", background: "#07144F" }}
          />
        }
      >
        <CityLanding />
      </Suspense>
    );
  }
  if (path === "/ecosystem") return <DirectoryShell page="ecosystem" />;
  if (path === "/cards") return <DirectoryShell page="cards" />;
  if (path === "/sandbox") return <SandboxPage />;
  return <App />;
}
