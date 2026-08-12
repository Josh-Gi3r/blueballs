import { useEffect, useRef, useState } from "react";
import { FX_RUNTIME_LABEL, FX_RUNTIME_MODE, fxCall } from "./api";
import liquidityArtwork from "./assets/fx-editorial-liquidity.svg";
import policyArtwork from "./assets/fx-editorial-policy.svg";
import routeArtwork from "./assets/fx-editorial-route.svg";
import treasuryArtwork from "./assets/fx-editorial-treasury.svg";
import { Packages } from "./fx/Packages";
import { ArtworkSection, Label, LiveBadge, Pill, SettlementRoute } from "./fx/Primitives";
import { SimulatorLab } from "./fx/Simulator";
import { AllocationMap } from "./fx/TradeViews";
import { ImplementationExplorer, ProductPhone } from "./fx/Story";
import { DeploymentBlueprints, FiatEdgeGraphic, MasterArchitecture, OwnMarketGraphic, ProviderParticipation } from "./fx/ArchitectureStory";
import { SCENARIO_COPY, errorMessage, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [trade,setTrade]=useState<PublicTrade|null>(null); const [market,setMarket]=useState<MarketState|null>(null); const [scenarios,setScenarios]=useState<Scenario[]>([]); const [activeScenario,setActiveScenario]=useState("balanced"); const [selectedSource,setSelectedSource]=useState<string|null>(null); const [loading,setLoading]=useState(true); const [runtimeReachable,setRuntimeReachable]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const previewSequence=useRef(0);
  async function preview(){const sequence=++previewSequence.current;setLoading(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/trades/preview",{inputAmount:"50000.00"});if(sequence!==previewSequence.current)return;setLoading(false);if(!result.ok){setRuntimeReachable(result.status!==0);setTrade(null);setError(errorMessage(result));return;}setRuntimeReachable(true);const nextTrade=result.body as PublicTrade;setTrade(nextTrade);setSelectedSource((current)=>{const stillExists=nextTrade.sourceStatus.some((source)=>source.sourceId===current&&source.eligible);return stillExists?current:nextTrade.sourceStatus.find((source)=>source.eligible)?.sourceId??null;});}
  useEffect(()=>{let cancelled=false;async function start(){const scenarioResult=await fxCall("GET","/v2/fx/reference/scenario");if(cancelled)return;setRuntimeReachable(scenarioResult.ok||scenarioResult.status!==0);if(scenarioResult.ok){const payload=scenarioResult.body as {current:MarketState;available:Scenario[]};setMarket(payload.current);setActiveScenario(payload.current.id);setScenarios(payload.available);}await preview();}void start();return()=>{cancelled=true;};},[]);
  async function changeScenario(id:string){if(id===activeScenario)return;setBusy(true);setError(null);const result=await fxCall("POST","/v2/fx/reference/scenario",{id});if(!result.ok){setBusy(false);setError(errorMessage(result));return;}setActiveScenario(id);setMarket(result.body as MarketState);await preview();setBusy(false);}
  const selectedScenario=SCENARIO_COPY[activeScenario]??{title:activeScenario,short:""}; const currentMarket=market??(trade?{id:activeScenario,sources:trade.sourceStatus,reference:{available:true}}:null);
  return <div className="fxp">
    <section className="fxp-hero"><div className="fxp-hero-copy"><div className="fxp-hero-top"><Label>STABLECOIN FX</Label><span className="fxp-hero-open">OPEN SOURCE · SELF-HOSTABLE</span></div><h1>Build FX into your financial product.</h1><p>Run your own market, connect external providers when needed, and support fiat and stablecoin flows through the same infrastructure.</p><div className="fxp-hero-proof"><div><span>START</span><b>Use existing providers to launch.</b></div><div><span>GROW</span><b>Add your own market and counterparties.</b></div><div><span>OWN</span><b>Control more of the economics and execution over time.</b></div></div></div><div className="fxp-hero-phone"><ProductPhone/></div></section>

    <MasterArchitecture/>
    <DeploymentBlueprints/>
    <OwnMarketGraphic/>

    <ArtworkSection image={liquidityArtwork} label="ONE TRADE · MANY POSSIBLE SOURCES" title="Fill the exchange from the market you assemble." copy="Opposing customer flow, private maker orders, issuer inventory, professional LPs, treasury and principal capacity can all contribute. Only the selected capacity is reserved for the customer quote."><div className="fxp-art-facts"><div><b>OWN</b><span>customer flow + private orders</span></div><div><b>CONNECTED</b><span>issuers + banks + market makers</span></div><div><b>EXTERNAL</b><span>venues when useful</span></div></div></ArtworkSection>

    <ProviderParticipation/>

    <ArtworkSection reverse image={policyArtwork} label="POLICY BEFORE PRICE" title="Only permitted routes get priced." copy="Identity, account attribution, credentials, jurisdiction, corridor rules and ticket limits decide which participants can enter the executable market. A cheaper quote does not bypass policy."/>

    <ArtworkSection image={treasuryArtwork} label="TREASURY · PRINCIPAL" title="Use the balance sheet without letting it become the whole market." copy="Treasury and principal capacity can support one-way flow within configured exposure limits. Reservations count immediately, and the route stops using principal when the limit is reached."/>

    <FiatEdgeGraphic/>

    <ArtworkSection reverse image={routeArtwork} label="EXECUTION · FINALITY" title="Keep the token FX and external rails separate." copy="A fiat payment, token swap and fiat redemption do not share the same finality. The token leg can settle atomically while payment and redemption remain externally evidenced or asynchronous."><SettlementRoute trade={trade}/></ArtworkSection>

    <section id="fx-reference" className="fxp-section fxp-live-market"><div className="fxp-section-head"><div><Label>RUN THE REFERENCE MARKET</Label><h2>Change the market. Inspect the route.</h2><p>The repository includes a deterministic reference runtime so policy, source selection, reservations and settlement states can be exercised without presenting seeded providers as commercial integrations.</p></div><div className="fxp-reference-status"><LiveBadge connected={runtimeReachable} loading={loading} mode={FX_RUNTIME_MODE}/><a href="#fx-implementation"><Pill>See the code ↓</Pill></a></div></div>{error&&<div className="fxp-phone-error">{error}</div>}<div className="fxp-market-scenarios">{scenarios.map((item)=>{const copy=SCENARIO_COPY[item.id]??{title:item.label,short:""};return <button type="button" key={item.id} className={activeScenario===item.id?"active":""} onClick={()=>void changeScenario(item.id)} disabled={busy}><b>{copy.title}</b><span>{copy.short}</span></button>;})}</div><div className="fxp-market-note"><span className={currentMarket?.reference.available?"ok":"bad"}/><b>{selectedScenario.title}</b><span>{busy?"Updating reference route…":selectedScenario.short}</span></div><AllocationMap trade={trade} selected={selectedSource} onSelect={setSelectedSource}/><div className="fx-reference-caveat"><b>REFERENCE PARTICIPANTS</b><span>Seeded issuer, LP, institution and treasury capacity exercise the planner and reservation lifecycle. They are not commercial integrations.</span></div></section>

    <SimulatorLab/>
    <div id="fx-implementation"><ImplementationExplorer/></div>
    <Packages/>
    <div className="fxp-runtime-note">FX runtime: <code>{FX_RUNTIME_LABEL}</code></div>
  </div>;
}
