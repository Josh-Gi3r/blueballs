import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { baselineScenarios, runSimulation } from "../packages/fx-simulator/src/index.js";
import { fxCall, fxNodeConfigured, FX_NODE_BASE } from "./api";

const MONO = "'IBM Plex Mono', monospace";
const RC = "02ebbf70ed6cef054549010222719d1a0357cf27";
const REPO = "https://github.com/Josh-Gi3r/blueballs";
const rcSource = (path: string) => `${REPO}/blob/${RC}/${path}`;

const ink = "#111318";
const muted = "#697184";
const line = "#DDE2EA";
const panel: CSSProperties = {
  background: "rgba(255,255,255,.94)",
  border: `1px solid ${line}`,
  borderRadius: 20,
  boxShadow: "0 14px 45px rgba(21,30,52,.05)",
};

const SOURCE_LABELS: Record<string, string> = {
  PRIVATE_MARKET: "Approved member flow",
  ISSUER: "Stablecoin issuer",
  INSTITUTIONAL_LP: "Institutional LP",
  NEOBANK: "Other neobank",
  BANK_TREASURY: "Bank treasury",
  BANK_PRINCIPAL: "Bank principal",
};

const SCENARIO_LABELS: Record<string, string> = {
  balanced: "Balanced flow",
  oneWay90: "90% one-way flow",
  lpDisappears: "Institutional LP disappears",
  issuerDisappears: "Issuer disappears",
  principalLimit: "Principal hard limit",
  referenceOutage: "Reference price outage",
  priceShock: "5% price shock",
  cancellationStorm: "Cancellation storm",
  chainCongestion: "Chain congestion",
  recovery: "Outage + recovery",
};

type SimulationResult = {
  requestedOrders: number;
  filledOrders: number;
  fillRatePct: number;
  requestedVolume: string;
  filledVolume: string;
  volumeFillPct: number;
  routeComposition: Record<string, string>;
  principalExposureB: string;
  peakPrincipalExposureAbs: string;
  principalHardLimit: string;
  rejections: { RISK_LIMIT: number; NO_LIQUIDITY: number };
  settlementFailures: number;
  referenceOutageRequests: number;
  referenceIndex: number;
};

type LiveQuote = {
  id?: string;
  quoteId?: string;
  routeId?: string;
  inputAsset?: string;
  outputAsset?: string;
  totalInput?: string;
  totalOutput?: string;
  state?: string;
  [key: string]: unknown;
};

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="fx-eyebrow">{children}</div>;
}

function Pill({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={dark ? "fx-pill fx-pill-dark" : "fx-pill"}>{children}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="fx-metric">
      <div className="fx-metric-label">{label}</div>
      <div className="fx-metric-value">{value}</div>
      {note && <div className="fx-metric-note">{note}</div>}
    </div>
  );
}

