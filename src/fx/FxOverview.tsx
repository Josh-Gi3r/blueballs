import { useMemo, useState } from "react";
import { Label } from "./Primitives";
import {
  SOURCE_LABELS,
  REPO,
  SCENARIO_COPY,
  formatAtomic,
  formatCurrency,
  source,
  type MarketState,
  type PublicTrade,
  type Scenario,
  type SourceStatus,
} from "./model";

const tree = (path: string) => `${REPO}/tree/main/${path}`;

type RouteMode = "fiat-fiat" | "fiat-stable" | "stable-fiat" | "stable-stable";
type FiatMode = "provider" | "customers" | "issuer" | "peer";
type LiquidityMode = "order" | "inventory" | "quote";

type OverviewProps = {
  trade: PublicTrade | null;
  market: MarketState | null;
  scenarios: Scenario[];
  activeScenario: string;
  selectedSource: string | null;
  amount: string;
  loading: boolean;
  busy: boolean;
  error: string | null;
  runtimeReachable: boolean;
  onAmountChange: (value: string) => void;
  onPreview: () => void;
  onScenarioChange: (id: string) => void;
  onSourceSelect: (id: string) => void;
};

const ROUTES: Record<RouteMode, { label: string; steps: string[]; note: string }> = {
  "fiat-fiat": { label: "Fiat → fiat", steps: ["BRL", "BRLX", "FX", "EURC", "EUR"], note: "Local fiat in, token exchange, local fiat out." },
  "fiat-stable": { label: "Fiat → stablecoin", steps: ["Fiat", "Stablecoin", "FX", "Stablecoin"], note: "The route ends on-chain." },
  "stable-fiat": { label: "Stablecoin → fiat", steps: ["Stablecoin", "FX", "Stablecoin", "Fiat"], note: "The route begins on-chain." },
  "stable-stable": { label: "Stablecoin → stablecoin", steps: ["Stablecoin", "FX", "Stablecoin"], note: "No fiat leg is required." },
};

const FIAT: Record<FiatMode, { label: string; detail: string; state: string }> = {
  provider: { label: "Provider", detail: "A bank or a ramp confirms the local payment.", state: "confirmed by the provider" },
  customers: { label: "Your customers", detail: "Two verified customers inside your own product move the money between themselves.", state: "settled on your ledger" },
  issuer: { label: "Issuer", detail: "An issuer mints after the fiat lands, and redeems before the fiat goes out.", state: "mint or redemption" },
  peer: { label: "Peer", detail: "An outside peer-to-peer adapter proves the payment before any token moves.", state: "proved by the payer" },
};

const MECHANISMS = [
  ["Private market with aggregate depth", "Orders and maker identities stay private. Authorised clients can see the price and total amount available at each level, but not who placed the orders.", "packages/fx-market/src/sqlite-market.js", "packages/fx-market/test"],
  ["Policy checked at execution", "Each selected fill needs live institutional authorisation when it executes. Signatures cannot override an expired or revoked policy.", "packages/fx-contracts/src/PolicyAuthorizationRegistry.sol", "packages/fx-contracts/test"],
  ["Exact multi-source routing", "Eligible prices and available amounts are compared across sources. A route can use several sources, but only when they can fill the full amount.", "packages/fx-liquidity/src/optimizer.js", "packages/fx-liquidity/test"],
  ["Liquidity reservation", "Each selected source reserves its part before the quote becomes firm. If any reservation fails, the earlier reservations are released.", "packages/fx-liquidity/src/coordinator.js", "packages/fx-liquidity/test"],
  ["Atomic token settlement", "Customer limits, maker fills, cancellations and nonces are checked in one router transaction. Every selected token transfer settles, or the transaction reverts.", "packages/fx-contracts/src/AtomicRouter.sol", "packages/fx-contracts/test"],
  ["Settlement recorded by leg", "Token swaps, internal ledger movements, verified external payments and asynchronous payouts keep the settlement status of the system that processes them.", "packages/fx-fiat/src/settlement-graph.js", "packages/fx-fiat/test"],
  ["Hard balance-sheet limits", "Open positions and outstanding reservations both count against the limit for each asset. Once the limit is reached, no more balance-sheet capacity is quoted.", "packages/fx-pricing/src/risk-book.js", "packages/fx-pricing/test"],
  ["Safe submission handling", "A trade is marked as submitted before the external call. If the outcome is unknown, the system waits for authoritative settlement evidence instead of submitting it again.", "packages/fx-fiat/src/settlement-store.js", "packages/fx-fiat/test"],
  ["No synthetic fills", "The route stops when liquidity is missing, capacity expires, policy is revoked, customer limits fail or risk capacity is exhausted. The system never creates liquidity to complete a quote.", "apps/fx-node/src/quote-coordinator.js", "apps/fx-node/test"],
] as const;

