import type { CSSProperties } from "react";
import { trackGrowthEvent } from "../growth/events";
import { encodeBlueprintShare } from "./share";
import { BLUEPRINT_TEMPLATES, type BlueprintTemplate } from "./templates";
import "./BlueprintLibrary.css";

type BlueprintLibraryProps = {
  onNavigate: (path: string) => void;
};

function openPath(
  template: BlueprintTemplate,
  destination: "inspect" | "fork",
  onNavigate: (path: string) => void,
) {
  const hash = encodeBlueprintShare(template);
  if (!hash) return;
  trackGrowthEvent(
    destination === "inspect"
      ? "blueprint_template_open"
      : "blueprint_template_fork",
    {
      template: template.id,
      category: template.category,
      markets: template.markets.length,
      capabilities: template.capabilities.length,
    },
  );
  onNavigate(`${destination === "inspect" ? "/blueprint" : "/sandbox"}${hash}`);
}

export default function BlueprintLibrary({ onNavigate }: BlueprintLibraryProps) {
  return (
    <section className="blueprint-library">
      <div className="blueprint-library-head">
        <div>
          <span>BLUEPRINT LIBRARY</span>
          <h2>Start from a financial product, not a blank page.</h2>
          <p>
            Eight public architectures show how the same Blueballs core can be
            composed into consumer, business, treasury, cards, remittance,
            merchant, community and institutional FX products.
          </p>
        </div>
        <button type="button" onClick={() => onNavigate("/sandbox")}>
          Build from scratch →
        </button>
      </div>

      <div className="blueprint-library-grid">
        {BLUEPRINT_TEMPLATES.map((template) => (
          <article
            key={template.id}
            style={{ "--template-accent": template.accent } as CSSProperties}
          >
            <div className="blueprint-template-top">
              <span>{template.category}</span>
              <i aria-hidden="true" />
            </div>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="blueprint-template-meta">
              <span>{template.markets.join(" · ")}</span>
              <span>{template.currencies.join(" · ")}</span>
            </div>
            <div className="blueprint-template-capabilities">
              {template.capabilities.slice(0, 5).map((capability) => (
                <span key={capability}>{capability.replaceAll("_", " ")}</span>
              ))}
              {template.capabilities.length > 5 && (
                <span>+{template.capabilities.length - 5}</span>
              )}
            </div>
            <div className="blueprint-template-actions">
              <button
                type="button"
                onClick={() => openPath(template, "inspect", onNavigate)}
              >
                Inspect Blueprint
              </button>
              <button
                type="button"
                onClick={() => openPath(template, "fork", onNavigate)}
              >
                Fork in Builder →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
