import { useMemo, useState } from "react";
import { CARD_PROGRAMS, type CardProgram, type CustodyModel } from "./data";
import "./cards-visual-page.css";

type Props = { onNavigate: (path: string) => void };
type Filter =
  | "all"
  | CustodyModel
  | "Visa"
  | "Mastercard"
  | "Consumer"
  | "Business"
  | "legacy";
type BuilderNetwork = "Visa" | "Mastercard";
type BuilderFunding = "USDC" | "USDT" | "Fiat" | "Multi-asset";
type BuilderCustody = "Self-custodial" | "Custodial" | "Hybrid";
type BuilderModel =
  | "Pre-funded"
  | "JIT spend"
  | "Collateralised"
  | "Earn until spend";
type BuilderTone = "Blueballs navy" | "Midnight" | "Silver" | "Electric blue";

const FILTERS: Array<{ id: Filter; label: string }> = [
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

const TONES: Record<BuilderTone, string> = {
  "Blueballs navy": "linear-gradient(145deg,#07144f,#173d9c)",
  Midnight: "linear-gradient(145deg,#05070d,#202a44)",
  Silver: "linear-gradient(145deg,#c4cad4,#f6f8fb)",
  "Electric blue": "linear-gradient(145deg,#0647e8,#1f8cff)",
};

const BRAND_TONES: Record<string, string> = {
  metamask: "linear-gradient(145deg,#21170f,#f6851b)",
  "gnosis-pay": "linear-gradient(145deg,#0d463d,#13917f)",
  kast: "linear-gradient(145deg,#16102f,#593b9c)",
  etherfi: "linear-gradient(145deg,#130d28,#5a2f92)",
  plasma: "linear-gradient(145deg,#080808,#2a2a2a)",
  avalanche: "linear-gradient(145deg,#d92c2d,#ff696a)",
  safepal: "linear-gradient(145deg,#111317,#303641)",
  solflare: "linear-gradient(145deg,#161922,#343b50)",
  nexo: "linear-gradient(145deg,#073fce,#0a68f0)",
  redotpay: "linear-gradient(145deg,#111,#2b2b2b)",
  minipay: "linear-gradient(145deg,#2346d8,#516cff)",
  "crypto-com": "linear-gradient(145deg,#061a38,#123a73)",
  okx: "linear-gradient(145deg,#050505,#202020)",
  bybit: "linear-gradient(145deg,#161616,#2b2b2b)",
  brighty: "linear-gradient(145deg,#ff477e,#ff87ab)",
  "bitget-wallet": "linear-gradient(145deg,#03aebe,#27d1df)",
};

const PATTERNS = [
  {
    name: "Wallet-native spending",
    copy: "Assets remain in a wallet-centric product until authorisation or settlement needs value on the card rail.",
    flow: ["WALLET", "AUTHORISATION", "ISSUER / PROCESSOR", "NETWORK"],
  },
  {
    name: "Stablecoin account + card",
    copy: "Stablecoin balances sit inside an account product with card access layered on top through the programme stack.",
    flow: ["STABLECOIN", "ACCOUNT", "CARD PROGRAMME", "NETWORK"],
  },
  {
    name: "Exchange account",
    copy: "A custodial asset account becomes the funding source, with conversion and card balance management behind the spend path.",
    flow: ["ACCOUNT ASSETS", "CONVERSION", "CARD BALANCE", "NETWORK"],
  },
  {
    name: "Collateralised spend",
    copy: "The customer keeps an asset position while a credit line supplies spending power under collateral policy.",
    flow: ["COLLATERAL", "CREDIT LINE", "AUTHORISATION", "NETWORK"],
  },
];

function matchesFilter(card: CardProgram, filter: Filter) {
  if (filter === "all") return card.status !== "legacy";
  if (filter === "legacy") return card.status === "legacy";
  if (filter === "Visa" || filter === "Mastercard") {
    return card.status !== "legacy" && card.network.includes(filter);
  }
  if (filter === "Consumer" || filter === "Business") {
    return (
      card.status !== "legacy" &&
      (card.customer === filter || card.customer === "Both")
    );
  }
  return card.status !== "legacy" && card.custody === filter;
}

function cardTone(card: CardProgram) {
  if (BRAND_TONES[card.id]) return BRAND_TONES[card.id];
  const palettes = [
    "linear-gradient(145deg,#07144f,#2454c7)",
    "linear-gradient(145deg,#13261f,#377760)",
    "linear-gradient(145deg,#251536,#7042a8)",
    "linear-gradient(145deg,#2a1b12,#845431)",
    "linear-gradient(145deg,#111,#3b3b3b)",
  ];
  const index = [...card.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

function NetworkMark({ network }: { network: string }) {
  if (network.includes("Mastercard")) {
    return (
      <span className="cv-mastercard" aria-label="Mastercard">
        <i />
        <i />
      </span>
    );
  }
  if (network.includes("Visa")) return <span className="cv-visa">VISA</span>;
  return <span className="cv-network-text">{network}</span>;
}

function Chip() {
  return (
    <span className="cv-chip" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function ProgrammeCard({ card, compact = false }: { card: CardProgram; compact?: boolean }) {
  return (
    <div
      className={`cv-payment-card ${compact ? "compact" : ""}`}
      style={{ background: cardTone(card), color: "#fff" }}
    >
      <div className="cv-card-glow" />
      <div className="cv-card-top">
        <span className="cv-brand-mark">
          <i>{card.company.slice(0, 2).toUpperCase()}</i>
          <b>{card.company}</b>
        </span>
        <NetworkMark network={card.network} />
      </div>
      <div className="cv-card-middle">
        <Chip />
        <span className="cv-contactless">)))</span>
      </div>
      <div className="cv-card-bottom">
        <div>
          <span>{card.physical ? "PHYSICAL + DIGITAL" : "DIGITAL"}</span>
          <b>{card.funding.slice(0, 2).join(" · ") || "CARD"}</b>
        </div>
        <small>{card.model}</small>
      </div>
    </div>
  );
}

function BlueballsCard({
  network,
  funding,
  model,
  tone,
}: {
  network: BuilderNetwork;
  funding: BuilderFunding;
  model: BuilderModel;
  tone: BuilderTone;
}) {
  const darkText = tone === "Silver";
  return (
    <div
      className="cv-payment-card cv-custom-card"
      style={{ background: TONES[tone], color: darkText ? "#07144f" : "#fff" }}
    >
      <div className="cv-card-glow" />
      <div className="cv-card-top">
        <span className="cv-blueballs-mark">
          <i />
          <i />
          <i />
          <i />
          <b>Blueballs</b>
        </span>
        <NetworkMark network={network} />
      </div>
      <div className="cv-card-middle">
        <Chip />
        <span className="cv-contactless">)))</span>
      </div>
      <div className="cv-custom-bottom">
        <div>
          <span>CARDHOLDER</span>
          <b>YOUR CUSTOMER</b>
        </div>
        <div>
          <span>FUNDING</span>
          <b>{funding}</b>
          <span>SPEND MODEL</span>
          <b>{model}</b>
        </div>
      </div>
    </div>
  );
}

