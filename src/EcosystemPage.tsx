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
  ["DIRECTORY", "Provider candidates."],
  ["STATUS", "No verified integrations yet."],
  ["SOURCES", "Official provider websites."],
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
          <div className="eco-eyebrow">PROVIDER DIRECTORY</div>
          <h1><span>Find services</span><span>your neobank may need.</span></h1>
          <p>
            Blueballs provides the reference software. A production product still needs services such as banking, identity checks, payment rails, cards or custody. This directory is a place to start looking.
          </p>
          <div className="eco-hero-actions">
            <button type="button" onClick={() => document.getElementById("eco-directory")?.scrollIntoView({ behavior: "smooth" })}>Browse the directory</button>
            <button type="button" className="secondary" onClick={() => onNavigate("/developers")}>See Blueballs APIs</button>
          </div>
          <div className="eco-hero-facts">
            <div className="eco-hero-fact-message"><span>DIRECTORY STATUS</span><strong>No provider integrations are included yet.</strong></div>
            <div><strong>{CATEGORIES.length}</strong><span>service categories</span></div>
            <div><strong>{PROVIDERS.length}</strong><span>companies listed</span></div>
            <div><strong>0</strong><span>verified adapters</span></div>
          </div>
        </div>
        <CategoryMap active={active} setActive={setActive} />
      </section>

      <section className="eco-principle">
        <div>
          <span>01 · BLUEBALLS SOFTWARE</span>
          <strong>Reference APIs, ledger, product flows and FX tooling.</strong>
        </div>
        <div className="highlight">
          <span>02 · YOUR INTEGRATIONS</span>
          <strong>Adapters your team builds and tests for the services it chooses.</strong>
        </div>
        <div>
          <span>03 · PROVIDER DIRECTORY</span>
          <strong>Companies to assess for location, licences, product fit and access.</strong>
        </div>
      </section>

      <section className="eco-featured">
        <div className="eco-section-head">
          <div>
            <span>STARTING POINTS</span>
            <h2>A short list across the main categories.</h2>
          </div>
          <p>These companies are listed for research. Blueballs does not currently include adapters for them.</p>
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
            <span>PROVIDER DIRECTORY</span>
            <h2>{selectedCategory ? selectedCategory.label : "Browse provider candidates."}</h2>
            <p>{selectedCategory ? selectedCategory.description : "Filter the directory by service or region. Open a company’s website to check whether it fits your product."}</p>
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
              <span>RELATED BLUEBALLS MODULES</span>
              <div>{selectedCategory.blueballs.map((module) => <b key={module}>{module}</b>)}</div>
            </div>
          </div>
        )}

        <div className="eco-results-line">
          <span>{filtered.length} {filtered.length === 1 ? "listing" : "listings"}</span>
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
          <span>BUILDING AN ADAPTER?</span>
          <h2>Start with the API your product already uses.</h2>
          <p>Match the provider to the relevant Blueballs request and response, then test the connection against the sandbox flow.</p>
        </div>
        <div className="eco-bottom-actions">
          <button type="button" onClick={() => onNavigate("/developers")}>View API reference</button>
          <button type="button" className="secondary" onClick={() => onNavigate("/fx")}>View FX adapter flow</button>
        </div>
      </section>

      <div className="eco-disclaimer">
        <span style={{ fontFamily: MONO }}>ABOUT THIS DIRECTORY</span>
        <p>Listings are for research only. Check services, licences, availability, pricing and technical fit directly with each company.</p>
      </div>
    </div>
  );
}