const PACKAGES = [
  ["apps/fx-node", "Serves the API, coordinates the quote, talks to every source and runs the trade through its lifecycle"],
  ["fx-market", "Holds signed orders, matches them, handles partial fills and reservations, and reports depth"],
  ["fx-liquidity", "Normalises the candidates, plans the exact route and reserves it across sources"],
  ["fx-pricing", "Checks the reference price, quotes your own book and enforces the risk limits"],
  ["fx-policy", "Decides who may trade what, and for how long that stays true"],
  ["fx-fiat", "Tracks fiat intents, evidence, route graphs, finality and reconciliation"],
  ["fx-contracts", "Handles vault accounting, signed maker fills, cancellation, policy and atomic routing"],
  ["fx-sdk", "Provides the JavaScript client for the API"],
  ["fx-simulator", "Deterministic market and failure scenarios"],
] as const;

const humanReason = (value: string) => value.replaceAll("_", " ").toLowerCase();

function StepLine({ steps }: { steps: string[] }) {
  return <div className="fxo-step-line">{steps.map((step, index) => <div key={`${step}-${index}`} className={step === "FX" ? "core" : index === 0 || index === steps.length - 1 ? "edge" : "token"}><span>{step}</span>{index < steps.length - 1 && <i>→</i>}</div>)}</div>;
}

function Amounts({ trade }: { trade: PublicTrade | null }) {
  return <div className="fxo-amounts"><div><small>You send</small><strong>{formatCurrency(trade?.from.charged, "BRL")}</strong><span>{trade?.from.symbol ?? "BRL"}</span></div><i>↓</i><div><small>You receive</small><strong>{formatCurrency(trade?.to.amount, "EUR")}</strong><span>{trade?.to.symbol ?? "EUR"}</span></div></div>;
}

