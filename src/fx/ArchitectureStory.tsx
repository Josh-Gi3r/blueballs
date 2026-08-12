import { useState } from "react";
import { Label } from "./Primitives";

const Dot = ({kind="own"}:{kind?:"own"|"firm"|"treasury"|"external"}) => <i className={`fxn-dot ${kind}`} />;

export function ProductExchangeVisual(){
  return <div className="fxn-hero-machine">
    <div className="fxn-phone fxn-phone-customer">
      <div className="fxn-phone-bar"><span>9:41</span><span>● ● ●</span></div>
      <span className="fxn-eyebrow">EXCHANGE</span>
      <div className="fxn-money"><small>You send</small><b>$10,000.00</b><span>USD</span></div>
      <div className="fxn-swap">↓</div>
      <div className="fxn-money receive"><small>You receive</small><b>€9,238.40</b><span>EUR</span></div>
      <div className="fxn-rate"><span>Rate</span><b>1 USD = 0.92384 EUR</b></div>
      <button>Review exchange</button>
    </div>
    <div className="fxn-hero-path"><span>quote</span><i/><span>execute</span><i/><span>settle</span></div>
    <div className="fxn-hero-core">
      <div className="fxn-core-title"><span>BLUEBALLS FX</span><b>Your market behind the exchange</b></div>
      <div className="fxn-core-row"><Dot/><div><b>Private market</b><small>customer and maker orders</small></div><strong>$165k</strong></div>
      <div className="fxn-core-row"><Dot kind="firm"/><div><b>Connected firms</b><small>issuer · bank · LP</small></div><strong>$50k</strong></div>
      <div className="fxn-core-row"><Dot kind="treasury"/><div><b>Treasury</b><small>within your limits</small></div><strong>$25k</strong></div>
      <div className="fxn-core-row"><Dot kind="external"/><div><b>External route</b><small>when you still need more</small></div><strong>$10k</strong></div>
      <div className="fxn-core-settle"><span>SELECTED ROUTE</span><b>4 fills · one token settlement</b></div>
    </div>
  </div>;
}

export function CustomerAndMaker(){
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>THE MARKET</Label><h2>Customers can exchange. They can also make the market.</h2><p>A verified user or business can place an order instead of only taking the price on screen. Professional makers, issuers and your treasury can join the same private market.</p></div></div>
    <div className="fxn-stage fxn-two-phones">
      <div className="fxn-phone">
        <div className="fxn-phone-bar"><span>9:41</span><span>● ● ●</span></div><span className="fxn-eyebrow">EXCHANGE</span>
        <div className="fxn-money"><small>You send</small><b>$5,000</b><span>USDC</span></div><div className="fxn-swap">↓</div><div className="fxn-money receive"><small>You receive</small><b>€4,619</b><span>EURC</span></div><button>Exchange</button>
      </div>
      <div className="fxn-market-link"><span>TAKES FX</span><i>⇄</i><span>MAKES FX</span></div>
      <div className="fxn-phone maker">
        <div className="fxn-phone-bar"><span>9:41</span><span>● ● ●</span></div><span className="fxn-eyebrow">PROVIDE LIQUIDITY</span>
        <div className="fxn-pair"><b>USDC / EURC</b><small>Private order</small></div>
        <div className="fxn-maker-field"><span>I will sell</span><b>25,000 EURC</b></div><div className="fxn-maker-field"><span>At</span><b>1 EURC = 1.0826 USDC</b></div><div className="fxn-maker-status"><Dot/><span>Open until filled or cancelled</span></div><button>Place order</button>
      </div>
      <div className="fxn-market-center"><span>YOUR PRIVATE FX MARKET</span><b>Orders meet here.</b><div className="fxn-book-mini"><p><em>25k</em><strong>1.0826</strong></p><p><em>80k</em><strong>1.0828</strong></p><p><em>50k</em><strong>1.0831</strong></p></div><small>Private identities · signed orders · partial fills</small></div>
    </div>
  </section>;
}

