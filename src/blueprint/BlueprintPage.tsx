import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BrandLockup } from "../Brand";
import ProviderMatchPanel from "../ecosystem/ProviderMatchPanel";
import { trackGrowthEvent } from "../growth/events";
import { decodeBlueprintShare, encodeBlueprintShare } from "./share";
import "./BlueprintPage.css";

type BlueprintPageProps = {
  onNavigate: (path: string) => void;
};

function Chips({ items }: { items: string[] }) {
  if (items.length === 0)
    return <span className="shared-blueprint-empty">Not specified</span>;
  return (
    <div className="shared-blueprint-chips">
      {items.map((item) => (
        <span key={item}>{item.replaceAll("_", " ")}</span>
      ))}
    </div>
  );
}

export default function BlueprintPage({ onNavigate }: BlueprintPageProps) {
  const [copied, setCopied] = useState(false);
  const blueprint = useMemo(
    () => decodeBlueprintShare(window.location.hash),
    [],
  );

  useEffect(() => {
    if (!blueprint) return;
    trackGrowthEvent("blueprint_public_view", {
      markets: blueprint.markets.length,
      currencies: blueprint.currencies.length,
      capabilities: blueprint.capabilities.length,
      rails: blueprint.rails.length,
    });
  }, [blueprint]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      trackGrowthEvent("blueprint_share", { source: "shared_blueprint" });
    } catch {
      setCopied(false);
    }
  }

  function forkBlueprint() {
    if (!blueprint) return;
    const hash = encodeBlueprintShare(blueprint);
    trackGrowthEvent("blueprint_fork_start", {
      markets: blueprint.markets.length,
      capabilities: blueprint.capabilities.length,
    });
    onNavigate(`/sandbox${hash}`);
  }

  if (!blueprint) {
    return (
      <main className="shared-blueprint-page">
        <header className="shared-blueprint-header">
          <button type="button" onClick={() => onNavigate("/home")}>
            <BrandLockup linked={false} />
          </button>
          <span>BLUEPRINTS</span>
        </header>
        <section className="shared-blueprint-invalid">
          <span>SHAREABLE PRODUCT ARCHITECTURE</span>
          <h1>
            Turn a financial-product idea into something people can inspect and
            fork.
          </h1>
          <p>
            Blueballs Blueprints capture the public-safe structure of a product:
            markets, currencies, capabilities and rails. Share the architecture,
            inspect matching infrastructure, then fork it back into Builder
            without exposing sandbox customers, balances, keys or transactions.
          </p>
          <button type="button" onClick={() => onNavigate("/sandbox")}>
            Build a Blueprint →
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="shared-blueprint-page"
      style={
        {
          "--blueprint-accent": blueprint.accent ?? "#0868FF",
        } as CSSProperties
      }
    >
      <header className="shared-blueprint-header">
        <button type="button" onClick={() => onNavigate("/home")}>
          <BrandLockup linked={false} />
        </button>
        <div>
          <span>SHARED BLUEPRINT</span>
          <button type="button" onClick={copyLink}>
            {copied ? "Link copied ✓" : "Copy link"}
          </button>
        </div>
      </header>

      <section className="shared-blueprint-hero">
        <div>
          <span>BLUEBALLS PRODUCT BLUEPRINT</span>
          <h1>{blueprint.name}</h1>
          <p>
            A shareable financial-product architecture built with Blueballs.
            Inspect the structure, explore matching infrastructure, or fork it
            into your own Builder workspace.
          </p>
        </div>
        <button type="button" onClick={forkBlueprint}>
          Fork this Blueprint →
          <small>Open the structure in Builder</small>
        </button>
      </section>

      <section className="shared-blueprint-architecture">
        <article>
          <span>MARKETS</span>
          <Chips items={blueprint.markets} />
        </article>
        <article>
          <span>CURRENCIES</span>
          <Chips items={blueprint.currencies} />
        </article>
        <article className="wide">
          <span>CAPABILITIES</span>
          <Chips items={blueprint.capabilities} />
        </article>
        <article className="wide">
          <span>RAILS</span>
          <Chips items={blueprint.rails} />
        </article>
      </section>

      <ProviderMatchPanel
        blueprint={blueprint}
        source="shared_blueprint"
        onNavigate={onNavigate}
      />

      <section className="shared-blueprint-privacy">
        <div>
          <span>PUBLIC-SAFE BY DESIGN</span>
          <strong>The shared link contains architecture, not sandbox data.</strong>
        </div>
        <p>
          Blueballs excludes sandbox IDs, API keys, customers, balances,
          transactions, free-text audience descriptions and tenant state from
          the shared Blueprint format. Provider matches are recalculated from
          the current public provider graph when the link is opened.
        </p>
      </section>
    </main>
  );
}
