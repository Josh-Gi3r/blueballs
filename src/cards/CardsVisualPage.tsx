import { useMemo, useState, type ChangeEvent } from "react";
import { CARD_PROGRAMS, type CardProgram, type CustodyModel } from "./data";
import "./cards-visual-page.css";

type Props = { onNavigate: (path: string) => void };
type Filter = "all" | CustodyModel | "Visa" | "Mastercard" | "Consumer" | "Business" | "legacy";
type BuilderNetwork = "Visa" | "Mastercard";
type BuilderFunding = "USDC" | "USDT" | "Fiat" | "Multi-asset";
type BuilderCustody = "Self-custodial" | "Custodial" | "Hybrid";
type BuilderModel = "Pre-funded" | "JIT spend" | "Collateralised" | "Earn until spend";
type BuilderTone = "Blueballs navy" | "Midnight" | "Silver" | "Electric blue";
type Brand = { domain?: string; name?: string; bg: string; fg: string; accent: string };

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All current" }, { id: "Self-custodial", label: "Self-custody" }, { id: "Custodial", label: "Custodial" },
  { id: "Hybrid", label: "Hybrid" }, { id: "Visa", label: "Visa" }, { id: "Mastercard", label: "Mastercard" },
  { id: "Consumer", label: "Consumer" }, { id: "Business", label: "Business" }, { id: "legacy", label: "Legacy" },
];

const BRANDS: Record<string, Brand> = {
  metamask:{domain:"metamask.io",name:"MetaMask",bg:"linear-gradient(145deg,#121212,#2b2119)",fg:"#fff",accent:"#f6851b"},
  "gnosis-pay":{domain:"gnosispay.com",name:"Gnosis Pay",bg:"linear-gradient(145deg,#0d463d,#13917f)",fg:"#fff",accent:"#9ce8d1"},
  kast:{domain:"kast.xyz",name:"KAST",bg:"linear-gradient(145deg,#16102f,#492d87)",fg:"#fff",accent:"#c7b6ff"},
  etherfi:{domain:"ether.fi",name:"ether.fi",bg:"linear-gradient(145deg,#130d28,#4a277d)",fg:"#fff",accent:"#a779ff"},
  plasma:{domain:"plasma.to",name:"Plasma",bg:"linear-gradient(145deg,#080808,#242424)",fg:"#fff",accent:"#e5ff52"},
  avalanche:{domain:"avax.network",name:"Avalanche",bg:"linear-gradient(145deg,#e84142,#ff696a)",fg:"#fff",accent:"#ffd1d1"},
  safepal:{domain:"safepal.com",name:"SafePal",bg:"linear-gradient(145deg,#111317,#252a32)",fg:"#fff",accent:"#4aa7ff"},
  solflare:{domain:"solflare.com",name:"Solflare",bg:"linear-gradient(145deg,#161922,#242938)",fg:"#fff",accent:"#ff9e32"},
  nexo:{domain:"nexo.com",name:"Nexo",bg:"linear-gradient(145deg,#073fce,#0a68f0)",fg:"#fff",accent:"#8ed1ff"},
  redotpay:{domain:"redotpay.com",name:"RedotPay",bg:"linear-gradient(145deg,#111,#292929)",fg:"#fff",accent:"#ff3b30"},
  minipay:{domain:"minipay.to",name:"MiniPay",bg:"linear-gradient(145deg,#2346d8,#516cff)",fg:"#fff",accent:"#75efaa"},
  "crypto-com":{domain:"crypto.com",name:"Crypto.com",bg:"linear-gradient(145deg,#061a38,#123a73)",fg:"#fff",accent:"#2d73ff"},
  okx:{domain:"okx.com",name:"OKX",bg:"linear-gradient(145deg,#050505,#202020)",fg:"#fff",accent:"#fff"},
  bybit:{domain:"bybit.com",name:"Bybit",bg:"linear-gradient(145deg,#161616,#2b2b2b)",fg:"#fff",accent:"#f7a600"},
  brighty:{domain:"brighty.app",name:"Brighty",bg:"linear-gradient(145deg,#ff477e,#ff87ab)",fg:"#fff",accent:"#ffe0ea"},
  "bitget-wallet":{domain:"web3.bitget.com",name:"Bitget Wallet",bg:"linear-gradient(145deg,#03aebe,#27d1df)",fg:"#04282c",accent:"#d7ffff"},
  "wirex-one":{domain:"wirexapp.com",name:"Wirex",bg:"linear-gradient(145deg,#5c16e8,#9964ff)",fg:"#fff",accent:"#d8c5ff"},
  "ledger-cl":{domain:"ledger.com",name:"Ledger",bg:"linear-gradient(145deg,#111,#2d2d2d)",fg:"#fff",accent:"#fff"},
  krak:{domain:"kraken.com",name:"Kraken",bg:"linear-gradient(145deg,#4f2ad9,#7555ff)",fg:"#fff",accent:"#d7ccff"},
  "1inch":{domain:"1inch.io",name:"1inch",bg:"linear-gradient(145deg,#081a35,#183a68)",fg:"#fff",accent:"#ff4055"},
  tria:{domain:"tria.so",name:"Tria",bg:"linear-gradient(145deg,#121212,#242424)",fg:"#fff",accent:"#83ff70"},
  kolo:{domain:"kolo.in",name:"Kolo",bg:"linear-gradient(145deg,#101010,#292929)",fg:"#fff",accent:"#ffb020"},
  avici:{domain:"avici.money",name:"Avici",bg:"linear-gradient(145deg,#13254a,#245bc6)",fg:"#fff",accent:"#8db6ff"},
  exa:{domain:"exa.finance",name:"Exa",bg:"linear-gradient(145deg,#16131c,#322645)",fg:"#fff",accent:"#e5bbff"},
  tuyo:{domain:"tuyo.com",name:"Tuyo",bg:"linear-gradient(145deg,#0d2a26,#1e6258)",fg:"#fff",accent:"#85e0cc"},
};