export function PrivateSettlement(){
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>PRIVATE MARKET · ON-CHAIN SETTLEMENT</Label><h2>Keep the dealing private. Put the exchange on-chain.</h2><p>Orders, customer identity, matching and risk stay off-chain. The selected token fills are authorised and settled on-chain, where the money actually changes hands.</p></div></div>
    <div className="fxn-stage fxn-boundary">
      <div className="fxn-boundary-side private"><span>OFF-CHAIN</span><b>Private market</b><div><p>Customer and maker identity</p><p>Orders and market depth</p><p>Pricing and matching</p><p>Limits and approvals</p><p>Reservations</p></div><small>Visible to the institution, not published to the world.</small></div>
      <div className="fxn-boundary-arrow"><span>selected fills</span><i>→</i><small>cryptographic authority</small></div>
      <div className="fxn-boundary-side chain"><span>ON-CHAIN</span><b>Settlement kernel</b><div><p>Maker signatures</p><p>Taker bounds</p><p>Cancellation + replay protection</p><p>Vault accounting</p><p>Atomic multi-maker settlement</p></div><small>If one selected token fill fails, the route does not half-settle.</small></div>
    </div>
  </section>;
}

export function OneTradeManyWays(){
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>ONE EXCHANGE</Label><h2>Use what is already in your market. Ask for the rest.</h2><p>A customer sees one quote. Underneath, the amount can be filled by your own market, a firm quote from a connected institution, treasury capacity or an outside venue.</p></div></div>
    <div className="fxn-stage fxn-route">
      <div className="fxn-trade"><span>CUSTOMER EXCHANGE</span><b>$250,000</b><small>USD → EUR</small></div>
      <div className="fxn-route-line"/>
      <div className="fxn-route-sources">
        <div><Dot/><span>PRIVATE MARKET</span><b>$165,000</b><small>customers + makers</small></div>
        <div><Dot kind="firm"/><span>FIRM QUOTE</span><b>$50,000</b><small>issuer / bank / LP</small></div>
        <div><Dot kind="treasury"/><span>TREASURY</span><b>$25,000</b><small>inside your limit</small></div>
        <div><Dot kind="external"/><span>OUTSIDE ROUTE</span><b>$10,000</b><small>only what is missing</small></div>
      </div>
      <div className="fxn-route-total"><span>RESERVED FOR THIS QUOTE</span><b>$250,000</b><small>then submitted as the selected route</small></div>
    </div>
  </section>;
}

export function ProviderParticipation(){
  const [mode,setMode]=useState<"orders"|"inventory"|"rfq">("rfq");
  const copy={orders:{k:"RESTING ORDERS",h:"Leave a signed price in the market.",s:"The order stays private until it fills, expires or is cancelled."},inventory:{k:"AVAILABLE INVENTORY",h:"Expose capacity without posting a normal order.",s:"Blueballs can read the amount and terms your adapter makes available."},rfq:{k:"JIT / RFQ",h:"Ask for a firm price only when a trade arrives.",s:"The firm can quote the exact amount for a few seconds and reserve only if selected."}}[mode];
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>CONNECTED FIRMS</Label><h2>A bank or issuer does not have to leave money sitting in the book.</h2><p>Different firms can participate in different ways. Blueballs turns those different forms of capacity into something the same exchange flow can use.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="orders"?"active":""} onClick={()=>setMode("orders")}>Resting orders</button><button className={mode==="inventory"?"active":""} onClick={()=>setMode("inventory")}>Available inventory</button><button className={mode==="rfq"?"active":""} onClick={()=>setMode("rfq")}>JIT / RFQ</button></div>
    <div className="fxn-stage fxn-provider">
      <div className="fxn-provider-intro"><span>{copy.k}</span><b>{copy.h}</b><p>{copy.s}</p></div>
      <div className="fxn-provider-request"><span>{mode==="rfq"?"REQUEST":"MARKET"}</span><b>{mode==="rfq"?"$4,000,000 USD → EUR":"USDC / EURC"}</b><small>{mode==="rfq"?"quote valid for 8 seconds":"private executable capacity"}</small></div>
      <div className="fxn-provider-table"><div className="head"><span>FIRM</span><span>PRICE</span><span>CAPACITY</span><span>STATE</span></div><div className="row selected"><span><Dot kind="firm"/>Issuer A</span><b>0.9235</b><strong>$2.0m</strong><em>{mode==="rfq"?"6s":"ready"}</em></div><div className="row selected"><span><Dot kind="firm"/>Bank B</span><b>0.9236</b><strong>$5.0m</strong><em>{mode==="rfq"?"8s":"ready"}</em></div><div className="row"><span><Dot kind="firm"/>LP C</span><b>0.9238</b><strong>$3.0m</strong><em>{mode==="rfq"?"4s":"ready"}</em></div><div className="summary"><span>SELECTED</span><b>Issuer A + Bank B</b></div></div>
    </div>
  </section>;
}

