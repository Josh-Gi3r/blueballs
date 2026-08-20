import type { FinalFxContext } from "./final-fx-context";
import type { InspectorView } from "./final-fx-definitions";

export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  return (
    <div className="section-head fade-up">
      <div className="eyebrow">{eyebrow}</div>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function TreasurySection({ ctx }: { ctx: FinalFxContext }) {
  const { state, corridor, activeReservations, riskUsed, riskRemaining, riskPct, money } = ctx;
  return (
    <section className="section" id="treasury">
      <div className="section-inner">
        <SectionHead eyebrow="07 · TREASURY LIMITS" title="Use balance-sheet liquidity without exceeding the risk limit.">
          The institution can fill part of a quote from its own balance sheet. Open positions and active reservations reduce the remaining capacity. When the limit is reached, the router removes treasury and either uses another source or returns no quote.
        </SectionHead>
        <div className="treasury-stage fade-up">
          <div className="risk-chart">
            <span className="small-label">INSTITUTION BALANCE-SHEET CAPACITY · SIMULATION</span>
            <svg viewBox="0 0 900 270" role="img" aria-label="Illustrative principal risk curve">
              <defs>
                <linearGradient id="bbfx-risk-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0868ff" stopOpacity=".25" />
                  <stop offset="1" stopColor="#0868ff" stopOpacity=".02" />
                </linearGradient>
              </defs>
              <g stroke="#eef0f5" strokeWidth="1">
                <line x1="0" y1="54" x2="900" y2="54" />
                <line x1="0" y1="105" x2="900" y2="105" />
                <line x1="0" y1="156" x2="900" y2="156" />
                <line x1="0" y1="207" x2="900" y2="207" />
              </g>
              <path d="M0 235 C160 232 265 219 370 190 C480 160 565 101 660 40 C735 8 815 7 900 7 L900 246 L0 246 Z" fill="url(#bbfx-risk-fill)" />
              <path d="M0 235 C160 232 265 219 370 190 C480 160 565 101 660 40 C735 8 815 7 900 7" fill="none" stroke="#2f6bff" strokeWidth="5" strokeLinecap="round" />
              <line x1={state.scenario === "treasury_limit" ? 520 : 650} y1="6" x2={state.scenario === "treasury_limit" ? 520 : 650} y2="246" stroke="#b4453c" strokeWidth="2" strokeDasharray="8 7" />
              <rect x={state.scenario === "treasury_limit" ? 460 : 590} y="14" width="120" height="40" rx="10" fill="#fdf1ef" stroke="#ebccc7" />
              <text x={state.scenario === "treasury_limit" ? 520 : 650} y="30" textAnchor="middle" fill="#b4453c" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="700">RISK LIMIT</text>
              <text x={state.scenario === "treasury_limit" ? 520 : 650} y="45" textAnchor="middle" fill="#b4453c" fontFamily="Arial" fontSize="11" fontWeight="700">treasury stops here</text>
            </svg>
            <div className="risk-axis"><span>balanced flow</span><span>increasing one-way demand</span><span>limit reached</span></div>
          </div>
          <div className="risk-book">
            <span className="small-label risk-kicker">TREASURY CAPACITY · SIMULATION</span>
            <h3>Positions and reservations reduce the amount still available.</h3>
            <div className="risk-row"><span>Used in this exchange</span><b>{money(corridor, riskUsed, "from")}</b></div>
            <div className="risk-row"><span>Active reservations</span><b>{money(corridor, activeReservations, "from")}</b></div>
            <div className="risk-row"><span>Capacity remaining</span><b>{money(corridor, riskRemaining, "from")}</b></div>
            <div className="risk-meter"><i style={{ width: `${riskPct}%` }} /></div>
            <div className="risk-refusal">{state.scenario === "treasury_limit" ? "TREASURY REMOVED: EXPOSURE LIMIT REACHED" : "NEXT QUOTE REMAINS WITHIN THE LIMIT"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LabSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, setState, corridor, available, scenario, SCENARIO_CATALOG } = ctx;
  return (
    <section className="section" id="lab">
      <div className="section-inner">
        <SectionHead eyebrow="08 · FAILURE SCENARIOS" title="See what happens when a source or settlement step fails.">
          The available tests change with the selected setup. Payment-proof replay appears only when the route contains a P2P payment, and payout pending appears only when the route contains an external payout. Every result is simulated.
        </SectionHead>
        <div className="lab-shell fade-up">
          <div className="lab-controls">
            <div className="scenario-buttons">
              {available.map((scenarioId) => (
                <button type="button" key={scenarioId} className={state.scenario === scenarioId ? "active" : ""} onClick={() => setState((current) => ({ ...current, scenario: scenarioId }))}>
                  {SCENARIO_CATALOG[scenarioId].label}
                </button>
              ))}
            </div>
          </div>
          <div className="lab-grid">
            <div className="lab-panel">
              <span className="small-label">ROUTE RESULT</span>
              <h3>{scenario.title}</h3>
              <div className="lab-flow">
                {scenario.flow.map(([title, detail, tone]) => (
                  <div className={`lab-flow-step ${tone === "failed" ? "failed" : tone === "pending" ? "pending" : ""}`} key={`${title}-${detail}`}>
                    <i>{tone === "failed" ? "×" : tone === "pending" ? "…" : "✓"}</i><b>{title}</b><span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lab-panel">
              <span className="small-label">OPERATOR STATE</span>
              <h3>State changes</h3>
              <div className="timeline">
                {scenario.timeline.map(([title, detail]) => (
                  <div className="timeline-row" key={`${title}-${detail}`}>
                    <div className="timeline-marker" /><div className="timeline-copy"><b>{title}</b><span>{detail}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lab-panel">
              <span className="small-label">EVENT PAYLOAD</span>
              <h3>Generated event data</h3>
              <pre className="lab-code">{JSON.stringify({ simulation: true, scenario: state.scenario, corridor: `${corridor.from}/${corridor.to}`, productModel: state.journey, ...scenario.event }, null, 2)}</pre>
            </div>
          </div>
          <div className="lab-assurances">
            {scenario.assurances.map(([title, detail]) => <div key={`${title}-${detail}`}><b>{title}</b><span>{detail}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function InspectSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, setState, inspector } = ctx;
  const inspectorLabels: Record<InspectorView, string> = {
    request: "Request",
    route: "Route",
    policy: "Policy",
    finality: "Finality",
    events: "Events",
    source: "Source",
  };
  const capabilities = [
    ["Private FX market", "IMPLEMENTED · DEPLOYMENT VERIFIER REQUIRED", "built"],
    ["Cross-source routing", "IMPLEMENTED", "built"],
    ["Participation policy", "IMPLEMENTED", "built"],
    ["Principal pricing and risk", "REFERENCE IMPLEMENTATION", "reference"],
    ["Atomic token contracts", "IMPLEMENTED + TESTED · RUNTIME NOT CONNECTED", "reference"],
    ["Fiat intent and evidence", "IMPLEMENTED · NO RAIL ADAPTER", "reference"],
    ["Provider, issuer and P2P adapters", "NOT CONNECTED", "not-connected"],
    ["Website", "SIMULATION", "simulated"],
  ] as const;

  return (
    <section className="section" id="inspect">
      <div className="section-inner">
        <SectionHead eyebrow="09 · CODE AND STATUS" title="See what is implemented and what still requires an integration.">
          The inspector shows example objects for the current simulation. The capability grid states which parts are implemented, reference-only or not connected. This page does not call the FX runtime or an external provider.
        </SectionHead>

        <div className="implementation-board fade-up">
          <div className="implementation-head">
            <div><span className="small-label">REPOSITORY STATUS</span><h3>Current implementation</h3></div>
            <p>Status reflects the repository modules used by this page, not a live commercial deployment.</p>
          </div>
          <div className="implementation-grid">
            {capabilities.map(([label, status, tone]) => (
              <article className="implementation-card" key={label}>
                <span>{label}</span>
                <b className={tone}>{status}</b>
              </article>
            ))}
          </div>
        </div>

        <div className="inspector inspector-full fade-up">
          <div className="inspector-tabs">
            {(["request", "route", "policy", "finality", "events", "source"] as InspectorView[]).map((view) => (
              <button type="button" key={view} className={state.inspector === view ? "active" : ""} onClick={() => setState((current) => ({ ...current, inspector: view }))}>
                {inspectorLabels[view]}
              </button>
            ))}
          </div>
          <div className="inspector-window compact">
            <div className="inspector-top"><span>{inspector.label}</span><span>{inspector.status}</span></div>
            <pre>{inspector.value}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClosingSection({ ctx }: { ctx: FinalFxContext }) {
  const { scrollTo } = ctx;
  return (
    <section className="closing">
      <div className="closing-inner">
        <h2>Build from the reference implementation.</h2>
        <div>
          <p>The repository contains modules for FX policy, private orders, liquidity routing, pricing, fiat settlement models and token contracts. This page shows how they fit together and states which parts are implemented, reference-only or not connected.</p>
          <button className="btn" type="button" onClick={() => scrollTo("inspect")}>Review implementation status</button>
          <div className="closing-note">WEBSITE SIMULATION · FIXED REFERENCE DATA · NO BACKEND CALLS · NO LIVE LIQUIDITY · NO MONEY MOVES</div>
        </div>
      </div>
    </section>
  );
}
