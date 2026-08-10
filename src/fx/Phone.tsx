import { Label } from "./Primitives";
import { formatCurrency, type PublicTrade } from "./model";

export function Phone({ amount, trade, mode, runtimeMode, busy, error, onAmount, onReview, onBack, onExecute }: {
  amount: string;
  trade: PublicTrade | null;
  mode: "quote" | "review" | "execution";
  runtimeMode: "node" | "demo";
  busy: boolean;
  error: string | null;
  onAmount: (value: string) => void;
  onReview: () => void;
  onBack: () => void;
  onExecute: () => void;
}) {
  const receive = trade?.to.amount;
  const charged = trade?.from.charged ?? trade?.from.requested;
  const quoteSeconds = trade ? Math.max(0, Math.ceil((trade.expiresAt - Date.now()) / 1000)) : 0;

  if (mode === "execution") {
    const confirmed = trade?.state === "CONFIRMED";
    return <div className="fxp-phone"><div className="fxp-phone-inner">
      <div className="fxp-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
      <button type="button" className="fxp-phone-back" onClick={onBack}>← Exchange</button>
      <div className="fxp-phone-result">
        <div className="fxp-boundary-icon">{confirmed ? "✓" : "↗"}</div>
        <Label>{confirmed ? "DEMO RECEIPT" : "EXECUTION"}</Label>
        <h3>{confirmed ? "Exchange complete" : error ? "Execution is not configured" : "Route submitted"}</h3>
        <p>{confirmed
          ? `${formatCurrency(charged, "BRL")} was converted into ${formatCurrency(receive, "EUR")} in this website demo.`
          : error ?? "The reserved route has been submitted and is waiting for its final result."}</p>
        <div className="fxp-phone-lines">
          <div><span>Trade</span><b>{trade?.id ?? "—"}</b></div>
          <div><span>Route</span><b>{trade?.routeId ?? "—"}</b></div>
          <div><span>State</span><b>{trade?.state ?? "—"}</b></div>
        </div>
        <button type="button" onClick={onBack}>{confirmed ? "Start another exchange" : "Back to exchange"}</button>
      </div>
    </div></div>;
  }

  if (mode === "review") return <div className="fxp-phone"><div className="fxp-phone-inner">
    <div className="fxp-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
    <button type="button" className="fxp-phone-back" onClick={onBack}>← Back</button>
    <div className="fxp-phone-title">Review exchange</div>
    <div className="fxp-review-value"><span>You receive</span><strong>{formatCurrency(receive, "EUR")}</strong></div>
    <div className="fxp-review-card">
      <div><span>You pay</span><b>{formatCurrency(charged, "BRL")}</b></div>
      <div><span>Rate</span><b>{trade ? `1 EUR = ${trade.rate} BRL` : "—"}</b></div>
      <div><span>Quote</span><b>{quoteSeconds > 0 ? `${quoteSeconds}s remaining` : "expired"}</b></div>
      <div><span>Route</span><b>{trade?.sources.length ?? 0} reserved sources</b></div>
      <div><span>Delivery</span><b>{runtimeMode === "demo" ? "Instant demo receipt" : "Depends on external rails"}</b></div>
    </div>
    <div className="fxp-phone-evidence"><span />{trade?.evidence.label ?? "NOT RESERVED"}</div>
    <button className="fxp-phone-primary" type="button" disabled={busy || !trade} onClick={onExecute}>{busy ? "Completing…" : runtimeMode === "demo" ? "Complete demo exchange" : "Submit exchange"}</button>
    <p className="fxp-phone-disclosure">{runtimeMode === "demo" ? "Interactive website demo. No money moves." : "Submission and settlement remain separate states."}</p>
  </div></div>;

  return <div className="fxp-phone"><div className="fxp-phone-inner">
    <div className="fxp-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
    <div className="fxp-phone-title-row"><div className="fxp-phone-title">Exchange</div><span>{runtimeMode === "demo" ? "DEMO" : "REFERENCE"}</span></div>
    <div className="fxp-phone-box"><div className="fxp-phone-box-label"><span>You pay</span><span>Balance R$82,400</span></div><div className="fxp-phone-amount"><input inputMode="decimal" value={amount} onChange={(event) => onAmount(event.target.value)} /><b>BRL ▾</b></div></div>
    <div className="fxp-phone-swap">⇅</div>
    <div className="fxp-phone-box"><div className="fxp-phone-box-label"><span>You receive</span><span>{trade?.evidence.reserved ? "Reserved" : runtimeMode === "demo" ? "Demo preview" : "Live preview"}</span></div><div className="fxp-phone-amount"><strong>{receive ? Number(receive).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</strong><b>EUR ▾</b></div></div>
    <div className="fxp-phone-summary"><div><span>Rate</span><b>{trade ? `1 EUR = ${trade.rate} BRL` : "Calculating…"}</b></div><div><span>Charged</span><b>{formatCurrency(charged, "BRL")}</b></div><div><span>Liquidity</span><b>{trade ? `${trade.sources.length} sources` : "—"}</b></div><div><span>Settlement</span><b>{trade?.settlement.guarantee.class ?? "—"}</b></div></div>
    {error && <div className="fxp-phone-error">{error}</div>}
    <button className="fxp-phone-primary" type="button" disabled={busy || !trade || trade.state !== "PREVIEW"} onClick={onReview}>{busy ? "Calculating…" : trade ? "Review exchange" : "No full route available"}</button>
  </div></div>;
}
