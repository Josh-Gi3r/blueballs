import { useState } from "react";
import { Label } from "./Primitives";

const SourceDot = ({ tone = "own" }: { tone?: "own" | "firm" | "external" | "risk" }) => <i className={`fxv-dot ${tone}`} />;

export function MasterArchitecture() {
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>THE WHOLE SYSTEM</Label><h2>One FX core. Different ways in, different ways out.</h2><p>The customer product stays simple while the institution decides how fiat enters, where stablecoin liquidity comes from, how execution is routed, and whether the destination stays on-chain or exits to fiat.</p></div></div>
    <div className="fxv-canvas fxv-master">
      <div className="fxv-edge-column">
        <div className="fxv-edge-label">OPTIONAL FIAT EDGE</div>
        <div className="fxv-edge-card"><span>MANAGED RAMP</span><b>Bank / PSP / provider</b><small>fiat confirmed externally</small></div>
        <div className="fxv-edge-card"><span>VERIFIED P2P</span><b>Buyer ↔ seller</b><small>escrow released on evidence</small></div>
        <div className="fxv-edge-card"><span>DIRECT ISSUER</span><b>Fiat → stablecoin</b><small>mint against received funds</small></div>
      </div>

      <div className="fxv-arrow-column"><span>→</span><small>ON-RAMP</small></div>

      <div className="fxv-core">
        <div className="fxv-core-head"><div><span>YOUR FX CORE</span><b>Stablecoin market + router</b></div><em>SELF-HOSTABLE</em></div>
        <div className="fxv-core-flow">
          <div className="fxv-core-step"><small>1</small><b>Eligible market</b><span>decide who and what can trade</span></div>
          <div className="fxv-core-step"><small>2</small><b>Price + route</b><span>combine internal and connected liquidity</span></div>
          <div className="fxv-core-step"><small>3</small><b>Reserve + execute</b><span>lock only selected capacity</span></div>
        </div>
        <div className="fxv-market-strip"><span>USDC</span><strong>⇄</strong><span>EURC</span><strong>⇄</strong><span>BRL stablecoin</span><strong>⇄</strong><span>other stables</span></div>
        <div className="fxv-core-sources">
          <div><SourceDot/><b>Own market</b><span>customers · businesses · makers</span></div>
          <div><SourceDot tone="firm"/><b>Connected firms</b><span>issuer · bank · LP · JIT</span></div>
          <div><SourceDot tone="risk"/><b>Treasury</b><span>bounded principal capacity</span></div>
          <div><SourceDot tone="external"/><b>External routes</b><span>only when useful</span></div>
        </div>
      </div>

      <div className="fxv-arrow-column"><span>→</span><small>SETTLE</small></div>

      <div className="fxv-output-column">
        <div className="fxv-edge-label">DESTINATION</div>
        <div className="fxv-output-card primary"><span>STAY ON-CHAIN</span><b>EURC received</b><small>token FX can settle atomically</small></div>
        <div className="fxv-output-or">OR</div>
        <div className="fxv-output-card"><span>OPTIONAL FIAT EDGE</span><b>Redeem / payout EUR</b><small>external finality</small></div>
      </div>

      <div className="fxv-bypass"><b>STABLECOIN → STABLECOIN</b><span>skips both fiat edges and enters the FX core directly</span></div>
    </div>
  </section>;
}

const MODELS = [
  {id:"external",title:"External-first",sub:"Launch with connected providers and venues. Own little execution on day one.",own:12,firm:52,external:100,caption:"Fastest launch · most economics remain external"},
  {id:"hybrid",title:"Hybrid",sub:"Internalise useful flow while keeping firms and venues available for residual liquidity.",own:62,firm:82,external:48,caption:"More control · external liquidity stays composable"},
  {id:"owned",title:"Own-market",sub:"Your private market is primary. Connected firms and external venues become optional extensions.",own:100,firm:50,external:18,caption:"Maximum control · external routes become fallback capacity"},
] as const;

