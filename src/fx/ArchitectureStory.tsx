import { useState } from "react";
import { Label } from "./Primitives";

const money = (value: string) => <strong>{value}</strong>;

export function MasterArchitecture() {
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>ONE CUSTOMER EXCHANGE</Label><h2>The product stays simple. The infrastructure can be much bigger.</h2><p>A USD → EUR exchange can use your own market, connected institutions, external venues and fiat edges without changing the customer-facing integration.</p></div></div>
    <div className="fx-stage fx-master-stage">
      <div className="fx-master-product">
        <div className="fx-mini-phone">
          <div className="fx-mini-status"><span>9:41</span><span>● ● ●</span></div>
          <div className="fx-mini-title">Exchange</div>
          <div className="fx-mini-amount"><span>You pay</span><b>$100,000.00</b><em>USD</em></div>
          <div className="fx-mini-arrow">↓</div>
          <div className="fx-mini-amount receive"><span>You receive</span><b>€92,340.00</b><em>EUR</em></div>
          <button type="button">Review exchange</button>
        </div>
      </div>

      <div className="fx-master-rail"><span className="fx-rail-dot"/><span className="fx-rail-label">FX REQUEST</span></div>

      <div className="fx-master-engine">
        <div className="fx-engine-header"><span>YOUR FX STACK</span><b>USD → EUR</b><em>route assembling</em></div>
        <div className="fx-engine-grid">
          <div className="fx-engine-market"><div className="fx-panel-head"><span>PRIVATE MARKET</span><b>USDC / EURC</b></div><div className="fx-depth"><div><small>BIDS</small><p><span>0.9237</span><b>85k</b></p><p><span>0.9235</span><b>120k</b></p><p><span>0.9232</span><b>240k</b></p></div><div><small>OFFERS</small><p><span>0.9239</span><b>100k</b></p><p><span>0.9241</span><b>220k</b></p><p><span>0.9244</span><b>460k</b></p></div></div></div>
          <div className="fx-engine-route"><div className="fx-panel-head"><span>SELECTED ROUTE</span><b>$100,000</b></div><ul><li><i className="own"/><span>Own market</span><b>$55k</b></li><li><i className="firm"/><span>Institutional JIT</span><b>$25k</b></li><li><i className="venue"/><span>External venue</span><b>$20k</b></li></ul><div className="fx-reserve"><span>ALL LEGS RESERVED</span><b>6.2s</b></div></div>
        </div>
        <div className="fx-engine-steps"><span>POLICY</span><span>PRICE</span><span>ROUTE</span><span>RESERVE</span><span>EXECUTE</span><span>RECONCILE</span></div>
      </div>

      <div className="fx-master-rail right"><span className="fx-rail-dot"/><span className="fx-rail-label">SETTLEMENT</span></div>

      <div className="fx-master-result"><div className="fx-result-check">✓</div><span>CUSTOMER</span><b>€92,340</b><small>EUR received</small></div>

      <div className="fx-master-sources">
        <div className="fx-source-panel own"><span>YOUR MARKET</span><b>Customers · businesses · makers · treasury</b><small>Private signed flow already inside the institution.</small></div>
        <div className="fx-source-panel firm"><span>CONNECTED FIRMS</span><b>Issuer · bank · LP · JIT</b><small>Orders, inventory or short-lived firm quotes.</small></div>
        <div className="fx-source-panel venue"><span>EXTERNAL ROUTES</span><b>Venue · aggregator · bridge</b><small>Used only when they improve the executable path.</small></div>
      </div>
      <div className="fx-master-caption">THE MARKET, PROVIDERS AND RAILS CAN CHANGE. THE PRODUCT INTEGRATION DOES NOT HAVE TO.</div>
    </div>
  </section>;
}

