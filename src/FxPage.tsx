import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { call, ensureKey } from "./api";

const MONO = "'IBM Plex Mono', monospace";
/** Rail windows span 10 seconds to five days — show whichever unit reads honestly. */
const fmtWindow = (sec: number) =>
  sec < 90 ? `${sec} seconds`
    : sec < 5400 ? `${Math.round(sec / 60)} minutes`
      : sec < 172800 ? `${Math.round(sec / 3600)} hours`
        : `${Math.round(sec / 86400)} days`;

const card: CSSProperties = { background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18 };

type Model = {
  base_bps: number; max_skew_bps: number;
  rebate_threshold: number; max_rebate_bps: number;
  formula: string[]; note: string;
};

/** The identical arithmetic the server runs. Published at /v2/fx/pricing-model so
 *  this is a re-computation, not a mock-up — drag the slider and you are running
 *  the engine's own formula. */
function price(model: Model, imbalance: number, impact: number) {
  const { base_bps: base, max_skew_bps: skew, rebate_threshold: thr, max_rebate_bps: maxReb } = model;
  let bps = base + skew * Math.max(0, imbalance) + skew * 0.4 * impact;
  let rebate = 0;
  if (imbalance < -thr) {
    const strength = Math.min(1, (Math.abs(imbalance) - thr) / (1 - thr));
    rebate = maxReb * strength;
    bps = Math.max(0, base - rebate);
  }
  return { bps: Math.round(bps * 100) / 100, rebate: Math.round(rebate * 100) / 100 };
}

