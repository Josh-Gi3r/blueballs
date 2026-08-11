import { useMemo, useState, type ChangeEvent } from "react";
import { CATEGORIES, CATEGORY_MAP, PROVIDERS } from "./ecosystem/data";
import CategoryMap, { type FilterId } from "./ecosystem/CategoryMap";
import ProviderCard from "./ecosystem/ProviderCard";
import "./EcosystemPage.css";

const MONO = "'IBM Plex Mono', monospace";

type EcosystemPageProps = {
  onNavigate: (path: string) => void;
};

const FILLER_COPY = [
  ["OPEN CORE", "Your product logic stays yours."],
  ["ADAPTER READY", "Replace providers without rebuilding the product."],
  ["VERIFY FIRST", "Publish compatibility evidence before claiming an integration."],
] as const;

function EcosystemFillers({ count, columns, featured = false }: { count: number; columns: 2 | 3 | 4; featured?: boolean }) {
  const missing = (columns - (count % columns)) % columns;
  return <>{Array.from({ length: missing }, (_, index) => {
    const [label, copy] = FILLER_COPY[index % FILLER_COPY.length];
    return <div aria-hidden="true" className={`eco-provider-filler eco-fill-${columns} ${featured ? "eco-provider-featured" : ""}`} key={`${columns}-${index}`}>
      <span>{label}</span><strong>{copy}</strong><small>BLUEBALLS · OPEN SOURCE</small>
    </div>;
  })}</>;
}