export function OwnMarketGraphic() {
  const participants = [
    ["Customer flow", "$40k", "opposing flow"],
    ["Businesses", "$75k", "private orders"],
    ["Market makers", "$300k", "resting quotes"],
    ["Issuer", "$150k", "inventory"],
    ["Treasury", "$90k", "risk-limited"],
    ["Institution", "$500k", "signed orders"],
  ];
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>YOUR MARKET</Label><h2>Run the market behind the exchange.</h2><p>Opposing customer flow, customer and business orders, professional makers, issuers and treasury can all meet inside the same private market.</p></div></div>
    <div className="fx-stage fx-market-stage">
      <div className="fx-participant-column"><span className="fx-stage-kicker">WHO CAN MAKE THE MARKET</span>{participants.map(([name, amount, detail], index)=><div className="fx-participant-row" key={name}><i className={`p${index}`}/><div><b>{name}</b><small>{detail}</small></div><strong>{amount}</strong></div>)}</div>
      <div className="fx-market-terminal">
        <div className="fx-terminal-top"><div><span>PRIVATE FX MARKET</span><b>USDC / EURC</b></div><div className="fx-terminal-state">OPEN · PRIVATE</div></div>
        <div className="fx-terminal-book"><div className="bid"><small>BIDS</small><div className="book-head"><span>AMOUNT</span><span>PRICE</span></div><p><b>250k</b><em>0.9237</em><i style={{width:"88%"}}/></p><p><b>120k</b><em>0.9235</em><i style={{width:"62%"}}/></p><p><b>85k</b><em>0.9234</em><i style={{width:"42%"}}/></p><p><b>60k</b><em>0.9232</em><i style={{width:"30%"}}/></p></div><div className="ask"><small>OFFERS</small><div className="book-head"><span>PRICE</span><span>AMOUNT</span></div><p><em>0.9239</em><b>100k</b><i style={{width:"34%"}}/></p><p><em>0.9241</em><b>220k</b><i style={{width:"58%"}}/></p><p><em>0.9243</em><b>300k</b><i style={{width:"72%"}}/></p><p><em>0.9246</em><b>500k</b><i style={{width:"94%"}}/></p></div></div>
        <div className="fx-terminal-foot"><span>Signed orders</span><span>Price-time matching</span><span>Partial fills</span><span>Reservations</span></div>
      </div>
      <div className="fx-market-outcome"><div className="fx-incoming-trade"><span>INCOMING EXCHANGE</span><b>$250,000</b><small>USD → EUR</small></div><div className="fx-flow-arrow">↓</div><div className="fx-best-fill"><span>BEST INTERNAL FILL</span><b>$165,000</b><small>matched in-market</small></div><div className="fx-residual"><span>REMAINING</span><b>$85,000</b><small>JIT / external if needed</small></div></div>
      <div className="fx-market-caption">MAKER IDENTITIES STAY PRIVATE. AGGREGATE DEPTH CAN STILL BE EXPOSED.</div>
    </div>
  </section>;
}

