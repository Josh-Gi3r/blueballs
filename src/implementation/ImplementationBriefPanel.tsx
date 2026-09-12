import { useEffect, useMemo, useState } from "react";
import { createBlueprintShareUrl } from "../blueprint/share";
import {
  PROVIDER_SHORTLIST_EVENT,
  providersForShortlist,
  readProviderShortlist,
} from "../ecosystem/shortlist";
import { trackGrowthEvent } from "../growth/events";
import {
  buildImplementationBrief,
  implementationBriefMarkdown,
  type ImplementationBlueprint,
} from "./brief";
import "./implementation-brief.css";

const IMPLEMENTATION_INTAKE =
  "https://github.com/Josh-Gi3r/blueballs/issues/new?template=implementation.yml";

type ImplementationBriefPanelProps = {
  blueprint: ImplementationBlueprint & {
    brand?: { accent?: string };
    accent?: string;
  };
  source: "builder" | "shared_blueprint";
  onNavigate: (path: string) => void;
};

export default function ImplementationBriefPanel({
  blueprint,
  source,
  onNavigate,
}: ImplementationBriefPanelProps) {
  const [shortlist, setShortlist] = useState<string[]>(readProviderShortlist);
  const [copied, setCopied] = useState(false);
  const providers = useMemo(() => providersForShortlist(shortlist), [shortlist]);
  const brief = useMemo(
    () => buildImplementationBrief(blueprint, providers),
    [blueprint, providers],
  );
  const blueprintUrl = useMemo(
    () => createBlueprintShareUrl(blueprint),
    [blueprint],
  );
  const markdown = useMemo(
    () => implementationBriefMarkdown(brief, blueprintUrl),
    [blueprintUrl, brief],
  );

  useEffect(() => {
    const sync = () => setShortlist(readProviderShortlist());
    window.addEventListener(PROVIDER_SHORTLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROVIDER_SHORTLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    trackGrowthEvent("implementation_brief_view", {
      source,
      providers: providers.length,
      workstreams: brief.workstreams.length,
      capabilities: blueprint.capabilities.length,
    });
  }, [
    blueprint.capabilities.length,
    brief.workstreams.length,
    providers.length,
    source,
  ]);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
      trackGrowthEvent("implementation_brief_copy", {
        source,
        providers: providers.length,
        workstreams: brief.workstreams.length,
      });
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="implementation-brief-panel">
      <div className="implementation-brief-head">
        <div>
          <span>TAKE IT INTO IMPLEMENTATION</span>
          <h3>Turn this Blueprint into a build brief.</h3>
          <p>
            Blueballs translates the product architecture and your provider
            shortlist into a practical implementation scope. Use it yourself,
            send it to a technical team, or bring it to Blueballs.
          </p>
        </div>
        <div className="implementation-brief-actions">
          <button type="button" onClick={() => void copyBrief()}>
            {copied ? "Brief copied ✓" : "Copy implementation brief"}
          </button>
          <a
            href={IMPLEMENTATION_INTAKE}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackGrowthEvent("implementation_intake_start", {
                source,
                providers: providers.length,
                workstreams: brief.workstreams.length,
              })
            }
          >
            Build this with Blueballs →
          </a>
        </div>
      </div>

      <div className="implementation-brief-grid">
        <article>
          <span>IMPLEMENTATION WORKSTREAMS</span>
          <ol>
            {brief.workstreams.map((workstream) => (
              <li key={workstream}>{workstream}</li>
            ))}
          </ol>
        </article>
        <article>
          <span>PROVIDER SHORTLIST</span>
          {providers.length > 0 ? (
            <div className="implementation-provider-list">
              {providers.map((provider) => (
                <div key={provider.id}>
                  <strong>{provider.name}</strong>
                  <small>{provider.kind}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="implementation-empty">
              <strong>No providers shortlisted yet.</strong>
              <p>
                The brief still works. Blueballs will treat provider discovery
                and due diligence as an implementation workstream.
              </p>
            </div>
          )}
          <p className="implementation-provider-note">
            Shortlisted providers are user-selected. Inclusion here does not
            imply a Blueballs recommendation, partnership or production
            integration.
          </p>
          <button
            type="button"
            className="implementation-directory-link"
            onClick={() => onNavigate("/ecosystem")}
          >
            {providers.length ? "Review shortlist" : "Explore providers"} →
          </button>
        </article>
      </div>

      <div className="implementation-brief-foot">
        <p>
          The GitHub implementation route is public. Copy the brief into “What
          do you want to ship?” and add only non-confidential information. Never
          include credentials, customer data or confidential commercial terms.
        </p>
        <span>OPEN SOURCE CORE · COMMERCIAL HELP OPTIONAL</span>
      </div>
    </section>
  );
}
