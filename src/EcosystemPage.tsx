import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { trackGrowthEvent } from "./growth/events";
import { CATEGORIES, CATEGORY_MAP, PROVIDERS } from "./ecosystem/data";
import CategoryMap, { type FilterId } from "./ecosystem/CategoryMap";
import ProviderCard from "./ecosystem/ProviderCard";
import type { Provider } from "./ecosystem/types";
import "./EcosystemPage.css";

const MONO = "'IBM Plex Mono', monospace";
const REPO = "https://github.com/Josh-Gi3r/blueballs";
const SHORTLIST_KEY = "blueballs_provider_shortlist";
const MAX_SHORTLIST = 3;
type EcosystemPageProps = { onNavigate: (path: string) => void };

const FILLER_COPY = [
  ["DIRECTORY", "Provider landscape."],
  ["OPEN SOURCE", "Free to fork and self-host."],
  ["SOURCES", "Links to official websites."],
] as const;

function initialShortlist() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHORTLIST_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(PROVIDERS.map((provider) => provider.id));
    return parsed.filter((id): id is string => typeof id === "string" && valid.has(id)).slice(0, MAX_SHORTLIST);
  } catch {
    return [] as string[];
  }
}

function EcosystemFillers({
  count,
  columns,
}: {
  count: number;
  columns: 2 | 3 | 4;
}) {
  const missing = (columns - (count % columns)) % columns;
  return (
    <>
      {Array.from({ length: missing }, (_, index) => {
        const [label, copy] = FILLER_COPY[index % FILLER_COPY.length];
        return (
          <div
            aria-hidden="true"
            className={`eco-provider-filler eco-fill-${columns}`}
            key={`${columns}-${index}`}
          >
            <span>{label}</span>
            <strong>{copy}</strong>
            <small>BLUEBALLS · OPEN SOURCE</small>
          </div>
        );
      })}
    </>
  );
}

