import { useEffect, useRef, useState } from "react";
import { FX_RUNTIME_LABEL, FX_RUNTIME_MODE, fxCall } from "./api";
import { Label, LiveBadge, Pill } from "./fx/Primitives";
import { SimulatorLab } from "./fx/Simulator";
import { AllocationMap } from "./fx/TradeViews";
import { ImplementationExplorer } from "./fx/Story";
import { CustomerAndMaker, DeploymentBlueprints, FiatModels, FinalityGraphic, OneTradeManyWays, PrivateSettlement, ProductExchangeVisual, ProviderParticipation, TreasuryGraphic } from "./fx/ArchitectureStory";
import { Packages } from "./fx/Packages";
import { SCENARIO_COPY, errorMessage, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [trade,setTrade]=useState<PublicTrade|null>(null); const [market,setMarket]=useState<MarketState|null>(null); const [scenarios,setScenarios]=useState<Scenario[]>([]); const [activeScenario,setActiveScenario]=useState("balanced"); const [selectedSource,setSelectedSource]=useState<string|null>(null); const [loading,setLoading]=useState(true); const [runtimeReachable,setRuntimeReachable]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const previewSequence=useRef(0);
  async function preview(){const sequence=++previewSequence.current;setLoading(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/trades/preview",{inputAmount:"50000.00"});if(sequence!==previewSequence.current)return;setLoading(false);if(!result.ok){setRuntimeReachable(result.status!==0);setTrade(null);setError(errorMessage(result));return;}setRuntimeReachable(true);const nextTrade=result.body as PublicTrade;setTrade(nextTrade);setSelectedSource((current)=>{const stillExists=nextTrade.sourceStatus.some((source)=>source.sourceId===current&&source.eligible);return stillExists?current:nextTrade.sourceStatus.find((source)=>source.eligible)?.sourceId??null;});}
  useEffect(()=>{let cancelled=false;async function start(){const scenarioResult=await fxCall("GET","/v2/fx/reference/scenario");if(cancelled)return;setRuntimeReachable(scenarioResult.ok||scenarioResult.status!==0);if(scenarioResult.ok){const payload=scenarioResult.body as {current:MarketState;available:Scenario[]};setMarket(payload.current);setActiveScenario(payload.current.id);setScenarios(payload.available);}await preview();}void start();return()=>{cancelled=true;};},[]);
  async function changeScenario(id:string){if(id===activeScenario)return;setBusy(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/scenario",{id});if(!result.ok){setBusy(false);setError(errorMessage(result));return;}setActiveScenario(id);setMarket(result.body as MarketState);await preview();setBusy(false);}
  const selectedScenario=SCENARIO_COPY[activeScenario]??{title:activeScenario,short:""}; const currentMarket=market??(trade?{id:activeScenario,sources:trade.sourceStatus,reference:{available:true}}:null);

  return <div className="fxp fxn-page">
    <section className="fxp-hero fxn-hero">
      <div className="fxp-hero-copy"><div className="fxp-hero-top"><Label>STABLECOIN FX</Label><span className="fxp-hero-open">OPEN SOURCE · SELF-HOSTABLE</span></div><h1>FX for financial products.</h1><p>Offer currency exchange in your app. Blueballs gives you the market software behind the quote, the exchange and the settlement. Run it yourself and connect the providers you use.</p><div className="fxn-hero-usecases"><span>Customer exchange</span><span>Multi-currency balances</span><span>Cross-border transfers</span><span>Stablecoin FX</span></div></div>
      <ProductExchangeVisual/>
    </section>

    <section className="fxp-section fxn-products">
      <div className="fxp-section-head"><div><Label>WHAT YOU CAN BUILD</Label><h2>Put currency exchange where your product needs it.</h2><p>The same FX layer can sit behind a simple exchange screen, a transfer, a business payment or a stablecoin balance.</p></div></div>
      <div className="fxn-product-grid"><article><span>EXCHANGE</span><b>Convert balances in the app.</b><p>Quote, review, exchange and show the result without sending the customer to another product.</p></article><article><span>TRANSFER</span><b>Convert while money moves.</b><p>Take one currency, deliver another, and keep the FX leg inside the transfer flow.</p></article><article><span>BALANCES</span><b>Move between tokenised currencies.</b><p>Use the same market for stablecoin-to-stablecoin exchange without a fiat leg.</p></article><article><span>BUSINESS</span><b>Give companies the same FX layer.</b><p>Use it for supplier payments, treasury conversion and multi-currency operations.</p></article></div>
    </section>

    <section className="fxp-section fxn-intro">
      <div className="fxp-section-head"><div><Label>WHAT CHANGES</Label><h2>You do not have to buy every FX trade from one outside provider.</h2><p>Your own customers, businesses, market makers, issuers and treasury can participate in the market. Connected firms and outside venues can add capacity when you need them.</p></div></div>
      <div className="fxn-intro-grid"><article><span>01</span><b>Operate a private market.</b><p>Keep orders and customer activity off the public chain.</p></article><article><span>02</span><b>Let more people provide FX.</b><p>Customers, businesses and institutions can place or quote liquidity.</p></article><article><span>03</span><b>Settle the token exchange on-chain.</b><p>The selected token fills can settle together instead of becoming separate promises.</p></article></div>
    </section>

    <CustomerAndMaker/>
    <PrivateSettlement/>
    <OneTradeManyWays/>
    <ProviderParticipation/>
    <FiatModels/>
    <TreasuryGraphic/>
    <FinalityGraphic/>
    <DeploymentBlueprints/>

    <section id="fx-reference" className="fxp-section fxp-live-market fxn-reference">
      <div className="fxp-section-head"><div><Label>WORKED EXAMPLE</Label><h2>Change the market and see what the route does.</h2><p>This is a deterministic reference market included in the repository. It is useful for testing source eligibility, route selection and reservations without pretending the seeded firms are live integrations.</p></div><div className="fxp-reference-status"><LiveBadge connected={runtimeReachable} loading={loading} mode={FX_RUNTIME_MODE}/><a href="#fx-implementation"><Pill>See the code ↓</Pill></a></div></div>
      {error&&<div className="fxp-phone-error">{error}</div>}
      <div className="fxp-market-scenarios">{scenarios.map((item)=>{const copy=SCENARIO_COPY[item.id]??{title:item.label,short:""};return <button type="button" key={item.id} className={activeScenario===item.id?"active":""} onClick={()=>void changeScenario(item.id)} disabled={busy}><b>{copy.title}</b><span>{copy.short}</span></button>;})}</div>
      <div className="fxp-market-note"><span className={currentMarket?.reference.available?"ok":"bad"}/><b>{selectedScenario.title}</b><span>{busy?"Updating reference route…":selectedScenario.short}</span></div>
      <AllocationMap trade={trade} selected={selectedSource} onSelect={setSelectedSource}/>
      <div className="fx-reference-caveat"><b>REFERENCE PARTICIPANTS</b><span>Seeded issuer, LP, institution and treasury capacity exercise the planner and reservation lifecycle. They are not commercial integrations.</span></div>
    </section>

    <section className="fxp-section fxn-proof-head"><div className="fxp-section-head"><div><Label>UNDER THE HOOD</Label><h2>The diagrams stop here. The implementation does not.</h2><p>Run the reference market, stress the economics, then inspect the packages that own matching, policy, pricing, fiat evidence and settlement.</p></div></div></section>
    <SimulatorLab/>
    <div id="fx-implementation"><ImplementationExplorer/></div>
    <Packages/>
    <section className="fxp-section fxn-isnt"><Label>WHAT THIS IS AND ISN'T</Label><div><p><b>Blueballs is software.</b> It does not provide a banking licence, KYC vendor, stablecoin issuer or fiat custody.</p><p>Those systems connect through adapters. The repository includes reference participants and simulators so the FX behaviour can be run and tested without implying commercial integrations that do not exist.</p></div></section>
    <div className="fxp-runtime-note">FX runtime: <code>{FX_RUNTIME_LABEL}</code></div>
  </div>;
}