export function DeploymentBlueprints() {
  const [model,setModel]=useState<(typeof MODELS)[number]["id"]>("hybrid");
  const active=MODELS.find((item)=>item.id===model)!;
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>START → GROW → OWN</Label><h2>You do not have to own the whole market on day one.</h2><p>The same integration can move from provider-led execution to a hybrid model and eventually to an institution-controlled market as volume, counterparties and treasury sophistication grow.</p></div></div>
    <div className="fx-diagram-tabs">{MODELS.map((item)=><button key={item.id} className={model===item.id?"active":""} onClick={()=>setModel(item.id)}>{item.title}</button>)}</div>
    <div className="fxv-canvas fxv-blueprint">
      <div className="fxv-blueprint-copy"><span>DEPLOYMENT MODEL</span><h3>{active.title}</h3><p>{active.sub}</p><b>{active.caption}</b></div>
      <div className="fxv-blueprint-stack">
        <div className="fxv-stack-row"><span><SourceDot/>YOUR MARKET</span><div><i style={{width:`${active.own}%`}}/></div><b>{active.own}%</b></div>
        <div className="fxv-stack-row"><span><SourceDot tone="firm"/>CONNECTED FIRMS</span><div><i style={{width:`${active.firm}%`}}/></div><b>{active.firm}%</b></div>
        <div className="fxv-stack-row"><span><SourceDot tone="external"/>EXTERNAL ROUTES</span><div><i style={{width:`${active.external}%`}}/></div><b>{active.external}%</b></div>
      </div>
      <div className="fxv-blueprint-constant"><small>WHAT DOES NOT CHANGE</small><b>Customer integration</b><span>quote → reserve → execute → reconcile</span></div>
    </div>
  </section>;
}

export function OwnMarketGraphic() {
  const participants = [
    ["Customer flow","opposing flow","$40k","own"],
    ["Businesses","private signed orders","$75k","own"],
    ["Market makers","resting quotes","$300k","firm"],
    ["Issuer","inventory","$150k","firm"],
    ["Treasury","risk-limited principal","$90k","risk"],
    ["Institution","signed capacity","$500k","firm"],
  ] as const;
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>YOUR MARKET</Label><h2>Internalise flow before you reach outside.</h2><p>Customer flow, private business orders, professional makers, issuers, institutions and bounded treasury capacity can meet inside the same market. Residual liquidity can then be requested elsewhere.</p></div></div>
    <div className="fxv-canvas fxv-own-market">
      <div className="fxv-participants"><span className="fxv-kicker">POTENTIAL LIQUIDITY</span>{participants.map(([name,detail,amount,tone])=><div className="fxv-participant" key={name}><SourceDot tone={tone}/><div><b>{name}</b><small>{detail}</small></div><strong>{amount}</strong></div>)}</div>
      <div className="fxv-orderbook">
        <div className="fxv-terminal-head"><div><span>PRIVATE FX MARKET</span><b>USDC / EURC</b></div><em>OPEN · PRIVATE</em></div>
        <div className="fxv-book-grid">
          <div><small>BIDS</small><p><b>250k</b><span>0.9237</span><i style={{width:"88%"}}/></p><p><b>120k</b><span>0.9235</span><i style={{width:"62%"}}/></p><p><b>85k</b><span>0.9234</span><i style={{width:"42%"}}/></p><p><b>60k</b><span>0.9232</span><i style={{width:"30%"}}/></p></div>
          <div className="ask"><small>OFFERS</small><p><span>0.9239</span><b>100k</b><i style={{width:"34%"}}/></p><p><span>0.9241</span><b>220k</b><i style={{width:"58%"}}/></p><p><span>0.9243</span><b>300k</b><i style={{width:"72%"}}/></p><p><span>0.9246</span><b>500k</b><i style={{width:"94%"}}/></p></div>
        </div>
        <div className="fxv-terminal-foot"><span>signed orders</span><span>partial fills</span><span>reservations</span><span>private identities</span></div>
      </div>
      <div className="fxv-fill-path"><div className="fxv-trade-card"><span>INCOMING EXCHANGE</span><b>$250,000</b><small>USD → EUR</small></div><div className="fxv-route-line"/><div className="fxv-fill-card"><span>INTERNAL FILL</span><b>$165,000</b><small>matched in your market</small></div><div className="fxv-fill-card residual"><span>RESIDUAL</span><b>$85,000</b><small>JIT / external only if needed</small></div></div>
    </div>
  </section>;
}

