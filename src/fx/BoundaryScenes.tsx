import { useEffect, useRef } from "react";
import { SOURCE_LABELS, formatCurrency, type PublicTrade } from "./model";
import "./market-scene.css";

/* The two remaining word-list sections as drawn instruments.
   GlassBoundaryScene: the private market and the chain, separated by the
   glass — names stay behind it, only the selected fills cross.
   ControlPlaneScene: the operator's controls wired to the real participants
   and the real depth the market is allowed to show. */

const eur2 = (v: number) =>
  "€" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GlassBoundaryScene({ trade }: { trade: PublicTrade | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const fills = (trade?.sources ?? []).map((s) => ({
    id: `${s.type}:${s.sourceId}`,
    label: SOURCE_LABELS[s.type],
    outEur: s.outputAmount ? Number(s.outputAmount) : 0,
  }));

  /* particles crossing the glass, left to right */
  useEffect(() => {
    const stage = stageRef.current, cv = canvasRef.current;
    if (!stage || !cv || fills.length === 0) return;
    if (stage.clientWidth < 900) { cv.style.display = "none"; return; }
    cv.style.display = "";
    const W = stage.clientWidth, H = stage.clientHeight;
    cv.width = W * 2; cv.height = H * 2;
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.scale(2, 2);
    const s = stage.getBoundingClientRect();
    const l = leftRef.current?.getBoundingClientRect();
    const r = rightRef.current?.getBoundingClientRect();
    if (!l || !r) return;
    const lanes = fills.map((_, i) => ({
      y: l.top - s.top + 74 + i * 34,
      x0: l.right - s.left - 8,
      x1: r.left - s.left + 8,
    }));
    const particles: { lane: number; t: number }[] = [];
    const emitters: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      lanes.forEach((_, i) => emitters.push(setTimeout(() => particles.push({ lane: i, t: 0 }), i * 320)));
    };
    cycle();
    const loop = setInterval(cycle, lanes.length * 320 + 1800);
    let raf = 0;
    const draw = () => {
      cx.clearRect(0, 0, W, H);
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.t += 0.016;
        if (pt.t >= 1) { particles.splice(i, 1); continue; }
        const lane = lanes[pt.lane];
        if (!lane) { particles.splice(i, 1); continue; }
        const x = lane.x0 + (lane.x1 - lane.x0) * pt.t;
        const g = cx.createRadialGradient(x, lane.y, 0, x, lane.y, 7);
        g.addColorStop(0, "#0868FF");
        g.addColorStop(1, "#0868FF00");
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(x, lane.y, 7, 0, 7); cx.fill();
        cx.fillStyle = "#FFF";
        cx.beginPath(); cx.arc(x, lane.y, 2.2, 0, 7); cx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearInterval(loop); emitters.forEach(clearTimeout); };
  }, [trade, fills.length]);

  return (
    <section className="fxp-section fxn-section fxgb">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">MARKET AND SETTLEMENT</span>
          <h2>Private market and atomic token settlement</h2>
          <p>
            Identity, orders, pricing, matching, reservations and limits remain
            off-chain. The selected token fills are authorised and settled
            on-chain. This keeps the institution's market private without asking
            counterparties to trust an internal ledger for the exchange of
            tokenised money.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxgb-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="fxms-canvas" />

        <div className="fxgb-room" ref={leftRef}>
          <span className="fxrs-kick">YOUR MARKET · OFF-CHAIN</span>
          <div className="fxgb-rows">
            {fills.map((f) => (
              <div key={f.id} className="fxgb-row">
                <span className="fxgb-avatar">{f.label.slice(0, 1)}</span>
                <span className="fxgb-name">{f.label}</span>
                <span className="fxgb-amt">{eur2(f.outEur)}</span>
                <span className="fxgb-lock">signed · private</span>
              </div>
            ))}
            {fills.length === 0 && <div className="fxfs-empty">connecting to the runtime…</div>}
          </div>
          <div className="fxgb-foot">identities · orders · matching · limits stay here</div>
        </div>

        <div className="fxgb-glass">
          <span>THE GLASS</span>
          <em>only the selected fills cross</em>
        </div>

        <div className="fxgb-chain" ref={rightRef}>
          <span className="fxrs-kick light">ON-CHAIN · ONE TRANSACTION</span>
          <div className="fxgb-tx">
            {fills.map((f) => (
              <div key={f.id} className="fxgb-txrow">
                <span className="fxgb-sig">✓ authorised fill</span>
                <b>{eur2(f.outEur)}</b>
              </div>
            ))}
          </div>
          <div className="fxgb-seal">
            {trade ? `${fills.length} fills settle together — or the transaction reverts` : "…"}
          </div>
          <div className="fxgb-noname">no names · no orders · no book on the chain</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- control plane */

export function ControlPlaneScene({ trade }: { trade: PublicTrade | null }) {
  const statuses = trade?.sourceStatus ?? [];
  const depthRows = statuses.filter((s) => s.eligible);
  const maxAvail = Math.max(1, ...depthRows.map((s) => Number(s.availableOutput) / 1e6));

  return (
    <section className="fxp-section fxn-section fxcp">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">PRIVACY AND POLICY</span>
          <h2>Institutional market control</h2>
          <p>
            The operator decides who can participate, which accounts and
            currencies are eligible, and the limits that apply. Aggregate depth
            can be shared without exposing maker identity, customer attribution
            or signed orders. A signature proves who signed; it does not replace
            the institution's current permission to execute the trade.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxcp-stage">
        <div className="fxcp-panel">
          <span className="fxrs-kick light">YOUR CONTROL PLANE · LIVE</span>
          <div className="fxcp-corridor">
            <span>CORRIDOR</span>
            <b>{trade ? `${trade.from.symbol} / ${trade.to.symbol}` : "—"}</b>
          </div>
          <div className="fxcp-list">
            {statuses.map((s) => (
              <div key={`${s.sourceType}:${s.sourceId}`} className={`fxcp-row ${s.eligible ? "on" : "off"}`}>
                <i />
                <span className="fxcp-name">{s.label}</span>
                <span className="fxcp-state">
                  {s.eligible ? "approved" : s.reason.replaceAll("_", " ").toLowerCase()}
                </span>
              </div>
            ))}
            {statuses.length === 0 && <div className="fxfs-empty">connecting to the runtime…</div>}
          </div>
          <div className="fxcp-note">a valid signature is not permission — approval is checked again at execution</div>
        </div>

        <div className="fxcp-window">
          <span className="fxrs-kick">WHAT AN APPROVED CLIENT SEES</span>
          <div className="fxcp-depth">
            {depthRows.map((s) => (
              <div key={s.sourceId} className="fxcp-depthrow">
                <div className="fxcp-bar"><i style={{ width: `${Math.max(2.5, (Number(s.availableOutput) / 1e6 / maxAvail) * 100)}%` }} /></div>
                <span>{formatCurrency(String(Number(s.availableOutput) / 1e6), "EUR")}</span>
              </div>
            ))}
          </div>
          <div className="fxcp-window-foot">price levels and size — <b>no names behind them</b></div>
        </div>
      </div>
    </section>
  );
}
