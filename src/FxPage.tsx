import { useEffect, useRef, useState } from "react";
import { FX_RUNTIME_LABEL, FX_RUNTIME_MODE, fxCall } from "./api";
import { Label, LiveBadge, Pill } from "./fx/Primitives";
import { SimulatorLab } from "./fx/Simulator";
import { AllocationMap } from "./fx/TradeViews";
import { ImplementationExplorer } from "./fx/Story";
import {
  CustomerMarket,
  DeploymentExamples,
  ExchangeOpening,
  FiatConnections,
  InstitutionParticipation,
  MarketReveal,
  SettlementArchitecture,
  SourceCodeHandoff,
  TreasuryCapacity,
} from "./fx/FxShowcase";
import { Packages } from "./fx/Packages";
import { SCENARIO_COPY, errorMessage, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [trade,setTrade]=useState<PublicTrade|null>(null);
  const [market,setMarket]=useState<MarketState|null>(null);
  const [scenarios,setScenarios]=useState<Scenario[]>([]);
  const [activeScenario,setActiveScenario]=useState("balanced");
  const [selectedSource,setSelectedSource]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [runtimeReachable,setRuntimeReachable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const previewSequence=useRef(0);

  async function preview(){
    const sequence=++previewSequence.current;
    setLoading(true);
    setError(null);
    const result=await fxCall("POST","/v2/fx/reference/trades/preview",{inputAmount:"50000.00"});
    if(sequence!==previewSequence.current)return;
    setLoading(false);
    if(!result.ok){
      setRuntimeReachable(result.status!==0);
      setTrade(null);
      setError(errorMessage(result));
      return;
    }
    setRuntimeReachable(true);
    const nextTrade=result.body as PublicTrade;
    setTrade(nextTrade);
    setSelectedSource((current)=>{
      const stillExists=nextTrade.sourceStatus.some((source)=>source.sourceId===current&&source.eligible);
      return stillExists?current:nextTrade.sourceStatus.find((source)=>source.eligible)?.sourceId??null;
    });
  }

  useEffect(()=>{
    let cancelled=false;
    async function start(){
      const scenarioResult=await fxCall("GET","/v2/fx/reference/scenario");
      if(cancelled)return;
      setRuntimeReachable(scenarioResult.ok||scenarioResult.status!==0);
      if(scenarioResult.ok){
        const payload=scenarioResult.body as {current:MarketState;available:Scenario[]};
        setMarket(payload.current);
        setActiveScenario(payload.current.id);
        setScenarios(payload.available);
      }
      await preview();
    }
    void start();
    return()=>{cancelled=true;};
  },[]);

  async function changeScenario(id:string){
    if(id===activeScenario)return;
    setBusy(true);
    setError(null);
    const result=await fxCall("POST","/v2/fx/reference/scenario",{id});
    if(!result.ok){setBusy(false);setError(errorMessage(result));return;}
    setActiveScenario(id);
    setMarket(result.body as MarketState);
    await preview();
    setBusy(false);
  }

  const selectedScenario=SCENARIO_COPY[activeScenario]??{title:activeScenario,short:""};
  const currentMarket=market??(trade?{id:activeScenario,sources:trade.sourceStatus,reference:{available:true}}:null);

  return <div className="fxp fxs-page">
    <ExchangeOpening/>
    <MarketReveal/>
    <CustomerMarket/>
    <InstitutionParticipation/>
    <SettlementArchitecture/>
    <FiatConnections/>
    <TreasuryCapacity/>
    <DeploymentExamples/>
    <SourceCodeHandoff/>

    <section id="fx-reference" className="fxp-section fxp-live-market fxs-reference">
      <div className="fxp-section-head">
        <div><Label>RUN THE REFERENCE MARKET</Label><h2>Change the inputs and see the route.</h2><p>The repository includes a deterministic reference market for exercising source eligibility, route selection and reservations. The participants shown here are seeded examples, not commercial integrations.</p></div>
        <div className="fxp-reference-status"><LiveBadge connected={runtimeReachable} loading={loading} mode={FX_RUNTIME_MODE}/><a href="#fx-implementation"><Pill>See the code ↓</Pill></a></div>
      </div>
      {error&&<div className="fxp-phone-error">{error}</div>}
      <div className="fxp-market-scenarios">{scenarios.map((item)=>{
        const copy=SCENARIO_COPY[item.id]??{title:item.label,short:""};
        return <button type="button" key={item.id} className={activeScenario===item.id?"active":""} onClick={()=>void changeScenario(item.id)} disabled={busy}><b>{copy.title}</b><span>{copy.short}</span></button>;
      })}</div>
      <div className="fxp-market-note"><span className={currentMarket?.reference.available?"ok":"bad"}/><b>{selectedScenario.title}</b><span>{busy?"Updating reference route…":selectedScenario.short}</span></div>
      <AllocationMap trade={trade} selected={selectedSource} onSelect={setSelectedSource}/>
      <div className="fx-reference-caveat"><b>REFERENCE PARTICIPANTS</b><span>Seeded issuer, LP, institution and treasury capacity exercise the planner and reservation lifecycle. They are not commercial integrations.</span></div>
    </section>

    <section className="fxp-section fxs-builder-intro">
      <div className="fxp-section-head"><div><Label>FOR BUILDERS</Label><h2>The page is the overview. The repository is the implementation.</h2><p>Run the simulator, inspect the API and follow the packages down to matching, pricing, policy, fiat evidence and settlement.</p></div></div>
    </section>
    <SimulatorLab/>
    <div id="fx-implementation"><ImplementationExplorer/></div>
    <Packages/>

    <section className="fxp-section fxs-isnt">
      <Label>WHAT THIS IS AND ISN'T</Label>
      <div><p><b>Blueballs is software.</b> It does not provide a banking licence, KYC vendor, stablecoin issuer or fiat custody.</p><p>Those systems connect through adapters. The repository includes reference participants and simulators so the FX behaviour can be run and tested without presenting them as live integrations.</p></div>
    </section>
    <div className="fxp-runtime-note">FX runtime: <code>{FX_RUNTIME_LABEL}</code></div>
  </div>;
}
