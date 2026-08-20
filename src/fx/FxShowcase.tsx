import { useState } from "react";
import { Label } from "./Primitives";

type ExchangeMode = "fiat-fiat" | "stable-stable" | "fiat-stable" | "stable-fiat";

type ModeCopy = {
  tab: string;
  send: string;
  sendAmount: string;
  receive: string;
  receiveAmount: string;
  rate: string;
  route: string[];
};

const EXCHANGES: Record<ExchangeMode, ModeCopy> = {
  "fiat-fiat": {
    tab: "USD → EUR",
    send: "USD",
    sendAmount: "$100,000.00",
    receive: "EUR",
    receiveAmount: "€92,340.00",
    rate: "1 USD = 0.9234 EUR",
    route: ["USD", "fiat edge", "USDC", "FX", "EURC", "fiat edge", "EUR"],
  },
  "stable-stable": {
    tab: "USDC → EURC",
    send: "USDC",
    sendAmount: "100,000.00",
    receive: "EURC",
    receiveAmount: "92,340.00",
    rate: "1 USDC = 0.9234 EURC",
    route: ["USDC", "FX", "EURC"],
  },
  "fiat-stable": {
    tab: "USD → EURC",
    send: "USD",
    sendAmount: "$100,000.00",
    receive: "EURC",
    receiveAmount: "92,340.00",
    rate: "1 USD = 0.9234 EURC",
    route: ["USD", "fiat edge", "USDC", "FX", "EURC"],
  },
  "stable-fiat": {
    tab: "USDC → EUR",
    send: "USDC",
    sendAmount: "100,000.00",
    receive: "EUR",
    receiveAmount: "€92,340.00",
    rate: "1 USDC = 0.9234 EUR",
    route: ["USDC", "FX", "EURC", "fiat edge", "EUR"],
  },
};

const Dot = ({ kind = "market" }: { kind?: "market" | "firm" | "treasury" | "external" }) => <i className={`fxs-dot ${kind}`} />;

export function ExchangeOpening() {
  const [mode, setMode] = useState<ExchangeMode>("fiat-fiat");
  const active = EXCHANGES[mode];
  return <section className="fxp-section fxs-opening">
    <div className="fxs-opening-copy">
      <div className="fxp-hero-top"><Label>STABLECOIN FX</Label><span className="fxp-hero-open">OPEN SOURCE · SELF-HOSTABLE</span></div>
      <h1>FX for financial products.</h1>
      <p>Offer fiat and stablecoin exchange in the same product. The customer sees a quote and an exchange. Blueballs provides the software underneath.</p>
      <div className="fxs-mode-tabs">{(Object.keys(EXCHANGES) as ExchangeMode[]).map((id) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{EXCHANGES[id].tab}</button>)}</div>
    </div>
    <div className="fxs-opening-stage">
      <div className="fxs-phone">
        <div className="fxs-phone-bar"><span>9:41</span><span>● ● ●</span></div>
        <span className="fxs-phone-label">EXCHANGE</span>
        <div className="fxs-phone-money"><small>You send</small><b>{active.sendAmount}</b><span>{active.send}</span></div>
        <div className="fxs-phone-swap">↓</div>
        <div className="fxs-phone-money receive"><small>You receive</small><b>{active.receiveAmount}</b><span>{active.receive}</span></div>
        <div className="fxs-phone-rate"><span>Rate</span><b>{active.rate}</b></div>
        <button>Review exchange</button>
      </div>
      <div className="fxs-route-preview">
        <span className="fxs-stage-label">THIS ROUTE</span>
        <div className="fxs-route-line">{active.route.map((step, index) => <div key={`${step}-${index}`} className={step === "FX" ? "fx" : step === "fiat edge" ? "edge" : "asset"}><b>{step}</b>{index < active.route.length - 1 && <i>→</i>}</div>)}</div>
        <small>The route changes with the assets. The exchange screen does not.</small>
      </div>
    </div>
  </section>;
}

