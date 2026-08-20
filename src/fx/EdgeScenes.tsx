import { useEffect, useRef, useState } from "react";
import { assetSymbol, type PublicTrade } from "./model";
import "./market-scene.css";

/* Sections 3–5 of the drawn-instrument pass: fiat edges, treasury limit,
   route finality. Structural labels are the settled copy; every figure and
   every settlement edge comes from the runtime trade. */

const eurF = (v: number) =>
  "€" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FINALITY_HUMAN: Record<string, string> = {
  ATOMIC: "one transaction · all or nothing",
  ATTESTED_EXTERNAL: "external payment · proven by evidence",
  ASYNC_EXTERNAL: "external payout · its own timing",
  AUTHORITATIVE_LEDGER: "posted ledger · authoritative",
};

/* ---------------------------------------------------------------- fiat edges */

const EDGES = [
  { id: "provider", side: "controlled", label: "Provider / Bridge", note: "provider-managed",
    body: "A banking or ramp provider such as Bridge moves the fiat and returns settlement evidence under the provider and institution's KYC/AML programme." },
  { id: "customers", side: "controlled", label: "Your customers", note: "inside your customer perimeter",
    body: "When both sides are your customers, their KYC/KYB, accounts, source-of-funds information, screening, monitoring and limits remain attributable inside your institution." },
  { id: "issuer", side: "controlled", label: "Issuer", note: "issuer evidence and timing",
    body: "An issuer mints tokenised currency after fiat arrives and redeems it before fiat is paid out. Mint, token exchange and payout remain separate route edges." },
  { id: "rails", side: "controlled", label: "Your own rails", note: "ledger and bank evidence",
    body: "An authoritative posted ledger event can satisfy a movement between your own accounts; a bank rail moves local money and returns its own payment state, recorded before the external call." },
  { id: "peer", side: "open", label: "Peer / open P2P", note: "outside your customer perimeter",
    body: "A Peer-style adapter discovers external crypto sellers, creates an intent, verifies the buyer's fiat payment and releases crypto after the proof is accepted. Those peers are outside your own customer and KYC perimeter." },
] as const;

