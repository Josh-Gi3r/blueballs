import { useMemo, useState } from "react";
import { Label, Pill } from "./Primitives";

const MAJOR_FLOWS = [
  ["USD", "EUR", "$100,000", "€92,340"],
  ["BRL", "USD", "R$500,000", "$91,820"],
  ["USDT", "EURC", "100,000 USDT", "92,410 EURC"],
] as const;

export function HeroExchangePhone() {
  const [index, setIndex] = useState(0);
  const [from, to, pay, receive] = MAJOR_FLOWS[index];
  return <div className="fxp-product-phone"><div className="fxp-product-phone-inner">
    <div className="fxp-product-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div>
    <div className="fxp-product-head"><div><span>EXCHANGE</span><h3>{from} → {to}</h3></div><Pill>REFERENCE UI</Pill></div>
    <div className="fxp-product-box"><span>You pay</span><strong>{pay}</strong><b>{from}</b></div>
    <div className="fxp-product-swap">↓</div>
    <div className="fxp-product-box receive"><span>You receive</span><strong>{receive}</strong><b>{to}</b></div>
    <div className="fxp-product-summary"><div><span>Route</span><b>Found</b></div><div><span>Quote</span><b>Ready to review</b></div></div>
    <button type="button" className="fxp-product-primary">Review exchange</button>
    <div className="fxp-product-switcher">{MAJOR_FLOWS.map((item, itemIndex)=><button type="button" key={`${item[0]}-${item[1]}`} onClick={()=>setIndex(itemIndex)} className={index===itemIndex?"active":""}>{item[0]} → {item[1]}</button>)}</div>
    <p>Illustrative interface. The connected reference runtime is shown further down the page.</p>
  </div></div>;
}

export function InfrastructureFlow() {
  return <section className="fxp-section fxp-flow-section"><div className="fxp-section-head"><div><Label>THE FLOW</Label><h2>One exchange. The infrastructure underneath.</h2><p>A customer sees a quote and an exchange. The stack behind it can check policy, use your own market, connect to outside providers, reserve the route and keep settlement state explicit.</p></div></div>
    <div className="fxp-infra-flow">
      <div className="fxp-flow-node customer"><span>01</span><b>FX request</b><small>USD → EUR</small></div>
      <div className="fxp-flow-arrow">→</div>
      <div className="fxp-flow-core"><Label>YOUR FX STACK</Label><div className="fxp-core-grid"><span>Policy</span><span>Market</span><span>Pricing</span><span>Routing</span><span>Reservations</span><span>Execution</span><span>Settlement state</span><span>Reconciliation</span></div></div>
      <div className="fxp-flow-arrow">→</div>
      <div className="fxp-flow-node customer"><span>03</span><b>Customer receives</b><small>EUR</small></div>
    </div>
    <div className="fxp-flow-sources"><div><span>02 · AVAILABLE PATHS</span><strong>Your market</strong><small>Customer and business orders, market makers, treasury.</small></div><div><span>CONNECTED</span><strong>Institutions</strong><small>Issuers, banks and LPs can place orders or answer firm requests.</small></div><div><span>OPTIONAL</span><strong>External routes</strong><small>Use venue and routing adapters when they improve the executable path.</small></div></div>
  </section>;
}

