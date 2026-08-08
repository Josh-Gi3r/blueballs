import { useMemo, useState, type CSSProperties } from "react";
import { baselineScenarios, runSimulation } from "../packages/fx-simulator/src/index.js";
import { fxCall, fxNodeConfigured, FX_NODE_BASE } from "./api";

const MONO = "'IBM Plex Mono', monospace";
const ink = "#111318";
const muted = "#697184";
const line = "#DDE2EA";
const panel: CSSProperties = {
  background: "rgba(255,255,255,.92)",
  border: `1px solid ${line}`,
  borderRadius: 20,
  boxShadow: "0 14px 45px rgba(21, 30, 52, .05)",
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
  totalInput: string;
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
  quoteId?: string;
  id?: string;
  routeId?: string;
  inputAsset?: string;
  outputAsset?: string;
  totalInput?: string;
  totalOutput?: string;
  state?: string;
  expiresAt?: number;
  [key: string]: unknown;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: ".16em", color: "#737C91" }}>
      {children}
    </div>
  );
}

function Pill({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 9px", borderRadius: 999,
      fontFamily: MONO, fontSize: 9.5, letterSpacing: ".06em",
      color: dark ? "#F5F7FA" : "#374054",
      background: dark ? "#171A20" : "#F3F5F8",
      border: dark ? "1px solid #292D37" : `1px solid ${line}`,
    }}>
      {children}
    </span>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: MONO, color: "#7A8293", fontSize: 9, letterSpacing: ".12em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 25, lineHeight: 1, fontWeight: 650, letterSpacing: "-.035em", color: ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {note && <div style={{ marginTop: 7, color: muted, fontSize: 11.5, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

function SystemFlow() {
  const steps = [
    ["01", "IDENTITY", "KYC / KYB results, sanctions, AML, account attribution"],
    ["02", "POLICY", "Corridor, participant class, jurisdiction, amount and institution rules"],
    ["03", "AUTHORIZED LIQUIDITY", "Only eligible makers, issuers, LPs and treasury capacity enter the market"],
    ["04", "PRICE + ROUTE", "Executable capacity competes on exact economics; risk limits remain hard gates"],
    ["05", "POLICY AUTH", "The institution grants a short-lived authorization bound into the taker intent"],
    ["06", "SETTLEMENT", "Atomic token execution, or explicit asynchronous finality for fiat legs"],
    ["07", "RECONCILIATION", "Submitted, confirmed, failed and ambiguous states stay honest and reconstructable"],
  ];

  return (
    <div style={{ ...panel, padding: "24px 24px 20px" }}>
      <Eyebrow>THE EXECUTION PERIMETER</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px,1fr))", gap: 7, marginTop: 15, overflowX: "auto", paddingBottom: 4 }}>
        {steps.map(([n, title, text], i) => (
          <div key={title} style={{ minWidth: 128, position: "relative", borderRadius: 14, background: i === 4 ? "#151820" : "#F6F7F9", color: i === 4 ? "#F7F8FA" : ink, padding: "14px 13px 13px", border: i === 4 ? "1px solid #151820" : "1px solid #E4E8EE" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: i === 4 ? "#8E98AE" : "#8B93A4", marginBottom: 13 }}>{n}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 650, letterSpacing: ".07em", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: i === 4 ? "#BBC2CF" : "#697184" }}>{text}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 11, background: "#F0F4FF", border: "1px solid #DCE5FF", fontSize: 12.5, lineHeight: 1.5, color: "#33436E" }}>
        <strong>Cryptographically valid is not enough.</strong> The on-chain Router independently requires a live institution policy authorization. Expiry, individual revocation or policy-epoch invalidation blocks settlement even when the maker and taker signatures are still valid.
      </div>
    </div>
  );
}