export function FiatEdgesScene({ trade }: { trade: PublicTrade | null }) {
  const [sel, setSel] = useState<(typeof EDGES)[number]["id"]>("customers");
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selected = EDGES.find((e) => e.id === sel)!;

  useEffect(() => {
    const stage = stageRef.current, cv = canvasRef.current;
    if (!stage || !cv) return;
    if (stage.clientWidth < 900) { cv.style.display = "none"; return; }
    cv.style.display = "";
    const W = stage.clientWidth, H = stage.clientHeight;
    cv.width = W * 2; cv.height = H * 2;
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.scale(2, 2);
    const s = stage.getBoundingClientRect();
    const anchor = (el: HTMLElement | null, edge: "bottom" | "top") => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left - s.left + r.width / 2, y: (edge === "bottom" ? r.bottom : r.top) - s.top } : null;
    };
    const token = anchor(tokenRef.current, "top");
    const market = anchor(marketRef.current, "top");
    const tokenBottom = anchor(tokenRef.current, "bottom");
    if (!token || !market || !tokenBottom) return;
    const paths = EDGES.map((e) => {
      const a = anchor(cardRefs.current[e.id] ?? null, "bottom");
      if (!a) return null;
      return {
        id: e.id,
        pts: [a, { x: a.x, y: a.y + (token.y - a.y) * 0.5 }, { x: token.x, y: token.y - 34 }, { x: token.x, y: token.y - 4 }] as const,
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null);
    const drop = [tokenBottom, { x: tokenBottom.x, y: tokenBottom.y + 12 }, { x: market.x, y: market.y - 22 }, { x: market.x, y: market.y - 4 }] as const;
    const bez = (p: readonly { x: number; y: number }[], t: number) => {
      const u = 1 - t;
      return {
        x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
        y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
      };
    };
    let dash = 0;
    const particles: { path: readonly { x: number; y: number }[]; t: number; hot: boolean }[] = [];
    const emitters: ReturnType<typeof setTimeout>[] = [];
    let emitSel = sel;
    const cycle = () => {
      for (const p of paths)
        emitters.push(setTimeout(() => particles.push({ path: p.pts, t: 0, hot: p.id === emitSel }), Math.random() * 900));
      emitters.push(setTimeout(() => particles.push({ path: drop, t: 0, hot: true }), 1500));
    };
    cycle();
    const loop = setInterval(cycle, 2600);
    let raf = 0;
    const draw = () => {
      cx.clearRect(0, 0, W, H);
      dash -= 0.5;
      for (const p of paths) {
        cx.beginPath();
        cx.moveTo(p.pts[0].x, p.pts[0].y);
        cx.bezierCurveTo(p.pts[1].x, p.pts[1].y, p.pts[2].x, p.pts[2].y, p.pts[3].x, p.pts[3].y);
        cx.strokeStyle = p.id === emitSel ? "#0868FFAA" : "#0868FF33";
        cx.lineWidth = p.id === emitSel ? 2.5 : 2;
        cx.setLineDash([6, 8]);
        cx.lineDashOffset = dash;
        cx.stroke();
        cx.setLineDash([]);
      }
      cx.beginPath();
      cx.moveTo(drop[0].x, drop[0].y);
      cx.bezierCurveTo(drop[1].x, drop[1].y, drop[2].x, drop[2].y, drop[3].x, drop[3].y);
      cx.strokeStyle = "#0868FF88";
      cx.lineWidth = 2.5;
      cx.setLineDash([6, 8]);
      cx.lineDashOffset = dash;
      cx.stroke();
      cx.setLineDash([]);
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.t += 0.014;
        if (pt.t >= 1) { particles.splice(i, 1); continue; }
        const pos = bez(pt.path, pt.t);
        const g = cx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pt.hot ? 8 : 6);
        g.addColorStop(0, pt.hot ? "#0868FF" : "#7BC7FF");
        g.addColorStop(1, "#0868FF00");
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(pos.x, pos.y, pt.hot ? 8 : 6, 0, 7); cx.fill();
        cx.fillStyle = "#FFF";
        cx.beginPath(); cx.arc(pos.x, pos.y, 2.2, 0, 7); cx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const selWatch = { set: (v: typeof sel) => { emitSel = v; } };
    (stage as HTMLDivElement & { __selWatch?: typeof selWatch }).__selWatch = selWatch;
    return () => { cancelAnimationFrame(raf); clearInterval(loop); emitters.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    const stage = stageRef.current as (HTMLDivElement & { __selWatch?: { set: (v: string) => void } }) | null;
    stage?.__selWatch?.set(sel);
  }, [sel]);

  const liveEdges = trade?.settlement.edges ?? [];

  return (
    <section className="fxp-section fxn-section fxfe">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">FIAT CONNECTIONS</span>
          <h2>Fiat settlement options</h2>
          <p>
            A provider, transfers between verified customers, issuer mint and
            redemption, internal ledger movements, bank rails or an external
            peer-to-peer service can move value to and from the same token FX
            market. The fiat connection does not determine who makes the FX
            price or supplies its liquidity.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxfe-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="fxms-canvas" />
        <div className="fxfe-columns">
          <div className="fxfe-perimeter controlled">
            <span className="fxfe-perimeter-label">INSTITUTION-CONTROLLED · YOUR KYC PERIMETER</span>
            <div className="fxfe-cards">
              {EDGES.filter((e) => e.side === "controlled").map((e) => (
                <button
                  key={e.id}
                  ref={(el) => { cardRefs.current[e.id] = el; }}
                  className={`fxfe-card ${sel === e.id ? "sel" : ""}`}
                  onClick={() => setSel(e.id)}
                >
                  <b>{e.label}</b><small>{e.note}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="fxfe-perimeter open">
            <span className="fxfe-perimeter-label">OPEN / EXTERNAL</span>
            <div className="fxfe-cards">
              {EDGES.filter((e) => e.side === "open").map((e) => (
                <button
                  key={e.id}
                  ref={(el) => { cardRefs.current[e.id] = el; }}
                  className={`fxfe-card ${sel === e.id ? "sel" : ""}`}
                  onClick={() => setSel(e.id)}
                >
                  <b>{e.label}</b><small>{e.note}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="fxfe-body">{selected.body}</div>

        <div className="fxfe-token" ref={tokenRef}>STABLECOIN BALANCE</div>
        <div className="fxfe-market" ref={marketRef}>
          <b>THE SAME FX MARKET UNDERNEATH</b>
          <span>the fiat model never changes the market model</span>
        </div>

        {liveEdges.length > 0 && (
          <div className="fxfe-live">
            <span className="fxfe-live-label">THIS PAGE'S LIVE ROUTE USES</span>
            {liveEdges.map((e) => (
              <span key={e.edgeId} className={`fxfe-live-chip ${e.finalityClass === "ATOMIC" ? "atomic" : ""}`}>
                {assetSymbol(trade, e.fromAsset)} → {assetSymbol(trade, e.toAsset)} · {FINALITY_HUMAN[e.finalityClass] ?? e.finalityClass.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- treasury limit */

export function TreasuryScene({ trade }: { trade: PublicTrade | null }) {
  const chartRef = useRef<HTMLCanvasElement>(null);

  const pick = (type: "BANK_TREASURY" | "BANK_PRINCIPAL") => {
    const status = trade?.sourceStatus.find((s) => s.sourceType === type);
    const alloc = trade?.sources.find((s) => s.type === type);
    const avail = status ? Number(status.availableOutput) / 1e6 : null;
    const used = alloc?.outputAmount ? Number(alloc.outputAmount) : 0;
    return { avail, used, eligible: status?.eligible ?? false };
  };
  const treasury = pick("BANK_TREASURY");
  const principal = pick("BANK_PRINCIPAL");
  const totalAvail = (treasury.avail ?? 0) + (principal.avail ?? 0);
  const totalUsed = treasury.used + principal.used;
  const meterPct = totalAvail + totalUsed > 0 ? (totalUsed / (totalAvail + totalUsed)) * 100 : 0;

  useEffect(() => {
    const cv = chartRef.current;
    if (!cv) return;
    const W = 900, H = 300;
    cv.width = W * 2; cv.height = H * 2;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.scale(2, 2);
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = "#EEF0F5"; cx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { const y = (H - 24) * i / 5; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    cx.strokeStyle = "#E3E6EE"; cx.beginPath(); cx.moveTo(0, H - 24); cx.lineTo(W, H - 24); cx.stroke();
    const pts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const y = Math.pow(t, 2.1) / (Math.pow(t, 2.1) + Math.pow(1 - t, 2.1));
      pts.push([t * (W - 12), (H - 24) - y * (H - 60) - 4]);
    }
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(8,104,255,0.28)"); g.addColorStop(1, "rgba(8,104,255,0.02)");
    cx.beginPath(); cx.moveTo(pts[0][0], H - 24);
    pts.forEach((p) => cx.lineTo(p[0], p[1]));
    cx.lineTo(pts[pts.length - 1][0], H - 24); cx.closePath();
    cx.fillStyle = g; cx.fill();
    cx.beginPath(); pts.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])));
    cx.strokeStyle = "#2F6BFF"; cx.lineWidth = 4.5; cx.lineCap = "round"; cx.stroke();
    const lx = W * 0.635;
    cx.setLineDash([8, 7]); cx.strokeStyle = "#B4453C"; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(lx, 6); cx.lineTo(lx, H - 24); cx.stroke();
    cx.setLineDash([]);
  }, [trade]);

  return (
    <section className="fxp-section fxn-section fxts">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">BALANCE SHEET</span>
          <h2>Treasury and principal risk</h2>
          <p>
            Treasury and principal participate as sources inside the market.
            Positions and outstanding reservations consume hard asset limits;
            exhausted capacity is removed from the plan. A wider spread never
            overrides the configured exposure ceiling.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxts-stage">
        <div className="fxts-chart">
          <span className="fxrs-kick">ONE-WAY FLOW MEETS A HARD LIMIT</span>
          <div className="fxts-chart-wrap">
            <div className="fxts-pill"><span>HARD LIMIT</span><b>principal stops here</b></div>
            <canvas ref={chartRef} />
          </div>
          <div className="fxts-axis"><span>balanced</span><span>one-way demand</span><span>limit reached</span></div>
        </div>

        <div className="fxts-book">
          <span className="fxrs-kick light">PRINCIPAL RISK BOOK · LIVE</span>
          <div className="fxts-row"><span>Treasury used in this exchange</span><b>{eurF(treasury.used)}</b></div>
          <div className="fxts-row"><span>Balance sheet used in this exchange</span><b>{eurF(principal.used)}</b></div>
          <hr />
          <div className="fxts-row big"><span>Capacity consumed</span><b>{eurF(totalUsed)}</b></div>
          <div className="fxts-row big"><span>Capacity remaining</span><b>{totalAvail ? eurF(totalAvail) : "—"}</b></div>
          <div className="fxts-meter"><i style={{ width: `${meterPct}%` }} /></div>
          <div className="fxts-refused">CAPACITY EXHAUSTED → NEXT QUOTE REFUSED, NOT WIDENED</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- route finality */

export function FinalityScene({ trade }: { trade: PublicTrade | null }) {
  const edges = trade?.settlement.edges ?? [];
  return (
    <section className="fxp-section fxn-section fxfs">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">SETTLEMENT</span>
          <h2>Route finality</h2>
          <p>
            The selected token fills settle together in one router transaction.
            Fiat payments, internal ledgers, mints, redemptions and payouts keep
            the evidence and timing of the system that performs them. The route
            records these boundaries instead of describing an entire
            fiat-to-fiat exchange as one atomic transaction.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxfs-stage">
        <div className="fxfs-rail">
          {edges.map((edge, i) => (
            <div key={edge.edgeId} className="fxfs-frag">
              {i > 0 && <span className="fxfs-arrow">→</span>}
              <div className={`fxfs-leg ${edge.finalityClass === "ATOMIC" ? "atomic" : ""}`}>
                <span className="fxfs-leg-kick">{edge.finalityClass === "ATOMIC" ? "THE EXCHANGE" : i === 0 ? "MONEY IN" : "MONEY OUT"}</span>
                <b>{assetSymbol(trade, edge.fromAsset)} → {assetSymbol(trade, edge.toAsset)}</b>
                <small>{edge.edgeType.replaceAll("_", " ").toLowerCase()}</small>
                <em>{FINALITY_HUMAN[edge.finalityClass] ?? edge.finalityClass.toLowerCase()}</em>
                <i className="fxfs-flow" />
              </div>
            </div>
          ))}
          {edges.length === 0 && <div className="fxfs-empty">connecting to the runtime…</div>}
        </div>
        <div className="fxfs-note">
          Only the middle leg is atomic — and the route says so instead of
          pretending the whole journey is.
        </div>
      </div>
    </section>
  );
}