export function LiquidityGraphic() {
  const sources = [
    ["Customer flow","opposing signed flow","own"],
    ["Private orders","business + institutional","own"],
    ["Issuer inventory","available capacity","firm"],
    ["Market makers","resting or streamed","firm"],
    ["Treasury","risk-limited principal","risk"],
    ["External venues","residual / best route","external"],
  ] as const;
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>ONE TRADE · MANY SOURCES</Label><h2>The router assembles execution. The sources do not plug straight into the customer.</h2><p>Each source has its own lifecycle and constraints. The executable market is assembled first, then the router prices, splits and reserves only the capacity selected for the customer quote.</p></div></div>
    <div className="fxv-canvas fxv-liquidity">
      <div className="fxv-source-grid">{sources.map(([name,detail,tone])=><div className="fxv-source-card" key={name}><SourceDot tone={tone}/><div><b>{name}</b><span>{detail}</span></div></div>)}</div>
      <div className="fxv-converge"><i/><i/><i/><span>→</span></div>
      <div className="fxv-router-card"><span>EXECUTABLE MARKET</span><b>USDC → EURC</b><div><small>ELIGIBLE</small><strong>→</strong><small>PRICE</small><strong>→</strong><small>ROUTE</small><strong>→</strong><small>RESERVE</small></div><em>selected capacity only</em></div>
      <div className="fxv-route-output"><span>CUSTOMER QUOTE</span><b>$250k → €230.9k</b><div><i className="own" style={{width:"52%"}}/><i className="firm" style={{width:"32%"}}/><i className="external" style={{width:"16%"}}/></div><small>52% own market · 32% connected · 16% external</small></div>
    </div>
  </section>;
}

export function ProviderParticipation() {
  const [mode,setMode]=useState<"resting"|"inventory"|"jit">("jit");
  const data = mode === "jit" ? [["Issuer A","0.9235","$2.0m","6s","selected"],["Bank B","0.9236","$5.0m","8s","selected"],["LP C","0.9238","$3.0m","4s",""]] : mode === "inventory" ? [["Issuer A","0.9234","$4.0m","live","selected"],["Bank B","0.9237","$6.5m","live",""],["LP C","0.9236","$2.5m","live","selected"]] : [["Issuer A","0.9233","$1.5m","GTC","selected"],["Bank B","0.9236","$2.0m","GTC",""],["LP C","0.9234","$3.5m","GTC","selected"]];
  const title = mode === "jit" ? "Request a firm quote only when flow arrives." : mode === "inventory" ? "Read executable inventory without forcing a resting order." : "Let institutions leave signed orders in the market.";
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>CONNECTED FIRMS</Label><h2>A provider does not have to behave like an exchange LP.</h2><p>Banks, issuers, LPs and intermediaries can participate through resting orders, exposed inventory or short-lived JIT/RFQ quotes. The router normalises those different lifecycles.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="resting"?"active":""} onClick={()=>setMode("resting")}>Resting orders</button><button className={mode==="inventory"?"active":""} onClick={()=>setMode("inventory")}>Available inventory</button><button className={mode==="jit"?"active":""} onClick={()=>setMode("jit")}>JIT / RFQ</button></div>
    <div className="fxv-canvas fxv-provider">
      <div className="fxv-provider-request"><span>{mode === "jit" ? "LIVE RFQ" : mode === "inventory" ? "INVENTORY DISCOVERY" : "PRIVATE ORDER BOOK"}</span><b>{mode === "jit" ? "$4,000,000" : "USDC / EURC"}</b><p>{title}</p><em>{mode === "jit" ? "00:08" : "LIVE"}</em></div>
      <div className="fxv-provider-table"><div className="head"><span>FIRM</span><span>PRICE</span><span>CAPACITY</span><span>{mode === "jit" ? "EXPIRES" : "STATE"}</span></div>{data.map(([provider,price,capacity,state,selected])=><div className={selected?"row selected":"row"} key={provider}><span><SourceDot tone="firm"/>{provider}</span><b>{price}</b><strong>{capacity}</strong><em>{state}</em></div>)}<div className="fxv-provider-summary"><span>RESERVED</span><b>{mode === "jit" ? "Issuer A + Bank B · $4.0m" : "Issuer A + LP C · $3.5m"}</b></div></div>
    </div>
  </section>;
}

