import { useEffect, useRef, useState } from "react";
import { FX_RUNTIME_LABEL, FX_RUNTIME_MODE, fxCall } from "./api";
import liquidityArtwork from "./assets/fx-editorial-liquidity.svg";
import policyArtwork from "./assets/fx-editorial-policy.svg";
import routeArtwork from "./assets/fx-editorial-route.svg";
import treasuryArtwork from "./assets/fx-editorial-treasury.svg";
import { DeveloperInspector } from "./fx/Developer";
import { Packages } from "./fx/Packages";
import { Phone } from "./fx/Phone";
import { ArtworkSection, Label, LiveBadge, Pill, SettlementRoute } from "./fx/Primitives";
import { SimulatorLab } from "./fx/Simulator";
import { AllocationMap, ApiView, BankView, CustomerView } from "./fx/TradeViews";
import { SCENARIO_COPY, errorMessage, sanitizeAmount, type HeroView, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [amount, setAmount] = useState("50000.00");
  const [trade, setTrade] = useState<PublicTrade | null>(null);
  const [market, setMarket] = useState<MarketState | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState("balanced");
  const [heroView, setHeroView] = useState<HeroView>("customer");
  const [phoneMode, setPhoneMode] = useState<"quote" | "review" | "execution">("quote");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeReachable, setRuntimeReachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const previewSequence = useRef(0);

  async function releaseCurrentTrade() {
    if (!trade?.id || trade.state !== "RESERVED") return;
    await fxCall("DELETE", `/v2/fx/reference/trades/${encodeURIComponent(trade.id)}`);
  }
  async function preview(nextAmount = amount) {
    if (!nextAmount || Number(nextAmount) <= 0) { setTrade(null); setError("Enter an amount above zero."); return; }
    const sequence = ++previewSequence.current; setLoading(true); setError(null);
    const result = await fxCall("POST", "/v2/fx/reference/trades/preview", { inputAmount: nextAmount });
    if (sequence !== previewSequence.current) return;
    setLoading(false);
    if (!result.ok) { setRuntimeReachable(result.status !== 0); setTrade(null); setError(errorMessage(result)); return; }
    setRuntimeReachable(true);
    const nextTrade = result.body as PublicTrade; setTrade(nextTrade); setSelectedSource((current) => current ?? nextTrade.sourceStatus[0]?.sourceId ?? null);
  }
  useEffect(() => {
    let cancelled = false;
    async function start() {
      const scenarioResult = await fxCall("GET", "/v2/fx/reference/scenario");
      if (cancelled) return;
      setRuntimeReachable(scenarioResult.ok || scenarioResult.status !== 0);
      if (scenarioResult.ok) { const payload = scenarioResult.body as { current: MarketState; available: Scenario[] }; setMarket(payload.current); setActiveScenario(payload.current.id); setScenarios(payload.available); }
      await preview("50000.00");
    }
    void start(); return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (phoneMode !== "quote") return; const timer = window.setTimeout(() => { void preview(amount); }, 350); return () => window.clearTimeout(timer); }, [amount, activeScenario, phoneMode]);
  async function changeScenario(id: string) { setBusy(true); setError(null); await releaseCurrentTrade(); setPhoneMode("quote"); const result = await fxCall("POST", "/v2/fx/reference/scenario", { id }); setBusy(false); if (!result.ok) { setError(errorMessage(result)); return; } setActiveScenario(id); setMarket(result.body as MarketState); }
  async function reviewAndReserve() { setBusy(true); setError(null); const result = await fxCall("POST", "/v2/fx/reference/trades", { inputAmount: amount, expiresInMs: 60_000 }); setBusy(false); if (!result.ok) { setError(errorMessage(result)); return; } const reserved = result.body as PublicTrade; setTrade(reserved); setPhoneMode("review"); setHeroView("bank"); }
  async function backToQuote() { await releaseCurrentTrade(); setExecutionError(null); setPhoneMode("quote"); await preview(amount); }
  async function execute() { if (!trade?.id) return; setBusy(true); setExecutionError(null); const result = await fxCall("POST", `/v2/fx/reference/trades/${encodeURIComponent(trade.id)}/execute`); setBusy(false); setPhoneMode("execution"); if (!result.ok) { setExecutionError(errorMessage(result)); return; } const payload = result.body as { trade: PublicTrade }; setTrade(payload.trade); }

  const selectedScenario = SCENARIO_COPY[activeScenario] ?? { title: activeScenario, short: "" };
  const currentMarket = market ?? (trade ? { id: activeScenario, sources: trade.sourceStatus, reference: { available: true } } : null);

  return <div className="fxp">
    <section className="fxp-hero">
      <div className="fxp-hero-copy">
        <div className="fxp-hero-top"><Label>STABLECOIN FX</Label><LiveBadge connected={runtimeReachable} loading={loading} mode={FX_RUNTIME_MODE} /></div>
        <h1>Build FX into your financial product.</h1>
        <p>Quote customers in familiar currencies while stablecoins, liquidity providers and treasury inventory can sit underneath. Blueballs handles pricing policy, source selection, reservations and settlement records. BRL → EUR is the interactive example below.</p>
        <div className="fxp-hero-tabs">{(["customer", "bank", "api"] as HeroView[]).map((view) => <button type="button" key={view} className={heroView === view ? "active" : ""} onClick={() => setHeroView(view)}>{view}</button>)}</div>
        {heroView === "customer" && <CustomerView trade={trade} />}{heroView === "bank" && <BankView trade={trade} selected={selectedSource} onSelect={setSelectedSource} />}{heroView === "api" && <ApiView trade={trade} amount={amount} />}
      </div>
      <div className="fxp-hero-phone"><Phone amount={amount} trade={trade} mode={phoneMode} runtimeMode={FX_RUNTIME_MODE} busy={busy || loading} error={phoneMode === "execution" ? executionError : error} onAmount={(value) => setAmount(sanitizeAmount(value))} onReview={reviewAndReserve} onBack={backToQuote} onExecute={execute} /></div>
    </section>

    <section className="fxp-section fxp-live-market">
      <div className="fxp-section-head"><div><Label>LIQUIDITY ROUTING</Label><h2>Choose where your FX liquidity comes from.</h2><p>Change the amount or market conditions and see how the route changes across the available sources.</p></div><a href="#fx-developer"><Pill>See the request ↓</Pill></a></div>
      <div className="fxp-market-scenarios">{scenarios.map((item) => { const copy = SCENARIO_COPY[item.id] ?? { title: item.label, short: "" }; return <button type="button" key={item.id} className={activeScenario === item.id ? "active" : ""} onClick={() => void changeScenario(item.id)} disabled={busy}><b>{copy.title}</b><span>{copy.short}</span></button>; })}</div>
      <div className="fxp-market-note"><span className={currentMarket?.reference.available ? "ok" : "bad"} /><b>{selectedScenario.title}</b><span>{selectedScenario.short}</span></div>
      <AllocationMap trade={trade} selected={selectedSource} onSelect={setSelectedSource} />
    </section>

    <ArtworkSection image={liquidityArtwork} label="LIQUIDITY" title="Use more than one source of liquidity." copy="Customer flow, issuers, institutional LPs, other institutions and your own treasury can all participate in the same market. Blueballs checks which sources are eligible, compares them and builds a route for the quote."><div className="fxp-art-facts"><div><b>{trade?.sources.length ?? 0}</b><span>sources used now</span></div><div><b>{trade?.sourceStatus.filter((item) => item.eligible).length ?? 0}</b><span>eligible now</span></div></div></ArtworkSection>

    <ArtworkSection reverse image={policyArtwork} label="POLICY" title="Decide who can quote before comparing prices." copy="Participant status, credentials, corridor rules and ticket limits determine which sources are allowed into the market."><button type="button" className="fxp-inline-action" onClick={() => void changeScenario(activeScenario === "issuer_policy_blocked" ? "balanced" : "issuer_policy_blocked")} disabled={busy}>{activeScenario === "issuer_policy_blocked" ? "Restore issuer" : "Disable issuer in this scenario"}</button></ArtworkSection>

    <ArtworkSection image={treasuryArtwork} label="TREASURY" title="Use your own liquidity without losing control of risk." copy="Set limits on treasury and principal liquidity. Reservations count against capacity immediately, and a source drops out when its configured limit is reached."><div className="fxp-inline-buttons"><button type="button" onClick={() => void changeScenario("treasury_near_limit")} disabled={busy}>Reduce treasury capacity</button><button type="button" onClick={() => void changeScenario("principal_limit")} disabled={busy}>Exhaust principal capacity</button></div></ArtworkSection>

    <ArtworkSection reverse image={routeArtwork} label="SETTLEMENT" title="Keep each settlement leg explicit." copy="In this example, BRL arrives through an external payment rail, BRLX swaps to EURC atomically, and EURC is redeemed for EUR. Blueballs records the different finality of each leg instead of treating the whole route as atomic."><SettlementRoute trade={trade} /></ArtworkSection>

    <SimulatorLab /><DeveloperInspector trade={trade} amount={amount} /><Packages />
    <div className="fxp-runtime-note">FX runtime: <code>{FX_RUNTIME_LABEL}</code></div>
  </div>;
}