export function MarketReveal() {
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>BEHIND THE QUOTE</Label><h2>The same customer exchange can use more than one market.</h2><p>Customer orders, market makers, issuers, treasury and connected providers can all contribute to the price the customer sees.</p></div></div>
    <div className="fxs-stage fxs-market-reveal">
      <div className="fxs-customer-quote"><span>CUSTOMER</span><b>$250,000</b><small>USD → EUR</small><em>one quote</em></div>
      <div className="fxs-flow-arrow">→</div>
      <div className="fxs-market-sources">
        <div><Dot/><span>YOUR MARKET</span><b>$90,000</b><small>customer + business orders</small></div>
        <div><Dot kind="firm"/><span>MARKET MAKER</span><b>$75,000</b><small>resting price</small></div>
        <div><Dot kind="firm"/><span>ISSUER / BANK</span><b>$50,000</b><small>firm quote</small></div>
        <div><Dot kind="treasury"/><span>TREASURY</span><b>$25,000</b><small>inside your limit</small></div>
        <div><Dot kind="external"/><span>EXTERNAL</span><b>$10,000</b><small>remaining amount</small></div>
      </div>
      <div className="fxs-flow-arrow">→</div>
      <div className="fxs-customer-result"><span>EXCHANGE</span><b>$250,000 filled</b><small>selected capacity reserved for this quote</small><div className="fxs-fillbar"><i/><i/><i/><i/><i/></div></div>
    </div>
  </section>;
}

export function CustomerMarket() {
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>YOUR MARKET</Label><h2>Customers and businesses can place FX orders too.</h2><p>A verified customer can exchange at the price on screen, or leave an order at a price they choose. Both can sit in the same private market.</p></div></div>
    <div className="fxs-stage fxs-customer-market">
      <div className="fxs-phone compact">
        <span className="fxs-phone-label">EXCHANGE</span>
        <div className="fxs-phone-money"><small>You send</small><b>5,000</b><span>USDC</span></div>
        <div className="fxs-phone-swap">↓</div>
        <div className="fxs-phone-money receive"><small>You receive</small><b>4,619</b><span>EURC</span></div>
        <button>Exchange</button>
      </div>
      <div className="fxs-market-center">
        <span>PRIVATE USDC / EURC MARKET</span>
        <div className="fxs-book">
          <div><small>AMOUNT</small><small>PRICE</small></div>
          <p><b>25,000</b><strong>1.0826</strong></p>
          <p><b>80,000</b><strong>1.0828</strong></p>
          <p><b>50,000</b><strong>1.0831</strong></p>
        </div>
        <small>Orders, customer identity and market depth stay private.</small>
      </div>
      <div className="fxs-phone compact maker">
        <span className="fxs-phone-label">CREATE FX ORDER</span>
        <div className="fxs-order-field"><small>Sell</small><b>25,000 EURC</b></div>
        <div className="fxs-order-field"><small>At</small><b>1.0826 USDC</b></div>
        <div className="fxs-order-field"><small>Status</small><b>Open until filled or cancelled</b></div>
        <button>Create order</button>
      </div>
    </div>
  </section>;
}

export function InstitutionParticipation() {
  const [mode, setMode] = useState<"order" | "inventory" | "rfq">("rfq");
  const copy = {
    order: { title: "Leave an order.", note: "A signed price can stay in the private market until it fills, expires or is cancelled.", state: "GTC" },
    inventory: { title: "Expose available inventory.", note: "An adapter can make executable capacity available without posting a normal resting order.", state: "ready" },
    rfq: { title: "Quote when the trade arrives.", note: "A bank, issuer or market maker can return a firm price for the exact amount requested.", state: "8s" },
  }[mode];
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>CONNECTED FIRMS</Label><h2>Institutions can participate without changing how they manage liquidity.</h2><p>Use resting orders, available inventory or short-lived firm quotes. Blueballs gives them a common execution path.</p></div></div>
    <div className="fxs-mode-tabs">{(["order","inventory","rfq"] as const).map((id) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{id === "order" ? "Resting order" : id === "inventory" ? "Inventory" : "Firm quote"}</button>)}</div>
    <div className="fxs-stage fxs-institution">
      <div className="fxs-institution-copy"><span>{mode === "rfq" ? "JIT / RFQ" : mode === "inventory" ? "INVENTORY" : "ORDER"}</span><b>{copy.title}</b><p>{copy.note}</p></div>
      <div className="fxs-rfq-request"><span>{mode === "rfq" ? "REQUEST" : "PAIR"}</span><b>{mode === "rfq" ? "$4,000,000 USD → EUR" : "USDC / EURC"}</b><small>{mode === "rfq" ? "firm price requested now" : "private executable capacity"}</small></div>
      <div className="fxs-rfq-table"><div className="head"><span>FIRM</span><span>PRICE</span><span>CAPACITY</span><span>STATE</span></div><div className="row selected"><span><Dot kind="firm"/>Issuer A</span><b>0.9235</b><strong>$2.0m</strong><em>{copy.state}</em></div><div className="row selected"><span><Dot kind="firm"/>Bank B</span><b>0.9236</b><strong>$5.0m</strong><em>{copy.state}</em></div><div className="row"><span><Dot kind="firm"/>Maker C</span><b>0.9238</b><strong>$3.0m</strong><em>{copy.state}</em></div><div className="summary"><span>SELECTED</span><b>Issuer A + Bank B</b></div></div>
    </div>
  </section>;
}

