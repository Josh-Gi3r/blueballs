import { useMemo, useState, type ChangeEvent } from "react";
import { CARD_PROGRAMS, type CardProgram, type CardStatus, type CustodyModel } from "./cards/data";
import "./CardsPage.css";
import "./cards/workbench.css";

type CardsPageProps = { onNavigate: (path: string) => void };
type Filter = "all" | CustodyModel | "Visa" | "Mastercard" | "Consumer" | "Business" | "legacy";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All current" },
  { id: "Self-custodial", label: "Self-custody" },
  { id: "Custodial", label: "Custodial" },
  { id: "Hybrid", label: "Hybrid" },
  { id: "Visa", label: "Visa" },
  { id: "Mastercard", label: "Mastercard" },
  { id: "Consumer", label: "Consumer" },
  { id: "Business", label: "Business" },
  { id: "legacy", label: "Legacy" },
];

const FEATURED = ["metamask", "plasma", "nexo", "minipay", "kast"];
const PATTERNS = [
  { name: "Wallet-native spending", desc: "Assets stay under user control until the card needs them.", ids: ["metamask", "solflare", "minipay", "gnosis-pay"], flow: ["WALLET", "AUTHORISATION", "ISSUER", "NETWORK"] },
  { name: "Stablecoin neobank", desc: "Stablecoin balances sit inside an account product with card access layered on top.", ids: ["kast", "brighty", "plasma", "coca"], flow: ["STABLECOIN", "ACCOUNT", "CARD PROGRAMME", "NETWORK"] },
  { name: "Exchange account", desc: "A custodial trading account becomes the source of funds for everyday card spend.", ids: ["okx", "krak", "bybit", "crypto-com"], flow: ["ACCOUNT ASSETS", "CONVERSION", "CARD BALANCE", "NETWORK"] },
  { name: "Collateralised spend", desc: "The customer keeps the asset and borrows or receives spending power against it.", ids: ["nexo", "avalanche", "exa", "avici"], flow: ["COLLATERAL", "CREDIT LINE", "AUTHORISATION", "NETWORK"] },
  { name: "Wallet to regulated account", desc: "Self-custody remains the crypto entry point, then value moves into regulated card infrastructure.", ids: ["safepal", "ledger-cl", "1inch"], flow: ["WALLET", "CARD ACCOUNT", "ISSUER", "NETWORK"] },
];

function matchesFilter(card: CardProgram, filter: Filter) {
  if (filter === "all") return card.status !== "legacy";
  if (filter === "legacy") return card.status === "legacy";
  if (filter === "Visa" || filter === "Mastercard") return card.network.includes(filter) && card.status !== "legacy";
  if (filter === "Consumer" || filter === "Business") return (card.customer === filter || card.customer === "Both") && card.status !== "legacy";
  return card.custody === filter && card.status !== "legacy";
}
function statusLabel(status: CardStatus) { return status === "launching" ? "LAUNCHING" : status === "legacy" ? "LEGACY" : "ACTIVE"; }
function short(value: string, max = 44) { return value.length > max ? `${value.slice(0, max - 1)}…` : value; }

