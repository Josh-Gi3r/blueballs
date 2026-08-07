import { useEffect, useState, type CSSProperties } from "react";
import { call } from "./api";

const MONO = "'IBM Plex Mono', monospace";

type Leg = {
  step: number; kind: string; from: string; to: string;
  spread_bps: number | null; settlement: string; note?: string;
  in: { amount: string; currency: string };
  out: { amount: string; currency: string };
};
type Route = {
  from: string; to: string; receives: { amount: string; currency: string };
  legs: Leg[]; total_spread_bps: number; note: string;
};
type Corridor = {
  pair: string; from: string; to: string;
  depth: { amount: string; currency: string };
  spread_bps: number; liquidity: string; settlement: string;
};

const PAIRS: [string, string][] = [
  ["EUR", "SGD"], ["USD", "EUR"], ["USD", "MYR"], ["GBP", "SGD"],
];

/** Stablecoin FX explained by showing the arithmetic, not by asserting it. */
export default function StablecoinFx() {
  const [pair, setPair] = useState(0);
  const [route, setRoute] = useState<Route | null>(null);
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    call("GET", "/v2/corridors", undefined, false).then((r) => {
      if (alive && r.ok) setCorridors((r.body as any).data);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const [from, to] = PAIRS[pair];
    setRoute(null); setErr(false);
    call("POST", "/v2/fx/route", { from, to, amount: "10000.00" }).then((r) => {
      if (!alive) return;
      if (r.ok) setRoute(r.body as Route); else setErr(true);
    });
    return () => { alive = false; };
  }, [pair]);

  const card: CSSProperties = { background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18 };
  const legTone = (k: string) =>
    k === "fx" ? { fg: "#4E5FA6", bg: "#EEF1FA", line: "#DADFF2" }
               : { fg: "#2E7D53", bg: "#E3F1E9", line: "#BFE0CD" };

  return (
    <div data-pad style={{ ...card, padding: "34px 34px 30px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>STABLECOIN FX</div>
      <h2 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>
        One spread, not three.
      </h2>
      <p style={{ margin: "12px 0 0", fontSize: 15.5, lineHeight: 1.62, maxWidth: "72ch", color: "#454B5C" }}>
        Correspondent banking charges a spread at every hop and takes days. Here the edges are
        1:1 mints and redemptions — no currency is changing, so nothing is priced. The only leg
        carrying FX is the corridor in the middle. Pick a pair and watch the arithmetic.
      </p>

      {/* pair picker */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "20px 0 16px" }}>
        {PAIRS.map(([f, t], i) => {
          const on = i === pair;
          return (
            <button key={`${f}${t}`} onClick={() => setPair(i)}
              style={{
                cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: 500, padding: "8px 14px", borderRadius: 999,
                border: `1px solid ${on ? "#5A6DB8" : "#D7DBE4"}`, background: on ? "#5A6DB8" : "#FFFFFF",
                color: on ? "#FFFFFF" : "#454B5C",
              }}>
              {f} → {t}
            </button>
          );
        })}
      </div>

      {/* the three legs */}
      {err && (
        <div style={{ background: "#F7E9E8", border: "1px solid #B4453C33", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, color: "#B4453C" }}>
          Could not reach the API. Start it with <span style={{ fontFamily: MONO }}>pnpm dev</span> to see live pricing.
        </div>
      )}
      {!route && !err && (
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#7A8296", padding: "20px 0" }}>PRICING THE ROUTE…</div>
      )}

      {route && (
        <>
          <div data-col style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {route.legs.map((l) => {
              const t = legTone(l.kind);
              return (
                <div key={l.step} style={{ border: `1px solid ${t.line}`, background: t.bg, borderRadius: 14, padding: "16px 16px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: t.fg }}>
                      {String(l.step).padStart(2, "0")} · {l.kind.replace("_", " ").toUpperCase()}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: t.fg }}>
                      {l.spread_bps ?? 0} BPS
                    </span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                    {l.in.amount} <span style={{ color: "#7A8296", fontWeight: 500 }}>{l.in.currency}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#7A8296", margin: "3px 0" }}>↓</div>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                    {l.out.amount} <span style={{ color: "#7A8296", fontWeight: 500 }}>{l.out.currency}</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#5B6376", marginTop: 10 }}>{l.note}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "16px 20px", marginTop: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>{route.note}</div>
            <div style={{ display: "flex", gap: 22, alignItems: "baseline" }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>YOU SEND</div>
                <div style={{ fontSize: 18, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>10,000.00 {route.from}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>THEY RECEIVE</div>
                <div style={{ fontSize: 18, fontWeight: 650, color: "#94A3E0", fontVariantNumeric: "tabular-nums" }}>
                  {route.receives.amount} {route.receives.currency}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>TOTAL SPREAD</div>
                <div style={{ fontSize: 18, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{route.total_spread_bps} bps</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* corridors — where the FX actually happens */}
      {corridors && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 4 }}>CORRIDORS</div>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55, color: "#5B6376", maxWidth: "72ch" }}>
            A corridor is a stablecoin pair — the only leg that carries FX. A thin corridor quotes
            wider and settles when a counterparty is matched. That widening is the point: it pays
            whoever takes the hard side, and pulls liquidity in. A corridor is never dead, only expensive.
          </p>
          <div data-scroll>
            <div>
              {corridors.map((c) => (
                <div key={c.pair} style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px 110px 120px", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #E7EAF0" }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5 }}>{c.pair}</div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: "#7A8296", fontVariantNumeric: "tabular-nums" }}>
                    depth {c.depth.amount} {c.depth.currency}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: c.liquidity === "thin" ? "#B0761E" : "#2E7D53" }}>
                    {c.spread_bps} bps
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: c.liquidity === "thin" ? "#B0761E" : "#2E7D53", background: c.liquidity === "thin" ? "#F6EEDD" : "#E3F1E9", border: `1px solid ${c.liquidity === "thin" ? "#E7D6B0" : "#BFE0CD"}`, borderRadius: 999, padding: "3px 9px", textAlign: "center" }}>
                    {c.liquidity.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#454B5C", textAlign: "right" }}>
                    {c.settlement === "instant" ? "Instant" : "When matched"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* who actually provides the liquidity */}
      <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 26 }}>
        {[
          { k: "ISSUERS", t: "Long their own currency by construction", b: "A stablecoin issuer's reserves are that currency. Filling flow in it is not inventory risk — it is their balance sheet, earning spread on reserves they already hold." },
          { k: "DEPOSIT-TAKERS", t: "Long their deposit base", b: "A bank whose customers hold a currency already carries it. Providing liquidity monetises exposure it has anyway rather than creating new exposure." },
          { k: "PRINCIPAL", t: "The backstop when nobody bids", b: "If no counterparty appears, the operator fills as principal at a wider rate. The corridor stays open; the price does the work." },
        ].map((x) => (
          <div key={x.k} style={{ background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 14, padding: "16px 17px 14px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#7A8296" }}>{x.k}</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.02em", margin: "8px 0 6px" }}>{x.t}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#5B6376" }}>{x.b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
