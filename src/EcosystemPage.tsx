import { useMemo, useState, type ChangeEvent } from "react";
import { CATEGORIES, CATEGORY_MAP, PROVIDERS } from "./ecosystem/data";
import CategoryMap, { type FilterId } from "./ecosystem/CategoryMap";
import ProviderCard from "./ecosystem/ProviderCard";
import "./EcosystemPage.css";

const MONO = "'IBM Plex Mono', monospace";

type EcosystemPageProps = {
  onNavigate: (path: string) => void;
};

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
          <div className="eco-eyebrow">THE BLUEBALLS ECOSYSTEM</div>
          <h1>Build the bank. Connect the regulated pieces.</h1>
          <p>
            Blueballs is the open-source product, ledger and orchestration layer. Use providers for the parts that need a bank licence, payment-network access, custody, cards, identity data or real liquidity.
          </p>
          <div className="eco-hero-actions">
            <button type="button" onClick={() => document.getElementById("eco-directory")?.scrollIntoView({ behavior: "smooth" })}>Browse providers</button>
            <button type="button" className="secondary" onClick={() => onNavigate("/developers")}>See integration surfaces</button>
          </div>
          <div className="eco-hero-facts">
            <div><strong>{CATEGORIES.length}</strong><span>infrastructure layers</span></div>
            <div><strong>{PROVIDERS.length}</strong><span>providers and alternatives</span></div>
            <div><strong>Official</strong><span>sites and brand marks</span></div>
          </div>
        </div>
        <CategoryMap active={active} setActive={setActive} />
      </section>

      <section className="eco-principle">
        <div>
          <span>YOU OWN</span>
          <strong>The customer experience, product rules, ledger and workflows.</strong>
        </div>
        <div className="eco-principle-arrow">+</div>
        <div>
          <span>PROVIDERS SUPPLY</span>
          <strong>Regulated access, networks, custody, cards, data and capital.</strong>
        </div>
        <div className="eco-principle-arrow">=</div>
        <div className="highlight">
          <span>YOU CAN LAUNCH</span>
          <strong>A bank shaped around your customers, not a vendor's template.</strong>
        </div>
      </section>

      <section className="eco-featured">
        <div className="eco-section-head">
          <div>
            <span>COMMON STARTING POINTS</span>
            <h2>Providers founders usually evaluate first.</h2>
          </div>
          <p>These are examples and alternatives, not formal Blueballs partnerships or endorsements.</p>
        </div>
        <div className="eco-featured-grid">
          {featured.map((provider) => <ProviderCard provider={provider} featured key={provider.id} />)}
        </div>
      </section>

      <section id="eco-directory" className="eco-directory">
        <div className="eco-directory-head">
          <div>
            <span>PROVIDER DIRECTORY</span>
            <h2>{selectedCategory ? selectedCategory.label : "Every layer you need around Blueballs."}</h2>
            <p>{selectedCategory ? selectedCategory.description : "Filter by the capability you need, compare credible options and open the provider's official site directly."}</p>
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
          <span>{filtered.length} {filtered.length === 1 ? "provider" : "providers"}</span>
          <span>Official links open in a new tab</span>
        </div>

        <div className="eco-provider-grid">
          {filtered.map((provider) => <ProviderCard provider={provider} key={provider.id} />)}
        </div>
        {filtered.length === 0 && (
          <div className="eco-empty">No providers match “{query}” in this layer.</div>
        )}
      </section>

      <section className="eco-bottom">
        <div>
          <span>BUILD THE SOFTWARE ON BLUEBALLS</span>
          <h2>Then choose the regulated and network providers that fit your market.</h2>
          <p>No single vendor needs to own the whole stack. Blueballs keeps the product contract consistent while providers remain replaceable behind adapters.</p>
        </div>
        <div className="eco-bottom-actions">
          <button type="button" onClick={() => onNavigate("/developers")}>Open developer manual</button>
          <button type="button" className="secondary" onClick={() => onNavigate("/fx")}>Inspect Stablecoin FX</button>
        </div>
      </section>

      <div className="eco-disclaimer">
        <span style={{ fontFamily: MONO }}>DIRECTORY NOTE</span>
        <p>Company names and logos belong to their respective owners. Listings link to official company websites. Inclusion describes a possible infrastructure role only; availability, licensing, geography and approval depend on the provider and your programme.</p>
      </div>
    </div>
  );
}