function HeroWorkbench({ active, onChange, onCompare }: { active: CardProgram; onChange: (card: CardProgram) => void; onCompare: (id: string) => void }) {
  const featured = FEATURED.map((id) => CARD_PROGRAMS.find((card) => card.id === id)).filter((card): card is CardProgram => Boolean(card));
  return <div className="ci-hero-workbench">
    <div className="ci-workbench-top"><span>LIVE TEARDOWN</span><div>{featured.map((card) => <button key={card.id} className={card.id === active.id ? "active" : ""} onClick={() => onChange(card)}>{card.name.replace(" Card", "")}</button>)}</div></div>
    <div className="ci-card-stage">
      <div className="ci-visual-card"><div className="ci-card-brand"><span>{active.company}</span><b>{active.network}</b></div><strong>{active.name}</strong><small>{active.model}</small><div className="ci-card-dots"><i /><i /></div></div>
      <div className="ci-card-facts"><div><span>CUSTODY</span><b>{active.custody}</b></div><div><span>MARKET OFFER</span><b>{short(active.rewards, 62)}</b></div><div><span>FUNDING</span><b>{active.funding.slice(0, 4).join(" · ")}</b></div><div><span>MARKETS</span><b>{short(active.geography, 58)}</b></div></div>
    </div>
    <div className="ci-flow"><span>{active.wallets}</span><i>→</i><span>{active.spendModel}</span><i>→</i><span>{active.partners[0] || "ISSUER"}</span><i>→</i><span>{active.network}</span></div>
    <div className="ci-workbench-foot"><div><span>KNOWN STACK</span><b>{active.partners.join(" → ") || "Not publicly disclosed"}</b></div><button onClick={() => onCompare(active.id)}>Add to compare +</button></div>
  </div>;
}

function DetailPanel({ card, onClose, onCompare, selected }: { card: CardProgram; onClose: () => void; onCompare: () => void; selected: boolean }) {
  return <div className="cards-detail-backdrop" onMouseDown={onClose}><aside className="cards-detail" onMouseDown={(event) => event.stopPropagation()}>
    <div className="cards-detail-head"><div><span>CARD MODEL</span><h2>{card.name}</h2><p>{card.company} · {card.network} · {card.type}</p></div><button onClick={onClose}>×</button></div>
    <div className="cards-detail-summary"><div><small>CUSTODY</small><b>{card.custody}</b></div><div><small>CUSTOMER</small><b>{card.customer}</b></div><div><small>FORM</small><b>{[card.virtual && "Virtual", card.physical && "Physical"].filter(Boolean).join(" + ") || "Not disclosed"}</b></div></div>
    <section><span>HOW IT WORKS</span><h3>{card.model}</h3><p>{card.note}</p><div className="cards-flow"><b>{card.wallets}</b><i>→</i><b>{card.spendModel}</b><i>→</i><b>{card.network}</b><i>→</i><b>Merchant</b></div></section>
    <section><span>MONEY + CUSTOMER OFFER</span><div className="cards-detail-list"><div><small>STABLECOINS / FUNDING</small><b>{card.funding.join(" · ")}</b></div><div><small>CHAINS</small><b>{card.chains.join(" · ")}</b></div><div><small>FEES / FX</small><b>{card.fees}</b></div><div><small>REWARDS / PERKS</small><b>{card.rewards}</b></div></div></section>
    <section><span>KNOWN INFRASTRUCTURE</span><div className="cards-partner-chain">{card.partners.length ? card.partners.map((partner, index) => <span key={partner}>{index > 0 && <i>→</i>}<b>{partner}</b></span>) : <b>Not publicly disclosed</b>}</div><p className="cards-disclosure">Unknown issuer, processor, settlement or compliance relationships stay undisclosed rather than being inferred.</p></section>
    <section><span>AVAILABILITY</span><p>{card.geography}</p></section>
    <div className="cards-detail-actions"><button onClick={onCompare}>{selected ? "Remove from comparison" : "Add to comparison"}</button><button className="secondary" onClick={onClose}>Back</button></div>
  </aside></div>;
}

const COMPARE_ROWS: Array<[string, (card: CardProgram) => string]> = [
  ["Product model", (card) => card.model], ["Card", (card) => `${card.network} · ${card.type}`], ["Custody", (card) => card.custody], ["Funding", (card) => card.funding.join(" · ")], ["Chains", (card) => card.chains.join(" · ")], ["Spend / authorisation", (card) => card.spendModel], ["Known stack", (card) => card.partners.join(" → ") || "Not publicly disclosed"], ["Rewards / perks", (card) => card.rewards], ["Fees / FX", (card) => card.fees], ["Markets", (card) => card.geography], ["Customer", (card) => card.customer],
];

