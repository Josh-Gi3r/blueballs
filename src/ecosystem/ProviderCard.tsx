import { useState } from "react";
import { CATEGORY_MAP, type Provider } from "./data";

function domainFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ProviderLogo({ provider }: { provider: Provider }) {
  const [failed, setFailed] = useState(false);
  const initials = provider.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className="eco-logo" aria-hidden="true">
      {failed ? (
        <span>{initials}</span>
      ) : (
        <img
          src={`/provider-logos/${provider.id}.png`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export default function ProviderCard({ provider }: { provider: Provider }) {
  const primary = CATEGORY_MAP[provider.categories[0]];
  return (
    <article className="eco-provider-card">
      <div className="eco-provider-top">
        <a
          className="eco-provider-brand"
          href={provider.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${provider.name} official website`}
        >
          <ProviderLogo provider={provider} />
          <div>
            <strong>{provider.name}</strong>
            <span>{domainFor(provider.url)}</span>
          </div>
        </a>
        <span className="eco-provider-kind">{provider.kind}</span>
      </div>
      <p>{provider.provides}</p>
      <div className="eco-chip-row">
        {provider.capabilities.map((capability) => (
          <span key={capability}>{capability}</span>
        ))}
      </div>
      <div className="eco-provider-access">
        <div>
          <small>ACCESS</small>
          <b>{provider.access}</b>
        </div>
        <div>
          <small>SANDBOX</small>
          <b>{provider.sandbox}</b>
        </div>
        <div>
          <small>TECHNICAL STATUS</small>
          <b>{provider.technicalStatus}</b>
        </div>
      </div>
      <div className="eco-provider-modules">
        <small>RELATIONSHIP · AS OF {provider.asOf}</small>
        <span>{provider.relationshipStatus}</span>
      </div>
      <div className="eco-provider-modules">
        <small>COULD CONNECT TO</small>
        <span>{provider.modules.join(" · ")}</span>
      </div>
      <div className="eco-provider-meta">
        <div>
          <small>PRIMARY LAYER</small>
          <b>{primary.label}</b>
        </div>
        <div>
          <small>REGION</small>
          <b>{provider.regions.join(" · ")}</b>
        </div>
      </div>
      <div className="eco-provider-links">
        <a href={provider.docsUrl} target="_blank" rel="noreferrer">
          Technical docs <span>↗</span>
        </a>
        <a href={provider.url} target="_blank" rel="noreferrer">
          Company <span>↗</span>
        </a>
      </div>
    </article>
  );
}