function scoreCard(
  card: CardProgram,
  network: BuilderNetwork,
  funding: BuilderFunding,
  custody: BuilderCustody,
) {
  let score = 0;
  if (card.network.includes(network)) score += 3;
  if (card.custody === custody) score += 3;
  if (funding === "Multi-asset") {
    if (card.funding.length > 1) score += 2;
  } else if (funding === "Fiat") {
    if (card.funding.some((item) => /fiat|usd|eur|gbp/i.test(item))) score += 2;
  } else if (card.funding.some((item) => item.toUpperCase().includes(funding))) {
    score += 2;
  }
  if (card.status === "active") score += 1;
  return score;
}

function SelectField({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
  );
}

export default function CardsVisualPage({ onNavigate }: Props) {
  const [network, setNetwork] = useState<BuilderNetwork>("Visa");
  const [funding, setFunding] = useState<BuilderFunding>("USDC");
  const [custody, setCustody] = useState<BuilderCustody>("Self-custodial");
  const [model, setModel] = useState<BuilderModel>("JIT spend");
  const [tone, setTone] = useState<BuilderTone>("Blueballs navy");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CardProgram | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CARD_PROGRAMS.filter((card) => {
      if (!matchesFilter(card, filter)) return false;
      if (!q) return true;
      return [
        card.name,
        card.company,
        card.network,
        card.model,
        card.custody,
        card.geography,
        ...card.funding,
        ...card.chains,
        ...card.partners,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [filter, query]);

  const closest = useMemo(
    () =>
      CARD_PROGRAMS.filter((card) => card.status !== "legacy")
        .map((card) => ({ card, score: scoreCard(card, network, funding, custody) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [network, funding, custody],
  );

  return (
    <div className="cards-visual-page">
      <aside className="cv-research-banner">
        <strong>SOURCED CARD INTELLIGENCE · AS-OF DATA</strong>
        <span>
          Programme records link to first-party sources and carry an as-of date,
          jurisdiction and confidence label. Use the market map alongside the
          Blueballs card, ledger, policy and provider contracts to design the
          programme architecture behind your product.
        </span>
      </aside>

      <section className="cv-hero">
        <div className="cv-hero-copy">
          <div className="cv-eyebrow">CARD PROGRAMME ARCHITECTURE</div>
          <h1>See the market. Build the system behind it.</h1>
          <p>
            Compare custody models, funding assets, networks, geographies and
            disclosed programme infrastructure, then map those choices into an
            institution-owned Blueballs stack.
          </p>
          <div className="cv-hero-actions">
            <button type="button" onClick={() => onNavigate("/developers")}>
              Inspect Cards API
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate("/ecosystem")}>
              Explore providers
            </button>
          </div>
          <div className="cv-hero-proof">
            <div><span>INTELLIGENCE</span><b>{CARD_PROGRAMS.length} programmes tracked</b></div>
            <div><span>ARCHITECTURE</span><b>Ledger + policy + provider contracts</b></div>
            <div><span>COMPOSITION</span><b>Issuer · processor · network · funding</b></div>
          </div>
        </div>

        <div className="cv-builder">
          <div className="cv-builder-card">
            <BlueballsCard network={network} funding={funding} model={model} tone={tone} />
          </div>
          <div className="cv-builder-controls">
            <SelectField label="NETWORK" value={network} values={["Visa", "Mastercard"]} onChange={(value) => setNetwork(value as BuilderNetwork)} />
            <SelectField label="FUNDING" value={funding} values={["USDC", "USDT", "Fiat", "Multi-asset"]} onChange={(value) => setFunding(value as BuilderFunding)} />
            <SelectField label="CUSTODY" value={custody} values={["Self-custodial", "Custodial", "Hybrid"]} onChange={(value) => setCustody(value as BuilderCustody)} />
            <SelectField label="SPEND MODEL" value={model} values={["Pre-funded", "JIT spend", "Collateralised", "Earn until spend"]} onChange={(value) => setModel(value as BuilderModel)} />
            <SelectField label="CARD TONE" value={tone} values={["Blueballs navy", "Midnight", "Silver", "Electric blue"]} onChange={(value) => setTone(value as BuilderTone)} />
          </div>
          <div className="cv-closest">
            <span>CLOSEST MARKET PATTERNS</span>
            <div>
              {closest.map(({ card }) => (
                <button type="button" key={card.id} onClick={() => setSelected(card)}>
                  <ProgrammeCard card={card} compact />
                  <small>{card.company}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="cv-market">
        <div className="cv-section-head">
          <div>
            <div className="cv-eyebrow">MARKET MAP</div>
            <h2>Compare real programme choices.</h2>
            <p>
              Filter by custody, network and customer model. Open any programme
              to inspect its source, operating model and evidence metadata.
            </p>
          </div>
          <label className="cv-search">
            <span>SEARCH PROGRAMMES</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company, chain, funding, geography…" />
          </label>
        </div>

        <div className="cv-filter-row">
          {FILTERS.map((item) => {
            const count = CARD_PROGRAMS.filter((card) => matchesFilter(card, item.id)).length;
            return (
              <button
                type="button"
                key={item.id}
                className={filter === item.id ? "active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label} <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="cv-card-wall">
          {visible.map((card) => (
            <article key={card.id} className={`cv-market-tile ${card.status === "legacy" ? "legacy" : ""}`}>
              <button type="button" className="cv-art-button" onClick={() => setSelected(card)}>
                <ProgrammeCard card={card} compact />
              </button>
              <div className="cv-tile-meta">
                <div><strong>{card.company}</strong><small>{card.model}</small></div>
                <span>{card.status.toUpperCase()}</span>
              </div>
            </article>
          ))}
        </div>
        {!visible.length && <p>No programme matches this view.</p>}
      </section>

      <section className="cv-patterns">
        <div className="cv-section-head solo">
          <div>
            <div className="cv-eyebrow">PROGRAMME PATTERNS</div>
            <h2>Different products, recurring infrastructure shapes.</h2>
            <p>
              The market changes quickly, but the architecture tends to resolve
              into a small set of funding, custody and settlement patterns.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginTop: 24 }}>
          {PATTERNS.map((pattern) => (
            <article key={pattern.name} style={{ border: "1px solid #D7DBE4", borderRadius: 15, padding: 20, background: "#F8F9FC" }}>
              <h3 style={{ margin: 0 }}>{pattern.name}</h3>
              <p style={{ margin: "9px 0 16px", color: "#5B6376", lineHeight: 1.55 }}>{pattern.copy}</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {pattern.flow.map((step, index) => (
                  <span key={step} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".1em", padding: "6px 8px", borderRadius: 999, border: "1px solid #D7DBE4", background: "#fff" }}>
                    {index ? "→ " : ""}{step}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cv-stack">
        <div className="cv-eyebrow">BLUEBALLS CARD STACK</div>
        <h2>Keep the product logic. Compose the regulated programme.</h2>
        <p>
          Blueballs supplies card lifecycle, ledger, policy, approvals, events
          and provider-orchestration contracts. Deployers compose the programme
          manager, issuer or processor, network, custody and funding relationships
          appropriate to their target market without rewriting the financial core.
        </p>
        <div className="cv-hero-actions" style={{ marginTop: 20 }}>
          <button type="button" onClick={() => onNavigate("/sandbox")}>Launch sandbox</button>
          <button className="secondary" type="button" onClick={() => onNavigate("/ecosystem")}>Provider capability map</button>
        </div>
      </section>

      {selected && (
        <div className="cv-drawer-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <aside className="cv-drawer" role="dialog" aria-modal="true" aria-label={`${selected.company} programme details`} onClick={(event) => event.stopPropagation()}>
            <button className="cv-drawer-close" type="button" onClick={() => setSelected(null)} aria-label="Close programme details">×</button>
            <ProgrammeCard card={selected} />
            <div className="cv-drawer-copy">
              <div className="cv-eyebrow">PROGRAMME EVIDENCE</div>
              <h2>{selected.name}</h2>
              <p>{selected.note}</p>
              <dl>
                <div><dt>Model</dt><dd>{selected.model}</dd></div>
                <div><dt>Custody</dt><dd>{selected.custody}</dd></div>
                <div><dt>Funding</dt><dd>{selected.funding.join(" · ")}</dd></div>
                <div><dt>Network</dt><dd>{selected.network}</dd></div>
                <div><dt>Customer</dt><dd>{selected.customer}</dd></div>
                <div><dt>Geography</dt><dd>{selected.geography}</dd></div>
                <div><dt>Partners disclosed</dt><dd>{selected.partners.join(" · ") || "—"}</dd></div>
                <div><dt>Jurisdiction</dt><dd>{selected.jurisdiction}</dd></div>
                <div><dt>As of</dt><dd>{selected.asOf}</dd></div>
                <div><dt>Confidence</dt><dd>{selected.confidence.toUpperCase()}</dd></div>
              </dl>
              <p className="cv-disclosure">
                Market intelligence is compiled from the linked source. Commercial
                availability and regulated programme relationships are established
                by each deployment.
              </p>
              <div className="cv-drawer-actions">
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>
                <button className="secondary" type="button" onClick={() => onNavigate("/ecosystem")}>Map provider stack</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