export function ComplianceModelGraphic() {
  const [mode,setMode]=useState<"controlled"|"open">("controlled");
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>CONTROL MODEL</Label><h2>The FX core can be permissioned without forcing every edge to be centralised.</h2><p>Compliance is not simply a box that sits before price. You choose the market model: tightly permissioned institutional participation, or more open verified P2P edges feeding the same stablecoin FX core.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="controlled"?"active":""} onClick={()=>setMode("controlled")}>Institution-controlled</button><button className={mode==="open"?"active":""} onClick={()=>setMode("open")}>Open / verified P2P</button></div>
    <div className="fxv-canvas fxv-control">
      <div className="fxv-control-side">
        <span>{mode==="controlled"?"PERMISSIONED ACCESS":"OPEN EDGE"}</span>
        <b>{mode==="controlled"?"Known accounts + approved counterparties":"Verified peers + escrow evidence"}</b>
        <div className="fxv-control-list">{mode==="controlled"?<><p>✓ identity / account attribution</p><p>✓ corridor + jurisdiction rules</p><p>✓ ticket / counterparty limits</p><p>✓ institution-set credentials</p></>:<><p>✓ peer discovery can remain open</p><p>✓ fiat payment happens peer-to-peer</p><p>✓ escrow release depends on evidence</p><p>✓ stablecoin FX core stays unchanged</p></>}</div>
      </div>
      <div className="fxv-control-arrow">→</div>
      <div className="fxv-control-core"><span>SAME FX CORE</span><b>Stablecoin market + router</b><div><i>1</i><p><strong>Market rules</strong><small>define executable participation</small></p></div><div><i>2</i><p><strong>Price + route</strong><small>compare only executable liquidity</small></p></div><div><i>3</i><p><strong>Reserve + settle</strong><small>preserve route-specific finality</small></p></div></div>
      <div className="fxv-control-note"><b>THE CHOICE IS ARCHITECTURAL</b><span>centralised compliance and decentralised edges are composable, not mutually exclusive</span></div>
    </div>
  </section>;
}

export function TreasuryGraphic() {
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>TREASURY · PRINCIPAL</Label><h2>Treasury is one bounded liquidity source, not the market itself.</h2><p>Principal capacity can improve execution for one-way flow, but exposure and reservations consume a hard limit immediately. Once the ceiling is reached, the router stops allocating new treasury flow and uses other sources.</p></div></div>
    <div className="fxv-canvas fxv-treasury">
      <div className="fxv-treasury-gauge"><span>EUR EXPOSURE LIMIT</span><b>€5.0m</b><div className="fxv-gauge"><i className="used" style={{width:"64%"}}/><i className="reserved" style={{width:"24%"}}/></div><div className="fxv-gauge-legend"><span><i className="used"/>€3.2m current</span><span><i className="reserved"/>€1.2m reserved</span><span>€0.6m free</span></div></div>
      <div className="fxv-treasury-trade"><span>NEW CUSTOMER TRADE</span><b>€1.0m</b><small>requires EUR principal capacity</small></div>
      <div className="fxv-treasury-decision"><div className="fxv-decision bad"><span>TREASURY</span><b>€0.6m available</b><small>insufficient for full trade</small></div><div className="fxv-decision good"><span>ROUTER</span><b>Split the remainder</b><small>treasury €0.6m + connected / external €0.4m</small></div></div>
      <div className="fxv-treasury-rule"><b>RESERVATIONS COUNT IMMEDIATELY</b><span>pending capacity cannot be promised twice</span></div>
    </div>
  </section>;
}