function SectionHead({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <div className="fxo-section-head"><span>{number}</span><div><h2>{title}</h2>{children}</div></div>;
}

export function FxOverview(props: OverviewProps) {
  const [routeMode, setRouteMode] = useState<RouteMode>("fiat-fiat");
  const [fiatMode, setFiatMode] = useState<FiatMode>("provider");
  const [liquidityMode, setLiquidityMode] = useState<LiquidityMode>("order");
  const [mechanism, setMechanism] = useState(0);
  const route = ROUTES[routeMode];
  const fiat = FIAT[fiatMode];
  const selectedStatus = props.trade?.sourceStatus.find((item) => item.sourceId === props.selectedSource) ?? props.trade?.sourceStatus[0];
  const selectedAllocation = props.trade?.sources.find((item) => item.sourceId === selectedStatus?.sourceId || (selectedStatus?.sourceType === "PRIVATE_MARKET" && item.type === "PRIVATE_MARKET"));
  const usedTotal = useMemo(() => props.trade?.sources.reduce((sum, item) => sum + Number(item.outputAmount ?? 0), 0) ?? 0, [props.trade]);
  const activeMechanism = MECHANISMS[mechanism];

  return <>
    <section className="fxp-section fxo-hero">
      <div className="fxo-hero-copy">
        <h1>Build and operate FX.</h1>
        <p>Offer fiat and stablecoin exchange through one API. Choose the currencies, liquidity, pricing, risk limits, fiat rails and settlement model for each market.</p>
        <p>Use your own market, external sources or both.</p>
        <div className="fxo-actions"><a href="#fx-products">See how it works</a><a className="quiet" href="#fx-repository">View the implementation</a></div>
      </div>
      <div className="fxo-product-shell">
        <div className="fxo-phone">
          <div className="fxo-phone-top"><span>Exchange</span><em>{props.loading ? "Updating" : props.trade ? "Quote ready" : "Unavailable"}</em></div>
          <Amounts trade={props.trade}/>
          <div className="fxo-rate"><span>Rate</span><b>{props.trade ? `1 EUR = ${props.trade.rate} BRL` : "—"}</b></div>
          <a className={props.trade ? "" : "disabled"} href={props.trade ? "#fx-lifecycle" : undefined}>Review exchange</a>
        </div>
        <aside className="fxo-live-rail">
          <div className="fxo-live-title"><span className={props.runtimeReachable ? "online" : ""}/><b>Exchange state</b><em>{props.trade?.state ?? "—"}</em></div>
          <div className="fxo-live-values"><span>Requested</span><b>{formatCurrency(props.trade?.from.requested, "BRL")}</b><span>Output</span><b>{formatCurrency(props.trade?.to.amount, "EUR")}</b><span>Sources used</span><b>{props.trade?.sources.length ?? 0}</b><span>Route</span><b>{props.trade?.settlement.guarantee.class?.replaceAll("_", " ").toLowerCase() ?? "—"}</b></div>
          <div className="fxo-live-states">{["request", "eligible", "planned", "reserved", "execute", "reconcile"].map((item, index) => <span key={item} className={props.trade && index < 3 ? "done" : props.trade?.state === "RESERVED" && index < 4 ? "done" : ""}>{item}</span>)}</div>
        </aside>
      </div>
    </section>

    <section id="fx-products" className="fxp-section fxo-section">
      <SectionHead number="01" title="Exchange products and routes"><p>One API covers fiat to fiat, fiat to stablecoin, stablecoin to fiat and stablecoin to stablecoin. The screen your customer sees stays the same; the route underneath changes with the pair.</p></SectionHead>
      <div className="fxo-route-tabs">{(Object.keys(ROUTES) as RouteMode[]).map((id) => <button type="button" key={id} className={id === routeMode ? "active" : ""} onClick={() => setRouteMode(id)}>{ROUTES[id].label}</button>)}</div>
      <div className="fxo-route-stage">
        <div><Label>SELECTED ROUTE</Label><h3>{route.label}</h3><p>{route.note}</p>{routeMode !== "fiat-fiat" && <small>The live numbers on this page come from the BRL → EUR exchange. This route shows its shape.</small>}</div>
        <StepLine steps={routeMode === "fiat-fiat" && props.trade ? [props.trade.from.symbol, props.trade.tokenRoute.inputSymbol, "FX", props.trade.tokenRoute.outputSymbol, props.trade.to.symbol] : route.steps}/>
        <div className="fxo-finality-list">{routeMode === "fiat-fiat" && props.trade ? props.trade.settlement.edges.map((edge) => <div key={edge.edgeId}><b>{edge.fromAsset} → {edge.toAsset}</b><span>{humanReason(edge.finalityClass)}</span></div>) : <div><b>{route.label}</b><span>Each leg is final when the system that performs it says it is.</span></div>}</div>
      </div>
    </section>

    <section id="fx-lifecycle" className="fxp-section fxo-section fxo-dark">
      <SectionHead number="02" title="From request to settlement"><p>Each exchange is checked, priced, routed, reserved, executed and reconciled. One source can fill it, or several can fill it together.</p><p>Before a source can quote, it must be eligible for the participant, account, currency pair, jurisdiction and amount. If the available sources cannot fill the amount within the accepted price, no quote is returned.</p></SectionHead>
      <div className="fxo-lifecycle">{[
        ["01", "Request", `${props.amount || "—"} BRL → EUR`],
        ["02", "Eligibility", `${props.trade?.sourceStatus.filter((item) => item.eligible).length ?? 0} sources eligible`],
        ["03", "Candidates", `${props.trade?.sourceStatus.length ?? 0} sources checked`],
        ["04", "Plan", `${props.trade?.sources.length ?? 0} selected`],
        ["05", "Reserve", props.trade?.evidence.reserved ? "capacity held" : "not held yet"],
        ["06", "Execute", "send the selected legs"],
        ["07", "Reconcile", "wait for settlement evidence"],
      ].map(([index, title, detail]) => <div key={title}><span>{index}</span><b>{title}</b><small>{detail}</small></div>)}</div>
    </section>

    <section className="fxp-section fxo-section">
      <SectionHead number="03" title="Liquidity"><p>Use liquidity from customers and businesses, issuers, market makers, financial institutions, outside providers and your own treasury. One exchange may draw from several eligible sources; the customer receives a single executable quote.</p><p>Participants can place an order, publish available inventory or quote on request. Customers and businesses can quote against balances they already hold. When an order fills, they exchange at the rate they set; their return depends on the price and volume filled.</p></SectionHead>
      <div className="fxo-allocation">
        <div className="fxo-source-list">{(props.trade?.sourceStatus ?? []).map((status) => <SourceRow key={status.sourceId} status={status} trade={props.trade} active={props.selectedSource === status.sourceId} onClick={() => props.onSourceSelect(status.sourceId)}/>)}</div>
        <div className="fxo-allocation-result"><Label>FILLED FROM THESE SOURCES</Label><strong>{formatCurrency(props.trade?.to.amount, "EUR")}</strong><div className="fxo-fillbar">{props.trade?.sources.map((item) => <i key={`${item.type}:${item.sourceId}`} style={{ width: `${usedTotal ? (Number(item.outputAmount ?? 0) / usedTotal) * 100 : 0}%` }}/>)}</div><dl><dt>Source</dt><dd>{selectedStatus?.label ?? "—"}</dd><dt>Available</dt><dd>{selectedStatus ? `${formatAtomic(selectedStatus.availableOutput)} EURC` : "—"}</dd><dt>Used</dt><dd>{selectedAllocation?.outputAmount ? formatCurrency(selectedAllocation.outputAmount, "EUR") : "€0.00"}</dd><dt>Status</dt><dd>{selectedStatus ? humanReason(selectedStatus.reason) : "—"}</dd></dl></div>
      </div>
      <div className="fxo-mode-stage">
        <div className="fxo-route-tabs">{(["order", "inventory", "quote"] as LiquidityMode[]).map((id) => <button type="button" key={id} className={id === liquidityMode ? "active" : ""} onClick={() => setLiquidityMode(id)}>{id === "order" ? "Resting order" : id === "inventory" ? "Available inventory" : "Firm quote"}</button>)}</div>
        <div><b>{liquidityMode === "order" ? "Leave an order at your rate." : liquidityMode === "inventory" ? "Show what you will trade." : "Price each request as it arrives."}</b><p>{liquidityMode === "order" ? "It sits in the market until it fills, expires or you cancel it." : liquidityMode === "inventory" ? "An adapter reports the size and price you will trade at, without placing an order." : "Return a price and a size for that one request, good for a few seconds."}</p></div>
      </div>
    </section>

    <section className="fxp-section fxo-section fxo-two-column">
      <SectionHead number="04" title="Pricing, routing and risk"><p>Orders, financial institutions and outside providers supply executable prices. Principal pricing starts from a reference rate and can account for spread, volatility, trade size, corridor, rail and inventory. Eligible prices are compared without floating-point rounding.</p><p>Liquidity is reserved before a firm quote is returned. Positions and open reservations count against treasury and principal limits. When a limit is reached, that source is removed and the route is recalculated. If the remaining sources cannot fill the exchange, no quote is returned.</p></SectionHead>
      <div className="fxo-control-panel">
        <div className="fxo-amount-control"><label htmlFor="fx-amount">Amount</label><div><span>R$</span><input id="fx-amount" inputMode="decimal" value={props.amount} onChange={(event) => props.onAmountChange(event.target.value)}/><button type="button" onClick={props.onPreview} disabled={props.loading}>Quote</button></div></div>
        <div className="fxo-scenario-list">{props.scenarios.map((item) => <button type="button" key={item.id} className={item.id === props.activeScenario ? "active" : ""} onClick={() => props.onScenarioChange(item.id)} disabled={props.busy}>{SCENARIO_COPY[item.id]?.title ?? item.label}</button>)}</div>
        {props.error && <p className="fxo-error">{props.error}</p>}
      </div>
    </section>

    <section className="fxp-section fxo-section fxo-dark">
      <SectionHead number="05" title="Private market and on-chain settlement"><p>Customer identities, orders, prices, matching and limits stay in your own systems. You can publish aggregate depth without revealing who placed an order or the signed order itself.</p><p>Only the selected token fills go on-chain. Each trade still needs live institutional authorisation when it executes. The contracts enforce customer limits, partial fills, cancellations, nonces and vault balances. Every selected fill settles, or the transaction reverts.</p></SectionHead>
      <div className="fxo-boundary">
        <div><Label>PRIVATE MARKET</Label>{["Identity and accounts", "Signed orders", "Prices and matching", "Limits and reservations"].map((item) => <p key={item}>{item}</p>)}</div>
        <div className="fxo-selected"><Label>SELECTED FILLS</Label>{props.trade?.sources.map((item) => <p key={`${item.type}:${item.sourceId}`}><span>{SOURCE_LABELS[item.type]}</span><b>{formatCurrency(item.outputAmount, "EUR")}</b></p>)}<small>All selected token fills settle or revert together.</small></div>
        <div><Label>ON-CHAIN CONTRACTS</Label>{["Maker signatures", "Customer bounds", "Fill and cancellation state", "Policy authorisation", "Vault transfers"].map((item) => <p key={item}>{item}</p>)}</div>
      </div>
    </section>

    <section className="fxp-section fxo-section">
      <SectionHead number="06" title="Fiat settlement"><p>Cash can enter and leave through a bank or ramp, transfers between verified customers or businesses, issuer mint and redemption, or an external peer-to-peer service. Stablecoin-to-stablecoin exchange has no fiat leg.</p><p>Track each leg independently. The token swap is atomic. Internal ledger movements, external payments, mints, redemptions and bank payouts keep their own status, evidence and timing.</p><p>A quote is not a fill, and submission is not confirmation. When an external result is uncertain, wait for authoritative settlement evidence before trying again.</p></SectionHead>
      <div className="fxo-route-tabs">{(Object.keys(FIAT) as FiatMode[]).map((id) => <button type="button" key={id} className={id === fiatMode ? "active" : ""} onClick={() => setFiatMode(id)}>{FIAT[id].label}</button>)}</div>
      <div className="fxo-fiat-stage">
        <div><Label>{fiat.label.toUpperCase()}</Label><h3>{fiat.detail}</h3><span>{fiat.state}</span>{fiatMode !== "provider" && <small>The BRL → EUR exchange above uses the provider route. This option shows how another fiat edge connects.</small>}</div>
        <StepLine steps={["Local fiat", fiat.label, props.trade?.tokenRoute.inputSymbol ?? "Token", "FX", props.trade?.tokenRoute.outputSymbol ?? "Token", "Local payout"]}/>
        <div className="fxo-finality-list">{fiatMode === "provider" ? props.trade?.settlement.edges.map((edge) => <div key={edge.edgeId}><b>{edge.edgeType.replaceAll("_", " ").toLowerCase()}</b><span>{humanReason(edge.finalityClass)}</span></div>) : <div><b>{fiat.label}</b><span>{fiat.state}</span></div>}</div>
      </div>
    </section>

    <section className="fxp-section fxo-section">
      <SectionHead number="07" title="What it already does"><p>Pick a mechanism to see what it does today, then open the code and the tests behind it.</p></SectionHead>
      <div className="fxo-mechanisms">
        <div>{MECHANISMS.map((item, index) => <button type="button" key={item[0]} className={index === mechanism ? "active" : ""} onClick={() => setMechanism(index)}><span>{String(index + 1).padStart(2, "0")}</span><b>{item[0]}</b></button>)}</div>
        <article><Label>CURRENT BEHAVIOUR</Label><h3>{activeMechanism[0]}</h3><p>{activeMechanism[1]}</p><div><a href={source(activeMechanism[2])} target="_blank" rel="noreferrer">Source ↗</a><a href={tree(activeMechanism[3])} target="_blank" rel="noreferrer">Tests ↗</a></div></article>
      </div>
    </section>

    <section id="fx-repository" className="fxp-section fxo-section fxo-repository">
      <SectionHead number="08" title="Inside the repository"><p>This is the exchange above, from the API request down to the packages that answered it.</p></SectionHead>
      <div className="fxo-repo-layout">
        <div className="fxo-request"><div><span>POST</span><code>/v2/fx/reference/trades/preview</code></div><pre>{JSON.stringify({ inputAmount: props.amount || "50000.00", from: "BRL", to: "EUR" }, null, 2)}</pre><div><span>{props.trade ? "200" : "—"}</span><code>{props.trade ? `${props.trade.sources.length} selected sources · ${props.trade.state}` : "No response"}</code></div></div>
        <div className="fxo-package-list">{PACKAGES.map(([name, detail]) => <a href={tree(name === "apps/fx-node" ? name : `packages/${name}`)} target="_blank" rel="noreferrer" key={name}><code>{name}</code><span>{detail}</span></a>)}</div>
      </div>
      <div className="fxo-repo-actions"><a href="https://github.com/Josh-Gi3r/blueballs" target="_blank" rel="noreferrer">View the source</a><a href="https://github.com/Josh-Gi3r/blueballs#quickstart" target="_blank" rel="noreferrer">Run it locally</a><a href="https://github.com/Josh-Gi3r/blueballs/tree/main/spec/fx" target="_blank" rel="noreferrer">Read the FX specification</a></div>
    </section>
  </>;
}

function SourceRow({ status, trade, active, onClick }: { status: SourceStatus; trade: PublicTrade | null; active: boolean; onClick: () => void }) {
  const allocation = trade?.sources.find((item) => item.sourceId === status.sourceId || (status.sourceType === "PRIVATE_MARKET" && item.type === "PRIVATE_MARKET"));
  return <button type="button" className={`${active ? "active" : ""} ${status.eligible ? "" : "blocked"}`} onClick={onClick}><i/><span><b>{status.label}</b><small>{status.eligible ? humanReason(status.reason) : `excluded · ${humanReason(status.reason)}`}</small></span><strong>{allocation?.outputAmount ? formatCurrency(allocation.outputAmount, "EUR") : "—"}</strong></button>;
}