function ScenarioLab() {
  const scenarios = useMemo(() => baselineScenarios(), []);
  const [scenario, setScenario] = useState("balanced");
  const result = useMemo(() => runSimulation((scenarios as Record<string, unknown>)[scenario]) as SimulationResult, [scenario, scenarios]);
  const totalRouted = Object.values(result.routeComposition).reduce((sum, value) => sum + BigInt(value), 0n);
  const principal = BigInt(result.peakPrincipalExposureAbs);
  const limit = BigInt(result.principalHardLimit);
  const utilization = limit === 0n ? 0 : Math.min(100, Number((principal * 10_000n) / limit) / 100);

  return (
    <div style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "26px 28px 22px", borderBottom: `1px solid ${line}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <Eyebrow>BREAK IT · REAL SIMULATOR</Eyebrow>
            <h2 style={{ margin: "10px 0 7px", fontSize: 25, fontWeight: 620, letterSpacing: "-.03em" }}>Change the market. Watch the routing survive or refuse.</h2>
            <p style={{ margin: 0, maxWidth: 760, color: muted, fontSize: 14, lineHeight: 1.55 }}>
              This panel imports the same deterministic simulator used by the FX-8 CI gate. It calls the real exact-output liquidity planner. These numbers are not a React recreation of the engine.
            </p>
          </div>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} style={{ fontFamily: MONO, fontSize: 11, border: `1px solid ${line}`, borderRadius: 11, background: "#FFF", padding: "10px 12px", color: ink }}>
            {Object.keys(SCENARIO_LABELS).map((key) => <option key={key} value={key}>{SCENARIO_LABELS[key]}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: "22px 28px 26px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 18, paddingBottom: 22 }}>
          <Metric label="ORDER FILL RATE" value={`${result.fillRatePct.toFixed(1)}%`} note={`${result.filledOrders}/${result.requestedOrders} orders`} />
          <Metric label="VOLUME FILLED" value={`${result.volumeFillPct.toFixed(1)}%`} note={`${result.filledVolume} / ${result.requestedVolume}`} />
          <Metric label="PRINCIPAL PEAK" value={`${utilization.toFixed(1)}%`} note={`${result.peakPrincipalExposureAbs} / ${result.principalHardLimit}`} />
          <Metric label="NO LIQUIDITY" value={String(result.rejections.NO_LIQUIDITY)} note="fail closed" />
          <Metric label="SETTLEMENT FAILURES" value={String(result.settlementFailures)} note="not counted as fills" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(240px,.7fr)", gap: 18 }}>
          <div style={{ background: "#F7F8FA", border: "1px solid #E6E9EF", borderRadius: 15, padding: "17px 18px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".12em", color: "#7B8496", marginBottom: 15 }}>WHO ACTUALLY FILLED THE FLOW</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(result.routeComposition).map(([type, value]) => {
                const amount = BigInt(value);
                const width = totalRouted === 0n ? 0 : Math.max(0.5, Number((amount * 10_000n) / totalRouted) / 100);
                return (
                  <div key={type}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11.5, marginBottom: 5 }}>
                      <span>{SOURCE_LABELS[type] ?? type}</span>
                      <span style={{ fontFamily: MONO, color: amount === 0n ? "#A4AAB5" : ink }}>{value}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: "#E7EAF0", overflow: "hidden" }}>
                      <div style={{ width: `${width}%`, height: "100%", borderRadius: 99, background: amount === 0n ? "transparent" : "linear-gradient(90deg,#6479D7,#303B72)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#151820", color: "#F5F6F8", borderRadius: 15, padding: "17px 18px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#8D96AA", letterSpacing: ".12em" }}>HARD TREASURY LIMIT</div>
            <div style={{ marginTop: 14, height: 118, display: "grid", placeItems: "center", position: "relative" }}>
              <div style={{ width: 104, height: 104, borderRadius: "50%", background: `conic-gradient(#8799F0 ${utilization * 3.6}deg,#292E39 0deg)`, display: "grid", placeItems: "center" }}>
                <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#151820", display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div><div style={{ fontSize: 21, fontWeight: 650 }}>{utilization.toFixed(0)}%</div><div style={{ fontFamily: MONO, color: "#8D96AA", fontSize: 8 }}>PEAK</div></div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#AEB6C6", lineHeight: 1.5, marginTop: 9 }}>
              Hard risk is not a price. When capacity is gone, the engine rejects flow instead of widening spread until someone accepts it.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompliancePanel() {
  const checks = [
    ["Identity credentials", "KYC / KYB / sanctions / AML", "OFF-CHAIN"],
    ["Institution rules", "corridor · jurisdiction · ticket · participant class", "OFF-CHAIN"],
    ["Account attribution", "the settlement wallet/account belongs to the approved participant", "OFF-CHAIN"],
    ["Authorization freshness", "participant epoch + policy version + expiry", "OFF-CHAIN"],
    ["Execution authority", "opaque policyAuthorizationHash must remain live", "ON-CHAIN"],
  ];
  return (
    <div style={{ ...panel, padding: "27px 28px" }}>
      <Eyebrow>COMPLIANCE IS AN EXECUTION CONTROL</Eyebrow>
      <h2 style={{ margin: "10px 0 7px", fontSize: 25, fontWeight: 620, letterSpacing: "-.03em" }}>The market never sees ineligible liquidity.</h2>
      <p style={{ margin: "0 0 20px", color: muted, fontSize: 14, lineHeight: 1.55, maxWidth: 820 }}>
        Sumsub, Persona or a bank's own systems can provide identity facts. Blueballs owns the authorization framework that turns those facts into an executable decision. Pricing happens only after that decision.
      </p>
      <div style={{ borderTop: `1px solid ${line}` }}>
        {checks.map(([title, text, where]) => (
          <div key={title} style={{ display: "grid", gridTemplateColumns: "190px 1fr 94px", gap: 18, padding: "13px 0", borderBottom: `1px solid ${line}`, alignItems: "center" }}>
            <strong style={{ fontSize: 13, fontWeight: 600 }}>{title}</strong>
            <span style={{ color: muted, fontSize: 13 }}>{text}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, textAlign: "right", color: where === "ON-CHAIN" ? "#495CA9" : "#7B8496" }}>{where}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <div style={{ borderRadius: 12, background: "#F3F7F4", border: "1px solid #D8E8DC", padding: "13px 14px", fontSize: 12.5, lineHeight: 1.5, color: "#315D40" }}>
          <strong>Approved:</strong> eligible liquidity reaches price competition and can be reserved.
        </div>
        <div style={{ borderRadius: 12, background: "#FAF1F0", border: "1px solid #EED9D7", padding: "13px 14px", fontSize: 12.5, lineHeight: 1.5, color: "#874C46" }}>
          <strong>Revoked:</strong> the route fails even if its customer and maker signatures remain cryptographically valid.
        </div>
      </div>
    </div>
  );
}

function FinalityPanel() {
  const legs = [
    ["MYR", "VERIFIED FIAT PAYMENT", "USDC", "ATTESTED / ASYNC"],
    ["USDC", "TOKEN SWAP", "EURC", "ATOMIC"],
    ["EURC", "ISSUER REDEEM", "EUR", "EXTERNAL / ASYNC"],
  ];
  return (
    <div style={{ ...panel, padding: "27px 28px" }}>
      <Eyebrow>FINALITY WITHOUT MARKETING FICTION</Eyebrow>
      <h2 style={{ margin: "10px 0 7px", fontSize: 25, fontWeight: 620, letterSpacing: "-.03em" }}>Atomic where it is atomic. Explicit everywhere else.</h2>
      <p style={{ margin: "0 0 20px", color: muted, fontSize: 14, lineHeight: 1.55, maxWidth: 820 }}>
        A token corridor can settle all-or-nothing in one transaction. Fiat payments, bank rails and issuer redemptions have different finality. Blueballs keeps those guarantees separate instead of calling the whole route instant or atomic.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {legs.map(([from, type, to, finality], i) => (
          <div key={type} style={{ borderRadius: 14, padding: "16px", background: i === 1 ? "#151820" : "#F6F7F9", color: i === 1 ? "#F7F8FA" : ink, border: i === 1 ? "1px solid #151820" : "1px solid #E4E8EE" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: i === 1 ? "#9099AD" : "#818A9C" }}><span>LEG {i + 1}</span><span>{finality}</span></div>
            <div style={{ marginTop: 17, fontSize: 22, fontWeight: 650 }}>{from} <span style={{ color: i === 1 ? "#6E7890" : "#A0A7B4" }}>→</span> {to}</div>
            <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 9.5, letterSpacing: ".08em", color: i === 1 ? "#AAB3C5" : "#657084" }}>{type}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10, color: "#8A5C29", background: "#FFF8EE", border: "1px solid #F0DFC5", borderRadius: 10, padding: "10px 12px" }}>
        ROUTE GUARANTEE · MIXED_FINALITY · NOT END-TO-END ATOMIC
      </div>
    </div>
  );
}

function LiveNodeLab() {
  const configured = fxNodeConfigured();
  const [inputAsset, setInputAsset] = useState("");
  const [outputAsset, setOutputAsset] = useState("");
  const [exactOutput, setExactOutput] = useState("1000000");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LiveQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quote() {
    setBusy(true); setError(null); setResult(null);
    const response = await fxCall("POST", "/v2/fx/quotes", { inputAsset, outputAsset, exactOutput });
    setBusy(false);
    if (!response.ok) {
      const apiError = (response.body as { error?: { code?: string; message?: string } } | null)?.error;
      setError(apiError ? `${apiError.code ?? "ERROR"} · ${apiError.message ?? "request failed"}` : response.error ?? "request failed");
      return;
    }
    setResult(response.body as LiveQuote);
  }

  const inputStyle: CSSProperties = { fontFamily: MONO, fontSize: 11, width: "100%", boxSizing: "border-box", border: `1px solid ${line}`, borderRadius: 10, padding: "10px 11px", background: "#FFF", color: ink };

  return (
    <div style={{ ...panel, padding: "27px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow>TRY IT · LIVE FX NODE</Eyebrow>
          <h2 style={{ margin: "10px 0 7px", fontSize: 25, fontWeight: 620, letterSpacing: "-.03em" }}>A firm quote means capacity is reserved.</h2>
          <p style={{ margin: 0, maxWidth: 760, color: muted, fontSize: 14, lineHeight: 1.55 }}>
            This panel talks only to the standalone release-gated FX node. It never falls back to the older demo FX API. Creating a quote consumes real sandbox reservation capacity.
          </p>
        </div>
        <Pill dark={configured}>{configured ? "● SANDBOX NODE CONNECTED" : "○ LIVE NODE NOT CONFIGURED"}</Pill>
      </div>

      {!configured ? (
        <div style={{ marginTop: 18, borderRadius: 14, background: "#F7F8FA", border: `1px solid ${line}`, padding: "16px 17px", color: "#505A6D", fontSize: 13, lineHeight: 1.6 }}>
          Run <code style={{ fontFamily: MONO }}>apps/fx-node</code> and set <code style={{ fontFamily: MONO }}>VITE_FX_NODE_BASE</code> plus a sandbox-only <code style={{ fontFamily: MONO }}>VITE_FX_NODE_KEY</code>. The simulator above remains fully functional because it imports the implementation directly.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.9fr)", gap: 16, marginTop: 20 }}>
          <div style={{ background: "#F7F8FA", border: "1px solid #E6E9EF", borderRadius: 15, padding: "16px" }}>
            <label style={{ fontFamily: MONO, fontSize: 9.5, color: "#737C91" }}>INPUT TOKEN ADDRESS</label>
            <input value={inputAsset} onChange={(e) => setInputAsset(e.target.value)} placeholder="0x…" style={{ ...inputStyle, marginTop: 6, marginBottom: 12 }} />
            <label style={{ fontFamily: MONO, fontSize: 9.5, color: "#737C91" }}>OUTPUT TOKEN ADDRESS</label>
            <input value={outputAsset} onChange={(e) => setOutputAsset(e.target.value)} placeholder="0x…" style={{ ...inputStyle, marginTop: 6, marginBottom: 12 }} />
            <label style={{ fontFamily: MONO, fontSize: 9.5, color: "#737C91" }}>EXACT OUTPUT · ATOMIC UNITS</label>
            <input value={exactOutput} onChange={(e) => setExactOutput(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            <button disabled={busy || !inputAsset || !outputAsset} onClick={() => void quote()} style={{ marginTop: 13, border: 0, borderRadius: 10, padding: "10px 14px", fontFamily: MONO, fontSize: 10.5, fontWeight: 650, cursor: busy ? "wait" : "pointer", background: "#151820", color: "#FFF", opacity: busy || !inputAsset || !outputAsset ? .45 : 1 }}>
              {busy ? "RESERVING…" : "CREATE FIRM QUOTE"}
            </button>
          </div>
          <div style={{ borderRadius: 15, background: "#151820", color: "#DDE2EB", padding: "16px", minHeight: 210 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: "#8D96AA" }}><span>NODE RESPONSE</span><span>{FX_NODE_BASE}</span></div>
            {error && <div style={{ marginTop: 16, color: "#F0A7A0", fontFamily: MONO, fontSize: 11, lineHeight: 1.55 }}>{error}</div>}
            {!error && !result && <div style={{ marginTop: 48, color: "#7E8799", textAlign: "center", fontSize: 12 }}>No request yet.</div>}
            {result && <pre style={{ margin: "14px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.55, color: "#C9D1DF" }}>{JSON.stringify(result, null, 2)}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

function Evidence() {
  const items = [
    ["ON-CHAIN KERNEL", "fx-contracts", "Vault · cancellation · settlement · atomic router · policy registry"],
    ["PRIVATE MARKET", "fx-market", "signed orders · reservations · concurrency · reconciliation"],
    ["PRICE + RISK", "fx-pricing", "reference consensus · principal spread · hard treasury limits"],
    ["LIQUIDITY", "fx-liquidity", "exact executable source optimization + compensating reservation"],
    ["COMPLIANCE", "fx-policy", "credentials · participant epochs · policy versions · scoped authorization"],
    ["FIAT", "fx-fiat", "intent · attestation · replay protection · settlement graph · finality"],
    ["RUNTIME", "fx-node", "self-hostable authenticated API · reconciliation · Docker"],
    ["SDK", "fx-sdk", "dependency-free client for the standalone FX node"],
    ["ECONOMIC PROOF", "fx-simulator", "deterministic hostile scenarios over the real liquidity planner"],
  ];
  return (
    <div style={{ ...panel, padding: "27px 28px" }}>
      <Eyebrow>TAKE IT · THE IMPLEMENTATION IS THE PRODUCT</Eyebrow>
      <h2 style={{ margin: "10px 0 7px", fontSize: 25, fontWeight: 620, letterSpacing: "-.03em" }}>No black box in the middle.</h2>
      <p style={{ margin: "0 0 18px", color: muted, fontSize: 14, lineHeight: 1.55, maxWidth: 790 }}>
        The reference backend passed its internal aggregate gate on the frozen RC boundary before this visual branch began. That means internal engineering evidence, not an independent security audit or regulatory approval.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 9 }}>
        {items.map(([title, pkg, desc]) => (
          <div key={pkg} style={{ border: `1px solid ${line}`, borderRadius: 13, padding: "14px", background: "#FAFBFC" }}>
            <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".11em", color: "#7D8597" }}>{title}</div>
            <div style={{ marginTop: 7, fontFamily: MONO, fontWeight: 650, fontSize: 11.5, color: "#36466E" }}>packages/{pkg}</div>
            <div style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.45, color: muted }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <Pill>11/11 aggregate backend jobs</Pill>
        <Pill>controlled EVM broadcast</Pill>
        <Pill>stateful invariants</Pill>
        <Pill>economic simulator</Pill>
        <Pill>Docker self-host</Pill>
        <Pill>MIT foundation</Pill>
      </div>
    </div>
  );
}

export default function FxPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ ...panel, overflow: "hidden", position: "relative", background: "linear-gradient(145deg,#FFFFFF 0%,#F7F9FF 48%,#EEF2FF 100%)" }}>
        <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(94,114,210,.18),rgba(94,114,210,0) 70%)", right: -110, top: -190, pointerEvents: "none" }} />
        <div style={{ padding: "48px 46px 42px", position: "relative" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            <Pill dark>FX BACKEND RC · GATE PASSED</Pill>
            <Pill>COMPLIANCE-FIRST</Pill>
            <Pill>SELF-HOSTABLE</Pill>
            <Pill>PROVIDER-NEUTRAL</Pill>
          </div>
          <Eyebrow>BLUEBALLS FX</Eyebrow>
          <h1 style={{ margin: "13px 0 13px", maxWidth: 970, fontSize: "clamp(34px,5vw,65px)", lineHeight: .99, fontWeight: 620, letterSpacing: "-.055em", color: ink }}>
            Your institution's FX market.<br />Your compliance perimeter.
          </h1>
          <p style={{ margin: 0, maxWidth: 790, fontSize: "clamp(16px,1.8vw,20px)", lineHeight: 1.55, color: "#4F596C" }}>
            Source liquidity from approved customers, institutional LPs, stablecoin issuers, other neobanks or your own treasury. Blueballs decides what is eligible before it prices anything, then constrains approved token settlement cryptographically on-chain.
          </p>
          <div style={{ marginTop: 26, maxWidth: 830, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
            <div style={{ borderRadius: 13, padding: "13px 14px", background: "rgba(255,255,255,.72)", border: "1px solid rgba(185,194,218,.65)" }}><Eyebrow>NOT P2P BY DEFAULT</Eyebrow><div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, color: "#556076" }}>The institution defines who may provide or take liquidity.</div></div>
            <div style={{ borderRadius: 13, padding: "13px 14px", background: "rgba(255,255,255,.72)", border: "1px solid rgba(185,194,218,.65)" }}><Eyebrow>NOT ONE FX VENDOR</Eyebrow><div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, color: "#556076" }}>Approved executable sources compete inside one route.</div></div>
            <div style={{ borderRadius: 13, padding: "13px 14px", background: "rgba(255,255,255,.72)", border: "1px solid rgba(185,194,218,.65)" }}><Eyebrow>NOT FAKE ATOMICITY</Eyebrow><div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, color: "#556076" }}>Token and fiat finality are modeled separately.</div></div>
          </div>
        </div>
      </section>

      <SystemFlow />
      <ScenarioLab />
      <CompliancePanel />
      <FinalityPanel />
      <LiveNodeLab />
      <Evidence />
    </div>
  );
}