function SourceLink({ path, label = "Inspect source" }: { path: string; label?: string }) {
  return (
    <a className="fx-source-link" href={rcSource(path)} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}

function SystemFlow() {
  const steps = [
    ["01", "IDENTITY", "KYC / KYB, sanctions, AML and account attribution"],
    ["02", "POLICY", "Corridor, jurisdiction, participant class and ticket rules"],
    ["03", "AUTHORIZED LIQUIDITY", "Only eligible makers, issuers, LPs and treasury capacity enter"],
    ["04", "PRICE + ROUTE", "Executable capacity competes on exact economics; risk stays a hard gate"],
    ["05", "POLICY AUTH", "Institution grants a short-lived authorization bound into execution"],
    ["06", "SETTLEMENT", "Atomic token execution or explicitly asynchronous fiat finality"],
    ["07", "RECONCILIATION", "Submitted, confirmed, failed and ambiguous states remain reconstructable"],
  ];

  return (
    <section style={{ ...panel, padding: "24px" }}>
      <div className="fx-section-head">
        <div>
          <Eyebrow>SEE IT · THE EXECUTION PERIMETER</Eyebrow>
          <h2 className="fx-h2">Compliance is upstream of price.</h2>
        </div>
        <SourceLink path="spec/fx/ARCHITECTURE.md" label="Architecture" />
      </div>
      <div className="fx-flow" data-scroll>
        {steps.map(([n, title, text], i) => (
          <div key={title} className={i === 4 ? "fx-flow-step fx-flow-step-dark" : "fx-flow-step"}>
            <div className="fx-step-number">{n}</div>
            <div className="fx-step-title">{title}</div>
            <div className="fx-step-copy">{text}</div>
          </div>
        ))}
      </div>
      <div className="fx-callout">
        <strong>Cryptographically valid is not enough.</strong> The Router independently requires a live institution policy authorization. Expiry, individual revocation or policy-epoch invalidation blocks settlement even when maker and taker signatures remain valid.
      </div>
    </section>
  );
}

function ScenarioLab() {
  const scenarios = useMemo(() => baselineScenarios(), []);
  const [scenario, setScenario] = useState("balanced");
  const result = useMemo(
    () => runSimulation((scenarios as Record<string, unknown>)[scenario]) as SimulationResult,
    [scenario, scenarios],
  );
  const totalRouted = Object.values(result.routeComposition).reduce((sum, value) => sum + BigInt(value), 0n);
  const principal = BigInt(result.peakPrincipalExposureAbs);
  const limit = BigInt(result.principalHardLimit);
  const utilization = limit === 0n ? 0 : Math.min(100, Number((principal * 10_000n) / limit) / 100);

  return (
    <section style={{ ...panel, overflow: "hidden" }}>
      <div className="fx-panel-head">
        <div>
          <Eyebrow>BREAK IT · REAL SIMULATOR</Eyebrow>
          <h2 className="fx-h2">Change the market. Watch routing survive or refuse.</h2>
          <p className="fx-copy">This imports the same deterministic simulator used by the FX-8 CI gate and calls the real exact-output liquidity planner. It is not a frontend recreation.</p>
        </div>
        <div className="fx-head-actions">
          <SourceLink path="packages/fx-simulator/src/simulator.js" label="Simulator" />
          <select className="fx-select" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {Object.keys(SCENARIO_LABELS).map((key) => <option key={key} value={key}>{SCENARIO_LABELS[key]}</option>)}
          </select>
        </div>
      </div>

      <div className="fx-panel-body">
        <div className="fx-metric-grid">
          <Metric label="ORDER FILL RATE" value={`${result.fillRatePct.toFixed(1)}%`} note={`${result.filledOrders}/${result.requestedOrders} orders`} />
          <Metric label="VOLUME FILLED" value={`${result.volumeFillPct.toFixed(1)}%`} note={`${result.filledVolume} / ${result.requestedVolume}`} />
          <Metric label="PRINCIPAL PEAK" value={`${utilization.toFixed(1)}%`} note={`${result.peakPrincipalExposureAbs} / ${result.principalHardLimit}`} />
          <Metric label="NO LIQUIDITY" value={String(result.rejections.NO_LIQUIDITY)} note="fail closed" />
          <Metric label="SETTLEMENT FAILURES" value={String(result.settlementFailures)} note="not counted as fills" />
        </div>

        <div className="fx-sim-grid">
          <div className="fx-inset">
            <div className="fx-mini-title">WHO ACTUALLY FILLED THE FLOW</div>
            <div className="fx-bars">
              {Object.entries(result.routeComposition).map(([type, value]) => {
                const amount = BigInt(value);
                const width = totalRouted === 0n ? 0 : Math.max(0.5, Number((amount * 10_000n) / totalRouted) / 100);
                return (
                  <div key={type}>
                    <div className="fx-bar-label"><span>{SOURCE_LABELS[type] ?? type}</span><span>{value}</span></div>
                    <div className="fx-bar-track"><div className="fx-bar-fill" style={{ width: `${width}%`, opacity: amount === 0n ? 0 : 1 }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="fx-risk-card">
            <div className="fx-mini-title fx-mini-title-dark">HARD TREASURY LIMIT</div>
            <div className="fx-ring" style={{ background: `conic-gradient(#8799F0 ${utilization * 3.6}deg,#292E39 0deg)` }}>
              <div className="fx-ring-inner"><strong>{utilization.toFixed(0)}%</strong><span>PEAK</span></div>
            </div>
            <p>Hard risk is not a price. When capacity is gone, the engine rejects flow instead of widening spread until someone accepts it.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompliancePanel() {
  const checks = [
    ["Identity credentials", "KYC / KYB / sanctions / AML", "OFF-CHAIN"],
    ["Institution rules", "corridor · jurisdiction · ticket · participant class", "OFF-CHAIN"],
    ["Account attribution", "settlement account belongs to the approved participant", "OFF-CHAIN"],
    ["Authorization freshness", "participant epoch + policy version + expiry", "OFF-CHAIN"],
    ["Execution authority", "policyAuthorizationHash must still be live", "ON-CHAIN"],
  ];
  return (
    <section style={{ ...panel, padding: "27px 28px" }}>
      <div className="fx-section-head">
        <div>
          <Eyebrow>UNDERSTAND IT · COMPLIANCE</Eyebrow>
          <h2 className="fx-h2">The market never sees ineligible liquidity.</h2>
        </div>
        <div className="fx-head-actions">
          <SourceLink path="packages/fx-policy/src/policy-engine.js" label="Policy engine" />
          <SourceLink path="packages/fx-contracts/src/PolicyAuthorizationRegistry.sol" label="On-chain guard" />
        </div>
      </div>
      <p className="fx-copy">KYC providers supply identity facts. Blueballs owns the authorization framework that decides whether those facts permit this participant, corridor and amount to become executable.</p>
      <div className="fx-checks">
        {checks.map(([title, text, where]) => (
          <div className="fx-check-row" key={title}>
            <strong>{title}</strong><span>{text}</span><code>{where}</code>
          </div>
        ))}
      </div>
      <div className="fx-two-col">
        <div className="fx-approved"><strong>APPROVED</strong><span>Eligible liquidity can now compete on price.</span></div>
        <div className="fx-rejected"><strong>REJECTED</strong><span>It never becomes a candidate route, regardless of price.</span></div>
      </div>
    </section>
  );
}

function SettlementGraph() {
  const legs = [
    ["MYR", "VERIFIED FIAT PAYMENT", "USDC", "ASYNC / ATTESTED"],
    ["USDC", "TOKEN SWAP", "EURC", "ATOMIC"],
    ["EURC", "ISSUER REDEMPTION", "EUR", "ASYNC / EXTERNAL"],
  ];
  return (
    <section style={{ ...panel, padding: "27px 28px" }}>
      <div className="fx-section-head">
        <div>
          <Eyebrow>INSPECT IT · SETTLEMENT GRAPH</Eyebrow>
          <h2 className="fx-h2">Atomic where it is true. Explicit where it is not.</h2>
        </div>
        <SourceLink path="packages/fx-fiat/src/settlement-graph.js" label="Settlement graph" />
      </div>
      <p className="fx-copy">Blueballs can route across token swaps, issuer mint/redeem, internal ledgers, bank rails and verified fiat. It never upgrades asynchronous fiat finality into an “atomic” marketing claim.</p>
      <div className="fx-route" data-scroll>
        {legs.map(([from, kind, to, finality], i) => (
          <div className="fx-route-leg" key={kind}>
            <div className="fx-route-assets"><strong>{from}</strong><span>→</span><strong>{to}</strong></div>
            <div className="fx-route-kind">{kind}</div>
            <Pill dark={finality === "ATOMIC"}>{finality}</Pill>
            {i < legs.length - 1 && <div className="fx-route-join">+</div>}
          </div>
        ))}
      </div>
      <div className="fx-finality"><strong>MIXED FINALITY</strong><span>Route is not end-to-end atomic.</span></div>
    </section>
  );
}

function LiveNodePanel() {
  const [inputAsset, setInputAsset] = useState("USDC");
  const [outputAsset, setOutputAsset] = useState("EURC");
  const [exactOutput, setExactOutput] = useState("100000000");
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getQuote() {
    setBusy(true); setMessage(null); setQuote(null);
    const result = await fxCall("POST", "/v2/fx/quotes", { inputAsset, outputAsset, exactOutput });
    setBusy(false);
    if (!result.ok) {
      const detail = (result.body as { error?: { message?: string; code?: string } } | null)?.error;
      setMessage(detail?.message ?? detail?.code ?? result.error ?? `FX node returned ${result.status}`);
      return;
    }
    setQuote(result.body as LiveQuote);
  }

  return (
    <section style={{ ...panel, padding: "27px 28px" }}>
      <div className="fx-section-head">
        <div>
          <Eyebrow>TRY IT · FIRM SANDBOX QUOTE</Eyebrow>
          <h2 className="fx-h2">A quote means liquidity was actually reserved.</h2>
        </div>
        <SourceLink path="apps/fx-node/src/quote-coordinator.js" label="Quote coordinator" />
      </div>
      <p className="fx-copy">This panel only talks to the standalone release-gated FX node. There is no fallback to the legacy hardcoded FX API.</p>

      <div className="fx-live-status">
        <Pill dark={fxNodeConfigured()}>{fxNodeConfigured() ? "LIVE SANDBOX CONFIGURED" : "LIVE NODE NOT CONFIGURED"}</Pill>
        <code>{fxNodeConfigured() ? FX_NODE_BASE : "set VITE_FX_NODE_BASE + VITE_FX_NODE_KEY"}</code>
      </div>

      <div className="fx-quote-form">
        <label><span>INPUT ASSET</span><input value={inputAsset} onChange={(e) => setInputAsset(e.target.value.toUpperCase())} /></label>
        <label><span>OUTPUT ASSET</span><input value={outputAsset} onChange={(e) => setOutputAsset(e.target.value.toUpperCase())} /></label>
        <label><span>EXACT OUTPUT · ATOMIC UNITS</span><input value={exactOutput} onChange={(e) => setExactOutput(e.target.value)} /></label>
        <button onClick={getQuote} disabled={busy || !fxNodeConfigured()}>{busy ? "RESERVING…" : "RESERVE FIRM QUOTE"}</button>
      </div>

      {message && <div className="fx-error">{message}</div>}
      {quote && (
        <div className="fx-quote-result">
          <div><span>QUOTE</span><strong>{quote.id ?? quote.quoteId ?? "reserved"}</strong></div>
          <div><span>INPUT</span><strong>{quote.totalInput ?? "see response"} {quote.inputAsset ?? inputAsset}</strong></div>
          <div><span>OUTPUT</span><strong>{quote.totalOutput ?? exactOutput} {quote.outputAsset ?? outputAsset}</strong></div>
          <div><span>STATE</span><strong>{quote.state ?? "RESERVED"}</strong></div>
          <details><summary>Raw node response</summary><pre>{JSON.stringify(quote, null, 2)}</pre></details>
        </div>
      )}
    </section>
  );
}

function SourceMap() {
  const items = [
    ["Financial kernel", "Vault · cancellation · maker settlement · atomic Router", "packages/fx-contracts/src/AtomicRouter.sol"],
    ["Compliance", "Policy engine + on-chain policy authorization guard", "packages/fx-contracts/src/PolicyAuthorizationRegistry.sol"],
    ["Private market", "Durable orders · deterministic matching · reservations", "packages/fx-market/src/sqlite-market.js"],
    ["Pricing + risk", "Reference consensus · bank-principal risk", "packages/fx-pricing/src/principal-quote-engine.js"],
    ["Liquidity routing", "Exact-output multi-source executable planner", "packages/fx-liquidity/src/optimizer.js"],
    ["Fiat", "Replay-safe intents · attestations · mixed-finality graph", "packages/fx-fiat/src/settlement-graph.js"],
    ["Runtime", "Self-hostable node · honest submission/reconciliation lifecycle", "apps/fx-node/src/server.js"],
    ["Simulation", "Seeded hostile economic scenarios using the real planner", "packages/fx-simulator/src/simulator.js"],
  ];
  return (
    <section style={{ ...panel, padding: "27px 28px" }}>
      <Eyebrow>TAKE IT · THE IMPLEMENTATION IS THE PRODUCT</Eyebrow>
      <h2 className="fx-h2">Every major claim has code behind it.</h2>
      <div className="fx-source-map">
        {items.map(([name, description, path]) => (
          <a href={rcSource(path)} target="_blank" rel="noreferrer" key={name}>
            <div><strong>{name}</strong><span>{description}</span></div><code>VIEW SOURCE ↗</code>
          </a>
        ))}
      </div>
      <div className="fx-rc-note">
        <div><span>BACKEND RC</span><code>{RC}</code></div>
        <div><span>RELEASE GATE</span><strong>11 / 11 GREEN</strong></div>
        <a href={rcSource(".github/workflows/fx-release-gate.yml")} target="_blank" rel="noreferrer">Inspect release gate ↗</a>
      </div>
    </section>
  );
}

export default function FxPage() {
  return (
    <div className="fx-page">
      <section className="fx-hero">
        <div className="fx-hero-copy">
          <Eyebrow>BLUEBALLS FX · OPEN-SOURCE NEOBANK INFRASTRUCTURE</Eyebrow>
          <h1>Your institution's FX market.<br />Your compliance perimeter.</h1>
          <p>Source liquidity from approved customers, issuers, institutional LPs, other financial institutions or your own treasury. Blueballs decides who is legally and operationally eligible first. Then eligible liquidity competes on executable economics.</p>
          <div className="fx-pills"><Pill>PRIVATE MARKET</Pill><Pill>POLICY-GATED</Pill><Pill>ATOMIC TOKEN SETTLEMENT</Pill><Pill>MIXED FIAT ROUTING</Pill><Pill>MIT</Pill></div>
        </div>
        <div className="fx-hero-proof">
          <div className="fx-proof-top"><span>EXECUTION RULE</span><strong>POLICY → PRICE → SETTLE</strong></div>
          <div className="fx-proof-center"><div>VALID SIGNATURES</div><span>+</span><div>LIVE POLICY AUTH</div><span>=</span><strong>EXECUTABLE</strong></div>
          <p>A leaked or stale signed route cannot bypass a later institution compliance stop. The on-chain Router checks policy authorization again at execution.</p>
          <SourceLink path="packages/fx-contracts/src/AtomicRouter.sol" label="Inspect Router" />
        </div>
      </section>

      <SystemFlow />
      <ScenarioLab />
      <CompliancePanel />
      <SettlementGraph />
      <LiveNodePanel />
      <SourceMap />
    </div>
  );
}
