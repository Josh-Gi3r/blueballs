import { useEffect, useMemo, useState, type ReactNode } from "react";
import { planExactOutput } from "../packages/fx-liquidity/src/index.js";
import { baselineScenarios, runSimulation } from "../packages/fx-simulator/src/index.js";
import "./FxPage.css";

const REPO = "https://github.com/Josh-Gi3r/blueballs";
const BACKEND_RC = "02ebbf70ed6cef054549010222719d1a0357cf27";
const source = (path: string) => `${REPO}/blob/${BACKEND_RC}/${path}`;

type SourceType =
  | "PRIVATE_MARKET"
  | "ISSUER"
  | "INSTITUTIONAL_LP"
  | "NEOBANK"
  | "BANK_TREASURY"
  | "BANK_PRINCIPAL";

type DemoSource = {
  sourceType: SourceType;
  sourceId: string;
  label: string;
  rate: number;
  capacityEur: number;
  enabled?: boolean;
  status?: string;
};

type RouteLeg = DemoSource & { inputBrl: number; outputEur: number };
type DemoQuote = { payBrl: number; receiveEur: number; rate: number; route: RouteLeg[] };

type Scenario = "balanced" | "oneWay" | "lpOff" | "issuerOff" | "riskLimit" | "referenceOutage";
type HeroView = "customer" | "bank" | "api";
type PhoneStep = "quote" | "review" | "processing" | "receipt";
type DevView = "quote" | "route" | "settlement" | "events";

const SOURCES: DemoSource[] = [
  { sourceType: "PRIVATE_MARKET", sourceId: "customer", label: "Internal customer flow", rate: 6.045, capacityEur: 3_200 },
  { sourceType: "ISSUER", sourceId: "issuer", label: "Issuer", rate: 6.072, capacityEur: 2_600 },
  { sourceType: "INSTITUTIONAL_LP", sourceId: "lp", label: "Institutional LP", rate: 6.088, capacityEur: 4_800 },
  { sourceType: "NEOBANK", sourceId: "neobank", label: "Another institution", rate: 6.102, capacityEur: 2_200 },
  { sourceType: "BANK_TREASURY", sourceId: "treasury", label: "Treasury inventory", rate: 6.128, capacityEur: 3_600 },
  { sourceType: "BANK_PRINCIPAL", sourceId: "principal", label: "Bank balance sheet", rate: 6.155, capacityEur: 6_500 },
];

const SCENARIOS: Array<{ id: Scenario; label: string; note: string }> = [
  { id: "balanced", label: "Balanced market", note: "Internal flow and external sources are available." },
  { id: "oneWay", label: "Demand tilts to EUR", note: "Less opposite customer flow is available and prices tighten." },
  { id: "lpOff", label: "Main LP offline", note: "The route rebuilds without the institutional LP." },
  { id: "issuerOff", label: "Issuer unavailable", note: "Issuer liquidity disappears from the market." },
  { id: "riskLimit", label: "Treasury near limit", note: "Treasury capacity is almost used and bank principal is unavailable." },
  { id: "referenceOutage", label: "Bank pricing unavailable", note: "The bank stops quoting its own balance sheet until reference pricing returns." },
];

function marketFor(id: Scenario): DemoSource[] {
  return SOURCES.map((sourceItem) => {
    if (id === "lpOff" && sourceItem.sourceId === "lp") return { ...sourceItem, enabled: false, status: "OFFLINE" };
    if (id === "issuerOff" && sourceItem.sourceId === "issuer") return { ...sourceItem, enabled: false, status: "UNAVAILABLE" };
    if (id === "riskLimit" && sourceItem.sourceId === "treasury") return { ...sourceItem, capacityEur: 450, status: "NEAR LIMIT" };
    if (id === "riskLimit" && sourceItem.sourceId === "principal") return { ...sourceItem, enabled: false, status: "RISK LIMIT" };
    if (id === "referenceOutage" && sourceItem.sourceId === "principal") return { ...sourceItem, enabled: false, status: "NO REFERENCE" };
    if (id === "oneWay" && sourceItem.sourceId === "customer") return { ...sourceItem, capacityEur: 850, rate: 6.082, status: "THIN" };
    if (id === "oneWay" && sourceItem.sourceId === "lp") return { ...sourceItem, rate: 6.108 };
    if (id === "oneWay" && sourceItem.sourceId === "treasury") return { ...sourceItem, rate: 6.145 };
    if (id === "oneWay" && sourceItem.sourceId === "principal") return { ...sourceItem, rate: 6.19 };
    return { ...sourceItem, enabled: true };
  });
}