export function ProviderParticipation() {
  const [mode,setMode]=useState<"resting"|"inventory"|"jit">("jit");
  const data = mode === "jit" ? [
    ["Issuer A","0.9235","$2.0m","6s","selected"],
    ["Bank B","0.9236","$5.0m","8s","selected"],
    ["LP C","0.9238","$3.0m","4s",""],
  ] : mode === "inventory" ? [
    ["Issuer A","0.9234","$4.0m","live","selected"],
    ["Bank B","0.9237","$6.5m","live",""],
    ["LP C","0.9236","$2.5m","live","selected"],
  ] : [
    ["Issuer A","0.9233","$1.5m","GTC","selected"],
    ["Bank B","0.9236","$2.0m","GTC",""],
    ["LP C","0.9234","$3.5m","GTC","selected"],
  ];
  const title = mode === "jit" ? "Ask only when flow arrives." : mode === "inventory" ? "Read executable capacity without a resting order." : "Let institutions leave signed orders in the market.";
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>CONNECTED FIRMS</Label><h2>Providers can connect on their terms.</h2><p>Banks, issuers, LPs and intermediaries can place orders, expose inventory, or answer a short-lived request when customer flow arrives.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="resting"?"active":""} onClick={()=>setMode("resting")}>Resting orders</button><button className={mode==="inventory"?"active":""} onClick={()=>setMode("inventory")}>Available inventory</button><button className={mode==="jit"?"active":""} onClick={()=>setMode("jit")}>JIT / RFQ</button></div>
    <div className="fx-stage fx-provider-stage">
      <div className="fx-provider-request"><span>{mode === "jit" ? "RFQ" : mode === "inventory" ? "DISCOVERY" : "ORDER BOOK"}</span><b>{mode === "jit" ? "$4,000,000" : "USDC / EURC"}</b><small>{mode === "jit" ? "USDC → EURC" : title}</small><div className="fx-request-clock">{mode === "jit" ? "00:08" : "LIVE"}</div></div>
      <div className="fx-provider-terminal">
        <div className="fx-terminal-top"><div><span>{mode === "jit" ? "FIRM QUOTES" : mode === "inventory" ? "AVAILABLE CAPACITY" : "RESTING INSTITUTIONAL ORDERS"}</span><b>{title}</b></div><div className="fx-terminal-state">NORMALISED</div></div>
        <div className="fx-provider-table"><div className="head"><span>PROVIDER</span><span>PRICE</span><span>CAPACITY</span><span>{mode === "jit" ? "EXPIRES" : "STATE"}</span></div>{data.map(([provider,price,capacity,state,selected])=><div className={selected?"quote-row selected":"quote-row"} key={provider}><span><i/>{provider}</span><b>{price}</b><strong>{capacity}</strong><em>{state}</em></div>)}</div>
        <div className="fx-provider-summary"><div><span>SELECTED</span><b>{mode === "jit" ? "Issuer A + Bank B" : "Issuer A + LP C"}</b></div><div><span>RESERVED CAPACITY</span><b>{mode === "jit" ? "$4.0m" : "$3.5m"}</b></div></div>
      </div>
      <div className="fx-provider-caption">SAME ROUTER · DIFFERENT PROVIDER LIFECYCLES · RESERVE ONLY WHAT IS SELECTED</div>
    </div>
  </section>;
}

export function FiatEdgeGraphic() {
  const [mode,setMode]=useState<"managed"|"peer"|"issuer">("peer");
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>FIAT AT THE EDGES</Label><h2>Change the way money gets on-chain without changing the FX market.</h2><p>Managed ramps, direct issuers and verified P2P routes create different fiat edges. Stablecoin-to-stablecoin FX skips those edges entirely.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="managed"?"active":""} onClick={()=>setMode("managed")}>Managed provider</button><button className={mode==="peer"?"active":""} onClick={()=>setMode("peer")}>Verified P2P</button><button className={mode==="issuer"?"active":""} onClick={()=>setMode("issuer")}>Direct issuer</button></div>
    <div className="fx-stage fx-fiat-stage">
      <div className="fx-fiat-start"><span>CUSTOMER</span><b>R$500,000</b><small>BRL</small></div>
      <div className="fx-fiat-track"><i/><b>1</b><i/><b>2</b><i/><b>3</b><i/></div>
      {mode === "peer" ? <div className="fx-edge-workbench peer"><div className="fx-edge-head"><span>VERIFIED P2P</span><b>Fiat payment → escrow release</b></div><div className="fx-peer-flow"><div><span>BUYER</span><b>R$500,000</b><small>pays seller</small></div><div className="fx-payment-proof"><span>PAYMENT</span><b>✓ VERIFIED</b><small>proof accepted</small></div><div className="fx-escrow"><span>ESCROW</span><b>91,820 USDC</b><small>released on proof</small></div></div></div> : mode === "managed" ? <div className="fx-edge-workbench managed"><div className="fx-edge-head"><span>MANAGED PROVIDER</span><b>Payment instruction → provider confirmation</b></div><div className="fx-managed-flow"><div><span>PAYMENT INSTRUCTION</span><b>PIX</b><small>reference 827401</small></div><div><span>STATUS</span><b className="ok-text">CONFIRMED</b><small>provider attested</small></div><div><span>RELEASE</span><b>91,740 USDC</b><small>to customer wallet</small></div></div></div> : <div className="fx-edge-workbench issuer"><div className="fx-edge-head"><span>DIRECT ISSUER</span><b>Fiat received → stablecoin minted</b></div><div className="fx-issued-flow"><div><span>FIAT RECEIVED</span><b>R$500,000</b><small>issuer account</small></div><div className="fx-mint-icon">+</div><div><span>MINTED</span><b>BRL stablecoin</b><small>issuer supply</small></div></div></div>}
      <div className="fx-token-balance"><span>STABLECOIN BALANCE</span><b>{mode === "issuer" ? "BRL stablecoin" : "USDC"}</b><small>ready for FX</small></div>
      <div className="fx-fx-market"><span>YOUR FX MARKET</span><b>{mode === "issuer" ? "BRL stablecoin → EURC" : "USDC → EURC"}</b><div className="fx-market-spark"><i/><i/><i/><i/><i/></div><small>own market + connected routes</small></div>
      <div className="fx-fiat-end"><span>REDEEM / PAYOUT</span><b>EUR</b><small>provider-specific</small></div>
      <div className="fx-no-edge"><span>NO FIAT EDGE</span><b>USDT → EURC</b><small>enters the FX market directly</small></div>
    </div>
  </section>;
}