export function PrivateMarketGraphic() {
  return <section className="fxp-section fxp-market-story"><div className="fxp-story-copy"><Label>YOUR MARKET</Label><h2>Run the market inside your product.</h2><p>Verified customers, businesses and professional participants can place FX orders. Your treasury can participate too. The market stays private to the institution instead of publishing every participant and order on-chain.</p><div className="fxp-story-points"><span>Signed orders</span><span>Private matching</span><span>Partial fills</span><span>Cancellation</span><span>Policy before execution</span></div></div>
    <div className="fxp-orderbook-graphic"><div className="fxp-orderbook-head"><span>USDC / EURC</span><b>PRIVATE MARKET</b></div><div className="fxp-book-cols"><div><small>SELL EURC</small><p><span>Customer</span><b>25k</b><em>0.9239</em></p><p><span>Business</span><b>80k</b><em>0.9241</em></p><p><span>Market maker</span><b>250k</b><em>0.9243</em></p></div><div><small>BUY EURC</small><p><span>Customer</span><b>18k</b><em>0.9235</em></p><p><span>Treasury</span><b>150k</b><em>0.9232</em></p><p><span>Market maker</span><b>300k</b><em>0.9230</em></p></div></div><div className="fxp-book-foot"><span>AGGREGATED DEPTH OUTSIDE</span><span>ORDER DETAIL PRIVATE</span></div></div>
  </section>;
}

export function LiquidityProviderPhone() {
  const [view, setView] = useState<"create"|"orders"|"earnings">("create");
  return <section className="fxp-section fxp-provider-section"><div className="fxp-section-head"><div><Label>ANOTHER SIDE OF THE MARKET</Label><h2>Let approved users place FX orders.</h2><p>The same product can expose a simple experience for customers or businesses that want to make a market. Earnings come from fills, not from a token reward schedule.</p></div></div><div className="fxp-provider-layout"><div className="fxp-mini-phone"><div className="fxp-mini-phone-inner"><div className="fxp-mini-tabs">{(["create","orders","earnings"] as const).map((item)=><button type="button" key={item} onClick={()=>setView(item)} className={view===item?"active":""}>{item}</button>)}</div>{view==="create"?<><Label>PROVIDE LIQUIDITY</Label><h3>USDC / EURC</h3><div className="fxp-mini-field"><span>I provide</span><strong>50,000 USDC</strong></div><div className="fxp-mini-field"><span>Minimum price</span><strong>0.9238 EURC</strong></div><div className="fxp-mini-field"><span>Duration</span><strong>Good until cancelled</strong></div><button type="button">Place order</button></>:view==="orders"?<><Label>OPEN ORDERS</Label><h3>3 active</h3><div className="fxp-mini-row"><span>USDC / EURC</span><b>50k · 32% filled</b></div><div className="fxp-mini-row"><span>USDT / EURC</span><b>25k · open</b></div><div className="fxp-mini-row"><span>USDC / USDT</span><b>75k · open</b></div><button type="button">Manage orders</button></>:<><Label>EARNINGS</Label><h3>From completed fills</h3><div className="fxp-mini-earn"><span>Filled volume</span><strong>$184,250</strong></div><div className="fxp-mini-earn"><span>Spread earned</span><strong>$126.40</strong></div><div className="fxp-mini-earn"><span>Open liquidity</span><strong>$118,000</strong></div><button type="button">View fills</button></>}</div></div><div className="fxp-provider-copy"><div><span>01</span><b>Choose a market</b><p>Offer one side of a supported stablecoin pair.</p></div><div><span>02</span><b>Set the terms</b><p>Price, size and validity remain explicit.</p></div><div><span>03</span><b>Fill against real flow</b><p>Orders can fill partially and remain open until completed, cancelled or expired.</p></div></div></div></section>;
}

const MODEL_DATA = [
  { id:"own", title:"Own market first", copy:"Customer and business orders do most of the work. Connect outside firms when a corridor needs more depth.", bars:[72,34,18] },
  { id:"institutional", title:"Institutional", copy:"Professional makers, issuers and treasury provide most of the executable market.", bars:[22,76,30] },
  { id:"hybrid", title:"Hybrid", copy:"Your private market, firm institutional quotes and external routes all participate.", bars:[54,58,28] },
  { id:"external", title:"External-first", copy:"Start with connected providers and grow your own market as customer flow develops.", bars:[18,42,80] },
] as const;