const TONES: Record<BuilderTone,string> = {
  "Blueballs navy":"linear-gradient(145deg,#07144f,#12358d)", Midnight:"linear-gradient(145deg,#05070d,#1a2235)",
  Silver:"linear-gradient(145deg,#bfc5cf,#f5f7fa)", "Electric blue":"linear-gradient(145deg,#0647e8,#1887ff)"
};

const PATTERNS = [
  {name:"Wallet-native spending",desc:"Assets stay under user control until the card needs them.",ids:["metamask","solflare","minipay","gnosis-pay"],flow:["WALLET","AUTHORISATION","ISSUER","NETWORK"]},
  {name:"Stablecoin neobank",desc:"Stablecoin balances sit inside an account product with card access layered on top.",ids:["kast","brighty","plasma"],flow:["STABLECOIN","ACCOUNT","CARD PROGRAMME","NETWORK"]},
  {name:"Exchange account",desc:"A custodial trading account becomes the source of funds for everyday card spend.",ids:["okx","krak","bybit","crypto-com"],flow:["ACCOUNT ASSETS","CONVERSION","CARD BALANCE","NETWORK"]},
  {name:"Collateralised spend",desc:"The customer keeps the asset and receives spending power against it.",ids:["nexo","avalanche","exa","avici"],flow:["COLLATERAL","CREDIT LINE","AUTHORISATION","NETWORK"]},
  {name:"Wallet to regulated account",desc:"Self-custody remains the crypto entry point, then value moves into regulated card infrastructure.",ids:["safepal","ledger-cl","1inch"],flow:["WALLET","CARD ACCOUNT","ISSUER","NETWORK"]},
];

function matchesFilter(card:CardProgram,filter:Filter){if(filter==="all")return card.status!=="legacy";if(filter==="legacy")return card.status==="legacy";if(filter==="Visa"||filter==="Mastercard")return card.network.includes(filter)&&card.status!=="legacy";if(filter==="Consumer"||filter==="Business")return(card.customer===filter||card.customer==="Both")&&card.status!=="legacy";return card.custody===filter&&card.status!=="legacy"}
function fallbackBrand(card:CardProgram):Brand{const sets=[["#07144f","#173ca2","#76b7ff"],["#14261f","#2e5c49","#8ee4bb"],["#211336","#5f32a0","#d9bbff"],["#2a1b12","#744c2d","#f4c492"],["#151515","#383838","#d8d8d8"],["#102b45","#2f6f9b","#9ee0ff"]];const i=[...card.id].reduce((n,c)=>n+c.charCodeAt(0),0)%sets.length;const[a,b,accent]=sets[i];return{name:card.company,bg:`linear-gradient(145deg,${a},${b})`,fg:"#fff",accent}}
function brandFor(card:CardProgram){return BRANDS[card.id]??fallbackBrand(card)}
function BrandMark({card}: {card:CardProgram}){const brand=brandFor(card);return <span className="cv-brand-mark"><i>{(brand.name??card.company).slice(0,2).toUpperCase()}</i><b>{brand.name??card.company}</b></span>}
function NetworkMark({network}:{network:string}){if(network.includes("Mastercard"))return <span className="cv-mastercard"><i/><i/></span>;if(network.includes("Visa"))return <span className="cv-visa">VISA</span>;return <span className="cv-network-text">{network}</span>}
function CardChip(){return <span className="cv-chip"><i/><i/><i/><i/></span>}