export function FiatModels(){
  const [mode,setMode]=useState<"provider"|"customers"|"peer">("customers");
  const data={provider:{label:"MANAGED PROVIDER",title:"Use a provider for the fiat leg.",body:"The provider handles the bank-side movement and gives your system the stablecoin balance or settlement evidence it needs.",left:"CUSTOMER BANK",middle:"RAMP PROVIDER",note:"provider compliance perimeter"},customers:{label:"YOUR CUSTOMERS",title:"Your own verified users can be the other side.",body:"When both parties are already customers, their identity, accounts and transaction history stay inside the institution's normal controls.",left:"CUSTOMER A",middle:"CUSTOMER B",note:"inside your customer perimeter"},peer:{label:"OPEN P2P",title:"A more open neobank can use external peers.",body:"A Peer-style route can prove an external fiat payment and release crypto without the counterparty being one of your own customers.",left:"FIAT PAYER",middle:"EXTERNAL PEER",note:"outside your customer perimeter"}}[mode];
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>FIAT IN · FIAT OUT</Label><h2>Fiat stays at the edges.</h2><p>The FX market in the middle does not have to change because you use a different way to get money on or off-chain.</p></div></div>
    <div className="fx-diagram-tabs"><button className={mode==="provider"?"active":""} onClick={()=>setMode("provider")}>Managed provider</button><button className={mode==="customers"?"active":""} onClick={()=>setMode("customers")}>Your customers</button><button className={mode==="peer"?"active":""} onClick={()=>setMode("peer")}>Open P2P</button></div>
    <div className="fxn-stage fxn-fiat">
      <div className="fxn-fiat-copy"><span>{data.label}</span><b>{data.title}</b><p>{data.body}</p><small>{data.note}</small></div>
      <div className="fxn-fiat-flow"><div><span>{data.left}</span><b>R$ 50,000</b><small>fiat</small></div><i>→</i><div><span>{data.middle}</span><b>{mode==="peer"?"payment proof":mode==="customers"?"account transfer":"settlement confirmation"}</b><small>{mode==="peer"?"external evidence":mode==="customers"?"known accounts":"provider evidence"}</small></div><i>→</i><div className="token"><span>STABLECOIN</span><b>USDC</b><small>ready for FX</small></div><i>→</i><div className="core"><span>BLUEBALLS FX</span><b>USDC → EURC</b><small>same market</small></div></div>
      <div className="fxn-fiat-direct"><span>Already holding a stablecoin?</span><b>Enter the FX market directly. No fiat leg.</b></div>
    </div>
  </section>;
}

