import { useMemo, useState, type ReactNode } from "react";
import { planExactOutput } from "../packages/fx-liquidity/src/index.js";
import { baselineScenarios, runSimulation } from "../packages/fx-simulator/src/index.js";
import liquidityB64 from "./assets/fx-liquidity.b64?raw";
import complianceB64 from "./assets/fx-compliance.b64?raw";
import routeB64 from "./assets/fx-route.b64?raw";
import treasuryB64 from "./assets/fx-treasury.b64?raw";
import "./FxPage.css";

const IMG = (raw: string) => `data:image/webp;base64,${raw.trim()}`;
const FX_LIQUIDITY = IMG(liquidityB64);
const FX_COMPLIANCE = IMG(complianceB64);
const FX_ROUTE = IMG(routeB64);
const FX_TREASURY = IMG(treasuryB64);
const RC = "02ebbf70ed6cef054549010222719d1a0357cf27";
const REPO = "https://github.com/Josh-Gi3r/blueballs";
const source = (path: string) => `${REPO}/blob/${RC}/${path}`;

type SourceType = "PRIVATE_MARKET" | "ISSUER" | "INSTITUTIONAL_LP" | "NEOBANK" | "BANK_TREASURY" | "BANK_PRINCIPAL";
type DemoSource = { sourceType: SourceType; sourceId: string; label: string; rate: number; capacityEur: number; enabled?: boolean; status?: string };
type DemoQuote = { payBrl: number; receiveEur: number; rate: number; route: Array<DemoSource & { inputBrl: number; outputEur: number }> };

const SOURCES: DemoSource[] = [
  { sourceType: "PRIVATE_MARKET", sourceId: "customer", label: "Customer flow", rate: 6.045, capacityEur: 3200 },
  { sourceType: "ISSUER", sourceId: "issuer", label: "Issuer", rate: 6.072, capacityEur: 2600 },
  { sourceType: "INSTITUTIONAL_LP", sourceId: "lp", label: "Institutional LP", rate: 6.088, capacityEur: 4800 },
  { sourceType: "NEOBANK", sourceId: "neobank", label: "Other institution", rate: 6.102, capacityEur: 2200 },
  { sourceType: "BANK_TREASURY", sourceId: "treasury", label: "Treasury", rate: 6.128, capacityEur: 3600 },
  { sourceType: "BANK_PRINCIPAL", sourceId: "principal", label: "Bank principal", rate: 6.155, capacityEur: 6500 },
];
const SCENARIOS = [
  ["balanced", "Balanced"], ["oneWay90", "90% buying EUR"], ["lpOff", "Remove LP"],
  ["issuerOff", "Remove issuer"], ["riskLimit", "Bank risk limit"], ["referenceOutage", "Reference unavailable"],
] as const;
type Scenario = typeof SCENARIOS[number][0];