function CompareWorkspace({ cards, onRemove, onClear }: { cards: CardProgram[]; onRemove: (id: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  return <div className="cards-compare-tray"><div className="cards-compare-bar"><div><span>COMPARE PROGRAMS</span><strong>{cards.map((card) => card.name).join(" · ")}</strong></div><div><button className="secondary" onClick={onClear}>Clear</button><button onClick={() => setOpen(!open)}>{open ? "Close" : `Compare ${cards.length}`}</button></div></div>{open && <div className="cards-compare-table-wrap"><table><thead><tr><th>BUILD DECISION</th>{cards.map((card) => <th key={card.id}>{card.name}<button onClick={() => onRemove(card.id)}>×</button></th>)}</tr></thead><tbody>{COMPARE_ROWS.map(([label, get]) => <tr key={label}><td>{label}</td>{cards.map((card) => <td key={card.id}>{get(card)}</td>)}</tr>)}</tbody></table></div>}</div>;
}

function MarketTable({ cards, selected, onToggle, onOpen }: { cards: CardProgram[]; selected: string[]; onToggle: (id: string) => void; onOpen: (card: CardProgram) => void }) {
  return <div className="ci-table-wrap"><table className="ci-market-table"><thead><tr><th>PROGRAM</th><th>MODEL</th><th>CUSTODY</th><th>FUNDING</th><th>NETWORK</th><th>MARKET OFFER</th><th>FEES / FX</th><th>KNOWN STACK</th><th /></tr></thead><tbody>{cards.map((card) => <tr key={card.id}><td><button className="ci-program" onClick={() => onOpen(card)}><b>{card.name}</b><span>{statusLabel(card.status)} · {card.company}</span></button></td><td>{card.model}</td><td><span className={`ci-pill ${card.custody === "Self-custodial" ? "blue" : ""}`}>{card.custody}</span></td><td>{card.funding.slice(0, 3).join(" · ")}</td><td><b>{card.network}</b></td><td>{short(card.rewards, 52)}</td><td>{short(card.fees, 48)}</td><td>{card.partners.slice(0, 3).join(" → ") || "Not disclosed"}</td><td><button className={`ci-add ${selected.includes(card.id) ? "selected" : ""}`} onClick={() => onToggle(card.id)}>{selected.includes(card.id) ? "✓" : "+"}</button></td></tr>)}</tbody></table></div>;
}

export default function CardsPage({ onNavigate }: CardsPageProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<CardProgram | null>(null);
  const [heroId, setHeroId] = useState("metamask");
  const hero = CARD_PROGRAMS.find((card) => card.id === heroId) || CARD_PROGRAMS[0];
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return CARD_PROGRAMS.filter((card) => matchesFilter(card, filter)).filter((card) => !q || [card.name, card.company, card.network, card.type, card.custody, card.model, card.spendModel, card.rewards, card.fees, card.geography, ...card.funding, ...card.chains, ...card.partners].join(" ").toLowerCase().includes(q)); }, [filter, query]);
  const compared = selected.map((id) => CARD_PROGRAMS.find((card) => card.id === id)).filter((card): card is CardProgram => Boolean(card));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);

  return <div className="cards-page ci-page">
    <section className="ci-hero"><div className="ci-hero-copy"><span className="cards-eyebrow">CARD INTELLIGENCE</span><h1>See how the market<br />is building cards.</h1><p>Study product models, customer economics, stablecoin rails and the infrastructure behind modern card programmes. Built for teams designing neobanks and financial products.</p><div className="cards-hero-actions"><button onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>Explore the market</button><button className="secondary" onClick={() => toggle(hero.id)}>Compare programmes</button></div><div className="ci-proof"><span><b>41</b> public programmes</span><span><b>38</b> current / launching</span><span><b>20+</b> mapped infrastructure relationships</span><span>Updated Aug 2026</span></div></div><HeroWorkbench active={hero} onChange={(card) => setHeroId(card.id)} onCompare={toggle} /></section>

    <section id="market" className="ci-section"><div className="ci-section-head"><div><span>MARKET</span><h2>Card programmes</h2><p>What customers are being offered, how funds move and who is publicly known to power the programme.</p></div><label className="cards-search"><span>SEARCH</span><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Card, stablecoin, provider, model or region…" /></label></div><div className="cards-filter-row">{FILTERS.map((item) => <button className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)}><b>{item.label}</b><span>{CARD_PROGRAMS.filter((card) => matchesFilter(card, item.id)).length}</span></button>)}</div><div className="cards-results-line"><span>{filtered.length} programmes</span><span>Unknown fields remain not publicly disclosed</span></div><MarketTable cards={filtered} selected={selected} onToggle={toggle} onOpen={setDetail} /></section>

    <section className="ci-section"><div className="ci-section-head solo"><div><span>MARKET PATTERNS</span><h2>Five ways the market is putting cards together.</h2><p>Observable product architectures, not rankings.</p></div></div><div className="ci-pattern-grid">{PATTERNS.map((pattern, index) => <article className={index === 0 ? "dark" : ""} key={pattern.name}><span>0{index + 1}</span><h3>{pattern.name}</h3><p>{pattern.desc}</p><div className="ci-mini-flow">{pattern.flow.map((step, stepIndex) => <span key={step}>{stepIndex > 0 && <i>→</i>}<b>{step}</b></span>)}</div><div className="ci-examples">{pattern.ids.map((id) => { const card = CARD_PROGRAMS.find((item) => item.id === id); return card ? <button key={id} onClick={() => setDetail(card)}>{card.name.replace(" Card", "")}</button> : null; })}</div></article>)}</div></section>

    <section className="ci-section ci-network"><div className="ci-section-head solo"><div><span>WHO POWERS WHOM</span><h2>The brands are more fragmented than the infrastructure.</h2><p>Follow publicly confirmed relationships underneath customer-facing cards.</p></div></div><div className="ci-network-grid"><article className="dark"><span>RAIN</span><strong>Visa issuing + stablecoin infrastructure</strong><p>RedotPay · KAST · ether.fi · Plasma One · Tria · Avalanche · Western Union</p></article><article><span>BAANX</span><strong>Wallet-to-card infrastructure</strong><p>MetaMask · Ledger CL · 1inch</p></article><article><span>GNOSIS PAY</span><strong>Self-custodial card infrastructure</strong><p>MiniPay · Gnosis ecosystem frontends</p></article><article><span>MONAVATE</span><strong>Regulated issuing</strong><p>Gnosis Pay · MiniPay · 1inch</p></article><article className="dark"><span>WIREX</span><strong>Principal member + stablecoin BaaS</strong><p>Wirex One · BingX</p></article><article><span>KULIPA</span><strong>Self-custodial Mastercard infrastructure</strong><p>Solflare · Ready (legacy)</p></article></div></section>

    <section className="cards-bottom ci-bottom"><div><span>FROM MARKET MODEL TO YOUR STACK</span><h2>See a model you want to build?</h2><p>Move into the Providers directory to explore issuing, banking, custody, compliance, FX, stablecoin and payment infrastructure for your own product.</p></div><div><button onClick={() => onNavigate("/ecosystem")}>Browse providers</button><button className="secondary" onClick={() => onNavigate("/developers")}>See Blueballs APIs</button></div></section>
    <div className="cards-disclaimer"><span>ABOUT THIS DIRECTORY</span><p>Card programmes, fees, rewards, eligibility and provider relationships change. Unknown relationships remain not publicly disclosed rather than being inferred. Research snapshot: Aug 2026.</p></div>

    {detail && <DetailPanel card={detail} onClose={() => setDetail(null)} onCompare={() => toggle(detail.id)} selected={selected.includes(detail.id)} />}
    <CompareWorkspace cards={compared} onRemove={toggle} onClear={() => setSelected([])} />
  </div>;
}
