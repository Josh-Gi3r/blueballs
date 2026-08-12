import { useEffect, useRef, useState } from "react";
import { FX_RUNTIME_LABEL, FX_RUNTIME_MODE, fxCall } from "./api";
import { DeveloperInspector } from "./fx/Developer";
import { Packages } from "./fx/Packages";
import { Label, LiveBadge, Pill, SettlementRoute } from "./fx/Primitives";
import { SimulatorLab } from "./fx/Simulator";
import { AllocationMap } from "./fx/TradeViews";
import { DeploymentModels, ExecutionStack, FiatEdges, HeroExchangePhone, InfrastructureFlow, InstitutionalFlow, LiquidityProviderPhone, PrivateMarketGraphic } from "./fx/Narrative";
import { SCENARIO_COPY, errorMessage, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [trade,setTrade]=useState<PublicTrade|null>(null); const [market,setMarket]=useState<MarketState|null>(null); const [scenarios,setScenarios]=useState<Scenario[]>([]); const [activeScenario,setActiveScenario]=useState("balanced"); const [selectedSource,setSelectedSource]=useState<string|null>(null); const [loading,setLoading]=useState(true); const [runtimeReachable,setRuntimeReachable]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const previewSequence=useRef(0);
  async function preview(){const sequence=++previewSequence.current;setLoading(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/trades/preview",{inputAmount:"50000.00"});if(sequence!==previewSequence.current)return;setLoading(false);if(!result.ok){setRuntimeReachable(result.status!==0);setTrade(null);setError(errorMessage(result));return;}setRuntimeReachable(true);const nextTrade=result.body as PublicTrade;setTrade(nextTrade);setSelectedSource((current)=>{const stillExists=nextTrade.sourceStatus.some((source)=>source.sourceId===current&&source.eligible);return stillExists?current:nextTrade.sourceStatus.find((source)=>source.eligible)?.sourceId??null;});}
  useEffect(()=>{let cancelled=false;async function start(){const scenarioResult=await fxCall("GET","/v2/fx/reference/scenario");if(cancelled)return;setRuntimeReachable(scenarioResult.ok||scenarioResult.status!==0);if(scenarioResult.ok){const payload=scenarioResult.body as {current:MarketState;available:Scenario[]};setMarket(payload.current);setActiveScenario(payload.current.id);setScenarios(payload.available);}await preview();}void start();return()=>{cancelled=true;};},[]);
  async function changeScenario(id:string){if(id===activeScenario)return;setBusy(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/scenario",{id});if(!result.ok){setBusy(false);setError(errorMessage(result));return;}setActiveScenario(id);setMarket(result.body as MarketState);await preview();setBusy(false);}
  const selectedScenario=SCENARIO_COPY[activeScenario]??{title:activeScenario,short:""}; const currentMarket=market??(trade?{id:activeScenario,sources:trade.sourceStatus,reference:{available:true}}:null);
  return <div className="fxp">
    <section className="fxp-hero"><div className="fxp-hero-copy"><div className="fxp-hero-top"><Label>STABLECOIN FX</Label><span className="fxp-hero-open">OPEN SOURCE · SELF-HOSTABLE</span></div><h1>Build FX into your financial product.</h1><p>Run your own market, connect external providers when needed, and support fiat and stablecoin flows through the same infrastructure.</p><div className="fxp-hero-proof"><div><span>YOUR MARKET</span><b>Private orders and matching</b></div><div><span>CONNECTED</span><b>Issuers, banks and market makers</b></div><div><span>FIAT + TOKENS</span><b>Provider-neutral settlement edges</b></div></div></div><div className="fxp-hero-phone"><HeroExchangePhone/></div></section>

    <InfrastructureFlow/>
    <PrivateMarketGraphic/>
    <LiquidityProviderPhone/>
    <InstitutionalFlow/>
    <DeploymentModels/>
    <FiatEdges/>

    <section id="fx-reference" className="fxp-section fxp-live-market"><div className="fxp-section-head"><div><Label>CONNECTED REFERENCE RUNTIME</Label><h2>Inspect how a route changes.</h2><p>This is the repository's current reference market. It uses seeded participants and proof assets to exercise policy, source selection and reservations. It is not presented as a connected commercial market.</p></div><div className="fxp-reference-status"><LiveBadge connected={runtimeReachable} loading={loading} mode={FX_RUNTIME_MODE}/><a href="#fx-developer"><Pill>See the request ↓</Pill></a></div></div>{error&&<div className="fxp-phone-error">{error}</div>}<div className="fxp-market-scenarios">{scenarios.map((item)=>{const copy=SCENARIO_COPY[item.id]??{title:item.label,short:""};return <button type="button" key={item.id} className={activeScenario===item.id?"active":""} onClick={()=>void changeScenario(item.id)} disabled={busy}><b>{copy.title}</b><span>{copy.short}</span></button>;})}</div><div className="fxp-market-note"><span className={currentMarket?.reference.available?"ok":"bad"}/><b>{selectedScenario.title}</b><span>{busy?"Updating reference route…":selectedScenario.short}</span></div><AllocationMap trade={trade} selected={selectedSource} onSelect={setSelectedSource}/></section>

    <ExecutionStack/>

    <section className="fxp-section fxp-reference-settlement"><div className="fxp-section-head"><div><Label>REFERENCE SETTLEMENT GRAPH</Label><h2>See the different finality of each leg.</h2><p>The current repository example uses a BRL payment edge, a BRLX/EURC token swap and an EUR redemption edge. It stays here as an engineering proof rather than defining the product above.</p></div></div><SettlementRoute trade={trade}/></section>

    <SimulatorLab/>
    <DeveloperInspector trade={trade} amount="50000.00"/>
    <Packages/>
    <div className="fxp-runtime-note">FX runtime: <code>{FX_RUNTIME_LABEL}</code></div>
  </div>;
}