function Eye({ children }: { children: ReactNode }) { return <div className="fxr-eye">{children}</div>; }
function Tag({ children }: { children: ReactNode }) { return <span className="fxr-tag">{children}</span>; }
function money(n: number, c: "BRL" | "EUR") { return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`; }

function marketFor(id: Scenario): DemoSource[] {
  return SOURCES.map((s) => {
    if (id === "lpOff" && s.sourceId === "lp") return { ...s, enabled: false, status: "OFFLINE" };
    if (id === "issuerOff" && s.sourceId === "issuer") return { ...s, enabled: false, status: "OFFLINE" };
    if (id === "riskLimit" && s.sourceId === "treasury") return { ...s, capacityEur: 450, status: "NEAR LIMIT" };
    if (id === "riskLimit" && s.sourceId === "principal") return { ...s, enabled: false, status: "RISK LIMIT" };
    if (id === "referenceOutage" && s.sourceId === "principal") return { ...s, enabled: false, status: "NO REFERENCE" };
    if (id === "oneWay90" && s.sourceId === "customer") return { ...s, capacityEur: 850, rate: 6.082, status: "THIN" };
    if (id === "oneWay90" && s.sourceId === "lp") return { ...s, rate: 6.108 };
    if (id === "oneWay90" && s.sourceId === "treasury") return { ...s, rate: 6.145 };
    if (id === "oneWay90" && s.sourceId === "principal") return { ...s, rate: 6.19 };
    return { ...s, enabled: true };
  });
}

function quoteForInput(payBrl: number, scenario: Scenario): DemoQuote | null {
  if (!Number.isFinite(payBrl) || payBrl <= 0) return null;
  const market = marketFor(scenario);
  const slices = market.filter((s) => s.enabled !== false && s.capacityEur > 0).map((s) => ({
    sourceType: s.sourceType, sourceId: s.sourceId, sliceId: `${s.sourceId}:brl-eur`, inputAsset: "BRL", outputAsset: "EUR",
    maxOutput: String(Math.round(s.capacityEur * 100)), inputNumerator: String(Math.round(s.rate * 1000)), inputDenominator: "1000",
    policyAuthorizationId: `sandbox:${s.sourceId}`, expiresAt: 9_999_999_999_999,
  }));
  const budget = BigInt(Math.round(payBrl * 100));
  let lo = 1n, hi = slices.reduce((n, s) => n + BigInt(s.maxOutput), 0n), best: ReturnType<typeof planExactOutput> | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) / 2n;
    try {
      const p = planExactOutput({ inputAsset: "BRL", outputAsset: "EUR", desiredOutput: mid.toString(), slices, now: 1 });
      if (BigInt(p.totalInput) <= budget) { best = p; lo = mid + 1n; } else hi = mid - 1n;
    } catch { hi = mid - 1n; }
  }
  if (!best) return null;
  const byId = new Map(market.map((s) => [s.sourceId, s]));
  const route = best.legs.map((leg) => ({ ...byId.get(leg.sourceId)!, inputBrl: Number(leg.inputAmount) / 100, outputEur: Number(leg.outputAmount) / 100 }));
  const input = Number(best.totalInput) / 100, output = Number(best.totalOutput) / 100;
  return { payBrl: input, receiveEur: output, rate: input / output, route };
}

function Phone({ amount, quote, setAmount }: { amount: number; quote: DemoQuote | null; setAmount: (n: number) => void }) {
  return <div className="fxr-phone"><div className="fxr-phone-in">
    <div className="fxr-status"><span>9:41</span><span>▮▮▮ ᯤ ▰</span></div><div className="fxr-phone-title">Exchange</div>
    <div className="fxr-phone-box"><div className="fxr-phone-label"><span>YOU PAY</span><span>BAL 82,400 BRL</span></div><div className="fxr-phone-amt"><input value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} /><b>BRL ▾</b></div></div>
    <div className="fxr-swap-dot">⇅</div>
    <div className="fxr-phone-box"><div className="fxr-phone-label"><span>YOU RECEIVE</span><span>SANDBOX QUOTE</span></div><div className="fxr-phone-amt"><strong>{quote ? quote.receiveEur.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</strong><b>EUR ▾</b></div></div>
    <div className="fxr-phone-meta"><div><span>Effective rate</span><b>{quote ? `1 EUR = ${quote.rate.toFixed(4)} BRL` : "No route"}</b></div><div><span>Sources used</span><b>{quote?.route.length ?? 0}</b></div><div><span>Quote holds</span><b>{quote ? "30 seconds" : "—"}</b></div><div><span>Settlement</span><b>{quote ? "Route dependent" : "—"}</b></div></div>
    <div className={quote ? "fxr-convert" : "fxr-convert off"}>{quote ? "Review exchange" : "No quote available"}</div>
  </div></div>;
}

function Breakdown({ quote, scenario }: { quote: DemoQuote | null; scenario: Scenario }) {
  return <div className="fxr-route-card"><div className="fxr-route-title"><div><Eye>HOW BLUEBALLS FILLED IT</Eye><h3>{quote ? `${money(quote.payBrl, "BRL")} → ${money(quote.receiveEur, "EUR")}` : "No executable route"}</h3></div><Tag>real fx-liquidity planner</Tag></div>
    {quote ? <div className="fxr-route-list">{quote.route.map((l) => <div className="fxr-route-row" key={l.sourceId}><div><strong>{l.label}</strong><span>{l.sourceType.replaceAll("_", " ")}</span></div><div><b>{money(l.outputEur, "EUR")}</b><span>{l.rate.toFixed(3)} BRL/EUR</span></div></div>)}</div> : <div className="fxr-empty">Approved executable capacity cannot fill this request under the current scenario.</div>}
    <div className="fxr-candidates">{marketFor(scenario).map((s) => <span className={s.enabled === false ? "off" : ""} key={s.sourceId}>{s.label}{s.status ? ` · ${s.status}` : ""}</span>)}</div>
  </div>;
}

function Editorial({ image, eyebrow, title, body, reverse = false }: { image: string; eyebrow: string; title: string; body: string; reverse?: boolean }) {
  return <section className={reverse ? "fxr-editorial reverse" : "fxr-editorial"}><div className="fxr-editorial-copy"><Eye>{eyebrow}</Eye><h2>{title}</h2><p>{body}</p></div><div className="fxr-editorial-img"><img src={image} alt={title} /></div></section>;
}
function CodePanel({ title, tag, children }: { title: string; tag: string; children: ReactNode }) { return <div className="fxr-code-panel"><div className="fxr-code-head"><span>{title}</span><b>{tag}</b></div><pre>{children}</pre></div>; }

export default function FxPage() {
  const [amount, setAmount] = useState(50_000);
  const [scenario, setScenario] = useState<Scenario>("balanced");
  const quote = useMemo(() => quoteForInput(amount, scenario), [amount, scenario]);
  const simulatorKey = scenario === "oneWay90" ? "oneWay90" : scenario === "lpOff" ? "lpDisappears" : scenario === "issuerOff" ? "issuerDisappears" : scenario === "riskLimit" ? "principalLimit" : scenario === "referenceOutage" ? "referenceOutage" : "balanced";
  const stress = useMemo(() => runSimulation((baselineScenarios() as Record<string, unknown>)[simulatorKey]) as { requestedOrders: number; fillRatePct: number; rejections: { NO_LIQUIDITY: number; RISK_LIMIT: number }; settlementFailures: number }, [simulatorKey]);

  return <div className="fxr">
    <section className="fxr-hero"><div className="fxr-hero-copy"><Eye>FX · PART OF THE BLUEBALLS BANKING STACK</Eye><h1>Put exchange inside your bank.</h1><p>Your customer sees a simple exchange. Blueballs can source the trade from approved customer flow, issuers, institutional LPs, other institutions and your own balance sheet, then carry the approved route into settlement.</p><div className="fxr-actions"><button className="fxr-btn" onClick={() => document.getElementById("fx-test")?.scrollIntoView()}>Try an FX swap</button><a className="fxr-btn alt" href="#fx-dev">See the calls behind it</a></div><div className="fxr-call"><div className="fxr-call-top"><Eye>THE CALL BEHIND THIS SCREEN</Eye><Tag>POST /v2/fx/quotes</Tag></div><div className="fxr-code">{`await bb.fx.quote({\n  from: "BRL", to: "EUR",\n  amount: "${amount.toFixed(2)}"\n});\n\n// → quote + reserved route`}</div></div></div><div className="fxr-hero-phone"><Phone amount={amount} quote={quote} setAmount={setAmount} /></div></section>

    <section id="fx-test" className="fxr-demo"><div className="fxr-head"><div><Eye>TRY IT · SANDBOX MARKET</Eye><h2>Change the trade. Change the market.</h2><p>The route below is calculated by the same exact-output liquidity planner used by the FX packages. The source inventory is deterministic sandbox data so you can safely remove liquidity, create one-way pressure and hit a risk limit.</p></div><a href={source("packages/fx-liquidity/src/optimizer.js")} target="_blank" rel="noreferrer"><Tag>inspect optimizer ↗</Tag></a></div><div className="fxr-scenarios">{SCENARIOS.map(([id, label]) => <button className={scenario === id ? "on" : ""} key={id} onClick={() => setScenario(id)}>{label}</button>)}</div><div className="fxr-demo-grid"><div className="fxr-swap-form"><label>YOU PAY</label><input value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} /><div className="fxr-pair"><span>BRL</span><span>→</span><span>EUR</span></div><p>{quote ? `Firm sandbox result: ${money(quote.receiveEur, "EUR")}` : "No executable quote. Reduce the size or restore liquidity."}</p></div><Breakdown quote={quote} scenario={scenario} /></div><div className="fxr-stats"><div className="fxr-stat"><span>SIMULATED ORDERS</span><strong>{stress.requestedOrders}</strong></div><div className="fxr-stat"><span>FILL RATE</span><strong>{stress.fillRatePct.toFixed(0)}%</strong></div><div className="fxr-stat"><span>NO LIQUIDITY</span><strong>{stress.rejections.NO_LIQUIDITY}</strong></div><div className="fxr-stat"><span>RISK REJECTIONS</span><strong>{stress.rejections.RISK_LIMIT}</strong></div><div className="fxr-stat"><span>SETTLEMENT FAILURES</span><strong>{stress.settlementFailures}</strong></div></div></section>

    <Editorial image={FX_LIQUIDITY} eyebrow="ONE REQUEST · MANY SOURCES" title="The price comes from executable liquidity, not a rate table." body="A customer trade can draw from natural customer flow, issuers, institutional LPs, other financial institutions, treasury or bank principal. One request can be split across sources instead of being forced through one provider." />

    <section className="fxr-story"><Eye>STORY · TWO CUSTOMERS CAN BECOME EACH OTHER'S LIQUIDITY</Eye><h2>Internal flow first, external liquidity when you need it.</h2><div className="fxr-story-grid"><div className="fxr-story-card"><Eye>ALICE · SÃO PAULO</Eye><h3>50,000 BRL → EUR</h3><p>Alice wants euros. Her request enters the bank's approved FX market.</p></div><div className="fxr-story-card"><Eye>PIERRE · PARIS</Eye><h3>EUR → BRL</h3><p>Pierre wants reais. Compatible approved flow can offset part of Alice's request before external liquidity fills the residual.</p></div></div></section>

    <Editorial image={FX_COMPLIANCE} eyebrow="BEST PRICE AMONG WHAT YOU MAY ACTUALLY TRADE" title="A cheaper quote can still be unusable." body="The institution decides which participants, corridors and ticket sizes are eligible. A source that fails those rules never enters the executable price competition, however attractive its displayed quote may be." reverse />

    <section className="fxr-story"><Eye>SEE THE FILTER</Eye><h2>The rejected quote never wins the trade.</h2><div className="fxr-filter"><div className="fxr-quotes"><div className="fxr-q blocked"><span>Epsilon Liquidity · jurisdiction blocked</span><b>6.011</b></div><div className="fxr-q blocked"><span>Cobalt Markets · KYB expired</span><b>6.018</b></div><div className="fxr-q"><span>Beta Capital · approved</span><b>6.040</b></div><div className="fxr-q"><span>Delta FX · approved</span><b>6.070</b></div></div><div className="fxr-arrow">→</div><div className="fxr-quotes"><div className="fxr-q"><span>Beta Capital</span><b>6.040</b></div><div className="fxr-q"><span>Delta FX</span><b>6.070</b></div><p>The two cheaper quotes do not exist in the executable market.</p></div></div></section>

    <Editorial image={FX_TREASURY} eyebrow="ONE-WAY MARKET PRESSURE" title="The bank can support the market without pretending its balance sheet is infinite." body="When customer flow becomes heavily one-sided, external liquidity and treasury can fill the gap. When hard balance-sheet risk capacity is gone, Blueballs can reject additional flow instead of manufacturing liquidity." />
    <Editorial image={FX_ROUTE} eyebrow="FIAT + TOKEN ROUTING" title="BRL to EUR can cross more than one settlement domain." body="A route can begin with a verified PIX payment, move through an atomic USDC to EURC token exchange and finish through issuer redemption into EUR. Each leg keeps its real finality instead of turning the whole route into an atomic marketing claim." reverse />

    <section className="fxr-journey"><Eye>WALK ONE EXCHANGE</Eye><h2>From the phone to final settlement.</h2><p>The rest of Blueballs pairs every user screen with the call behind it. FX does the same. One customer action becomes a quote, reservation, authorization, submission, settlement and reconciliation.</p><div className="fxr-steps"><span className="on">01 Quote</span><span>02 Reserve</span><span>03 Confirm</span><span>04 Submit</span><span>05 Settle</span><span>06 Reconcile</span></div><div className="fxr-journey-grid"><div className="fxr-event"><Eye>CUSTOMER SCREEN</Eye><h3>50,000 BRL → EUR</h3><p>The customer sees the amount, executable quote, expiry and expected settlement. The route remains infrastructure, not UI clutter.</p></div><CodePanel title="THE CALL BEHIND THIS STEP" tag="POST /v2/fx/quotes">{`{\n  "inputAsset": "BRL",\n  "outputAsset": "EUR",\n  "exactOutput": "${quote ? Math.round(quote.receiveEur * 100) : 0}"\n}\n\n→ state: RESERVED\n→ routeId: route_…\n→ sources: [ … ]`}</CodePanel></div></section>

    <section id="fx-dev" className="fxr-dev"><Eye>FOR DEVELOPERS</Eye><h2>The UI is the surface. The engine is yours.</h2><p>Run the reference FX node yourself, call it through the SDK, inspect the reserved route or read the contracts that constrain token settlement.</p><div className="fxr-dev-grid"><CodePanel title="SDK" tag="quote + route">{`const fx = new BlueballsFxClient({\n  baseUrl: "http://localhost:8788",\n  apiKey: process.env.FX_KEY\n});\n\nconst quote = await fx.quote({\n  inputAsset: "USDC",\n  outputAsset: "EURC",\n  exactOutput: "100000000"\n});`}</CodePanel><CodePanel title="ROUTE RESPONSE" tag="reserved liquidity">{`{\n  "state": "RESERVED",\n  "maxInput": "…",\n  "output": "…",\n  "sources": [\n    { "type": "PRIVATE_MARKET", … }\n  ],\n  "finality": { "class": "ATOMIC" }\n}`}</CodePanel></div></section>

    <section className="fxr-take"><Eye>TAKE IT</Eye><h2>The FX stack is open source and self-hostable.</h2><div className="fxr-packages">{[["FX node","apps/fx-node","apps/fx-node/src/server.js"],["SDK","packages/fx-sdk","packages/fx-sdk/src/index.js"],["Contracts","packages/fx-contracts","packages/fx-contracts/src/AtomicRouter.sol"],["Private market","packages/fx-market","packages/fx-market/src/market-service.js"],["Pricing + risk","packages/fx-pricing","packages/fx-pricing/src/principal-pricing.js"],["Liquidity","packages/fx-liquidity","packages/fx-liquidity/src/optimizer.js"],["Policy","packages/fx-policy","packages/fx-policy/src/policy-engine.js"],["Fiat","packages/fx-fiat","packages/fx-fiat/src/settlement-graph.js"]].map(([name, desc, path]) => <a key={name} href={source(path)} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{desc}</span></a>)}</div><div className="fxr-note"><span>BACKEND REFERENCE COMMIT · {RC.slice(0, 12)}</span><span>INTERNAL ENGINEERING GATES PASSED · NOT AN INDEPENDENT SECURITY AUDIT</span></div></section>
  </div>;
}
