import PhoneScreen from "../PhoneScreen";
import type { PublicTrade } from "./model";

/* Hero in the exact grammar of the Home hero: copy + EXAMPLE REQUEST on the left,
   the product phone on the right, the exchange living inside the phone.
   Same tokens as App.tsx — Archivo, #07144F ink, #D7DBE4 lines, #EDEFF4 wash. */

const MONO = "'IBM Plex Mono', monospace";

const EXAMPLE = `fetch("/v2/fx/reference/trades/preview", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ inputAmount: "50000.00" })
});`;

export function FxHero({ trade, loading, runtimeReachable }: {
  trade: PublicTrade | null; loading: boolean; runtimeReachable: boolean;
}) {
  const eligible = trade ? trade.sourceStatus.filter((s) => s.eligible).length : null;
  return (
    <section className="fxp-section fxh" style={{ padding: 0, overflow: "hidden" }}>
      <div className="fxh-grid">

        {/* left — copy + example request */}
        <div style={{ padding: "44px 46px 40px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, border: "1px solid #CCE6FF", background: "#EAF4FF", borderRadius: 999, padding: "6px 13px", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.13em", color: "#0647E8" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#0868FF" }} />
            OPEN-SOURCE FX INFRASTRUCTURE
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(34px, 3.6vw, 52px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
            Build and operate FX.
          </h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, maxWidth: "56ch", color: "#454B5C" }}>
            One API for fiat and stablecoin exchange. You choose how money comes in
            and goes out, where the price and the liquidity come from, and how each
            leg settles. Run your own market, connect outside liquidity, or both.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="#fx-proof" style={{ fontSize: 14, fontWeight: 500, padding: "13px 22px", borderRadius: 10, background: "#07144F", color: "#FFFFFF", border: "1px solid #07144F" }}>See it run</a>
            <a href="https://github.com/Josh-Gi3r/blueballs" target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 500, padding: "13px 22px", borderRadius: 10, background: "#FFFFFF", color: "#07144F", border: "1px solid #D7DBE4" }}>Read the source</a>
          </div>
          <div style={{ display: "flex", gap: 30, flexWrap: "wrap", paddingTop: 20, borderTop: "1px solid #E7EAF0", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "#7A8296" }}>
            <span>FIAT ↔ STABLECOIN · 4 ROUTES</span>
            <span>ATOMIC TOKEN SETTLEMENT</span>
            <span>MIT LICENSE · SELF-HOSTABLE</span>
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>EXAMPLE REQUEST</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#0647E8", border: "1px solid #CCE6FF", background: "#EAF4FF", borderRadius: 999, padding: "5px 12px" }}>POST /v2/fx/reference/trades/preview</div>
            </div>
            <div style={{ background: "#07144F", color: "#E4E7EE", borderRadius: 14, padding: "20px 22px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre", overflowX: "auto" }}>{EXAMPLE}</div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13, color: "#5B6376" }}>
              <span><span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#7A8296" }}>ROUTE</span> <span style={{ fontWeight: 500, color: "#07144F" }}>{trade ? `${trade.from.symbol} → ${trade.to.symbol}` : "—"}</span></span>
              <span><span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#7A8296" }}>SOURCES</span> <span style={{ fontWeight: 500, color: "#07144F" }}>{eligible !== null ? `${eligible} eligible` : "—"}</span></span>
              <span><span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "#7A8296" }}>SETTLEMENT</span> <span style={{ fontWeight: 500, color: "#07144F" }}>{trade?.settlement.guarantee.atomic ? "atomic token fills" : "typed by leg"}</span></span>
            </div>
          </div>
        </div>

        {/* right — the product phone, exchange inside it */}
        <div style={{ margin: 12, background: "#EDEFF4", border: "1px solid #D7DBE4", borderRadius: 18, padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>The exchange</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#5B6376", maxWidth: "34ch" }}>Your customer sees one screen. Your market fills it behind the glass.</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", whiteSpace: "nowrap", paddingTop: 3, color: runtimeReachable ? "#2E7D53" : "#B4453C" }}>
              {loading ? "CONNECTING…" : runtimeReachable ? "● RUNTIME LIVE" : "RUNTIME OFFLINE"}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <PhoneScreen screen="fx" fxTrade={trade} fxTradeErr={!loading && !runtimeReachable} />
          </div>
        </div>
      </div>
    </section>
  );
}