export function DeploymentModels() {
  const [selected,setSelected]=useState(0); const model=MODEL_DATA[selected];
  return <section className="fxp-section fxp-models"><div className="fxp-section-head"><div><Label>DIFFERENT MODELS</Label><h2>Use the parts that fit your product.</h2><p>The infrastructure does not require one market structure. A new product can begin with external firms. Another can run mostly on its own customer flow and treasury.</p></div></div><div className="fxp-model-tabs">{MODEL_DATA.map((item,index)=><button type="button" key={item.id} className={selected===index?"active":""} onClick={()=>setSelected(index)}>{item.title}</button>)}</div><div className="fxp-model-graphic"><div><Label>{model.title.toUpperCase()}</Label><h3>{model.copy}</h3></div><div className="fxp-model-bars"><div><span>Own market</span><i><b style={{width:`${model.bars[0]}%`}}/></i></div><div><span>Institutions</span><i><b style={{width:`${model.bars[1]}%`}}/></i></div><div><span>External routes</span><i><b style={{width:`${model.bars[2]}%`}}/></i></div></div></div></section>;
}

export function InstitutionalFlow() {
  return <section className="fxp-section fxp-jit"><div className="fxp-section-head"><div><Label>CONNECTED INSTITUTIONS</Label><h2>Orders when they want them. Firm quotes when they do not.</h2><p>An issuer, bank or market maker can leave orders in the market, expose available inventory, or answer a short-lived request for the amount that is needed.</p></div></div><div className="fxp-jit-graphic"><div className="fxp-jit-request"><span>REQUEST</span><b>$4m USDC → EURC</b><small>Additional executable amount required</small></div><div className="fxp-jit-lines"><i/><i/><i/></div><div className="fxp-jit-quotes"><div><span>ISSUER</span><b>$2m</b><small>firm · 6s</small></div><div><span>BANK</span><b>$5m</b><small>firm · 8s</small></div><div><span>LP</span><b>$3m</b><small>firm · 4s</small></div></div><div className="fxp-jit-result"><span>COMBINE WITH YOUR MARKET</span><b>Reserve only the selected route.</b></div></div></section>;
}

export function FiatEdges() {
  return <section className="fxp-section fxp-fiat"><div className="fxp-section-head"><div><Label>FIAT AND STABLECOINS</Label><h2>Keep the rails at the edges.</h2><p>Fiat does not have to become part of the FX engine itself. Connect a ramp, issuer or verified payment provider before or after the token FX leg. If both sides are already stablecoins, those steps disappear.</p></div></div><div className="fxp-fiat-routes"><div><span>FIAT → FIAT</span><div className="fxp-route-line"><b>BRL</b><i>ramp</i><b>USDC</b><i>FX</i><b>EURC</b><i>redeem</i><b>EUR</b></div><small>Ramp and redemption are provider integrations.</small></div><div><span>STABLECOIN → STABLECOIN</span><div className="fxp-route-line short"><b>USDT</b><i>FX</i><b>EURC</b></div><small>No banking rail is required inside this route.</small></div></div></section>;
}

export function ExecutionStack() {
  const items=useMemo(()=>["Policy","Executable market","Price and route","Reserve","Submit","Settlement evidence","Reconcile"],[]);
  return <section className="fxp-section fxp-execution"><div className="fxp-section-head"><div><Label>EXECUTION</Label><h2>Keep each state explicit.</h2><p>A quote is not a fill. Submission is not settlement. Token swaps, fiat payments and issuer redemptions can have different finality, so the infrastructure keeps those boundaries visible.</p></div></div><div className="fxp-execution-steps">{items.map((item,index)=><div key={item}><span>{String(index+1).padStart(2,"0")}</span><b>{item}</b></div>)}</div><div className="fxp-finality-row"><div><span>TOKEN SWAP</span><b>Atomic when executed in one router transaction</b></div><div><span>FIAT PAYMENT</span><b>External evidence</b></div><div><span>ISSUER REDEMPTION</span><b>External / asynchronous</b></div></div></section>;
}