export function SettlementArchitecture() {
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>MARKET + SETTLEMENT</Label><h2>Keep the market private. Settle the token exchange on-chain.</h2><p>Customer identity, orders, pricing and matching stay off-chain. The selected token fills are authorised and settled on-chain.</p></div></div>
    <div className="fxs-stage fxs-settlement">
      <div className="fxs-private-side"><span>OFF-CHAIN</span><b>Private FX market</b><p>Accounts and identity</p><p>Orders and depth</p><p>Pricing and matching</p><p>Limits and reservations</p></div>
      <div className="fxs-selected-fills"><span>SELECTED FILLS</span><div><i/><b>Customer order</b><strong>$40k</strong></div><div><i/><b>Maker</b><strong>$25k</strong></div><div><i/><b>Issuer</b><strong>$20k</strong></div><div><i/><b>Treasury</b><strong>$15k</strong></div><em>signed + bounded</em></div>
      <div className="fxs-chain-side"><span>ON-CHAIN</span><b>Settlement kernel</b><p>Maker signatures</p><p>Taker bounds</p><p>Partial-fill accounting</p><p>Cancellation + replay protection</p><div>All selected token fills settle together.</div></div>
    </div>
  </section>;
}

export function FiatConnections() {
  const [mode, setMode] = useState<"provider" | "customers" | "peer" | "issuer">("provider");
  const data = {
    provider: { title: "Banking / ramp provider", sub: "The provider moves fiat and returns the confirmation needed to release or mint stablecoins.", left: "CUSTOMER BANK", middle: "PROVIDER", evidence: "settlement confirmation" },
    customers: { title: "Your own customers", sub: "Both sides are already accounts in your product, with the identity and transaction controls you operate for those accounts.", left: "CUSTOMER A", middle: "CUSTOMER B", evidence: "internal / bank transfer" },
    peer: { title: "Open P2P", sub: "An external peer can receive the fiat payment. Payment evidence is used before crypto is released.", left: "FIAT PAYER", middle: "EXTERNAL PEER", evidence: "payment proof" },
    issuer: { title: "Direct issuer", sub: "Fiat received by an issuer can mint the stablecoin used for the FX leg. Redemption can work in the other direction.", left: "FIAT ACCOUNT", middle: "ISSUER", evidence: "mint / redeem" },
  }[mode];
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>FIAT CONNECTIONS</Label><h2>Use the fiat rails that fit the product you are building.</h2><p>The FX market in the middle does not depend on one on-ramp or off-ramp model.</p></div></div>
    <div className="fxs-mode-tabs">{(["provider","customers","peer","issuer"] as const).map((id) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{id === "provider" ? "Provider" : id === "customers" ? "Your customers" : id === "peer" ? "Open P2P" : "Issuer"}</button>)}</div>
    <div className="fxs-stage fxs-fiat">
      <div className="fxs-fiat-copy"><span>{data.title}</span><p>{data.sub}</p></div>
      <div className="fxs-fiat-route"><div><span>{data.left}</span><b>R$50,000</b><small>fiat</small></div><i>→</i><div><span>{data.middle}</span><b>{data.evidence}</b><small>{mode === "peer" ? "outside your customer perimeter" : mode === "customers" ? "known customer accounts" : "adapter boundary"}</small></div><i>→</i><div className="stable"><span>STABLECOIN</span><b>USDC</b><small>available for FX</small></div><i>→</i><div className="fx"><span>FX MARKET</span><b>USDC → EURC</b><small>same market</small></div></div>
      <div className="fxs-direct-stable"><span>USDT → EURC</span><b>Stablecoin FX enters here directly. No fiat leg.</b></div>
    </div>
  </section>;
}