export function FiatEdgeGraphic() {
  const [mode,setMode]=useState<"managed"|"peer"|"issuer">("peer");
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>FIAT AT THE EDGES</Label><h2>Change the on-ramp without changing the FX market.</h2><p>A managed provider, direct issuer or verified P2P route can create the stablecoin balance. Once on-chain, all three feed the same FX core. Stablecoin-to-stablecoin flow skips the fiat edge completely.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="managed"?"active":""} onClick={()=>setMode("managed")}>Managed provider</button><button className={mode==="peer"?"active":""} onClick={()=>setMode("peer")}>Verified P2P</button><button className={mode==="issuer"?"active":""} onClick={()=>setMode("issuer")}>Direct issuer</button></div>
    <div className="fxv-canvas fxv-fiat">
      <div className="fxv-fiat-customer"><span>CUSTOMER</span><b>R$500,000</b><small>BRL</small></div>
      <div className="fxv-fiat-arrow">→</div>
      <div className="fxv-fiat-mode"><span>{mode==="peer"?"VERIFIED P2P":mode==="managed"?"MANAGED PROVIDER":"DIRECT ISSUER"}</span><b>{mode==="peer"?"Buyer pays seller directly":mode==="managed"?"PIX instruction + provider confirmation":"Issuer receives fiat and mints"}</b>{mode==="peer"?<div className="fxv-mini-flow"><i>BUYER</i><strong>payment proof</strong><i>ESCROW</i></div>:mode==="managed"?<div className="fxv-mini-flow"><i>PIX</i><strong>confirmed</strong><i>RELEASE</i></div>:<div className="fxv-mini-flow"><i>FIAT</i><strong>received</strong><i>MINT</i></div>}<small>{mode==="peer"?"escrow releases on accepted evidence":mode==="managed"?"provider attests external payment":"stablecoin issued against received funds"}</small></div>
      <div className="fxv-fiat-arrow">→</div>
      <div className="fxv-token"><span>STABLECOIN BALANCE</span><b>{mode==="issuer"?"BRL stablecoin":"USDC"}</b><small>ready for FX</small></div>
      <div className="fxv-fiat-arrow">→</div>
      <div className="fxv-fx-box"><span>YOUR FX CORE</span><b>{mode==="issuer"?"BRL stablecoin → EURC":"USDC → EURC"}</b><small>same market · same router</small></div>
      <div className="fxv-direct-entry"><b>USDT → EURC</b><span>direct stablecoin entry · no fiat edge</span></div>
    </div>
  </section>;
}

export function FinalityGraphic() {
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>EXECUTION · FINALITY</Label><h2>Do not pretend the whole route is atomic.</h2><p>A fiat payment, an on-chain stablecoin exchange and a fiat redemption have different settlement guarantees. Keep them separate in the architecture and expose the state of each leg honestly.</p></div></div>
    <div className="fxv-canvas fxv-finality">
      <div className="fxv-leg external"><span>LEG 01 · FIAT IN</span><b>BRL payment</b><small>PIX / bank / peer transfer</small><em>EXTERNAL FINALITY</em></div>
      <div className="fxv-leg-link">→</div>
      <div className="fxv-leg atomic"><span>LEG 02 · TOKEN FX</span><b>USDC → EURC</b><small>reserve + execute on-chain</small><em>ATOMIC TOKEN LEG</em></div>
      <div className="fxv-leg-link">→</div>
      <div className="fxv-leg external"><span>LEG 03 · FIAT OUT</span><b>EUR redemption</b><small>issuer / bank payout</small><em>ASYNC EXTERNAL FINALITY</em></div>
      <div className="fxv-finality-states"><div><i className="done"/><span>fiat payment</span><b>confirmed externally</b></div><div><i className="done"/><span>token FX</span><b>settled</b></div><div><i className="pending"/><span>EUR payout</span><b>processing</b></div></div>
      <div className="fxv-finality-bypass"><span>PURE STABLECOIN FX</span><b>USDT → EURC enters directly at leg 02</b></div>
    </div>
  </section>;
}