export function TreasuryGraphic(){
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>TREASURY</Label><h2>Your balance sheet can quote too. Up to the limit you set.</h2><p>Treasury can improve execution when the institution already holds the currency. Reserved and existing exposure count against the same ceiling.</p></div></div>
    <div className="fxn-stage fxn-treasury">
      <div className="fxn-limit"><span>EUR PRINCIPAL LIMIT</span><b>€5.0m</b><div className="fxn-meter"><i className="used"/><i className="reserved"/></div><div className="fxn-legend"><span>€3.2m current</span><span>€1.2m reserved</span><span>€0.6m free</span></div></div>
      <div className="fxn-next-trade"><span>NEW EXCHANGE</span><b>€1.0m</b><small>customer needs EUR</small></div><div className="fxn-split-arrow">→</div>
      <div className="fxn-treasury-answer"><div><span>TREASURY</span><b>€0.6m</b><small>remaining capacity</small></div><div><span>OTHER LIQUIDITY</span><b>€0.4m</b><small>route the remainder</small></div></div>
      <div className="fxn-rule"><b>Reserved capacity is already spoken for.</b><span>It cannot be promised to a second quote.</span></div>
    </div>
  </section>;
}

export function FinalityGraphic(){
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>SETTLEMENT</Label><h2>Only the token exchange is atomic.</h2><p>A bank payment, an on-chain exchange and a bank payout do not become the same kind of settlement just because they are part of one customer journey.</p></div></div>
    <div className="fxn-stage fxn-finality">
      <div className="fxn-leg"><span>1 · FIAT IN</span><b>BRL payment</b><small>bank / provider / peer</small><em>external finality</em></div><i>→</i><div className="fxn-leg atomic"><span>2 · TOKEN FX</span><b>USDC → EURC</b><small>selected fills settle together</small><em>atomic</em></div><i>→</i><div className="fxn-leg"><span>3 · FIAT OUT</span><b>EUR payout</b><small>issuer / bank rail</small><em>external finality</em></div>
      <div className="fxn-finality-status"><div><Dot kind="firm"/><span>BRL payment</span><b>confirmed</b></div><div><Dot/><span>token FX</span><b>settled</b></div><div><Dot kind="external"/><span>EUR payout</span><b>processing</b></div></div>
    </div>
  </section>;
}

const models=[
  {id:"start",name:"Start",title:"Use providers first.",body:"Launch the exchange experience before you have a deep market of your own.",own:12,firm:74,external:88},
  {id:"grow",name:"Grow",title:"Add your own flow.",body:"Customer orders, makers and treasury start filling more of each exchange.",own:58,firm:66,external:44},
  {id:"own",name:"Own",title:"Make your market primary.",body:"Outside firms and venues become extra capacity rather than the whole product.",own:100,firm:48,external:18},
] as const;
export function DeploymentBlueprints(){
  const [id,setId]=useState<(typeof models)[number]["id"]>("grow"); const m=models.find(x=>x.id===id)!;
  return <section className="fxp-section fxn-section">
    <div className="fxp-section-head"><div><Label>START · GROW · OWN</Label><h2>You can own more of the FX over time.</h2><p>The customer integration can stay the same while the market underneath changes.</p></div></div>
    <div className="fx-diagram-tabs">{models.map(x=><button key={x.id} className={id===x.id?"active":""} onClick={()=>setId(x.id)}>{x.name}</button>)}</div>
    <div className="fxn-stage fxn-deploy"><div className="fxn-deploy-copy"><span>{m.name.toUpperCase()}</span><b>{m.title}</b><p>{m.body}</p></div><div className="fxn-bars"><p><span><Dot/>YOUR MARKET</span><i><em style={{width:`${m.own}%`}}/></i></p><p><span><Dot kind="firm"/>CONNECTED FIRMS</span><i><em style={{width:`${m.firm}%`}}/></i></p><p><span><Dot kind="external"/>EXTERNAL ROUTES</span><i><em style={{width:`${m.external}%`}}/></i></p></div><div className="fxn-deploy-constant"><span>SAME CUSTOMER FLOW</span><b>quote → review → exchange → receipt</b></div></div>
  </section>;
}

/* Backwards-compatible exports used by older page revisions. */
export const MasterArchitecture = PrivateSettlement;
export const OwnMarketGraphic = CustomerAndMaker;
export const LiquidityGraphic = OneTradeManyWays;
export const ComplianceModelGraphic = FiatModels;
export const FiatEdgeGraphic = FiatModels;
