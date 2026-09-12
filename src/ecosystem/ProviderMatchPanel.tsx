import { useEffect, useMemo, useState } from "react";
import { trackGrowthEvent } from "../growth/events";
import { CATEGORY_MAP, PROVIDERS } from "./data";
import { matchProvidersForBlueprint } from "./matching";
import type { Provider } from "./types";
import "./ProviderMatchPanel.css";

const SHORTLIST_KEY = "blueballs_provider_shortlist";
const MAX_SHORTLIST = 3;

type ProviderMatchBlueprint = {
  markets: string[];
  capabilities: string[];
  rails: string[];
};

type ProviderMatchPanelProps = {
  blueprint: ProviderMatchBlueprint;
  onNavigate: (path: string) => void;
};

function readShortlist() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(
      window.localStorage.getItem(SHORTLIST_KEY) || "[]",
    );
    const providerIds = new Set(PROVIDERS.map((provider) => provider.id));
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is string =>
              typeof item === "string" && providerIds.has(item),
          )
          .slice(0, MAX_SHORTLIST)
      : [];
  } catch {
    return [] as string[];
  }
}

function writeShortlist(ids: string[]) {
  try {
    window.localStorage.setItem(SHORTLIST_KEY, JSON.stringify(ids));
  } catch {
    // The decision experience still works if local storage is unavailable.
  }
}

function ProviderMatchCard({
  provider,
  reasons,
  categories,
  shortlisted,
  onToggle,
}: {
  provider: Provider;
  reasons: string[];
  categories: string[];
  shortlisted: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`builder-provider-match${shortlisted ? " is-shortlisted" : ""}`}
    >
      <div className="builder-provider-match-head">
        <div>
          <span>{categories.join(" · ")}</span>
          <h4>{provider.name}</h4>
        </div>
        <span className="builder-provider-kind">{provider.kind}</span>
      </div>
      <p>{provider.provides}</p>
      <div className="builder-provider-reasons">
        {reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <div className="builder-provider-actions">
        <button type="button" onClick={onToggle} aria-pressed={shortlisted}>
          {shortlisted ? "Shortlisted ✓" : "Add to shortlist"}
        </button>
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackGrowthEvent("provider_outbound", {
              provider: provider.id,
              destination: "docs",
              context: "blueprint_match",
            })
          }
        >
          Technical docs ↗
        </a>
      </div>
    </article>
  );
}

export default function ProviderMatchPanel({
  blueprint,
  onNavigate,
}: ProviderMatchPanelProps) {
  const [shortlist, setShortlist] = useState<string[]>(readShortlist);
  const [notice, setNotice] = useState("");
  const matches = useMemo(
    () =>
      matchProvidersForBlueprint({
        markets: blueprint.markets,
        capabilities: blueprint.capabilities,
        rails: blueprint.rails,
      }),
    [blueprint.capabilities, blueprint.markets, blueprint.rails],
  );

  useEffect(() => {
    trackGrowthEvent("blueprint_provider_matches_view", {
      matches: matches.length,
      markets: blueprint.markets.length,
      capabilities: blueprint.capabilities.length,
      rails: blueprint.rails.length,
    });
  }, [
    blueprint.capabilities.length,
    blueprint.markets.length,
    blueprint.rails.length,
    matches.length,
  ]);

  const toggleShortlist = (provider: Provider) => {
    const selected = shortlist.includes(provider.id);
    if (!selected && shortlist.length >= MAX_SHORTLIST) {
      setNotice(
        `Your provider shortlist already has ${MAX_SHORTLIST} companies.`,
      );
      return;
    }
    const next = selected
      ? shortlist.filter((id) => id !== provider.id)
      : [...shortlist, provider.id];
    setShortlist(next);
    writeShortlist(next);
    setNotice("");
    trackGrowthEvent(selected ? "provider_unshortlist" : "provider_shortlist", {
      provider: provider.id,
      context: "blueprint_match",
      shortlist_size: next.length,
    });
  };

  if (matches.length === 0) return null;

  return (
    <section className="builder-provider-panel">
      <div className="builder-provider-panel-head">
        <div>
          <span>INFRASTRUCTURE MATCHES</span>
          <h3>Providers that fit this Blueprint.</h3>
          <p>
            Ranked from the capabilities, markets and rails in this Builder
            Blueprint. Commercial relationships do not affect the order.
          </p>
        </div>
        <button type="button" onClick={() => onNavigate("/ecosystem")}>
          Explore provider directory →
        </button>
      </div>
      {notice && <div className="builder-provider-notice">{notice}</div>}
      <div className="builder-provider-grid">
        {matches.map((match) => (
          <ProviderMatchCard
            key={match.provider.id}
            provider={match.provider}
            reasons={match.reasons}
            categories={match.matchedCategories.map(
              (category) => CATEGORY_MAP[category].label,
            )}
            shortlisted={shortlist.includes(match.provider.id)}
            onToggle={() => toggleShortlist(match.provider)}
          />
        ))}
      </div>
      <p className="builder-provider-method">
        Matching is a discovery aid, not a recommendation. Blueballs uses
        declared provider coverage and the current Blueprint; verify licensing,
        commercial terms, technical fit and market availability with each
        provider before launch.
      </p>
    </section>
  );
}
