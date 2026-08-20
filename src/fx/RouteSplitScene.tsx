import { useEffect, useRef, useState } from "react";
import { SOURCE_LABELS, formatCurrency, type PublicTrade } from "./model";
import "./market-scene.css";

/* Multi-source execution as a drawn instrument: one request fans out through
   the actual allocation slices and recombines into one quote. Runtime-bound. */

const eur = (v: number) =>
  "€" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function RouteSplitScene({ trade }: { trade: PublicTrade | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lit, setLit] = useState(0); // chips lit so far; slices.length+1 = quote on

  const slices = (trade?.sources ?? []).map((s) => ({
    id: `${s.type}:${s.sourceId}`,
    label: SOURCE_LABELS[s.type],
    outEur: s.outputAmount ? Number(s.outputAmount) : 0,
    rate: s.outputAmount && s.inputAmount ? Number(s.inputAmount) / Number(s.outputAmount) : null,
  }));
  const n = slices.length;

  useEffect(() => {
    if (!trade || n === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setLit(0);
      for (let i = 1; i <= n + 1; i++) timers.push(setTimeout(() => setLit(i), 500 + i * 620));
    };
    run();
    const loop = setInterval(run, 620 * (n + 1) + 3600);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, [trade, n]);

  useEffect(() => {
    const stage = stageRef.current, cv = canvasRef.current;
    if (!stage || !cv || !trade || n === 0) return;
    if (stage.clientWidth < 900) { cv.style.display = "none"; return; }
    cv.style.display = "";
    const W = stage.clientWidth, H = stage.clientHeight;
    cv.width = W * 2; cv.height = H * 2;
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.scale(2, 2);
    const s = stage.getBoundingClientRect();
    const mid = (el: HTMLElement | null, side: "left" | "right") => {
      const r = el?.getBoundingClientRect();
      return r ? { x: (side === "left" ? r.left : r.right) - s.left, y: r.top - s.top + r.height / 2 } : null;
    };
    const req = mid(reqRef.current, "right"), quo = mid(quoteRef.current, "left");
    const chips = chipRefs.current.map((el) => ({
      in: mid(el, "left"), out: mid(el, "right"),
    }));
    if (!req || !quo) return;
    const curveTo = (a: { x: number; y: number }, d: { x: number; y: number }) => {
      const dx = (d.x - a.x) * 0.5;
      return [a, { x: a.x + dx, y: a.y }, { x: d.x - dx, y: d.y }, d] as const;
    };
    const inPaths = chips.map((c) => (c.in ? curveTo({ x: req.x - 4, y: req.y }, { x: c.in.x + 2, y: c.in.y }) : null));
    const outPaths = chips.map((c) => (c.out ? curveTo({ x: c.out.x - 2, y: c.out.y }, { x: quo.x + 4, y: quo.y }) : null));
    const bez = (p: readonly { x: number; y: number }[], t: number) => {
      const u = 1 - t;
      return {
        x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
        y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
      };
    };
    let dash = 0;
    const particles: { path: readonly { x: number; y: number }[]; t: number; color: string }[] = [];
    const emitters: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      inPaths.forEach((p, i) => {
        if (p) emitters.push(setTimeout(() => particles.push({ path: p, t: 0, color: "#0868FF" }), 500 + (i + 1) * 620 - 480));
      });
      outPaths.forEach((p, i) => {
        if (p) emitters.push(setTimeout(() => particles.push({ path: p, t: 0, color: "#22A0FF" }), 500 + (i + 1) * 620 + 120));
      });
    };
    cycle();
    const loop = setInterval(cycle, 620 * (n + 1) + 3600);
    let raf = 0;
    const draw = () => {
      cx.clearRect(0, 0, W, H);
      dash -= 0.5;
      for (const p of [...inPaths, ...outPaths]) {
        if (!p) continue;
        cx.beginPath();
        cx.moveTo(p[0].x, p[0].y);
        cx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
        cx.strokeStyle = "#0868FF44";
        cx.lineWidth = 2;
        cx.setLineDash([6, 8]);
        cx.lineDashOffset = dash;
        cx.stroke();
        cx.setLineDash([]);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.t += 0.016;
        if (pt.t >= 1) { particles.splice(i, 1); continue; }
        const pos = bez(pt.path, pt.t);
        const g = cx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 8);
        g.addColorStop(0, pt.color);
        g.addColorStop(1, pt.color + "00");
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(pos.x, pos.y, 8, 0, 7); cx.fill();
        cx.fillStyle = "#FFF";
        cx.beginPath(); cx.arc(pos.x, pos.y, 2.4, 0, 7); cx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearInterval(loop); emitters.forEach(clearTimeout); };
  }, [trade, n]);

  return (
    <section className="fxp-section fxn-section fxrs">
      <div className="fxp-section-head">
        <div>
          <span className="fxp-label">ROUTING</span>
          <h2>Multi-source execution</h2>
          <p>
            Every source is converted into the same executable form: price,
            capacity, expiry and authorisation. The planner compares exact
            rational prices and combines eligible capacity into a complete
            quote. If the full amount cannot be filled, it returns no route.
          </p>
        </div>
      </div>

      <div className="fxms-stage fxrs-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="fxms-canvas" />

        <div className="fxrs-req" ref={reqRef}>
          <span className="fxrs-kick">CUSTOMER REQUEST</span>
          <b>{trade ? formatCurrency(trade.from.charged ?? trade.from.requested, "BRL") : "—"}</b>
          <small>{trade ? `${trade.from.symbol} → ${trade.to.symbol}` : ""}</small>
        </div>

        <div className="fxrs-chips">
          {slices.map((sl, i) => (
            <div
              key={sl.id}
              ref={(el) => { chipRefs.current[i] = el; }}
              className={`fxrs-chip ${lit > i ? "lit" : ""}`}
            >
              <span className="fxrs-chip-label">{sl.label}</span>
              <b>{eur(sl.outEur)}</b>
              <small>{sl.rate ? `@ ${sl.rate.toFixed(4)}` : ""}</small>
            </div>
          ))}
        </div>

        <div className={`fxrs-quote ${lit > n ? "on" : ""}`} ref={quoteRef}>
          <span className="fxrs-kick light">ONE QUOTE</span>
          <b>{trade ? formatCurrency(trade.to.amount, "EUR") : "—"}</b>
          <small>{n} fills · one route</small>
          <em>{trade?.evidence.reserved ? "reserved before the quote is firm" : "preview · not yet reserved"}</em>
        </div>
      </div>
    </section>
  );
}
