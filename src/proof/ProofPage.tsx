import { useEffect, useMemo, useState } from "react";
import { BrandLockup } from "../Brand";
import { TOTAL_ENDPOINTS } from "../endpoints";
import { trackGrowthEvent } from "../growth/events";
import {
  DEPLOYMENT_PROOF,
  FULL_RELEASE_PROOF,
  STANDARD_PROOF,
  type ProofItem,
} from "./proof-data";
import "./proof.css";

type ProofPageProps = {
  onNavigate: (path: string) => void;
};

type Health = {
  status?: string;
  source_commit?: string | null;
  deployment_consistent?: boolean;
  banking_api?: number;
  banking_source_commit?: string | null;
  fx_api?: number;
  fx_source_commit?: string | null;
};

function shortSha(value?: string | null) {
  return value && /^[0-9a-f]{7,64}$/i.test(value) ? value.slice(0, 10) : "—";
}

function sourceUrl(value?: string | null) {
  return value && /^[0-9a-f]{40}$/i.test(value)
    ? `https://github.com/Josh-Gi3r/blueballs/commit/${value}`
    : null;
}

function ProofList({ items }: { items: ProofItem[] }) {
  return (
    <div className="proof-list">
      {items.map((item, index) => (
        <article key={item.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
          <a
            href={item.source}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackGrowthEvent("proof_source_open", { surface: item.title })
            }
          >
            Source ↗
          </a>
        </article>
      ))}
    </div>
  );
}

export default function ProofPage({ onNavigate }: ProofPageProps) {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let alive = true;
    trackGrowthEvent("proof_page_view", { catalogue_operations: TOTAL_ENDPOINTS });
    void fetch("/api/health", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as Health;
      })
      .then((body) => {
        if (!alive) return;
        setHealth(body);
        setHealthState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setHealthState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const liveConsistent = health?.deployment_consistent === true;
  const liveStatus = useMemo(() => {
    if (healthState === "loading") return "Checking live deployment…";
    if (healthState === "error") return "Live parity unavailable";
    return liveConsistent ? "One source SHA across the stack" : "Mixed deployment detected";
  }, [healthState, liveConsistent]);
  const commitUrl = sourceUrl(health?.source_commit);

  return (
    <main className="proof-page">
      <header className="proof-header">
        <button type="button" onClick={() => onNavigate("/home")}>
          <BrandLockup linked={false} />
        </button>
        <nav>
          <button type="button" onClick={() => onNavigate("/blueprint")}>
            Blueprints
          </button>
          <button type="button" onClick={() => onNavigate("/developers")}>
            Developers
          </button>
          <button type="button" onClick={() => onNavigate("/contact")}>
            Build with us
          </button>
        </nav>
      </header>

      <section className="proof-hero">
        <div>
          <span>BLUEBALLS PROOF</span>
          <h1>Financial infrastructure should show its work.</h1>
          <p>
            Blueballs keeps verification inspectable. The live card below reads
            the source SHAs reported by the deployed site, banking and FX stack.
            The rest of this page documents the release gate that must run before
            a production promotion.
          </p>
        </div>
        <div className="proof-hero-stat">
          <span>BANKING CONTRACT</span>
          <b>{TOTAL_ENDPOINTS}</b>
          <small>documented API operations in the current catalogue</small>
        </div>
      </section>

      <section className="proof-live">
        <div className="proof-section-head">
          <div>
            <span>LIVE DEPLOYMENT</span>
            <h2>Source parity, from the running stack.</h2>
          </div>
          <strong className={liveConsistent ? "ok" : healthState}>
            <i /> {liveStatus}
          </strong>
        </div>
        <div className="proof-live-grid">
          <article>
            <span>SITE</span>
            <b>{shortSha(health?.source_commit)}</b>
            <small>{healthState === "ready" ? health?.status ?? "unknown" : healthState}</small>
          </article>
          <article>
            <span>BANKING</span>
            <b>{shortSha(health?.banking_source_commit)}</b>
            <small>
              {typeof health?.banking_api === "number"
                ? `HTTP ${health.banking_api}`
                : healthState}
            </small>
          </article>
          <article>
            <span>FX</span>
            <b>{shortSha(health?.fx_source_commit)}</b>
            <small>
              {typeof health?.fx_api === "number" ? `HTTP ${health.fx_api}` : healthState}
            </small>
          </article>
          <article className="proof-live-convergence">
            <span>DEPLOYMENT CONSISTENCY</span>
            <b>{healthState === "ready" ? (liveConsistent ? "YES" : "NO") : "—"}</b>
            <small>site + banking + FX exact-source convergence</small>
          </article>
        </div>
        <div className="proof-live-foot">
          <p>
            These are live deployment facts, not a cached badge. The health
            endpoint compares source commits reported by the currently running
            components.
          </p>
          {commitUrl && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackGrowthEvent("proof_source_open", { surface: "live_commit" })
              }
            >
              Inspect deployed commit ↗
            </a>
          )}
        </div>
      </section>

      <section className="proof-section">
        <div className="proof-section-head">
          <div>
            <span>STANDARD VERIFICATION</span>
            <h2>What `pnpm verify` checks.</h2>
          </div>
          <code>pnpm verify</code>
        </div>
        <ProofList items={STANDARD_PROOF} />
      </section>

      <section className="proof-section proof-section-dark">
        <div className="proof-section-head">
          <div>
            <span>FULL RELEASE PROFILE</span>
            <h2>What gets added before publication.</h2>
          </div>
          <code>pnpm verify:release</code>
        </div>
        <ProofList items={FULL_RELEASE_PROOF} />
      </section>

      <section className="proof-section">
        <div className="proof-section-head">
          <div>
            <span>DEPLOYMENT PROMOTION</span>
            <h2>The checkout and the live stack must agree.</h2>
          </div>
          <code>pnpm deploy:cloudflare</code>
        </div>
        <ProofList items={DEPLOYMENT_PROOF} />
      </section>

      <section className="proof-close">
        <div>
          <span>INSPECTABLE BY DESIGN</span>
          <h2>Use the proof. Fork the system. Change what your institution needs.</h2>
          <p>
            Release proof is generated for an exact checkout and tied to its
            commit. The scripts, tests and deployment checks are part of the MIT-
            licensed repository, so teams can inspect, extend or replace the gate
            alongside the product.
          </p>
        </div>
        <div>
          <a
            href="https://github.com/Josh-Gi3r/blueballs"
            target="_blank"
            rel="noreferrer"
            onClick={() => trackGrowthEvent("proof_source_open", { surface: "repo" })}
          >
            Inspect the source ↗
          </a>
          <button type="button" onClick={() => onNavigate("/contact")}>
            Build with Blueballs →
          </button>
        </div>
      </section>
    </main>
  );
}
