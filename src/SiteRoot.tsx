import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import App from "./App";
import EcosystemPage from "./EcosystemPage";
import { BrandLockup } from "./Brand";

const MONO = "'IBM Plex Mono', monospace";

function navigate(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function EcosystemNavBridge() {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const install = () => {
      const fxButton = Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Stablecoin FX");
      if (!fxButton?.parentElement) return false;
      let holder = document.getElementById("bb-ecosystem-nav-slot");
      if (!holder) {
        holder = document.createElement("span");
        holder.id = "bb-ecosystem-nav-slot";
        holder.style.display = "contents";
        fxButton.insertAdjacentElement("afterend", holder);
      }
      setMount(holder);
      return true;
    };

    if (!install()) {
      observer = new MutationObserver(() => {
        if (install()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, []);

  if (!mount) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => navigate("/ecosystem")}
      style={{ fontSize: 13.5, fontWeight: 500, padding: "9px 14px", cursor: "pointer", border: "none", borderRadius: 8, background: "transparent", color: "#5B6376" }}
      onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => { event.currentTarget.style.color = "#07144F"; }}
      onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => { event.currentTarget.style.color = "#5B6376"; }}
    >
      Providers
    </button>,
    mount,
  );
}

function EcosystemShell() {
  const nav = [
    ["Home", "/"],
    ["Products", "/products"],
    ["Stablecoin FX", "/fx"],
    ["Providers", "/ecosystem"],
    ["Developers", "/developers"],
    ["Build notes", "/bulletin"],
  ] as const;
  const ticker = ["PROVIDER DIRECTORY", "ACCOUNTS", "IDENTITY AND COMPLIANCE", "PAYMENT RAILS", "STABLECOINS", "WALLETS AND CUSTODY", "CARD ISSUING", "FX AND LIQUIDITY", "OPEN BANKING", "OPERATIONS"];

  return (
    <div style={{ fontFamily: "Archivo, system-ui, sans-serif", color: "#07144F", background: "#E8EAEF", minHeight: "100vh", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div data-pad style={{ width: "100%", maxWidth: 1200, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 24px", background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 14 }}>
        <button type="button" onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 11, marginRight: "auto", border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "#07144F" }}>
          <BrandLockup />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296", borderLeft: "1px solid #D7DBE4", paddingLeft: 11 }}>OPEN SOURCE</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {nav.map(([label, path]) => (
            <button key={path} type="button" onClick={() => navigate(path)} style={{ fontSize: 13.5, fontWeight: 500, padding: "9px 14px", cursor: "pointer", border: "none", borderRadius: 8, background: path === "/ecosystem" ? "#F0F2F7" : "transparent", color: path === "/ecosystem" ? "#07144F" : "#5B6376" }}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => navigate("/developers")} style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #07144F", borderRadius: 10, background: "#07144F", color: "#FFFFFF" }}>Try the sandbox</button>
      </div>

      <div style={{ width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ border: "1px solid #D7DBE4", borderRadius: 12, overflow: "hidden", padding: "9px 0", background: "#FFFFFF" }}>
          <div style={{ display: "flex", width: "max-content", animation: "gb-marquee 52s linear infinite", fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "#5B6376" }}>
            {[0, 1].map((copy) => <div key={copy} style={{ display: "flex", gap: 34, paddingRight: 34 }}>{ticker.map((item) => <span key={`${copy}-${item}`}>{item}</span>)}</div>)}
          </div>
        </div>
        <EcosystemPage onNavigate={navigate} />
        <div data-pad className="eco-shell-footer" style={{ background: "#07144F", color: "#FFFFFF", borderRadius: 18, padding: "26px", display: "grid", gap: 12 }}>
          <div><BrandLockup compact inverse /><p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#C5CAD7", maxWidth: "36ch" }}>MIT-licensed reference software for building neobank products.</p><div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8F98AC" }}>© 2026 · MIT LICENCE</div></div>
          <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8F98AC", marginBottom: 10 }}>PRODUCT</div><button type="button" onClick={() => navigate("/products")} className="eco-shell-link">Products</button><button type="button" onClick={() => navigate("/fx")} className="eco-shell-link">Stablecoin FX</button><button type="button" onClick={() => navigate("/ecosystem")} className="eco-shell-link">Providers</button></div>
          <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8F98AC", marginBottom: 10 }}>DEVELOPERS</div><button type="button" onClick={() => navigate("/developers")} className="eco-shell-link">Documentation</button><a href="https://github.com/Josh-Gi3r/blueballs" target="_blank" rel="noreferrer" className="eco-shell-link">GitHub ↗</a></div>
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

  if (path === "/ecosystem") return <EcosystemShell />;
  return <><App /><EcosystemNavBridge /></>;
}
