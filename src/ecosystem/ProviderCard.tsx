import { useMemo, useState } from "react";
import { CATEGORY_MAP, type Provider } from "./data";

function domainFor(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function logoCandidates(url: string) {
  try {
    const origin = new URL(url).origin;
    return [
      `${origin}/favicon.svg`,
      `${origin}/favicon.ico`,
      `${origin}/favicon-32x32.png`,
      `${origin}/favicon.png`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/logo.svg`,
    ];
  } catch { return []; }
}

function ProviderLogo({ provider, large = false }: { provider: Provider; large?: boolean }) {
  const candidates = useMemo(() => logoCandidates(provider.url), [provider.url]);
  const [index, setIndex] = useState(0);
  const failed = index >= candidates.length;
  const initials = provider.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <span className={`eco-logo ${large ? "eco-logo-large" : ""}`} aria-hidden="true">
    {failed ? <span>{initials}</span> : <img src={candidates[index]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIndex((current) => current + 1)} />}
  </span>;
}

export default function ProviderCard({ provider, featured = false }: { provider: Provider; featured?: boolean }) {
  const primary = CATEGORY_MAP[provider.categories[0]];
  return <a className={`eco-provider-card ${featured ? "eco-provider-featured" : ""}`} href={provider.url} target="_blank" rel="noreferrer" aria-label={`${provider.name} official website`}>
    <div className="eco-provider-top">
      <div className="eco-provider-brand"><ProviderLogo provider={provider} large={featured} /><div><strong>{provider.name}</strong><span>{domainFor(provider.url)}</span></div></div>
      <span className="eco-provider-kind">{provider.kind}</span>
    </div>
    <div className="eco-chip-row">{provider.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
    <div className="eco-provider-meta">
      <div><small>PRIMARY LAYER</small><b>{primary.label}</b></div>
      <div><small>REGION</small><b>{provider.regions.join(" · ")}</b></div>
    </div>
    <div className="eco-provider-link">Open company website <span>↗</span></div>
  </a>;
}