function PaymentCard({card,compact=false}:{card:CardProgram;compact?:boolean}){const brand=brandFor(card);return <div className={`cv-payment-card ${compact?"compact":""}`} style={{background:brand.bg,color:brand.fg}}><div className="cv-card-glow"/><div className="cv-card-top"><BrandMark card={card}/><NetworkMark network={card.network}/></div><div className="cv-card-middle"><CardChip/><span className="cv-contactless">)))</span></div><div className="cv-card-bottom"><div><span>{card.physical?"PHYSICAL":"VIRTUAL"}</span><b>{card.funding[0]||"CARD"}</b></div><small style={{color:brand.accent}}>{card.model}</small></div></div>}
function BlueballsCard({network,funding,model,tone}:{network:BuilderNetwork;funding:BuilderFunding;model:BuilderModel;tone:BuilderTone}){return <div className="cv-payment-card cv-custom-card" style={{background:TONES[tone],color:tone==="Silver"?"#07144f":"#fff"}}><div className="cv-card-glow"/><div className="cv-card-top"><span className="cv-blueballs-mark"><i/><i/><i/><i/><b>Blueballs</b></span><NetworkMark network={network}/></div><div className="cv-card-middle"><CardChip/><span className="cv-contactless">)))</span></div><div className="cv-custom-bottom"><div><span>CARDHOLDER</span><b>MOTOKO KUSANAGI</b></div><div><span>FUNDING</span><b>{funding}</b><span>SPEND MODEL</span><b>{model}</b></div></div></div>}
function matchScore(card:CardProgram,network:BuilderNetwork,funding:BuilderFunding,custody:BuilderCustody,model:BuilderModel){let s=0;if(card.network.includes(network))s+=30;if(card.funding.some(v=>v.toLowerCase().includes(funding.toLowerCase().replace("multi-asset","stablecoin"))))s+=25;if(card.custody===custody)s+=25;const words=model.toLowerCase().split(/\s+/);if(words.some(w=>card.spendModel.toLowerCase().includes(w)||card.model.toLowerCase().includes(w)))s+=20;return s}

function Drawer({card,selected,onClose,onCompare}:{card:CardProgram;selected:boolean;onClose:()=>void;onCompare:()=>void}){return <div className="cv-drawer-backdrop" onMouseDown={onClose}><aside className="cv-drawer" onMouseDown={e=>e.stopPropagation()}><div className="cv-drawer-top"><PaymentCard card={card}/><button onClick={onClose}>×</button></div><div className="cv-drawer-title"><BrandMark card={card}/><h2>{card.name}</h2><p>{card.network} · {card.type} · {card.custody}</p></div><section><span>HOW IT WORKS</span><h3>{card.model}</h3><p>{card.note}</p><div className="cv-flow"><b>{card.wallets}</b><i>→</i><b>{card.spendModel}</b><i>→</i><b>{card.partners[0]||"Issuer / programme"}</b><i>→</i><b>{card.network}</b><i>→</i><b>Merchant</b></div></section><section><span>CUSTOMER OFFER</span><div className="cv-fact-grid"><div><small>Funding</small><b>{card.funding.join(" · ")}</b></div><div><small>Chains</small><b>{card.chains.join(" · ")}</b></div><div><small>Fees / FX</small><b>{card.fees}</b></div><div><small>Rewards</small><b>{card.rewards}</b></div><div><small>Markets</small><b>{card.geography}</b></div><div><small>Known stack</small><b>{card.partners.join(" → ")||"Not publicly disclosed"}</b></div></div></section><section><span>RESEARCH PROVENANCE</span><div className="cv-fact-grid"><div><small>As of</small><b>{card.asOf}</b></div><div><small>Jurisdiction</small><b>{card.jurisdiction}</b></div><div><small>Confidence</small><b>{card.confidence.toUpperCase()}</b></div><div><small>Source</small><b><a href={card.sourceUrl} target="_blank" rel="noreferrer">First-party page ↗</a></b></div></div><p className="cv-disclosure">Research only. A listing or source link does not mean Blueballs is connected to, endorsed by, or partnered with this programme.</p></section><div className="cv-drawer-actions"><button onClick={onCompare}>{selected?"Remove from comparison":"Add to comparison"}</button><button className="secondary" onClick={onClose}>Close</button></div></aside></div>}