function ComparePanel({
  providers,
  onClose,
  onNavigate,
}: {
  providers: Provider[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="eco-compare-panel" aria-label="Provider comparison">
      <div className="eco-compare-head">
        <div>
          <span>SHORTLIST COMPARISON</span>
          <h2>Compare the infrastructure behind your product.</h2>
          <p>
            Blueballs keeps factual provider data separate from commercial
            relationships. Compare the current directory evidence, then verify
            final availability with each provider.
          </p>
        </div>
        <button type="button" onClick={onClose}>Close comparison</button>
      </div>
      <div className="eco-compare-grid">
        {providers.map((provider) => (
          <article key={provider.id}>
            <span>{CATEGORY_MAP[provider.categories[0]].label}</span>
            <h3>{provider.name}</h3>
            <p>{provider.provides}</p>
            <dl>
              <div><dt>Access</dt><dd>{provider.access}</dd></div>
              <div><dt>Sandbox</dt><dd>{provider.sandbox}</dd></div>
              <div><dt>Technical</dt><dd>{provider.technicalStatus}</dd></div>
              <div><dt>Regions</dt><dd>{provider.regions.join(" · ")}</dd></div>
              <div><dt>Capabilities</dt><dd>{provider.capabilities.join(" · ")}</dd></div>
            </dl>
            <div className="eco-compare-links">
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackGrowthEvent("provider_outbound", { provider: provider.id, destination: "docs", context: "compare" })}
              >
                Technical docs ↗
              </a>
              <a
                href={provider.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackGrowthEvent("provider_outbound", { provider: provider.id, destination: "website", context: "compare" })}
              >
                Company ↗
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="eco-compare-commercial">
        <div>
          <span>BUILD THE STACK</span>
          <strong>Need help turning the shortlist into an implementation?</strong>
        </div>
        <button
          type="button"
          onClick={() => {
            trackGrowthEvent("commercial_cta", { source: "provider_compare", providers: providers.length });
            onNavigate("/contact");
          }}
        >
          Build with Blueballs →
        </button>
      </div>
    </section>
  );
}

export default function EcosystemPage({ onNavigate }: EcosystemPageProps) {
  const [active, setActive] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [shortlist, setShortlist] = useState<string[]>(initialShortlist);
  const [showCompare, setShowCompare] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    trackGrowthEvent("provider_directory_view", { providers: PROVIDERS.length });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist));
    } catch {
      // The shortlist still works for the current session if storage is blocked.
    }
  }, [shortlist]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDERS.filter((provider) => {
      const categoryMatch = active === "all" || provider.categories.includes(active);
      if (!categoryMatch) return false;
      if (!q) return true;
      return [
        provider.name,
        provider.kind,
        provider.provides,
        provider.access,
        provider.regions.join(" "),
        provider.capabilities.join(" "),
        provider.modules.join(" "),
        provider.categories.map((id) => CATEGORY_MAP[id].label).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [active, query]);

  const selectedCategory = active === "all" ? null : CATEGORY_MAP[active];
  const shortlistedProviders = useMemo(
    () => shortlist.flatMap((id) => {
      const provider = PROVIDERS.find((candidate) => candidate.id === id);
      return provider ? [provider] : [];
    }),
    [shortlist],
  );

  const toggleShortlist = (provider: Provider) => {
    const selected = shortlist.includes(provider.id);
    if (!selected && shortlist.length >= MAX_SHORTLIST) {
      setNotice(`Compare up to ${MAX_SHORTLIST} providers at a time.`);
      return;
    }
    const next = selected
      ? shortlist.filter((id) => id !== provider.id)
      : [...shortlist, provider.id];
    setShortlist(next);
    if (next.length < 2) setShowCompare(false);
    setNotice("");
    trackGrowthEvent(selected ? "provider_unshortlist" : "provider_shortlist", {
      provider: provider.id,
      category: provider.categories[0],
      shortlist_size: next.length,
    });
  };

  const claimDirectoryHref = `${REPO}/issues/new?template=provider_claim.yml`;

  return (
    <div className="eco-page">
      <section className="eco-hero">
        <div className="eco-hero-copy">
          <div className="eco-eyebrow">FINANCIAL INFRASTRUCTURE DIRECTORY</div>
          <h1>
            <span>Find the services</span>
            <span>your product needs.</span>
          </h1>
          <p>
            Research, shortlist and compare companies across banking, identity,
            payments, cards, custody, stablecoins and FX. Blueballs stays
            provider-neutral; you decide what powers your product.
          </p>
          <div className="eco-hero-actions">
            <button
              type="button"
              onClick={() => document.getElementById("eco-directory")?.scrollIntoView({ behavior: "smooth" })}
            >
              Browse the directory
            </button>
            <a
              href={claimDirectoryHref}
              target="_blank"
              rel="noreferrer"
              className="secondary"
              onClick={() => trackGrowthEvent("provider_claim_start", { provider: "unselected", source: "directory_hero" })}
            >
              Claim a provider profile
            </a>
          </div>
          <div className="eco-hero-guide">
            <div>
              <span>DISCOVER</span>
              <strong>Find infrastructure by capability and market.</strong>
            </div>
            <div>
              <span>DECIDE</span>
              <strong>Shortlist up to three providers and compare them.</strong>
            </div>
            <div>
              <span>BUILD</span>
              <strong>Connect the providers you choose behind Blueballs.</strong>
            </div>
          </div>
        </div>
        <CategoryMap active={active} setActive={(next) => {
          setActive(next);
          trackGrowthEvent("provider_filter", { category: next });
        }} />
      </section>

      {shortlistedProviders.length > 0 && (
        <section className="eco-shortlist-bar" aria-live="polite">
          <div>
            <span>YOUR SHORTLIST</span>
            <strong>{shortlistedProviders.map((provider) => provider.name).join(" · ")}</strong>
            {notice && <small>{notice}</small>}
          </div>
          <div>
            <button
              type="button"
              disabled={shortlistedProviders.length < 2}
              onClick={() => {
                setShowCompare(true);
                trackGrowthEvent("provider_compare", {
                  providers: shortlistedProviders.length,
                  provider_ids: shortlistedProviders.map((provider) => provider.id).join(","),
                });
              }}
            >
              Compare {shortlistedProviders.length > 1 ? shortlistedProviders.length : "providers"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShortlist([]);
                setShowCompare(false);
                setNotice("");
              }}
            >
              Clear
            </button>
          </div>
        </section>
      )}

      {showCompare && shortlistedProviders.length > 1 && (
        <ComparePanel
          providers={shortlistedProviders}
          onClose={() => setShowCompare(false)}
          onNavigate={onNavigate}
        />
      )}

      <section id="eco-directory" className="eco-directory">
        <div className="eco-directory-head">
          <div>
            <span>PROVIDER DIRECTORY</span>
            <h2>{selectedCategory ? selectedCategory.label : "Browse by service."}</h2>
            <p>
              {selectedCategory
                ? selectedCategory.description
                : "Filter by service or region, shortlist the providers that fit, then compare the evidence before you integrate."}
            </p>
          </div>
          <label className="eco-search">
            <span>SEARCH</span>
            <input
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              onBlur={() => {
                if (query.trim()) {
                  trackGrowthEvent("provider_search", {
                    query_length: query.trim().length,
                    results: filtered.length,
                    category: active,
                  });
                }
              }}
              placeholder="Provider, capability or region…"
            />
          </label>
        </div>
        <div className="eco-filter-row">
          <button
            type="button"
            className={active === "all" ? "active" : ""}
            onClick={() => {
              setActive("all");
              trackGrowthEvent("provider_filter", { category: "all" });
            }}
          >
            <b>All providers</b>
            <span>{PROVIDERS.length}</span>
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={active === category.id ? "active" : ""}
              onClick={() => {
                setActive(category.id);
                trackGrowthEvent("provider_filter", { category: category.id });
              }}
            >
              <b>{category.label}</b>
              <span>{PROVIDERS.filter((provider) => provider.categories.includes(category.id)).length}</span>
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
              <div>
                {selectedCategory.blueballs.map((module) => <b key={module}>{module}</b>)}
              </div>
            </div>
          </div>
        )}
        <div className="eco-results-line">
          <span>{filtered.length} {filtered.length === 1 ? "listing" : "listings"}</span>
          <span>Reviewed against official provider information · 20 Aug 2026</span>
        </div>
        <div className="eco-provider-grid">
          {filtered.map((provider) => (
            <ProviderCard
              provider={provider}
              key={provider.id}
              selected={shortlist.includes(provider.id)}
              onToggleShortlist={toggleShortlist}
            />
          ))}
          <EcosystemFillers count={filtered.length} columns={3} />
          <EcosystemFillers count={filtered.length} columns={2} />
        </div>
        {filtered.length === 0 && (
          <div className="eco-empty">No providers match “{query}” in this category.</div>
        )}
      </section>

      <section className="eco-bottom">
        <div>
          <span>INFRASTRUCTURE PROVIDERS</span>
          <h2>Be discoverable where financial products are being designed.</h2>
          <p>
            Claim or correct your profile, contribute an adapter, or talk to
            Blueballs about launches, research and qualified builder demand.
            Commercial relationships are labelled and never change organic
            technical status.
          </p>
        </div>
        <div className="eco-bottom-actions">
          <a
            href={claimDirectoryHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackGrowthEvent("provider_claim_start", { provider: "unselected", source: "directory_bottom" })}
          >
            Claim your profile
          </a>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              trackGrowthEvent("provider_partnership_start", { source: "directory_bottom" });
              onNavigate("/contact");
            }}
          >
            Work with Blueballs
          </button>
        </div>
      </section>
      <div className="eco-disclaimer">
        <span style={{ fontFamily: MONO }}>HOW BLUEBALLS RANKS</span>
        <p>
          Directory data links to official provider sources. Commercial
          relationships, if any, are labelled separately from technical status.
          Paid participation does not buy an organic ranking or a technical
          verification. Provider availability changes, so confirm current terms
          and coverage directly with the provider before building.
        </p>
      </div>
    </div>
  );
}
