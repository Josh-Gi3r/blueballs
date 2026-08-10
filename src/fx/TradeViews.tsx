import { Label, Pill } from "./Primitives";
import { SOURCE_LABELS, formatAtomic, formatCurrency, type PublicTrade } from "./model";

export function CustomerView({ trade }: { trade: PublicTrade | null }) {
  return <div className="fxp-hero-panel"><Label>WHAT YOUR CUSTOMER GETS</Label><div className="fxp-customer-summary"><div><span>They pay</span><strong>{formatCurrency(trade?.from.charged, "BRL")}</strong></div><div className="arrow">→</div><div><span>They receive</span><strong>{formatCurrency(trade?.to.amount, "EUR")}</strong></div></div><p>A normal exchange experience. The customer does not need to choose a liquidity provider, stablecoin or settlement rail.</p><div className="fxp-panel-footer"><Pill tone={trade?.evidence.reserved ? "green" : "blue"}>{trade?.evidence.label ?? "WAITING FOR NODE"}</Pill></div></div>;
}

export function BankView({ trade, selected, onSelect }: { trade: PublicTrade | null; selected: string | null; onSelect: (id: string) => void }) {
  const statuses = trade?.sourceStatus ?? [];
  return <div className="fxp-hero-panel"><div className="fxp-panel-heading"><div><Label>WHAT YOUR INSTITUTION SEES</Label><h3>One trade, fully attributable.</h3></div><Pill>{trade?.sources.length ?? 0} selected</Pill></div><div className="fxp-bank-source-list">{statuses.map((status) => {
    const allocation = trade?.sources.find((item) => item.type === status.sourceType && (item.sourceId === status.sourceId || status.sourceType === "PRIVATE_MARKET"));
    return <button type="button" key={`${status.sourceType}:${status.sourceId}`} className={`${selected === status.sourceId ? "selected" : ""} ${status.eligible ? "" : "blocked"}`} onClick={() => onSelect(status.sourceId)}><span className="dot" /><span className="copy"><b>{status.label}</b><small>{status.eligible ? status.reason.replaceAll("_", " ").toLowerCase() : `excluded · ${status.reason.replaceAll("_", " ").toLowerCase()}`}</small></span><span className="amount">{allocation?.outputAmount ? formatCurrency(allocation.outputAmount, "EUR") : "not used"}</span></button>;
  })}</div></div>;
}

export function ApiView({ trade, amount }: { trade: PublicTrade | null; amount: string }) {
  const request = `POST /v2/fx/reference/trades/preview\n\n{\n  "inputAmount": "${amount}",\n  "from": "BRL",\n  "to": "EUR"\n}`;
  return <div className="fxp-hero-panel code"><div className="fxp-code-top"><Label>THE CALL BEHIND THE SCREEN</Label><Pill tone={trade ? "green" : "grey"}>{trade ? "200" : "—"}</Pill></div><pre>{request}</pre><div className="fxp-code-result"><span>state</span><b>{trade?.state ?? "—"}</b><span>sources</span><b>{trade?.sources.length ?? 0}</b><span>finality</span><b>{trade?.settlement.guarantee.class ?? "—"}</b></div></div>;
}

export function AllocationMap({ trade, selected, onSelect }: { trade: PublicTrade | null; selected: string | null; onSelect: (id: string) => void }) {
  const statuses = trade?.sourceStatus ?? [];
  const selectedStatus = statuses.find((status) => status.sourceId === selected) ?? statuses[0];
  const selectedAllocation = trade?.sources.find((item) => item.sourceId === selectedStatus?.sourceId || (selectedStatus?.sourceType === "PRIVATE_MARKET" && item.type === "PRIVATE_MARKET"));
  return <div className="fxp-allocation-shell"><div className="fxp-source-grid">{statuses.map((status) => {
    const allocation = trade?.sources.find((item) => item.type === status.sourceType && (item.sourceId === status.sourceId || status.sourceType === "PRIVATE_MARKET"));
    return <button type="button" key={`${status.sourceType}:${status.sourceId}`} className={`${allocation ? "used" : ""} ${status.eligible ? "" : "blocked"} ${selected === status.sourceId ? "selected" : ""}`} onClick={() => onSelect(status.sourceId)}><span className="fxp-source-icon">{SOURCE_LABELS[status.sourceType].slice(0, 2).toUpperCase()}</span><span><b>{status.label}</b><small>{status.eligible ? "available" : status.reason.replaceAll("_", " ").toLowerCase()}</small></span><strong>{allocation?.outputAmount ? formatCurrency(allocation.outputAmount, "EUR") : "—"}</strong></button>;
  })}</div><div className="fxp-allocation-core"><Label>CUSTOMER TRADE</Label><strong>{formatCurrency(trade?.from.charged, "BRL")}</strong><span>→ {formatCurrency(trade?.to.amount, "EUR")}</span></div><div className="fxp-source-detail"><div><Label>SELECTED SOURCE</Label><h3>{selectedStatus?.label ?? "Choose a source"}</h3></div><div className="fxp-detail-values"><span>Status</span><b>{selectedStatus?.eligible ? "Eligible" : "Excluded"}</b><span>Available</span><b>{selectedStatus ? `${formatAtomic(selectedStatus.availableOutput)} EURC` : "—"}</b><span>Used here</span><b>{selectedAllocation?.outputAmount ? formatCurrency(selectedAllocation.outputAmount, "EUR") : "€0.00"}</b><span>Reason</span><b>{selectedStatus?.reason.replaceAll("_", " ").toLowerCase() ?? "—"}</b></div></div></div>;
}