export default function EcosystemPage({ onNavigate }: EcosystemPageProps) {
  const [active, setActive] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDERS.filter((provider) => {
      const categoryMatch = active === "all" || provider.categories.includes(active);
      if (!categoryMatch) return false;
      if (!q) return true;
      return [
        provider.name,
        provider.kind,
        provider.summary,
        provider.regions.join(" "),
        provider.capabilities.join(" "),
        provider.categories.map((id) => CATEGORY_MAP[id].label).join(" "),
      ].join(" ").toLowerCase().includes(q);
    });
  }, [active, query]);

  const featured = PROVIDERS.filter((provider) => provider.featured);
  const selectedCategory = active === "all" ? null : CATEGORY_MAP[active];

  return (
    <div className="eco-page">
      <section className="eco-hero">
        <div className="eco-hero-copy">
          <div className="eco-eyebrow">THE INFRASTRUCTURE LANDSCAPE</div>
          <h1><span>Own the core.</span><span>Connect the regulated edge.</span></h1>
          <p>
            Blueballs is the open-source product, ledger and orchestration layer. This map shows where adapters meet the licensed banks, networks, custody, cards, identity data and real liquidity a deployment may need.
          </p>
          <div className="eco-hero-actions">
            <button type="button" onClick={() => document.getElementById("eco-directory")?.scrollIntoView({ behavior: "smooth" })}>Browse providers</button>
            <button type="button" className="secondary" onClick={() => onNavigate("/developers")}>See integration surfaces</button>
          </div>
          <div className="eco-hero-facts">
            <div className="eco-hero-fact-message"><span>CONTROL PLANE</span><strong>One open core. Any regulated edge.</strong></div>
            <div><strong>{CATEGORIES.length}</strong><span>infrastructure layers</span></div>
            <div><strong>{PROVIDERS.length}</strong><span>candidates to evaluate</span></div>
            <div><strong>None</strong><span>implied partnerships</span></div>
          </div>
        </div>
        <CategoryMap active={active} setActive={setActive} />
      </section>

      <section className="eco-principle">
        <div>
          <span>01 · BLUEBALLS CORE</span>
          <strong>Customer experience, product rules, ledger, workflows and FX orchestration.</strong>
        </div>
        <div className="highlight">
          <span>02 · INTEGRATION SURFACES</span>
          <strong>Replaceable adapters, webhooks and contracts that keep vendor choices outside the product core.</strong>
        </div>
        <div>
          <span>03 · PROVIDER LANDSCAPE</span>
          <strong>Candidate banks, networks, custody, cards, data and liquidity providers to evaluate.</strong>
        </div>
      </section>

      <section className="eco-featured">
        <div className="eco-section-head">
          <div>
            <span>EXAMPLE SHORTLIST</span>
            <h2>Infrastructure teams commonly evaluate.</h2>
          </div>
          <p>Research leads, not Blueballs partners or endorsements. “Works with Blueballs” should be reserved for verified adapters.</p>
        </div>
        <div className="eco-featured-grid">
          {featured.map((provider) => <ProviderCard provider={provider} featured key={provider.id} />)}
          <EcosystemFillers count={featured.length} columns={4} featured />
          <EcosystemFillers count={featured.length} columns={2} featured />
        </div>
      </section>

      <section id="eco-directory" className="eco-directory">
        <div className="eco-directory-head">
          <div>
            <span>PROVIDER LANDSCAPE</span>
            <h2>{selectedCategory ? selectedCategory.label : "Explore the regulated edge around Blueballs."}</h2>
            <p>{selectedCategory ? selectedCategory.description : "Filter candidate infrastructure by capability and region. Inclusion means relevant to evaluate—not integrated, approved or endorsed."}</p>
          </div>
          <label className="eco-search">
            <span>SEARCH</span>
            <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Provider, capability or region…" />
          </label>
        </div>

        <div className="eco-filter-row">
          <button type="button" className={active === "all" ? "active" : ""} onClick={() => setActive("all")}>
            <b>All providers</b><span>{PROVIDERS.length}</span>
          </button>
          {CATEGORIES.map((category) => (
            <button key={category.id} type="button" className={active === category.id ? "active" : ""} onClick={() => setActive(category.id)}>
              <b>{category.label}</b><span>{PROVIDERS.filter((provider) => provider.categories.includes(category.id)).length}</span>
            </button>
          ))}
        </div>

        {selectedCategory && (
          <div className="eco-category-brief">
            <div>
              <span>{selectedCategory.eyebrow}</span>
              <strong>{selectedCategory.description}</strong>
            </div>
            <div>
              <span>CONNECTS TO BLUEBALLS</span>
              <div>{selectedCategory.blueballs.map((module) => <b key={module}>{module}</b>)}</div>
            </div>
          </div>
        )}

        <div className="eco-results-line">
          <span>{filtered.length} candidate {filtered.length === 1 ? "provider" : "providers"}</span>
          <span>Official links open in a new tab</span>
        </div>

        <div className="eco-provider-grid">
          {filtered.map((provider) => <ProviderCard provider={provider} key={provider.id} />)}
          <EcosystemFillers count={filtered.length} columns={3} />
          <EcosystemFillers count={filtered.length} columns={2} />
        </div>
        {filtered.length === 0 && (
          <div className="eco-empty">No providers match “{query}” in this layer.</div>
        )}
      </section>

      <section className="eco-bottom">
        <div>
          <span>BUILD THE SOFTWARE ON BLUEBALLS</span>
          <h2>Verify an adapter before calling a provider part of the ecosystem.</h2>
          <p>No single vendor needs to own the whole stack. The directory is the research layer; tested adapters and published compatibility evidence are what turn a candidate into something Blueballs genuinely works with.</p>
        </div>
        <div className="eco-bottom-actions">
          <button type="button" onClick={() => onNavigate("/developers")}>Open developer manual</button>
          <button type="button" className="secondary" onClick={() => onNavigate("/fx")}>Inspect Stablecoin FX</button>
        </div>
      </section>

      <div className="eco-disclaimer">
        <span style={{ fontFamily: MONO }}>DIRECTORY NOTE</span>
        <p>Company names and logos belong to their respective owners. Listings are independent research leads, not partnerships, integrations or endorsements. Availability, licensing, geography, technical compatibility and approval must be verified with each provider.</p>
      </div>
    </div>
  );
}