export function TreasuryCapacity() {
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>TREASURY</Label><h2>The institution can use currency it already holds.</h2><p>Treasury can participate within an exposure limit. Existing exposure and reserved quotes both consume that limit.</p></div></div>
    <div className="fxs-stage fxs-treasury">
      <div className="fxs-balance-list"><span>BALANCES</span><p><b>USD</b><strong>$12.4m</strong></p><p><b>EUR</b><strong>€3.2m</strong></p><p><b>SGD</b><strong>S$8.1m</strong></p></div>
      <div className="fxs-limit"><span>EUR PRINCIPAL LIMIT</span><b>€5.0m</b><div className="meter"><i/><i/></div><small>€3.2m current · €1.2m reserved · €0.6m free</small></div>
      <div className="fxs-new-trade"><span>NEW CUSTOMER EXCHANGE</span><b>€1.0m</b><small>customer needs EUR</small></div>
      <div className="fxs-treasury-split"><div><span>TREASURY</span><b>€0.6m</b><small>remaining capacity</small></div><div><span>OTHER SOURCES</span><b>€0.4m</b><small>fill the remainder</small></div></div>
    </div>
  </section>;
}

const DEPLOYMENTS = {
  new: { title: "New financial product", note: "Use providers for most of the route while the customer product stays yours.", items: ["Ramp / banking provider", "External FX provider", "Blueballs quote + settlement state"] },
  growing: { title: "Growing neobank", note: "Add customer orders and direct issuer liquidity without rebuilding the exchange screen.", items: ["Customer orders", "Issuer", "External provider", "Blueballs market"] },
  institution: { title: "Institution", note: "Use customer flow, treasury and direct institutional pricing together.", items: ["Private customer market", "Treasury", "Bank / issuer RFQ", "Market makers", "External fallback"] },
  open: { title: "Crypto-native product", note: "Use open fiat edges and the same stablecoin FX market underneath.", items: ["Open P2P fiat edge", "Stablecoin market", "On-chain token settlement", "Optional external venues"] },
} as const;

export function DeploymentExamples() {
  const [mode, setMode] = useState<keyof typeof DEPLOYMENTS>("growing");
  const active = DEPLOYMENTS[mode];
  return <section className="fxp-section fxs-section">
    <div className="fxp-section-head"><div><Label>DEPLOYMENT</Label><h2>Build the FX stack around the institution you have.</h2><p>Blueballs does not require one fixed set of providers or one fixed market model.</p></div></div>
    <div className="fxs-mode-tabs">{(Object.keys(DEPLOYMENTS) as (keyof typeof DEPLOYMENTS)[]).map((id) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{DEPLOYMENTS[id].title}</button>)}</div>
    <div className="fxs-stage fxs-deployment">
      <div className="fxs-deployment-copy"><span>CONFIGURATION</span><b>{active.title}</b><p>{active.note}</p></div>
      <div className="fxs-deployment-flow"><div className="customer"><span>CUSTOMER PRODUCT</span><b>Exchange</b></div><i>→</i><div className="stack"><span>BEHIND IT</span>{active.items.map((item, index) => <p key={item}><small>{String(index + 1).padStart(2,"0")}</small><b>{item}</b></p>)}</div><i>→</i><div className="customer"><span>SAME SURFACE</span><b>Quote · exchange · status</b></div></div>
    </div>
  </section>;
}

export function SourceCodeHandoff() {
  const packages = [
    ["fx-market", "Orders, matching and market state"],
    ["fx-liquidity", "Sources, capacity and reservations"],
    ["fx-pricing", "Pricing and quote construction"],
    ["fx-policy", "Execution and participation rules"],
    ["fx-fiat", "Fiat evidence and adapter boundaries"],
    ["fx-contracts", "On-chain settlement contracts"],
    ["fx-sdk", "Client integration"],
    ["fx-simulator", "Reference scenarios and testing"],
  ];
  return <section className="fxp-section fxs-section fxs-handoff">
    <div className="fxp-section-head"><div><Label>OPEN SOURCE</Label><h2>Everything behind these diagrams is in the repository.</h2><p>Run the reference market, inspect the packages, change the assumptions and build your own integration around them.</p></div></div>
    <div className="fxs-stage fxs-code-map"><div className="fxs-code-title"><span>PACKAGES / FX</span><b>Take the parts you need.</b><small>MIT licensed · self-hostable</small></div><div className="fxs-package-grid">{packages.map(([name, description]) => <div key={name}><code>packages/{name}</code><span>{description}</span></div>)}</div></div>
  </section>;
}