export default function CardsVisualPage({onNavigate:_onNavigate}:Props){
  const[network,setNetwork]=useState<BuilderNetwork>("Visa"),[funding,setFunding]=useState<BuilderFunding>("USDC"),[custody,setCustody]=useState<BuilderCustody>("Self-custodial"),[model,setModel]=useState<BuilderModel>("JIT spend"),[tone,setTone]=useState<BuilderTone>("Blueballs navy"),[filter,setFilter]=useState<Filter>("all"),[query,setQuery]=useState(""),[selected,setSelected]=useState<string[]>([]),[detail,setDetail]=useState<CardProgram|null>(null);
  const current=useMemo(()=>CARD_PROGRAMS.filter(c=>c.status!=="legacy"),[]);
  const closest=useMemo(()=>[...current].sort((a,b)=>matchScore(b,network,funding,custody,model)-matchScore(a,network,funding,custody,model)).slice(0,3),[current,network,funding,custody,model]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return CARD_PROGRAMS.filter(c=>matchesFilter(c,filter)).filter(c=>!q||[c.name,c.company,c.network,c.custody,c.model,c.spendModel,c.geography,...c.funding,...c.partners].join(" ").toLowerCase().includes(q))},[filter,query]);
  const compared=selected.map(id=>CARD_PROGRAMS.find(c=>c.id===id)).filter((c):c is CardProgram=>Boolean(c));
  const toggle=(id:string)=>setSelected(items=>items.includes(id)?items.filter(x=>x!==id):items.length<4?[...items,id]:items);
  return <div className="cards-visual-page">
    <aside className="cv-research-banner"><strong>RESEARCH DIRECTORY · NOT CONNECTED</strong><span>Sources are linked per programme with an as-of date, jurisdiction and confidence label. This is not the Blueballs Cards API, and no listing implies a partnership.</span></aside>
    <section className="cv-hero"><div className="cv-hero-copy"><span className="cv-eyebrow">BLUEBALLS CARDS</span><h1>Build your custom card.</h1><p>Choose funding, custody, spend model and network. See the customer card and the operating model together, then compare it with real programmes already in market.</p><div className="cv-hero-actions"><button onClick={()=>document.getElementById("card-market")?.scrollIntoView({behavior:"smooth"})}>Compare the market</button><button className="secondary" onClick={()=>document.getElementById("card-patterns")?.scrollIntoView({behavior:"smooth"})}>How cards are built</button></div><div className="cv-hero-proof"><div><span>YOUR PRODUCT</span><b>{custody}</b></div><div><span>FUNDING</span><b>{funding}</b></div><div><span>SPEND</span><b>{model}</b></div></div></div>
      <div className="cv-builder"><div className="cv-builder-card"><BlueballsCard network={network} funding={funding} model={model} tone={tone}/></div><div className="cv-builder-controls"><label><span>NETWORK</span><select value={network} onChange={e=>setNetwork(e.target.value as BuilderNetwork)}><option>Visa</option><option>Mastercard</option></select></label><label><span>FUNDING</span><select value={funding} onChange={e=>setFunding(e.target.value as BuilderFunding)}><option>USDC</option><option>USDT</option><option>Fiat</option><option>Multi-asset</option></select></label><label><span>CUSTODY</span><select value={custody} onChange={e=>setCustody(e.target.value as BuilderCustody)}><option>Self-custodial</option><option>Custodial</option><option>Hybrid</option></select></label><label><span>SPEND MODEL</span><select value={model} onChange={e=>setModel(e.target.value as BuilderModel)}><option>JIT spend</option><option>Pre-funded</option><option>Collateralised</option><option>Earn until spend</option></select></label><label><span>CARD TONE</span><select value={tone} onChange={e=>setTone(e.target.value as BuilderTone)}>{Object.keys(TONES).map(v=><option key={v}>{v}</option>)}</select></label></div><div className="cv-closest"><span>CLOSEST MATCHES IN MARKET</span><div>{closest.map(card=><button key={card.id} onClick={()=>setDetail(card)}><BrandMark card={card}/><small>{matchScore(card,network,funding,custody,model)}% match</small></button>)}</div></div></div>
    </section>
    <section className="cv-market" id="card-market"><div className="cv-section-head"><div><span className="cv-eyebrow">MARKET</span><h2>See how the market built theirs.</h2><p>Every programme is shown as a card first. Corporate colours and brand marks identify the product; click any card to inspect custody, funding, fees and the known infrastructure underneath.</p></div><label className="cv-search"><span>SEARCH</span><input value={query} onChange={(e:ChangeEvent<HTMLInputElement>)=>setQuery(e.target.value)} placeholder="Card, brand, stablecoin, model or region…"/></label></div><div className="cv-filter-row">{FILTERS.map(item=><button key={item.id} className={filter===item.id?"active":""} onClick={()=>setFilter(item.id)}>{item.label}<span>{CARD_PROGRAMS.filter(c=>matchesFilter(c,item.id)).length}</span></button>)}</div><div className="cv-card-wall">{filtered.map(card=><article className={`cv-market-tile ${card.status==="legacy"?"legacy":""}`} key={card.id}><button className="cv-art-button" onClick={()=>setDetail(card)}><PaymentCard card={card}/></button><div className="cv-tile-meta"><div><BrandMark card={card}/><span>{card.name}</span></div><button className={selected.includes(card.id)?"selected":""} onClick={()=>toggle(card.id)}>{selected.includes(card.id)?"✓":"+"}</button></div><div className="cv-tags"><span>{card.network}</span><span>{card.custody}</span><span>{card.funding[0]||"Not disclosed"}</span></div></article>)}</div></section>
    <section className="cv-patterns" id="card-patterns"><div className="cv-section-head solo"><div><span className="cv-eyebrow">ARCHITECTURES</span><h2>Five common ways card programmes are assembled.</h2><p>The card face changes. The operating model underneath usually falls into a small number of patterns.</p></div></div><div className="cv-pattern-grid">{PATTERNS.map((p,i)=><article key={p.name}><span>0{i+1}</span><h3>{p.name}</h3><p>{p.desc}</p><div className="cv-pattern-flow">{p.flow.map((step,j)=><span key={step}>{j>0&&<i>→</i>}<b>{step}</b></span>)}</div><div className="cv-pattern-brands">{p.ids.map(id=>{const card=CARD_PROGRAMS.find(c=>c.id===id);return card?<button key={id} onClick={()=>setDetail(card)}><BrandMark card={card}/></button>:null})}</div></article>)}</div></section>
    <section className="cv-stack"><div><span className="cv-eyebrow">WHAT YOU NEED</span><h2>From wallet or account to merchant.</h2><p>Blueballs supplies the product, ledger and policy primitives. A production card still needs the programme, issuer/processor and network relationships required for the target market.</p></div><div className="cv-stack-flow"><span><i>01</i><b>Customer wallet / account</b></span><em>→</em><span><i>02</i><b>Programme manager</b></span><em>→</em><span><i>03</i><b>Issuer / processor</b></span><em>→</em><span><i>04</i><b>Visa / Mastercard</b></span><em>→</em><span><i>05</i><b>Merchant</b></span></div></section>
    {compared.length>0&&<div className="cv-compare"><div><span>COMPARE</span><b>{compared.map(c=>c.name).join(" · ")}</b></div><button onClick={()=>setSelected([])}>Clear</button></div>}
    {detail&&<Drawer card={detail} selected={selected.includes(detail.id)} onClose={()=>setDetail(null)} onCompare={()=>toggle(detail.id)}/>} </div>
}