function quoteForInput(payBrl: number, scenario: Scenario): DemoQuote | null {
  if (!Number.isFinite(payBrl) || payBrl <= 0) return null;

  const market = marketFor(scenario);
  const slices = market
    .filter((sourceItem) => sourceItem.enabled !== false && sourceItem.capacityEur > 0)
    .map((sourceItem) => ({
      sourceType: sourceItem.sourceType,
      sourceId: sourceItem.sourceId,
      sliceId: `${sourceItem.sourceId}:brl-eur`,
      inputAsset: "BRL",
      outputAsset: "EUR",
      maxOutput: String(Math.round(sourceItem.capacityEur * 100)),
      inputNumerator: String(Math.round(sourceItem.rate * 1_000)),
      inputDenominator: "1000",
      policyAuthorizationId: `sandbox:${sourceItem.sourceId}`,
      expiresAt: 9_999_999_999_999,
    }));

  const budget = BigInt(Math.round(payBrl * 100));
  let low = 1n;
  let high = slices.reduce((total, slice) => total + BigInt(slice.maxOutput), 0n);
  let best: ReturnType<typeof planExactOutput> | null = null;

  while (low <= high) {
    const desiredOutput = (low + high) / 2n;
    try {
      const plan = planExactOutput({ inputAsset: "BRL", outputAsset: "EUR", desiredOutput: desiredOutput.toString(), slices, now: 1 });
      if (BigInt(plan.totalInput) <= budget) {
        best = plan;
        low = desiredOutput + 1n;
      } else {
        high = desiredOutput - 1n;
      }
    } catch {
      high = desiredOutput - 1n;
    }
  }

  if (!best) return null;
  const spent = Number(best.totalInput) / 100;
  if (spent < payBrl - 0.02) return null;

  const byId = new Map(market.map((sourceItem) => [sourceItem.sourceId, sourceItem]));
  const route = best.legs.map((leg) => ({
    ...byId.get(leg.sourceId)!,
    inputBrl: Number(leg.inputAmount) / 100,
    outputEur: Number(leg.outputAmount) / 100,
  }));
  const output = Number(best.totalOutput) / 100;
  return { payBrl: spent, receiveEur: output, rate: spent / output, route };
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function money(value: number, currency: "BRL" | "EUR") {
  return `${currency === "BRL" ? "R$" : "€"}${formatNumber(value)}`;
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="fxv-label">{children}</div>;
}

function SourceTag({ children }: { children: ReactNode }) {
  return <span className="fxv-source-tag">{children}</span>;
}

function Phone({
  amount,
  quote,
  step,
  onAmount,
  onStep,
}: {
  amount: number;
  quote: DemoQuote | null;
  step: PhoneStep;
  onAmount: (amount: number) => void;
  onStep: (step: PhoneStep) => void;
}) {
  if (step === "processing") {
    return (
      <div className="fxv-phone"><div className="fxv-phone-inner">
        <div className="fxv-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
        <div className="fxv-phone-progress">
          <div className="fxv-spinner" />
          <h3>Completing your exchange</h3>
          <p>This is a sandbox product flow. No money is moving.</p>
        </div>
      </div></div>
    );
  }

  if (step === "receipt") {
    return (
      <div className="fxv-phone"><div className="fxv-phone-inner">
        <div className="fxv-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
        <div className="fxv-phone-receipt">
          <div className="fxv-phone-check">✓</div>
          <Label>SANDBOX EXCHANGE</Label>
          <h3>Exchange complete</h3>
          <strong>{quote ? money(quote.receiveEur, "EUR") : "—"}</strong>
          <p>{quote ? `${money(quote.payBrl, "BRL")} exchanged at 1 EUR = ${quote.rate.toFixed(4)} BRL` : "No quote"}</p>
          <div className="fxv-receipt-lines">
            <div><span>Status</span><b>Completed</b></div>
            <div><span>Reference</span><b>fx_demo_82a1</b></div>
          </div>
          <button type="button" onClick={() => onStep("quote")}>Make another exchange</button>
        </div>
      </div></div>
    );
  }

  if (step === "review") {
    return (
      <div className="fxv-phone"><div className="fxv-phone-inner">
        <div className="fxv-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
        <button className="fxv-phone-back" type="button" onClick={() => onStep("quote")}>← Back</button>
        <div className="fxv-phone-title">Review exchange</div>
        <div className="fxv-review-amount"><span>You receive</span><strong>{quote ? money(quote.receiveEur, "EUR") : "—"}</strong></div>
        <div className="fxv-review-card">
          <div><span>You pay</span><b>{money(amount, "BRL")}</b></div>
          <div><span>Rate</span><b>{quote ? `1 EUR = ${quote.rate.toFixed(4)} BRL` : "—"}</b></div>
          <div><span>Estimated arrival</span><b>Depends on the selected rails</b></div>
          <div><span>Product mode</span><b>Sandbox</b></div>
        </div>
        <p className="fxv-phone-disclosure">A production deployment would show its configured fees, rate lock and delivery estimate here.</p>
        <button className="fxv-phone-primary" type="button" disabled={!quote} onClick={() => onStep("processing")}>Complete sandbox exchange</button>
      </div></div>
    );
  }

  return (
    <div className="fxv-phone"><div className="fxv-phone-inner">
      <div className="fxv-phone-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
      <div className="fxv-phone-title-row"><div className="fxv-phone-title">Exchange</div><span>SANDBOX</span></div>
      <div className="fxv-phone-box">
        <div className="fxv-phone-box-label"><span>You pay</span><span>Balance R$82,400</span></div>
        <div className="fxv-phone-amount"><input inputMode="decimal" value={formatNumber(amount)} onChange={(event) => onAmount(parseAmount(event.target.value))} /><b>BRL ▾</b></div>
      </div>
      <div className="fxv-phone-swap">⇅</div>
      <div className="fxv-phone-box">
        <div className="fxv-phone-box-label"><span>You receive</span><span>Preview</span></div>
        <div className="fxv-phone-amount"><strong>{quote ? formatNumber(quote.receiveEur) : "—"}</strong><b>EUR ▾</b></div>
      </div>
      <div className="fxv-phone-summary">
        <div><span>Rate</span><b>{quote ? `1 EUR = ${quote.rate.toFixed(4)} BRL` : "No full route"}</b></div>
        <div><span>Amount charged</span><b>{quote ? money(quote.payBrl, "BRL") : "—"}</b></div>
        <div><span>Delivery</span><b>{quote ? "Shown after route selection" : "—"}</b></div>
      </div>
      <button className="fxv-phone-primary" type="button" disabled={!quote} onClick={() => onStep("review")}>{quote ? "Review exchange" : "No full quote available"}</button>
    </div></div>
  );
}

function RouteBreakdown({ quote, scenario }: { quote: DemoQuote | null; scenario: Scenario }) {
  const market = marketFor(scenario);
  return (
    <div className="fxv-route-card">
      <div className="fxv-route-head">
        <div><Label>THE BANK VIEW</Label><h3>{quote ? `${money(quote.payBrl, "BRL")} becomes ${money(quote.receiveEur, "EUR")}` : "This trade cannot be filled"}</h3></div>
        <SourceTag>real routing function</SourceTag>
      </div>
      {quote ? (
        <div className="fxv-route-rows">
          {quote.route.map((leg) => (
            <div className="fxv-route-row" key={leg.sourceId}>
              <div><strong>{leg.label}</strong><span>{leg.sourceType.split("_").join(" ").toLowerCase()}</span></div>
              <div><b>{money(leg.inputBrl, "BRL")}</b><span>{money(leg.outputEur, "EUR")}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="fxv-no-route">The approved sandbox sources cannot cover the full amount. Reduce the trade or restore liquidity.</div>
      )}
      <div className="fxv-market-status">
        {market.map((sourceItem) => (
          <span className={sourceItem.enabled === false ? "blocked" : sourceItem.status ? "warning" : ""} key={sourceItem.sourceId}>
            {sourceItem.label}{sourceItem.status ? ` · ${sourceItem.status}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroPanel({ view, quote, amount }: { view: HeroView; quote: DemoQuote | null; amount: number }) {
  if (view === "bank") {
    return (
      <div className="fxv-hero-panel">
        <div className="fxv-mini-route">
          {quote?.route.map((leg) => (
            <div key={leg.sourceId}><span>{leg.label}</span><b>{money(leg.inputBrl, "BRL")}</b></div>
          )) ?? <p>No complete route at this amount.</p>}
        </div>
        <p>The customer never needs this detail. Your product, treasury and operations teams can inspect it.</p>
      </div>
    );
  }

  if (view === "api") {
    return (
      <div className="fxv-hero-code">{`await bb.fx.quote({
  inputAsset: "BRL",
  outputAsset: "EUR",
  inputAmount: "${amount.toFixed(2)}"
});

// A deployed FX node returns the quote and route state.`}</div>
    );
  }

  return (
    <div className="fxv-hero-panel">
      <div className="fxv-outcome-row"><span>Quote</span><b>Amount, rate and delivery expectation</b></div>
      <div className="fxv-outcome-row"><span>Review</span><b>A clear confirmation before anything moves</b></div>
      <div className="fxv-outcome-row"><span>Receipt</span><b>A complete state your app can reconcile</b></div>
      <p>Use the phone. Review the trade and complete the sandbox flow.</p>
    </div>
  );
}

function InternalFlow({ demand }: { demand: number }) {
  const max = Math.max(100_000, demand * 1.25);
  const [oppositeFlow, setOppositeFlow] = useState(Math.min(30_000, max));
  const sellFlow = Math.min(oppositeFlow, max);
  const matched = Math.min(demand, sellFlow);
  const external = Math.max(0, demand - matched);
  const scale = Math.max(demand, sellFlow, 1);

  return (
    <section className="fxv-section fxv-netting">
      <div className="fxv-section-copy">
        <Label>USE WHAT IS ALREADY INSIDE THE BANK</Label>
        <h2>Customer demand can offset before you buy the rest outside.</h2>
        <p>Move the opposite flow. The matched amount stays inside the institution; only the remainder needs another source.</p>
      </div>
      <div className="fxv-netting-ui">
        <div className="fxv-flow-inputs">
          <div><span>Customers buying EUR</span><b>{money(demand, "BRL")}</b><div className="fxv-flow-bar"><i style={{ width: `${(demand / scale) * 100}%` }} /></div></div>
          <div><span>Customers selling EUR</span><b>{money(sellFlow, "BRL")}</b><div className="fxv-flow-bar reverse"><i style={{ width: `${(sellFlow / scale) * 100}%` }} /></div></div>
        </div>
        <input className="fxv-range" type="range" min="0" max={max} step="1" value={sellFlow} onChange={(event) => setOppositeFlow(Number(event.target.value))} aria-label="Opposite customer flow" />
        <div className="fxv-netting-result">
          <div><span>Matched internally</span><strong>{money(matched, "BRL")}</strong></div>
          <div><span>Still needs liquidity</span><strong>{money(external, "BRL")}</strong></div>
        </div>
      </div>
    </section>
  );
}

const MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  customer: { x: 32, y: 40 },
  issuer: { x: 32, y: 180 },
  lp: { x: 32, y: 320 },
  neobank: { x: 718, y: 40 },
  treasury: { x: 718, y: 180 },
  principal: { x: 718, y: 320 },
};

function LiquidityMap({ quote, scenario }: { quote: DemoQuote | null; scenario: Scenario }) {
  const market = marketFor(scenario);
  const [selected, setSelected] = useState("customer");
  const usedById = new Map((quote?.route ?? []).map((leg) => [leg.sourceId, leg]));
  const selectedSource = market.find((sourceItem) => sourceItem.sourceId === selected) ?? market[0];
  const selectedLeg = usedById.get(selectedSource.sourceId);

  return (
    <section className="fxv-section fxv-liquidity">
      <div className="fxv-section-head">
        <div><Label>ONLY SOURCE WHAT IS LEFT</Label><h2>One trade can use more than one source.</h2><p>Click a source. Increase the trade or remove liquidity above and the route changes without changing the customer experience.</p></div>
        <a href={source("packages/fx-liquidity/src/optimizer.js")} target="_blank" rel="noreferrer"><SourceTag>open the optimizer ↗</SourceTag></a>
      </div>
      <div className="fxv-map-shell">
        <svg className="fxv-map" viewBox="0 0 960 450" role="img" aria-label="Liquidity sources feeding one BRL to EUR exchange">
          <defs><marker id="fxv-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          {market.map((sourceItem) => {
            const position = MAP_POSITIONS[sourceItem.sourceId];
            const left = position.x < 400;
            const used = usedById.has(sourceItem.sourceId);
            const disabled = sourceItem.enabled === false;
            const x1 = left ? position.x + 210 : position.x;
            const y1 = position.y + 45;
            const x2 = left ? 350 : 610;
            const y2 = 225;
            return <line key={`line-${sourceItem.sourceId}`} className={disabled ? "fxv-map-line off" : used ? "fxv-map-line used" : "fxv-map-line"} x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={used ? "url(#fxv-arrow)" : undefined} />;
          })}
          <rect className="fxv-map-centre" x="350" y="155" width="260" height="140" rx="20" />
          <text className="fxv-map-kicker" x="480" y="190" textAnchor="middle">CUSTOMER EXCHANGE</text>
          <text className="fxv-map-total" x="480" y="228" textAnchor="middle">{money(quote?.payBrl ?? 0, "BRL")}</text>
          <text className="fxv-map-result" x="480" y="260" textAnchor="middle">→ {quote ? money(quote.receiveEur, "EUR") : "NO FULL ROUTE"}</text>
          {market.map((sourceItem) => {
            const position = MAP_POSITIONS[sourceItem.sourceId];
            const leg = usedById.get(sourceItem.sourceId);
            const disabled = sourceItem.enabled === false;
            const className = `fxv-map-node${leg ? " used" : ""}${disabled ? " off" : ""}${selected === sourceItem.sourceId ? " selected" : ""}`;
            return (
              <g key={sourceItem.sourceId} className={className} role="button" tabIndex={0} onClick={() => setSelected(sourceItem.sourceId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(sourceItem.sourceId); }}>
                <rect x={position.x} y={position.y} width="210" height="90" rx="15" />
                <text className="fxv-map-node-title" x={position.x + 16} y={position.y + 31}>{sourceItem.label}</text>
                <text className="fxv-map-node-value" x={position.x + 16} y={position.y + 60}>{disabled ? sourceItem.status : leg ? money(leg.inputBrl, "BRL") : "Available, not used"}</text>
                <circle cx={position.x + 187} cy={position.y + 24} r="6" />
              </g>
            );
          })}
        </svg>
        <div className="fxv-map-detail">
          <div><Label>SELECTED SOURCE</Label><h3>{selectedSource.label}</h3></div>
          <div className="fxv-map-detail-grid">
            <span>Status</span><b>{selectedSource.enabled === false ? selectedSource.status : selectedLeg ? "Used in this route" : "Available"}</b>
            <span>Available EUR</span><b>{money(selectedSource.capacityEur, "EUR")}</b>
            <span>Rate</span><b>{selectedSource.rate.toFixed(3)} BRL/EUR</b>
            <span>Used here</span><b>{selectedLeg ? money(selectedLeg.inputBrl, "BRL") : "R$0.00"}</b>
          </div>
        </div>
      </div>
    </section>
  );
}

const POLICY_PROVIDERS = [
  { id: "epsilon", name: "Epsilon Liquidity", rate: 6.011, allowed: false, reason: "Corridor not permitted" },
  { id: "cobalt", name: "Cobalt Markets", rate: 6.018, allowed: false, reason: "KYB expired" },
  { id: "beta", name: "Beta Capital", rate: 6.04, allowed: true, reason: "Permitted" },
  { id: "delta", name: "Delta FX", rate: 6.07, allowed: true, reason: "Permitted" },
];

function PolicyMarket({ amount }: { amount: number }) {
  const [permitEpsilon, setPermitEpsilon] = useState(false);
  const [showBlocked, setShowBlocked] = useState(true);
  const providers = POLICY_PROVIDERS.map((provider) => provider.id === "epsilon" ? { ...provider, allowed: permitEpsilon, reason: permitEpsilon ? "Permitted in sandbox" : provider.reason } : provider);
  const permitted = providers.filter((provider) => provider.allowed).sort((a, b) => a.rate - b.rate);
  const winner = permitted[0];
  const received = winner ? amount / winner.rate : 0;

  return (
    <section className="fxv-section fxv-policy">
      <div className="fxv-section-head">
        <div><Label>YOUR RULES DEFINE THE MARKET</Label><h2>The cheapest displayed quote may not be a quote your bank can use.</h2><p>Only permitted providers are compared. Change one sandbox policy and watch the best available result change.</p></div>
        <label className="fxv-toggle"><input type="checkbox" checked={showBlocked} onChange={(event) => setShowBlocked(event.target.checked)} /><span>Show unavailable providers</span></label>
      </div>
      <div className="fxv-policy-grid">
        <div className="fxv-provider-list">
          {providers.filter((provider) => showBlocked || provider.allowed).map((provider) => (
            <div className={provider.allowed ? "fxv-provider" : "fxv-provider blocked"} key={provider.id}>
              <div><strong>{provider.name}</strong><span>{provider.reason}</span></div>
              <div><b>{provider.rate.toFixed(3)}</b><span>BRL/EUR</span></div>
            </div>
          ))}
        </div>
        <div className="fxv-policy-result">
          <Label>BEST PERMITTED RESULT</Label>
          <h3>{winner.name}</h3>
          <strong>{money(received, "EUR")}</strong>
          <p>{money(amount, "BRL")} at {winner.rate.toFixed(3)} BRL/EUR</p>
          <button type="button" onClick={() => setPermitEpsilon((value) => !value)}>{permitEpsilon ? "Restore the corridor block" : "Permit Epsilon in this sandbox"}</button>
          <small>This changes a local demonstration only. It does not change a real policy.</small>
        </div>
      </div>
    </section>
  );
}

function TreasuryMarket() {
  const [demand, setDemand] = useState(180_000);
  const externalCapacity = 120_000;
  const treasuryLimit = 80_000;
  const gap = Math.max(0, demand - externalCapacity);
  const treasuryUse = Math.min(gap, treasuryLimit);
  const unavailable = Math.max(0, gap - treasuryLimit);
  const utilization = (treasuryUse / treasuryLimit) * 100;

  return (
    <section className="fxv-section fxv-treasury">
      <div className="fxv-section-copy">
        <Label>OPTIONAL BALANCE-SHEET LIQUIDITY</Label>
        <h2>Your treasury can quote until it reaches the limit you set.</h2>
        <p>Increase one-way demand. External sources fill first, treasury covers the gap, and anything beyond the configured limit is unavailable rather than quietly repriced.</p>
      </div>
      <div className="fxv-treasury-ui">
        <div className="fxv-demand-line"><span>Customer demand</span><strong>{money(demand, "BRL")}</strong></div>
        <input className="fxv-range" type="range" min="40000" max="280000" step="1000" value={demand} onChange={(event) => setDemand(Number(event.target.value))} />
        <div className="fxv-capacity-stack">
          <div className="external" style={{ flexGrow: externalCapacity }}><span>External sources</span><b>{money(Math.min(demand, externalCapacity), "BRL")}</b></div>
          <div className="treasury" style={{ flexGrow: Math.max(treasuryUse, 1) }}><span>Treasury</span><b>{money(treasuryUse, "BRL")}</b></div>
          {unavailable > 0 && <div className="unavailable" style={{ flexGrow: unavailable }}><span>Unavailable</span><b>{money(unavailable, "BRL")}</b></div>}
        </div>
        <div className="fxv-risk-meter"><div><span>Treasury limit used</span><b>{utilization.toFixed(0)}%</b></div><div className="fxv-risk-track"><i style={{ width: `${utilization}%` }} /></div></div>
        <div className={unavailable > 0 ? "fxv-capacity-message stop" : "fxv-capacity-message"}>{unavailable > 0 ? `${money(unavailable, "BRL")} cannot be quoted under the current limit.` : "The full demand can be quoted under the current limits."}</div>
      </div>
    </section>
  );
}

const SETTLEMENT_LEGS = [
  { title: "BRL received through PIX", short: "Payment verified", detail: "A bank-payment adapter records the BRL payment and its verification evidence.", finality: "Off-chain payment finality" },
  { title: "USDC issued", short: "Issuer mint", detail: "An approved issuer or internal ledger edge creates the token balance used for the cross-border leg.", finality: "Issuer or ledger finality" },
  { title: "USDC exchanged for EURC", short: "Atomic token FX", detail: "The token exchange can settle atomically when every leg shares the same transaction boundary.", finality: "On-chain atomic finality" },
  { title: "EURC submitted for redemption", short: "Issuer redemption", detail: "Redemption is an external asynchronous step. Blueballs keeps that state explicit.", finality: "Issuer finality" },
  { title: "EUR delivered", short: "Bank payout", detail: "The EUR payout completes when the destination bank rail confirms delivery.", finality: "Bank-rail finality" },
];

function SettlementRoute() {
  const [selected, setSelected] = useState(0);
  const leg = SETTLEMENT_LEGS[selected];
  return (
    <section className="fxv-section fxv-settlement">
      <div className="fxv-section-head">
        <div><Label>THE CUSTOMER STILL SEES BRL → EUR</Label><h2>Stablecoins can stay behind the scenes.</h2><p>This is one route the settlement model can represent: PIX in, token FX across, EUR out. Click each leg to see where finality actually comes from.</p></div>
        <a href={source("packages/fx-fiat/src/settlement-graph.js")} target="_blank" rel="noreferrer"><SourceTag>open settlement graph ↗</SourceTag></a>
      </div>
      <div className="fxv-settlement-route">
        {SETTLEMENT_LEGS.map((routeLeg, index) => (
          <button type="button" className={selected === index ? "selected" : ""} key={routeLeg.title} onClick={() => setSelected(index)}>
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{routeLeg.short}</strong>{index < SETTLEMENT_LEGS.length - 1 && <i>→</i>}
          </button>
        ))}
      </div>
      <div className="fxv-settlement-detail">
        <div><Label>SELECTED LEG</Label><h3>{leg.title}</h3><p>{leg.detail}</p></div>
        <div><span>Finality</span><b>{leg.finality}</b><small>Illustrative route using real settlement classes; no live PIX or issuer connection is implied.</small></div>
      </div>
    </section>
  );
}

function CodePanel({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return <div className="fxv-code-panel"><div className="fxv-code-head"><span>{title}</span><b>{tag}</b></div><pre>{children}</pre></div>;
}

function DeveloperPanel({ quote }: { quote: DemoQuote | null }) {
  const [view, setView] = useState<DevView>("quote");
  const code: Record<DevView, string> = {
    quote: `const quote = await fx.quote({
  inputAsset: "BRL",
  outputAsset: "EUR",
  inputAmount: "50000.00"
});`,
    route: JSON.stringify({
      state: "RESERVED",
      totalInput: quote ? quote.payBrl.toFixed(2) : null,
      totalOutput: quote ? quote.receiveEur.toFixed(2) : null,
      sources: quote?.route.map((leg) => ({ type: leg.sourceType, input: leg.inputBrl.toFixed(2), output: leg.outputEur.toFixed(2) })) ?? [],
    }, null, 2),
    settlement: `await fx.execute({
  quoteId: quote.id,
  customerIntent: signedIntent,
  policyAuthorization: authorization.id
});`,
    events: `fx.quote_reserved
fx.route_submitted
fx.settlement_confirmed
fx.reconciliation_completed`,
  };

  return (
    <section className="fxv-section fxv-dev" id="fx-dev">
      <div className="fxv-section-head"><div><Label>OPEN THE HOOD</Label><h2>Every product state maps to code you can run or inspect.</h2><p>The browser demo uses sandbox inventory. A deployment runs the FX node, SDK, policy engine, market, settlement contracts and reconciliation services.</p></div></div>
      <div className="fxv-dev-tabs">{(["quote", "route", "settlement", "events"] as DevView[]).map((tab) => <button type="button" className={view === tab ? "selected" : ""} key={tab} onClick={() => setView(tab)}>{tab}</button>)}</div>
      <div className="fxv-dev-grid">
        <CodePanel title={view.toUpperCase()} tag={view === "route" ? "example from this sandbox trade" : "SDK / EVENT SHAPE"}>{code[view]}</CodePanel>
        <div className="fxv-source-list">
          <a href={source("apps/fx-node/src/server.js")} target="_blank" rel="noreferrer"><strong>FX node</strong><span>HTTP surface and authentication</span></a>
          <a href={source("packages/fx-liquidity/src/optimizer.js")} target="_blank" rel="noreferrer"><strong>Liquidity planner</strong><span>Builds exact-output routes</span></a>
          <a href={source("packages/fx-policy/src/policy-engine.js")} target="_blank" rel="noreferrer"><strong>Policy engine</strong><span>Defines the permitted market</span></a>
          <a href={source("packages/fx-contracts/src/AtomicRouter.sol")} target="_blank" rel="noreferrer"><strong>Atomic router</strong><span>Constrains token settlement</span></a>
        </div>
      </div>
    </section>
  );
}

function TakeIt() {
  const packages = [
    ["FX node", "apps/fx-node", "apps/fx-node/src/server.js"],
    ["SDK", "packages/fx-sdk", "packages/fx-sdk/src/index.js"],
    ["Contracts", "packages/fx-contracts", "packages/fx-contracts/src/AtomicRouter.sol"],
    ["Private market", "packages/fx-market", "packages/fx-market/src/market-service.js"],
    ["Pricing + risk", "packages/fx-pricing", "packages/fx-pricing/src/principal-pricing.js"],
    ["Liquidity", "packages/fx-liquidity", "packages/fx-liquidity/src/optimizer.js"],
    ["Policy", "packages/fx-policy", "packages/fx-policy/src/policy-engine.js"],
    ["Fiat settlement", "packages/fx-fiat", "packages/fx-fiat/src/settlement-graph.js"],
  ];
  return (
    <section className="fxv-section fxv-take">
      <Label>BUILD ON IT</Label><h2>The whole FX stack is open source and self-hostable.</h2>
      <div className="fxv-packages">{packages.map(([name, pathLabel, path]) => <a key={name} href={source(path)} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{pathLabel}</span></a>)}</div>
      <div className="fxv-run"><code>git clone https://github.com/Josh-Gi3r/blueballs.git</code><span>Backend reference commit {BACKEND_RC.slice(0, 12)} · internal engineering gates passed · not an independent security audit</span></div>
    </section>
  );
}

export default function FxPage() {
  const [amount, setAmount] = useState(50_000);
  const [scenario, setScenario] = useState<Scenario>("balanced");
  const [heroView, setHeroView] = useState<HeroView>("customer");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("quote");
  const [showStress, setShowStress] = useState(false);
  const quote = useMemo(() => quoteForInput(amount, scenario), [amount, scenario]);

  useEffect(() => {
    setPhoneStep("quote");
  }, [amount, scenario]);

  useEffect(() => {
    if (phoneStep !== "processing") return;
    const timer = window.setTimeout(() => setPhoneStep("receipt"), 850);
    return () => window.clearTimeout(timer);
  }, [phoneStep]);

  const simulatorKey = scenario === "oneWay" ? "oneWay90" : scenario === "lpOff" ? "lpDisappears" : scenario === "issuerOff" ? "issuerDisappears" : scenario === "riskLimit" ? "principalLimit" : scenario === "referenceOutage" ? "referenceOutage" : "balanced";
  const stress = useMemo(() => runSimulation((baselineScenarios() as Record<string, unknown>)[simulatorKey]) as {
    requestedOrders: number;
    filledOrders: number;
    fillRatePct: number;
    rejections: { NO_LIQUIDITY: number; RISK_LIMIT: number };
    settlementFailures: number;
  }, [simulatorKey]);
  const scenarioInfo = SCENARIOS.find((item) => item.id === scenario)!;

  return (
    <div className="fxv">
      <section className="fxv-hero">
        <div className="fxv-hero-copy">
          <Label>FX FOR THE BANK YOU ARE BUILDING</Label>
          <h1>Give your customers currency exchange.</h1>
          <p>The phone is the simple part. Blueballs gives you the market underneath it: multiple liquidity sources, institutional rules, treasury limits and settlement, open source and self-hostable.</p>
          <div className="fxv-hero-facts">
            <div><span>Customer</span><b>Quote, review and receipt inside your product</b></div>
            <div><span>Institution</span><b>Your counterparties, your risk limits, your rails</b></div>
            <div><span>Builder</span><b>Run the node, SDK and contracts yourself</b></div>
          </div>
          <div className="fxv-view-tabs" role="tablist">
            {(["customer", "bank", "api"] as HeroView[]).map((view) => <button type="button" role="tab" aria-selected={heroView === view} className={heroView === view ? "selected" : ""} key={view} onClick={() => setHeroView(view)}>{view}</button>)}
          </div>
          <HeroPanel view={heroView} quote={quote} amount={amount} />
        </div>
        <div className="fxv-hero-phone"><Phone amount={amount} quote={quote} step={phoneStep} onAmount={setAmount} onStep={setPhoneStep} /></div>
      </section>

      <section className="fxv-section fxv-market" id="fx-test">
        <div className="fxv-section-head">
          <div><Label>TRY THE SAME TRADE</Label><h2>See what changes when the market changes.</h2><p>The inventory is deterministic sandbox data. The route is built by the real exact-output planner in <code>packages/fx-liquidity</code>. This page does not reserve or move funds.</p></div>
          <a href={source("packages/fx-liquidity/src/optimizer.js")} target="_blank" rel="noreferrer"><SourceTag>inspect the function ↗</SourceTag></a>
        </div>
        <div className="fxv-scenarios">{SCENARIOS.map((item) => <button type="button" className={scenario === item.id ? "selected" : ""} key={item.id} onClick={() => setScenario(item.id)}>{item.label}</button>)}</div>
        <div className="fxv-scenario-note">{scenarioInfo.note}</div>
        <div className="fxv-market-grid">
          <div className="fxv-amount-card"><label>YOU PAY</label><input value={formatNumber(amount)} onChange={(event) => setAmount(parseAmount(event.target.value))} /><div><b>BRL</b><span>→</span><b>EUR</b></div><p>{quote ? `Sandbox quote: ${money(quote.receiveEur, "EUR")}` : "No complete quote at this size."}</p></div>
          <RouteBreakdown quote={quote} scenario={scenario} />
        </div>
        <button className="fxv-stress-button" type="button" onClick={() => setShowStress((value) => !value)}>{showStress ? "Hide the 200-order stress run" : "Inspect the 200-order stress run"}</button>
        {showStress && <div className="fxv-stress-grid"><div><span>Orders filled</span><b>{stress.filledOrders}/{stress.requestedOrders}</b></div><div><span>Fill rate</span><b>{stress.fillRatePct.toFixed(1)}%</b></div><div><span>No liquidity</span><b>{stress.rejections.NO_LIQUIDITY}</b></div><div><span>Risk limit</span><b>{stress.rejections.RISK_LIMIT}</b></div><div><span>Settlement failures</span><b>{stress.settlementFailures}</b></div></div>}
      </section>

      <InternalFlow demand={amount} />
      <LiquidityMap quote={quote} scenario={scenario} />
      <PolicyMarket amount={amount} />
      <TreasuryMarket />
      <SettlementRoute />
      <DeveloperPanel quote={quote} />
      <TakeIt />
    </div>
  );
}
