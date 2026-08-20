import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import App from "./App";
import EcosystemPage from "./EcosystemPage";
import CardsPage from "./CardsPage";
import { BrandLockup } from "./Brand";

const MONO = "'IBM Plex Mono', monospace";
function navigate(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function DirectoryNavBridge() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let o: MutationObserver | null = null;
    const install = () => {
      const fx = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Stablecoin FX",
      );
      if (!fx?.parentElement) return false;
      let h = document.getElementById("bb-directory-nav-slot");
      if (!h) {
        h = document.createElement("span");
        h.id = "bb-directory-nav-slot";
        h.style.display = "contents";
        fx.insertAdjacentElement("afterend", h);
      }
      setMount(h);
      return true;
    };
    if (!install()) {
      o = new MutationObserver(() => {
        if (install()) o?.disconnect();
      });
      o.observe(document.body, { childList: true, subtree: true });
    }
    return () => o?.disconnect();
  }, []);
  if (!mount) return null;
  const style = {
    fontSize: 13.5,
    fontWeight: 500,
    padding: "9px 14px",
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#5B6376",
  };
  return createPortal(
    <>
      <button
        type="button"
        onClick={() => navigate("/cards")}
        style={style}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) =>
          (e.currentTarget.style.color = "#07144F")
        }
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) =>
          (e.currentTarget.style.color = "#5B6376")
        }
      >
        Cards
      </button>
      <button
        type="button"
        onClick={() => navigate("/ecosystem")}
        style={style}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) =>
          (e.currentTarget.style.color = "#07144F")
        }
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) =>
          (e.currentTarget.style.color = "#5B6376")
        }
      >
        Providers
      </button>
    </>,
    mount,
  );
}

function DirectoryShell({ page }: { page: "cards" | "ecosystem" }) {
  const nav = [
    ["Home", "/"],
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
          type="button"
          onClick={() => navigate("/")}
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
          <BrandLockup />
          <span
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
              onClick={() => navigate(path)}
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
          type="button"
          onClick={() => navigate("/developers")}
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
          style={{
            border: "1px solid #D7DBE4",
            borderRadius: 12,
            overflow: "hidden",
            padding: "9px 0",
            background: "#fff",
          }}
        >
          <div
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
            <button onClick={() => navigate("/contact")} className="eco-shell-link">
              Source status
            </button>
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
  if (path === "/ecosystem") return <DirectoryShell page="ecosystem" />;
  if (path === "/cards") return <DirectoryShell page="cards" />;
  return (
    <>
      <App />
      <DirectoryNavBridge />
    </>
  );
}
