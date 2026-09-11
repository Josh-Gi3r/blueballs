import { useMemo, useState, type ChangeEvent } from "react";
import { CATEGORIES, CATEGORY_MAP, PROVIDERS } from "./ecosystem/data";
import CategoryMap, { type FilterId } from "./ecosystem/CategoryMap";
import ProviderCard from "./ecosystem/ProviderCard";
import "./EcosystemPage.css";

const MONO = "'IBM Plex Mono', monospace";
type EcosystemPageProps = { onNavigate: (path: string) => void };

const FILLER_COPY = [
  ["CAPABILITY MAP", "Official-source provider intelligence."],
  ["PROVIDER NEUTRAL", "Keep the financial core institution-owned."],
  ["COMPOSABLE", "Change external rails without rewriting products."],
] as const;

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

const latestEvidenceDate = PROVIDERS.map((provider) => provider.asOf)
  .filter(Boolean)
  .sort()
  .at(-1);

export default function EcosystemPage({ onNavigate }: EcosystemPageProps) {
  const [active, setActive] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDERS.filter((provider) => {
      const categoryMatch =
        active === "all" || provider.categories.includes(active);
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

  return (
    <div className="eco-page">
      <section className="eco-hero">
        <div className="eco-hero-copy">
          <div className="eco-eyebrow">PROVIDER CAPABILITY MAP</div>
          <h1>
            <span>Compose the infrastructure</span>
            <span>behind your product.</span>
          </h1>
          <p>
            Blueballs keeps product and ledger semantics stable while provider
            adapters connect the sponsor banks, identity vendors, payment rails,
            card infrastructure, custodians and liquidity venues your deployment
            selects.
          </p>
          <div className="eco-hero-actions">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("eco-directory")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Browse provider capabilities
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onNavigate("/developers")}
            >
              Inspect provider contracts
            </button>
          </div>
          <div className="eco-hero-guide">
            <div>
              <span>FINANCIAL CORE</span>
              <strong>Exact money, ledger, policy, events and audit stay inside Blueballs.</strong>
            </div>
            <div>
              <span>CAPABILITY CONTRACTS</span>
              <strong>Provider-specific behavior is translated at explicit adapter boundaries.</strong>
            </div>
            <div>
              <span>DEPLOYMENT CONTROL</span>
              <strong>Institutions choose the commercial and regulated relationships for their markets.</strong>
            </div>
          </div>
        </div>
        <CategoryMap active={active} setActive={setActive} />
      </section>

      <section id="eco-directory" className="eco-directory">
        <div className="eco-directory-head">
          <div>
            <span>OFFICIAL-SOURCE CAPABILITIES</span>
            <h2>
              {selectedCategory ? selectedCategory.label : "Browse by infrastructure layer."}
            </h2>
            <p>
              {selectedCategory
                ? selectedCategory.description
                : "Filter by capability or region, then open the provider's own technical material to evaluate fit for your deployment."}
            </p>
          </div>
          <label className="eco-search">
            <span>SEARCH</span>
            <input
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setQuery(event.target.value)
              }
              placeholder="Provider, capability or region…"
            />
          </label>
        </div>

        <div className="eco-filter-row">
          <button
            type="button"
            className={active === "all" ? "active" : ""}
            onClick={() => setActive("all")}
          >
            <b>All providers</b>
            <span>{PROVIDERS.length}</span>
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={active === category.id ? "active" : ""}
              onClick={() => setActive(category.id)}
            >
              <b>{category.label}</b>
              <span>
                {
                  PROVIDERS.filter((provider) =>
                    provider.categories.includes(category.id),
                  ).length
                }
              </span>
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
              <span>BLUEBALLS INTEGRATION SURFACES</span>
              <div>
                {selectedCategory.blueballs.map((module) => (
                  <b key={module}>{module}</b>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="eco-results-line">
          <span>
            {filtered.length} {filtered.length === 1 ? "provider" : "providers"}
          </span>
          <span>
            Official provider material · latest evidence {latestEvidenceDate ?? "tracked per listing"}
          </span>
        </div>

        <div className="eco-provider-grid">
          {filtered.map((provider) => (
            <ProviderCard provider={provider} key={provider.id} />
          ))}
          <EcosystemFillers count={filtered.length} columns={3} />
          <EcosystemFillers count={filtered.length} columns={2} />
        </div>

        {filtered.length === 0 && (
          <div className="eco-empty">
            No provider matches “{query}” in this infrastructure layer.
          </div>
        )}
      </section>

      <section className="eco-bottom">
        <div>
          <span>PROVIDER ORCHESTRATION</span>
          <h2>Change external rails without changing your financial core.</h2>
          <p>
            Blueballs maps provider execution into durable intents, encrypted
            payloads, stable external idempotency keys, leases, retries and
            reconciliation. Product code continues to speak the canonical
            Blueballs contract while the deployment controls the provider stack.
          </p>
        </div>
        <div className="eco-bottom-actions">
          <button type="button" onClick={() => onNavigate("/developers")}>
            View API contracts
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onNavigate("/sandbox")}
          >
            Launch sandbox
          </button>
        </div>
      </section>

      <div className="eco-disclaimer">
        <span style={{ fontFamily: MONO }}>EVIDENCE MODEL</span>
        <p>
          Provider capabilities are compiled from official provider materials and
          carry an evidence date per listing. Availability changes by product,
          entity and jurisdiction; each deployment establishes its own commercial,
          regulatory and operational relationships while Blueballs keeps the core
          provider-neutral.
        </p>
      </div>
    </div>
  );
}
