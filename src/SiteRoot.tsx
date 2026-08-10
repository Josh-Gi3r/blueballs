import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import App from "./App";
import EcosystemPage from "./EcosystemPage";

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
      onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => { event.currentTarget.style.color = "#14161C"; }}
      onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => { event.currentTarget.style.color = "#5B6376"; }}
    >
      Ecosystem
    </button>,
    mount,
  );
}

function EcosystemShell() {
  const nav = [
    ["Home", "/"],
    ["Products", "/products"],
    ["Stablecoin FX", "/fx"],
    ["Ecosystem", "/ecosystem"],
    ["Developers", "/developers"],
    ["Bulletin", "/bulletin"],
  ] as const;
  const ticker = ["REGULATED ACCOUNTS", "KYC · KYB · AML", "FIAT RAILS", "STABLECOINS", "WALLETS & CUSTODY", "CARD ISSUING", "FX LIQUIDITY", "OPEN BANKING", "RECONCILIATION"];

  return (
    <div style={{ fontFamily: "Archivo, system-ui, sans-serif", color: "#14161C", background: "#E8EAEF", minHeight: "100vh", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div data-pad style={{ width: "100%", maxWidth: 1200, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 24px", background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 14 }}>
        <button type="button" onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 11, marginRight: "auto", border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "#14161C" }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: "#5A6DB8", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "#FFFFFF" }} /></span>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>Blueballs</span>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296", borderLeft: "1px solid #D7DBE4", paddingLeft: 11 }}>OPEN SOURCE</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {nav.map(([label, path]) => (
            <button key={path} type="button" onClick={() => navigate(path)} style={{ fontSize: 13.5, fontWeight: 500, padding: "9px 14px", cursor: "pointer", border: "none", borderRadius: 8, background: path === "/ecosystem" ? "#F0F2F7" : "transparent", color: path === "/ecosystem" ? "#14161C" : "#5B6376" }}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => navigate("/contact")} style={{ fontSize: 13.5, fontWeight: 500, padding: "10px 18px", cursor: "pointer", border: "1px solid #14161C", borderRadius: 10, background: "#14161C", color: "#FFFFFF" }}>Get a key</button>
      </div>

      <div style={{ width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ border: "1px solid #D7DBE4", borderRadius: 12, overflow: "hidden", padding: "9px 0", background: "#FFFFFF" }}>
          <div style={{ display: "flex", width: "max-content", animation: "gb-marquee 52s linear infinite", fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "#5B6376" }}>
            {[0, 1].map((copy) => <div key={copy} style={{ display: "flex", gap: 34, paddingRight: 34 }}>{ticker.map((item) => <span key={`${copy}-${item}`}>{item}</span>)}</div>)}
          </div>
        </div>
        <EcosystemPage onNavigate={navigate} />
        <div data-col data-pad style={{ background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18, padding: "30px 38px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 26 }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>Blueballs</div><p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#5B6376", maxWidth: "36ch" }}>Open-source banking software, connected to the regulated providers your product needs.</p><div style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>© 2026 · MIT LICENCE</div></div>
          <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 10 }}>BUILD</div><button type="button" onClick={() => navigate("/products")} className="eco-shell-link">Products</button><button type="button" onClick={() => navigate("/fx")} className="eco-shell-link">Stablecoin FX</button></div>
          <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 10 }}>DEVELOPERS</div><button type="button" onClick={() => navigate("/developers")} className="eco-shell-link">Documentation</button><a href="https://github.com/Josh-Gi3r/blueballs" target="_blank" rel="noreferrer" className="eco-shell-link">GitHub ↗</a></div>
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