/* ------------------------------------------------------------------ */
/* 1. The thermostat — drag one-sidedness, watch the price respond.     */
/* ------------------------------------------------------------------ */
function Thermostat({ model }: { model: Model }) {
  const [imb, setImb] = useState(0);
  const [size, setSize] = useState(0);

  const p = price(model, imb, size);
  const reverse = price(model, -imb, size);

  // the whole curve, so you can see the shape rather than one point
  const curve = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = -100; i <= 100; i += 2) pts.push({ x: i / 100, y: price(model, i / 100, 0).bps });
    return pts;
  }, [model]);
  const maxY = Math.max(...curve.map((c) => c.y), 1);
  const path = curve
    .map((c, i) => `${i === 0 ? "M" : "L"} ${((c.x + 1) / 2) * 100} ${100 - (c.y / maxY) * 100}`)
    .join(" ");

  const tone = p.rebate > 0 ? "#2E7D53" : p.bps > 40 ? "#B0761E" : "#4E5FA6";

  return (
    <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>THE THERMOSTAT · DRAG IT</div>
      <h3 style={{ margin: "10px 0 8px", fontSize: 21, fontWeight: 600, letterSpacing: "-0.025em" }}>
        A one-way corridor doesn't die. It gets expensive.
      </h3>
      <p style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.6, color: "#454B5C", maxWidth: "68ch" }}>
        Drag the corridor from balanced to completely one-sided. The spread is not looked up in a
        table — it is derived. Push it far enough and the other direction starts paying you.
      </p>

      <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
        <div>
          {/* the curve */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 150, background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 12 }}>
            <line x1="50" y1="0" x2="50" y2="100" stroke="#D7DBE4" strokeWidth="0.4" />
            <path d={path} fill="none" stroke="#5A6DB8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <circle cx={((imb + 1) / 2) * 100} cy={100 - (p.bps / maxY) * 100} r="1.8" fill={tone} vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9.5, color: "#7A8296", marginTop: 6 }}>
            <span>← ONE-SIDED AGAINST YOU (you get paid)</span>
            <span>BALANCED</span>
            <span>ONE-SIDED WITH YOU (you pay) →</span>
          </div>

          <label style={{ display: "block", marginTop: 18, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296" }}>
            CORRIDOR IMBALANCE · {Math.round(imb * 100)}%
          </label>
          <input type="range" min={-100} max={100} value={imb * 100}
            onChange={(e) => setImb(Number(e.target.value) / 100)}
            style={{ width: "100%", accentColor: "#5A6DB8", marginTop: 8 }} />

          <label style={{ display: "block", marginTop: 14, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296" }}>
            YOUR SIZE vs AVAILABLE DEPTH · {Math.round(size * 100)}%
          </label>
          <input type="range" min={0} max={100} value={size * 100}
            onChange={(e) => setSize(Number(e.target.value) / 100)}
            style={{ width: "100%", accentColor: "#5A6DB8", marginTop: 8 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>YOUR DIRECTION</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: p.rebate > 0 ? "#5FBE89" : "#FFFFFF" }}>
              {p.bps.toFixed(1)}<span style={{ fontSize: 15, color: "#8B93A6", marginLeft: 5 }}>bps</span>
            </div>
            {p.rebate > 0 && (
              <div style={{ fontSize: 13, color: "#5FBE89", marginTop: 4 }}>+ {p.rebate.toFixed(1)} bps rebate — you are paid to level it</div>
            )}
          </div>
          <div style={{ background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#7A8296" }}>THE OTHER DIRECTION</div>
            <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
              {reverse.bps.toFixed(1)}<span style={{ fontSize: 13, color: "#7A8296", marginLeft: 5 }}>bps</span>
            </div>
            {reverse.rebate > 0 && <div style={{ fontSize: 12.5, color: "#2E7D53", marginTop: 3 }}>earns a {reverse.rebate.toFixed(1)} bps rebate</div>}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#5B6376" }}>
            {p.rebate > 0
              ? "Nobody wants to go this way, so the corridor pays you to. That is how it refills itself."
              : imb > 0.2
              ? "Everyone is going your way, so you pay for the privilege — and that payment is what attracts the other side."
              : "Balanced. Priced at the floor."}
          </div>
        </div>
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", color: "#4E5FA6" }}>
          THE FORMULA — CHECK IT YOURSELF
        </summary>
        <pre style={{ margin: "10px 0 0", background: "#14161C", color: "#E4E7EE", borderRadius: 12, padding: "16px 18px", fontFamily: MONO, fontSize: 12, lineHeight: 1.8, overflowX: "auto" }}>
{model.formula.join("\n")}
        </pre>
        <div style={{ fontSize: 12.5, color: "#5B6376", marginTop: 8 }}>{model.note}</div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Route builder — live, against the running API.                    */
/* ------------------------------------------------------------------ */
const FIATS = ["EUR", "USD", "GBP", "SGD", "MYR"];

function RouteBuilder() {
  const [from, setFrom] = useState("EUR");
  const [to, setTo] = useState("SGD");
  const [amount, setAmount] = useState("10000.00");
  const [route, setRoute] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    const t = setTimeout(() => {
      // Pricing a route is an authenticated call, and a visitor arriving straight
      // at /fx has never been through the docs page. Issue them a sandbox key on
      // the spot — the demo is meant to work for anyone with the link.
      ensureKey()
        .then(() => call("POST", "/v2/fx/route", { from, to, amount }))
        .then((r) => {
          if (!alive) return;
          if (r.ok) setRoute(r.body);
          else setErr((r.body as any)?.detail ?? r.error ?? "Could not price that route");
        });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [from, to, amount]);

  const undeliverable = route?.settlement?.deliverable === false;

  const sel: CSSProperties = { fontFamily: MONO, fontSize: 13, padding: "9px 12px", borderRadius: 10, border: "1px solid #DDE1E8", background: "#FFFFFF" };

  return (
    <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>ROUTE BUILDER · LIVE</div>
      <h3 style={{ margin: "10px 0 8px", fontSize: 21, fontWeight: 600, letterSpacing: "-0.025em" }}>One spread, not three.</h3>
      <p style={{ margin: "0 0 18px", fontSize: 14.5, lineHeight: 1.6, color: "#454B5C", maxWidth: "68ch" }}>
        Change anything and it re-prices against the running API. The ramps are 1:1 — no currency
        is changing, so nothing is charged. Only the middle leg is priced.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ ...sel, width: 140, fontVariantNumeric: "tabular-nums" }} />
        <select value={from} onChange={(e) => setFrom(e.target.value)} style={sel}>
          {FIATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span style={{ color: "#7A8296" }}>→</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} style={sel}>
          {FIATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {err && <div style={{ background: "#F7E9E8", border: "1px solid #B4453C33", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, color: "#B4453C" }}>{err}</div>}

      {route && !err && (
        <>
          <div data-col style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {route.legs.map((l: any) => {
              const isFx = l.kind === "fx";
              return (
                <div key={l.step} style={{
                  border: `1px solid ${isFx ? "#DADFF2" : "#BFE0CD"}`,
                  background: isFx ? "#EEF1FA" : "#E3F1E9", borderRadius: 14, padding: "16px 16px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: isFx ? "#4E5FA6" : "#2E7D53" }}>
                      {String(l.step).padStart(2, "0")} · {l.kind.replace("_", " ").toUpperCase()}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: isFx ? "#4E5FA6" : "#2E7D53" }}>{l.spread_bps ?? 0} BPS</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {l.in.amount} <span style={{ color: "#7A8296", fontWeight: 500 }}>{l.in.currency}</span>
                  </div>
                  <div style={{ color: "#7A8296", margin: "3px 0" }}>↓</div>
                  <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {l.out.amount} <span style={{ color: "#7A8296", fontWeight: 500 }}>{l.out.currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* When a leg cannot actually be delivered, the headline number must not
              read like a quote you could act on. Same figure, stated as indicative. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", background: undeliverable ? "#3A2A28" : "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "16px 20px", marginTop: 12 }}>
            <div style={{ fontSize: 14 }}>
              {undeliverable
                ? "Indicative only — this route cannot be completed end to end."
                : route.note}
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>
                  {undeliverable ? "WOULD RECEIVE" : "THEY RECEIVE"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: undeliverable ? "#C99A93" : "#94A3E0", fontVariantNumeric: "tabular-nums", textDecoration: undeliverable ? "line-through" : "none" }}>{route.receives.amount} {route.receives.currency}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>TOTAL</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{route.total_spread_bps} bps</div>
              </div>
            </div>
          </div>
          {/* Cost and time are different claims. The corridor is atomic; the fiat
              ramps either side are not, and a corridor with no rail cannot be
              delivered at all — the page says so rather than quoting past it. */}
          {route.settlement && (
            <div style={{
              marginTop: 10, padding: "12px 16px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
              border: `1px solid ${route.settlement.deliverable === false ? "#E7C9C9" : "#DDE1E8"}`,
              background: route.settlement.deliverable === false ? "#FCF6F5" : "#F7F8FA",
              color: route.settlement.deliverable === false ? "#8C3A34" : "#5A6274",
            }}>
              {route.settlement.deliverable === false ? (
                <><strong>Not deliverable end to end.</strong> {route.settlement.blocked_reason}</>
              ) : (
                <>
                  <strong>Atomic in the middle, not at the edges.</strong>{" "}
                  The corridor leg settles atomically. The ramps ride{" "}
                  <span style={{ fontFamily: MONO }}>{route.settlement.on_ramp?.rail}</span> and{" "}
                  <span style={{ fontFamily: MONO }}>{route.settlement.off_ramp?.rail}</span>
                  {route.settlement.end_to_end_seconds != null && <> — about {fmtWindow(route.settlement.end_to_end_seconds)} end to end</>}
                  . The rate is struck when the corridor leg runs, and that movement is carried by{" "}
                  <span style={{ fontFamily: MONO }}>{route.settlement.rate_risk_borne_by}</span>.
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. LP calculator — what a bank earns vs what a member earns.         */
/* ------------------------------------------------------------------ */
const SHARES = { issuer: 0.70, bank: 0.75, member: 0.80 };

function LpCalculator() {
  const [stake, setStake] = useState(100000);
  const [klass, setKlass] = useState<keyof typeof SHARES>("member");
  const [poolSize, setPoolSize] = useState(1000000);
  const [monthlyVolume, setMonthlyVolume] = useState(5000000);
  const [spreadBps, setSpreadBps] = useState(12);

  const weight = stake / Math.max(poolSize, stake);
  const totalSpread = (monthlyVolume * spreadBps) / 10000;
  const earned = totalSpread * weight * SHARES[klass];
  const annualised = stake > 0 ? ((earned * 12) / stake) * 100 : 0;

  const row = (label: string, val: string, hint?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid #E7EAF0", fontSize: 13.5 }}>
      <span style={{ color: "#5B6376" }}>{label}{hint && <span style={{ color: "#9AA1B0" }}> · {hint}</span>}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{val}</span>
    </div>
  );

  const slider = (label: string, v: number, set: (n: number) => void, min: number, max: number, step: number, fmt: (n: number) => string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "#7A8296" }}>
        <span>{label}</span><span style={{ color: "#14161C" }}>{fmt(v)}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => set(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#5A6DB8", marginTop: 6 }} />
    </div>
  );

  const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div data-pad style={{ ...card, padding: "30px 32px 28px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>PROVIDE LIQUIDITY · CALCULATE IT</div>
      <h3 style={{ margin: "10px 0 8px", fontSize: 21, fontWeight: 600, letterSpacing: "-0.025em" }}>
        A bank and a person use the same endpoint.
      </h3>
      <p style={{ margin: "0 0 18px", fontSize: 14.5, lineHeight: 1.6, color: "#454B5C", maxWidth: "68ch" }}>
        Yield is a share of the spread takers actually paid — no flow, no earnings. A member earns
        the largest share, because they are the only provider carrying real round-trip risk: an
        issuer's reserves already <em>are</em> that currency, and a bank is already long its deposits.
      </p>

      <div data-col style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
            {(Object.keys(SHARES) as (keyof typeof SHARES)[]).map((k) => (
              <button key={k} onClick={() => setKlass(k)}
                style={{
                  cursor: "pointer", fontFamily: MONO, fontSize: 11.5, padding: "8px 14px", borderRadius: 999,
                  border: `1px solid ${klass === k ? "#5A6DB8" : "#D7DBE4"}`,
                  background: klass === k ? "#5A6DB8" : "#FFFFFF", color: klass === k ? "#FFFFFF" : "#454B5C",
                }}>
                {k.toUpperCase()} · {Math.round(SHARES[k] * 100)}%
              </button>
            ))}
          </div>
          {slider("YOUR STAKE", stake, setStake, 1000, 2000000, 1000, (n) => money(n))}
          {slider("TOTAL POOL", poolSize, setPoolSize, 100000, 20000000, 100000, (n) => money(n))}
          {slider("MONTHLY CORRIDOR VOLUME", monthlyVolume, setMonthlyVolume, 100000, 50000000, 100000, (n) => money(n))}
          {slider("CORRIDOR SPREAD", spreadBps, setSpreadBps, 2, 120, 1, (n) => `${n} bps`)}
        </div>

        <div>
          <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#8B93A6" }}>YOUR MONTHLY EARNINGS</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
              {money(earned)}
            </div>
            <div style={{ fontSize: 13, color: "#8B93A6", marginTop: 4 }}>
              {annualised.toFixed(1)}% annualised on your stake
            </div>
          </div>
          <div style={{ background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 14, padding: "4px 16px 12px" }}>
            {row("Your share of the pool", `${(weight * 100).toFixed(1)}%`)}
            {row("Spread paid by takers", money(totalSpread), "per month")}
            {row("Your class share", `${Math.round(SHARES[klass] * 100)}%`, klass)}
            {row("Operator keeps", `${Math.round((1 - SHARES[klass]) * 100)}%`)}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "#7A8296", marginTop: 10 }}>
            Illustrative arithmetic using the real split constants. Actual earnings depend on flow
            through the corridor you supply.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* 0. The comparison. Three ways, not two — the middle one is the point.        */
/* ------------------------------------------------------------------ */
function Contrast() {
  const [live, setLive] = useState<any>(null);
  useEffect(() => {
    ensureKey()
      .then(() => call("POST", "/v2/fx/route", { from: "EUR", to: "SGD", amount: "10000.00" }))
      .then((r) => r.ok && setLive(r.body));
  }, []);

  const ROWS = ["What actually crosses the border", "Who prices the FX", "What you're quoted up front", "Arrives"];
  const COLS = [
    {
      label: "A BANK TRANSFER",
      tone: "plain" as const,
      cells: ["Money, bank to bank", "2–4 banks, each in turn", "Not the final number", "Days, after cut-offs"],
    },
    {
      label: "A STABLECOIN ON THE OLD RAIL",
      tone: "warn" as const,
      cells: ["Money, bank to bank — still", "The banks underneath, still", "Not the final number", "Days, after cut-offs"],
    },
    {
      label: "A STABLECOIN THAT ACTUALLY CROSSES",
      tone: "dark" as const,
      cells: [
        "The token itself, on-chain",
        "One corridor, once",
        live ? `${live.total_spread_bps} bps — the final number` : "…",
        live?.settlement?.end_to_end_seconds != null ? fmtWindow(live.settlement.end_to_end_seconds) : "…",
      ],
    },
  ];

  const bg = { plain: "#F7F8FA", warn: "#FBF7F0", dark: "#14161C" };
  const bd = { plain: "1px solid #DDE1E8", warn: "1px solid #E8DCC4", dark: "1px solid #14161C" };
  const fg = { plain: "#5A6274", warn: "#6B5B3E", dark: "#C8CEDA" };
  const strong = { plain: "#454B5C", warn: "#8A6D33", dark: "#FFFFFF" };
  const rule = { plain: "#E7EAF0", warn: "#EFE4D0", dark: "#262A33" };

  return (
    <>
      <div data-col style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {COLS.map((c) => (
          <div key={c.label} style={{ padding: "20px 20px 18px", borderRadius: 14, background: bg[c.tone], border: bd[c.tone], color: fg[c.tone] }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.13em", marginBottom: 12, minHeight: 24, color: c.tone === "dark" ? "#8B93A6" : undefined }}>
              {c.label}
            </div>
            {c.cells.map((cell, i) => (
              <div key={ROWS[i]} style={{ borderTop: `1px solid ${rule[c.tone]}`, padding: "9px 0" }}>
                <div style={{ fontSize: 11.5, opacity: 0.75, marginBottom: 2 }}>{ROWS[i]}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: i === 2 && c.tone === "dark" ? "#94A3E0" : strong[c.tone], fontVariantNumeric: "tabular-nums" }}>
                  {cell}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p style={{ margin: "18px 0 0", fontSize: 15, lineHeight: 1.6, maxWidth: "68ch", color: "#454B5C" }}>
        The middle one is where most of the industry is. Issuing a stablecoin does not by itself
        move anything — if the crossing still happens bank to bank underneath, the customer pays
        the same as they always did. <strong style={{ fontWeight: 600 }}>The saving comes from
        changing the rail, not from wrapping the old one in a token.</strong>
      </p>
    </>
  );
}

export default function FxPage() {
  const [model, setModel] = useState<Model | null>(null);
  const [corridors, setCorridors] = useState<any[] | null>(null);

  useEffect(() => {
    call("GET", "/v2/fx/pricing-model", undefined, false).then((r) => r.ok && setModel(r.body as Model));
    call("GET", "/v2/corridors", undefined, false).then((r) => r.ok && setCorridors((r.body as any).data));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-pad style={{ ...card, padding: "46px 46px 40px" }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>STABLECOIN FX</div>
        <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 600, letterSpacing: "-0.035em" }}>
          A payment abroad is priced by every bank it touches.
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 17, lineHeight: 1.62, maxWidth: "62ch", color: "#454B5C" }}>
          This replaces that chain with one corridor. Money leaves on a local rail, becomes a
          stablecoin 1:1, crosses once, and lands on a local rail the other side — so there is one
          spread to pay instead of one per bank.
        </p>
        <Contrast />
        <p style={{ margin: "22px 0 0", fontSize: 14.5, lineHeight: 1.6, maxWidth: "62ch", color: "#5B6376" }}>
          Everything below is the working thing, not a description of it — the price, the route and
          the payouts all come from the running API. Drag them and check the arithmetic.
        </p>
      </div>

      {model && <Thermostat model={model} />}
      <RouteBuilder />
      <LpCalculator />

      {corridors && (
        <div data-pad style={{ ...card, padding: "30px 32px 26px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296", marginBottom: 14 }}>LIVE CORRIDORS</div>
          <div data-scroll><div>
            {corridors.map((c: any) => (
              <div key={c.pair} style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 100px 110px", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #E7EAF0" }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5 }}>{c.pair}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: "#7A8296", fontVariantNumeric: "tabular-nums" }}>depth {c.depth.amount} {c.depth.currency}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: c.liquidity === "thin" ? "#B0761E" : "#2E7D53" }}>{c.spread_bps} bps</div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textAlign: "center", color: c.liquidity === "thin" ? "#B0761E" : "#2E7D53", background: c.liquidity === "thin" ? "#F6EEDD" : "#E3F1E9", border: `1px solid ${c.liquidity === "thin" ? "#E7D6B0" : "#BFE0CD"}`, borderRadius: 999, padding: "3px 8px" }}>{c.liquidity.toUpperCase()}</div>
                <div style={{ fontSize: 12.5, color: "#454B5C", textAlign: "right" }}>{c.settlement === "instant" ? "Instant" : "When matched"}</div>
              </div>
            ))}
          </div></div>
        </div>
      )}
    </div>
  );
}
