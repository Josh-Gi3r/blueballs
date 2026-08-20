import { useEffect, useRef, useState } from "react";
import { formatCurrency, type PublicTrade } from "./model";
import "./market-scene.css";

/* The customer-and-maker moment as a drawn instrument.
   Two device phones flank the private order book; canvas flow-curves carry
   value between them. Every number on screen comes from the runtime trade. */

const eur = (v: number) =>
  "€" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type Phase = 0 | 1 | 2 | 3; // grow · maker posts · customer fills · settle

export function MarketScene({ trade }: { trade: PublicTrade | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const custRef = useRef<HTMLDivElement>(null);
  const makerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>(0);

  const sent = trade ? formatCurrency(trade.from.charged ?? trade.from.requested, "BRL") : "—";
  const recv = trade ? formatCurrency(trade.to.amount, "EUR") : "—";
  const rate = trade ? Number(trade.rate) : null;

  const rows = (trade?.sourceStatus ?? []).map((status) => {
    const alloc = trade?.sources.find(
      (item) => item.type === status.sourceType &&
        (item.sourceId === status.sourceId || status.sourceType === "PRIVATE_MARKET"),
    );
    return {
      id: `${status.sourceType}:${status.sourceId}`,
      label: status.label,
      eligible: status.eligible,
      availEur: Number(status.availableOutput) / 1e6,
      filledEur: alloc?.outputAmount ? Number(alloc.outputAmount) : 0,
      impliedRate: alloc?.outputAmount && alloc.inputAmount
        ? Number(alloc.inputAmount) / Number(alloc.outputAmount)
        : null,
      isMaker: status.sourceType === "PRIVATE_MARKET",
    };
  });
  const maxAvail = Math.max(1, ...rows.map((r) => r.availEur));
  const maker = rows.find((r) => r.isMaker);
  const fillCount = trade?.sources.length ?? 0;

  /* choreography — phases loop while mounted; widths derive from phase + real numbers */
  useEffect(() => {
    if (!trade) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setPhase(0);
      timers.push(setTimeout(() => setPhase(1), 1400));
      timers.push(setTimeout(() => setPhase(2), 3400));
      timers.push(setTimeout(() => setPhase(3), 5200));
    };
    run();
    const loop = setInterval(run, 8600);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, [trade]);

  /* canvas flow-curves + particles, anchors measured from layout */
  useEffect(() => {
    const stage = stageRef.current, cv = canvasRef.current;
    if (!stage || !cv || !trade) return;
    if (stage.clientWidth < 900) { cv.style.display = "none"; return; }
    cv.style.display = "";
    const W = stage.clientWidth, H = stage.clientHeight;
    cv.width = W * 2; cv.height = H * 2;
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.scale(2, 2);

    const rel = (el: HTMLElement | null) => {
      const s = stage.getBoundingClientRect(), r = el?.getBoundingClientRect();
      return r ? { left: r.left - s.left, right: r.right - s.left, top: r.top - s.top, h: r.height } : null;
    };
    const c = rel(custRef.current), m = rel(makerRef.current), b = rel(bookRef.current);
    if (!c || !m || !b) return;
    const curve = (a: { x: number; y: number }, d: { x: number; y: number }, bend: number) => {
      const mx = (a.x + d.x) / 2;
      return [a, { x: mx, y: a.y - bend }, { x: mx, y: d.y - bend }, d] as const;
    };
    const paths = [
      { pts: curve({ x: c.right - 6, y: c.top + c.h * 0.30 }, { x: b.left + 4, y: b.top + b.h * 0.32 }, 44), color: "#0868FF" },
      { pts: curve({ x: m.left + 6, y: m.top + m.h * 0.52 }, { x: b.right - 4, y: b.top + b.h * 0.45 }, 44), color: "#7BC7FF" },
      { pts: curve({ x: b.left + 4, y: b.top + b.h * 0.58 }, { x: c.right - 6, y: c.top + c.h * 0.47 }, 32), color: "#22A0FF" },
    ];
    const bez = (p: readonly { x: number; y: number }[], t: number) => {
      const u = 1 - t;
      return {
        x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
        y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
      };
    };
    let dash = 0;
    const particles: { path: (typeof paths)[number]; t: number }[] = [];
    const emitters: ReturnType<typeof setTimeout>[] = [];
    const emit = (idx: number, n: number, gap: number) => {
      for (let i = 0; i < n; i++)
        emitters.push(setTimeout(() => particles.push({ path: paths[idx], t: 0 }), i * gap));
    };
    const schedule = () => { emit(1, 3, 220); emitters.push(setTimeout(() => emit(0, 4, 200), 2100)); emitters.push(setTimeout(() => emit(2, 3, 220), 4100)); };
    emitters.push(setTimeout(schedule, 1300));
    const loop = setInterval(() => emitters.push(setTimeout(schedule, 1300)), 8600);

    let raf = 0;
    const draw = () => {
      cx.clearRect(0, 0, W, H);
      dash -= 0.6;
      for (const path of paths) {
        cx.beginPath();
        cx.moveTo(path.pts[0].x, path.pts[0].y);
        cx.bezierCurveTo(path.pts[1].x, path.pts[1].y, path.pts[2].x, path.pts[2].y, path.pts[3].x, path.pts[3].y);
        cx.strokeStyle = path.color + "88";
        cx.lineWidth = 2.5;
        cx.setLineDash([7, 8]);
        cx.lineDashOffset = dash;
        cx.stroke();
        cx.setLineDash([]);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.t += 0.011;
        if (pt.t >= 1) { particles.splice(i, 1); continue; }
        const pos = bez(pt.path.pts, pt.t);
        const g = cx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 9);
        g.addColorStop(0, pt.path.color);
        g.addColorStop(1, pt.path.color + "00");
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(pos.x, pos.y, 9, 0, 7); cx.fill();
        cx.fillStyle = "#FFF";
        cx.beginPath(); cx.arc(pos.x, pos.y, 2.6, 0, 7); cx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearInterval(loop); emitters.forEach(clearTimeout); };
  }, [trade]);

  const capWidth = (r: (typeof rows)[number]) => {
    if (phase === 0 || (r.isMaker && phase < 1)) return 0;
    return (r.availEur / maxAvail) * 100;
  };
  const fillWidth = (r: (typeof rows)[number]) => {
    if (phase < 2 || r.filledEur <= 0) return 0;
    return (Math.min(r.filledEur, r.availEur) / maxAvail) * 100;
  };

  return (
    <section className="fxp-section fxn-section fxms">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">PARTICIPANTS</span>
          <h2>Customer and business liquidity</h2>
          <p>
            Verified customers and businesses can place signed FX orders against
            balances they control. They choose the rate and amount. The order
            remains private, can fill in parts, and is reduced only when a
            completed exchange supplies settlement evidence.
          </p>
        </div>
      </div>

      <div className="fxms-stage" ref={stageRef} data-phase={phase}>
        <canvas ref={canvasRef} className="fxms-canvas" />

        {/* customer phone */}
        <div className="fxms-phone" ref={custRef}>
          <div className="fxms-honesty">{trade ? "LIVE · FX RUNTIME" : "CONNECTING…"}</div>
          <div className="fxms-screen">
            <div className="fxms-statusbar"><span>9:41</span><span className="fxms-mono">▮▮▮ ᯤ ▰</span></div>
            <div className="fxms-stitle">Exchange</div>
            <div className="fxms-pcard">
              <div className="fxms-plabel"><span>YOU SEND</span><span>{trade?.from.symbol ?? ""}</span></div>
              <div className="fxms-pamount">{sent}</div>
            </div>
            <div className="fxms-swapdot">⇅</div>
            <div className="fxms-pcard">
              <div className="fxms-plabel"><span>YOU RECEIVE</span><span>{trade?.to.symbol ?? ""}</span></div>
              <div className="fxms-pamount recv">{recv}</div>
            </div>
            <div className="fxms-prow"><span>Rate</span><b>{rate ? `1 ${trade!.to.symbol} = ${rate.toFixed(4)} ${trade!.from.symbol}` : "—"}</b></div>
            <div className="fxms-prow"><span>Filled from</span><b>{fillCount ? `your market · ${fillCount} sources` : "—"}</b></div>
            <div className="fxms-prow"><span>Token exchange</span><b>one on-chain transaction</b></div>
            <div className={`fxms-pbtn ${phase === 2 ? "pulse" : ""}`}>Exchange</div>
          </div>
        </div>

        {/* the private book */}
        <div className="fxms-market" ref={bookRef}>
          <div className="fxms-mhead">
            <span className="fxms-kick">YOUR MARKET · PRIVATE BOOK</span>
            <span className="fxms-pair">{trade ? `${trade.from.symbol} / ${trade.to.symbol}` : ""}</span>
          </div>
          <div className="fxms-mtitle">Orders meet here.</div>
          <div className="fxms-book">
            {rows.map((r) => (
              <div key={r.id} className={`fxms-brow ${r.isMaker ? "maker" : ""} ${r.eligible ? "" : "blocked"}`}>
                <div className="fxms-rowlabel">{r.label}</div>
                <div className="fxms-depth">
                  <i style={{ width: `${capWidth(r)}%` }} />
                  <u style={{ width: `${fillWidth(r)}%` }} />
                  {r.isMaker && phase >= 1 && <span className="fxms-tag">YOUR CUSTOMER</span>}
                </div>
                <div className="fxms-size">
                  {r.filledEur > 0 && phase >= 2
                    ? <em>+{eur(r.filledEur)} filled</em>
                    : r.eligible ? eur(r.availEur) : "offline"}
                </div>
              </div>
            ))}
          </div>
          <div className="fxms-mid">
            <span className="fxms-midrate">{rate ? rate.toFixed(4) : "—"}</span>
            <span className="fxms-midlbl">MID · AGGREGATE DEPTH PUBLIC · NAMES PRIVATE</span>
          </div>
          <div className={`fxms-settle ${phase >= 3 ? "on" : ""}`}>
            <span>SETTLEMENT</span>
            <b>{fillCount} fills → one atomic on-chain transaction</b>
          </div>
        </div>

        {/* maker phone */}
        <div className="fxms-phone" ref={makerRef}>
          <div className="fxms-honesty">{trade ? "LIVE · FX RUNTIME" : "CONNECTING…"}</div>
          <div className="fxms-screen">
            <div className="fxms-statusbar"><span>9:41</span><span className="fxms-mono">▮▮▮ ᯤ ▰</span></div>
            <div className="fxms-stitle">Create order</div>
            <div className="fxms-pcard">
              <div className="fxms-plabel"><span>PAIR</span><span>PRIVATE</span></div>
              <div className="fxms-pamount small">{trade ? `${trade.from.symbol} / ${trade.to.symbol}` : "—"}</div>
            </div>
            <div className="fxms-pcard">
              <div className="fxms-plabel"><span>SELL</span><span>{trade?.to.symbol ?? ""}</span></div>
              <div className="fxms-pamount">{maker ? eur(maker.availEur) : "—"}</div>
            </div>
            <div className="fxms-pcard">
              <div className="fxms-plabel"><span>AT</span><span>YOUR RATE</span></div>
              <div className="fxms-pamount small">
                {maker?.impliedRate
                  ? `1 ${trade!.to.symbol} = ${maker.impliedRate.toFixed(6)} ${trade!.from.symbol}`
                  : rate ? `1 ${trade!.to.symbol} = ${rate.toFixed(4)} ${trade!.from.symbol}` : "—"}
              </div>
            </div>
            <div className="fxms-prow"><span>Stays until</span><b>filled or cancelled</b></div>
            <div className="fxms-prow"><span>You earn</span><b>the spread on your fill</b></div>
            <div className={`fxms-pbtn ${phase === 1 ? "pulse" : ""}`}>Create order</div>
          </div>
        </div>
      </div>
    </section>
  );
}