const MODELS = [
  {id:"external",title:"External-first",sub:"Launch with ramps, LPs and external routes. Add your own market later.",own:18,firm:42,external:92,foot:"Fast launch. Most execution remains external."},
  {id:"hybrid",title:"Hybrid",sub:"Your market handles natural flow. Institutions and venues extend depth.",own:66,firm:70,external:44,foot:"Internal flow first. Connected firms extend the market."},
  {id:"own",title:"Own-market",sub:"Customer flow, private orders and treasury do most of the work.",own:94,firm:35,external:18,foot:"The institution internalises more of the economics."},
  {id:"issuer",title:"Issuer-led",sub:"Issuer inventory and mint/redeem rails sit beside market-maker partners.",own:48,firm:90,external:24,foot:"Issuer capacity anchors the market; makers add depth."},
] as const;

export function DeploymentBlueprints() {
  const [idx,setIdx]=useState(1); const m=MODELS[idx];
  return <section className="fxp-section fx-visual-section">
    <div className="fxp-section-head"><div><Label>ONE STACK · DIFFERENT BUSINESSES</Label><h2>Choose how much of the market you want to operate.</h2><p>A new fintech can start external-first. A bank can use treasury and JIT relationships. An issuer can centre the market around its own inventory. The underlying interface stays the same.</p></div></div>
    <div className="fx-diagram-tabs">{MODELS.map((x,i)=><button key={x.id} className={i===idx?"active":""} onClick={()=>setIdx(i)}>{x.title}</button>)}</div>
    <div className="fx-stage fx-blueprint-stage">
      <div className="fx-blueprint-copy"><span>{m.title.toUpperCase()}</span><h3>{m.sub}</h3><p>{m.foot}</p></div>
      <div className="fx-blueprint-map">
        <div className="fx-blueprint-customer"><span>CUSTOMER FLOW</span><b>USD → EUR</b></div>
        <div className="fx-blueprint-engine"><span>YOUR FX STACK</span><b>same interface</b><small>policy · pricing · routing · execution</small></div>
        <div className="fx-blueprint-result"><span>RESULT</span><b>EUR</b><small>settled</small></div>
        <div className="fx-blueprint-meter own"><div><span>OWN MARKET</span><b>{m.own}%</b></div><i><em style={{width:`${m.own}%`}}/></i><small>customer flow · private orders · treasury</small></div>
        <div className="fx-blueprint-meter firm"><div><span>CONNECTED FIRMS</span><b>{m.firm}%</b></div><i><em style={{width:`${m.firm}%`}}/></i><small>issuer · bank · LP · JIT</small></div>
        <div className="fx-blueprint-meter external"><div><span>EXTERNAL ROUTES</span><b>{m.external}%</b></div><i><em style={{width:`${m.external}%`}}/></i><small>venues · aggregators · ramps</small></div>
      </div>
    </div>
  </section>;
}
