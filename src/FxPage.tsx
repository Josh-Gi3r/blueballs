import { useEffect, useRef, useState } from "react";
import { fxCall } from "./api";
import { FxOverview } from "./fx/FxOverview";
import { errorMessage, sanitizeAmount, type MarketState, type PublicTrade, type Scenario } from "./fx/model";
import "./FxPage.css";

export default function FxPage() {
  const [trade,setTrade]=useState<PublicTrade|null>(null);
  const [market,setMarket]=useState<MarketState|null>(null);
  const [scenarios,setScenarios]=useState<Scenario[]>([]);
  const [activeScenario,setActiveScenario]=useState("balanced");
  const [selectedSource,setSelectedSource]=useState<string|null>(null);
  const [amount,setAmount]=useState("50000.00");
  const [loading,setLoading]=useState(true);
  const [runtimeReachable,setRuntimeReachable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const previewSequence=useRef(0);

  async function preview(nextAmount=amount){
    const sequence=++previewSequence.current;
    setLoading(true);
    setError(null);
    const result=await fxCall("POST","/v2/fx/reference/trades/preview",{inputAmount:nextAmount});
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

  const currentMarket=market??(trade?{id:activeScenario,sources:trade.sourceStatus,reference:{available:true}}:null);

  return <div className="fxp fxs-page fxn-page">
    <FxOverview
      trade={trade}
      market={currentMarket}
      scenarios={scenarios}
      activeScenario={activeScenario}
      selectedSource={selectedSource}
      amount={amount}
      loading={loading}
      busy={busy}
      error={error}
      runtimeReachable={runtimeReachable}
      onAmountChange={(value)=>setAmount(sanitizeAmount(value))}
      onPreview={()=>void preview()}
      onScenarioChange={(id)=>void changeScenario(id)}
      onSourceSelect={setSelectedSource}
    />
  </div>;
}
