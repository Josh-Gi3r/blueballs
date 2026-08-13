import { useState } from "react";
import { Label } from "./Primitives";
import { SOURCE_LABELS, formatCurrency, type PublicTrade } from "./model";

const Dot = ({
  kind = "own",
}: {
  kind?: "own" | "firm" | "treasury" | "external";
}) => <i className={`fxn-dot ${kind}`} />;

export function ProductExchangeVisual({
  trade,
}: {
  trade: PublicTrade | null;
}) {
  const rows = trade?.sources.slice(0, 4) ?? [];
  return (
    <div className="fxn-hero-machine">
      <div className="fxn-phone fxn-phone-customer">
        <div className="fxn-phone-bar">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        <span className="fxn-eyebrow">EXCHANGE</span>
        <div className="fxn-money">
          <small>You send</small>
          <b>
            {formatCurrency(
              trade?.from.charged ?? trade?.from.requested,
              "BRL",
            )}
          </b>
          <span>{trade?.from.symbol ?? "BRL"}</span>
        </div>
        <div className="fxn-swap">↓</div>
        <div className="fxn-money receive">
          <small>You receive</small>
          <b>{formatCurrency(trade?.to.amount, "EUR")}</b>
          <span>{trade?.to.symbol ?? "EUR"}</span>
        </div>
        <div className="fxn-rate">
          <span>Rate</span>
          <b>{trade ? `1 EUR = ${trade.rate} BRL` : "Finding a route…"}</b>
        </div>
        <a className="fxn-phone-action" href="#fx-proof">
          Review exchange
        </a>
      </div>
      <div className="fxn-hero-path">
        <span>quote</span>
        <i />
        <span>exchange</span>
        <i />
        <span>settle</span>
      </div>
      <div className="fxn-hero-core">
        <div className="fxn-core-title">
          <span>PRIVATE FX MARKET</span>
          <b>The market behind the product.</b>
        </div>
        {rows.map((item, index) => (
          <div className="fxn-core-row" key={`${item.type}:${item.sourceId}`}>
            <Dot
              kind={
                index === 0
                  ? "own"
                  : index === 1
                    ? "firm"
                    : index === 2
                      ? "treasury"
                      : "external"
              }
            />
            <div>
              <b>{SOURCE_LABELS[item.type]}</b>
              <small>{item.sourceId}</small>
            </div>
            <strong>{formatCurrency(item.outputAmount, "EUR")}</strong>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="fxn-core-row">
            <Dot />
            <div>
              <b>Finding eligible liquidity</b>
              <small>orders · firms · treasury · providers</small>
            </div>
            <strong>—</strong>
          </div>
        )}
        <div className="fxn-core-settle">
          <span>THIS EXCHANGE</span>
          <b>
            {trade
              ? `${trade.sources.length} selected fills · one token settlement`
              : "Waiting for the market"}
          </b>
        </div>
      </div>
    </div>
  );
}

export function CustomerAndMaker({ trade }: { trade: PublicTrade | null }) {
  const customerLiquidity = trade?.sources.find(
    (item) => item.type === "PRIVATE_MARKET",
  );
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>PARTICIPANTS</Label>
          <h2>Customer and business liquidity</h2>
          <p>
            Verified customers and businesses can place signed FX orders against
            balances they control. Their identity and orders remain inside the
            institution's market.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-two-phones">
        <div className="fxn-phone">
          <div className="fxn-phone-bar">
            <span>9:41</span>
            <span>● ● ●</span>
          </div>
          <span className="fxn-eyebrow">EXCHANGE</span>
          <div className="fxn-money">
            <small>You send</small>
            <b>{formatCurrency(trade?.from.charged, "BRL")}</b>
            <span>{trade?.from.symbol ?? "BRL"}</span>
          </div>
          <div className="fxn-swap">↓</div>
          <div className="fxn-money receive">
            <small>You receive</small>
            <b>{formatCurrency(trade?.to.amount, "EUR")}</b>
            <span>{trade?.to.symbol ?? "EUR"}</span>
          </div>
          <div className="fxn-phone-action">Exchange</div>
        </div>
        <div className="fxn-market-link">
          <span>EXCHANGE</span>
          <i>⇄</i>
          <span>ORDER</span>
        </div>
        <div className="fxn-phone maker">
          <div className="fxn-phone-bar">
            <span>9:41</span>
            <span>● ● ●</span>
          </div>
          <span className="fxn-eyebrow">CREATE ORDER</span>
          <div className="fxn-pair">
            <b>
              {trade
                ? `${trade.from.symbol} / ${trade.to.symbol}`
                : "BRL / EUR"}
            </b>
            <small>Private order</small>
          </div>
          <div className="fxn-maker-field">
            <span>Sell</span>
            <b>{formatCurrency(customerLiquidity?.outputAmount, "EUR")}</b>
          </div>
          <div className="fxn-maker-field">
            <span>At</span>
            <b>{trade ? `1 EUR = ${trade.rate} BRL` : "—"}</b>
          </div>
          <div className="fxn-maker-status">
            <Dot />
            <span>Open until filled or cancelled</span>
          </div>
          <div className="fxn-phone-action">Create order</div>
        </div>
        <div className="fxn-market-center">
          <span>YOUR MARKET</span>
          <b>Orders meet here.</b>
          <div className="fxn-book-mini">
            <p>
              <em>{formatCurrency(customerLiquidity?.outputAmount, "EUR")}</em>
              <strong>{trade?.rate ?? "—"}</strong>
            </p>
            <p>
              <em>Businesses</em>
              <strong>private</strong>
            </p>
            <p>
              <em>Institutions</em>
              <strong>authorised</strong>
            </p>
          </div>
          <small>Private identities · signed orders · partial fills</small>
        </div>
      </div>
    </section>
  );
}

export function PrivateSettlement() {
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>MARKET AND SETTLEMENT</Label>
          <h2>Private market and atomic token settlement</h2>
          <p>
            Identity, orders, pricing, matching, reservations and limits remain
            off-chain. The selected token fills are authorised and settled
            on-chain.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-boundary">
        <div className="fxn-boundary-side private">
          <span>OFF-CHAIN</span>
          <b>Your market</b>
          <div>
            <p>Customers</p>
            <p>Orders</p>
            <p>Market depth</p>
            <p>Pricing + matching</p>
            <p>Limits</p>
          </div>
          <small>
            Visible to the institution. Not published to the public chain.
          </small>
        </div>
        <div className="fxn-boundary-arrow">
          <span>selected fills</span>
          <i>→</i>
          <small>signed</small>
        </div>
        <div className="fxn-boundary-side chain">
          <span>ON-CHAIN</span>
          <b>Settlement</b>
          <div>
            <p>Maker signatures</p>
            <p>Taker limits</p>
            <p>Cancellation protection</p>
            <p>Vault accounting</p>
            <p>Multi-maker settlement</p>
          </div>
          <small>The token fills settle together.</small>
        </div>
      </div>
    </section>
  );
}

export function OneTradeManyWays({ trade }: { trade: PublicTrade | null }) {
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>ROUTING</Label>
          <h2>Multi-source execution</h2>
          <p>
            The planner combines eligible prices and capacity from one or more
            counterparties into a complete quote. If the full amount cannot be
            filled, it returns no route.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-route">
        <div className="fxn-trade">
          <span>CUSTOMER REQUEST</span>
          <b>
            {formatCurrency(
              trade?.from.charged ?? trade?.from.requested,
              "BRL",
            )}
          </b>
          <small>
            {trade ? `${trade.from.symbol} → ${trade.to.symbol}` : "BRL → EUR"}
          </small>
        </div>
        <div className="fxn-route-line" />
        <div className="fxn-route-sources">
          {trade?.sources.map((item, index) => (
            <div key={`${item.type}:${item.sourceId}`}>
              <Dot
                kind={
                  index === 0
                    ? "own"
                    : index === 1
                      ? "firm"
                      : index === 2
                        ? "treasury"
                        : "external"
                }
              />
              <span>{SOURCE_LABELS[item.type].toUpperCase()}</span>
              <b>{formatCurrency(item.outputAmount, "EUR")}</b>
              <small>{item.sourceId}</small>
            </div>
          )) ?? (
            <div>
              <Dot />
              <span>MARKET</span>
              <b>—</b>
              <small>waiting for a quote</small>
            </div>
          )}
        </div>
        <div className="fxn-route-total">
          <span>CUSTOMER RECEIVES</span>
          <b>One quote</b>
          <small>{formatCurrency(trade?.to.amount, "EUR")}</small>
        </div>
      </div>
    </section>
  );
}

export function InstitutionalControl() {
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>PRIVACY AND POLICY</Label>
          <h2>Institutional market control</h2>
          <p>
            The operator decides who can participate, which accounts and
            currencies are eligible, and the limits that apply. Aggregate depth
            can be shared without exposing maker identity, customer attribution
            or signed orders.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-boundary">
        <div className="fxn-boundary-side private">
          <span>INSTITUTION SYSTEMS</span>
          <b>Identity and market control</b>
          <div>
            <p>Participant approval</p>
            <p>Account and corridor rules</p>
            <p>Orders and attribution</p>
            <p>Pricing and matching</p>
            <p>Risk limits</p>
          </div>
          <small>Full market activity remains private.</small>
        </div>
        <div className="fxn-boundary-arrow">
          <span>permissioned view</span>
          <i>→</i>
          <small>aggregate only</small>
        </div>
        <div className="fxn-boundary-side chain">
          <span>SHARED EVIDENCE</span>
          <b>Depth and execution</b>
          <div>
            <p>Price levels</p>
            <p>Available size</p>
            <p>Selected fill authority</p>
            <p>Settlement result</p>
            <p>Audit evidence</p>
          </div>
          <small>Share what is required without publishing the L3 book.</small>
        </div>
      </div>
    </section>
  );
}

export function ProviderParticipation() {
  const [mode, setMode] = useState<"orders" | "inventory" | "rfq">("rfq");
  const copy = {
    orders: {
      k: "RESTING ORDER",
      h: "Price and size remain in the market.",
      s: "The order remains available until it fills, expires or is cancelled.",
    },
    inventory: {
      k: "AVAILABLE INVENTORY",
      h: "Capacity is exposed through an adapter.",
      s: "The available amount can change without placing a resting order.",
    },
    rfq: {
      k: "FIRM QUOTE",
      h: "Price one request when it arrives.",
      s: "A bank, issuer or market maker returns price, size and expiry for that request.",
    },
  }[mode];
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>LIQUIDITY PARTICIPATION</Label>
          <h2>Resting orders, inventory and firm quotes</h2>
          <p>
            Banks, issuers and market makers can participate without using the
            same liquidity model or leaving all capacity in an order book.
          </p>
        </div>
      </div>
      <div className="fx-diagram-tabs">
        <button
          className={mode === "orders" ? "active" : ""}
          onClick={() => setMode("orders")}
        >
          Order
        </button>
        <button
          className={mode === "inventory" ? "active" : ""}
          onClick={() => setMode("inventory")}
        >
          Inventory
        </button>
        <button
          className={mode === "rfq" ? "active" : ""}
          onClick={() => setMode("rfq")}
        >
          Firm quote
        </button>
      </div>
      <div className="fxn-stage fxn-provider">
        <div className="fxn-provider-intro">
          <span>{copy.k}</span>
          <b>{copy.h}</b>
          <p>{copy.s}</p>
        </div>
        <div className="fxn-provider-request">
          <span>{mode === "rfq" ? "REQUEST" : "PAIR"}</span>
          <b>
            {mode === "rfq"
              ? "Exact customer amount"
              : "Supported currency pair"}
          </b>
          <small>{mode === "rfq" ? "short expiry" : "private capacity"}</small>
        </div>
        <div className="fxn-provider-table">
          <div className="head">
            <span>FIRM</span>
            <span>PRICE</span>
            <span>AMOUNT</span>
            <span>STATE</span>
          </div>
          <div className="row selected">
            <span>
              <Dot kind="firm" />
              Issuer A
            </span>
            <b>firm</b>
            <strong>capacity</strong>
            <em>{mode === "rfq" ? "expires" : "ready"}</em>
          </div>
          <div className="row selected">
            <span>
              <Dot kind="firm" />
              Bank B
            </span>
            <b>firm</b>
            <strong>capacity</strong>
            <em>{mode === "rfq" ? "expires" : "ready"}</em>
          </div>
          <div className="row">
            <span>
              <Dot kind="firm" />
              Maker C
            </span>
            <b>firm</b>
            <strong>capacity</strong>
            <em>{mode === "rfq" ? "expires" : "ready"}</em>
          </div>
          <div className="summary">
            <span>USED</span>
            <b>Issuer A + Bank B</b>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FiatModels() {
  const [mode, setMode] = useState<"provider" | "customers" | "peer">(
    "customers",
  );
  const data = {
    provider: {
      label: "PROVIDER",
      title: "Provider-managed fiat leg",
      body: "A banking or ramp provider moves the fiat and returns settlement evidence.",
      left: "CUSTOMER BANK",
      middle: "PROVIDER",
      note: "provider-managed",
    },
    customers: {
      label: "YOUR CUSTOMERS",
      title: "Verified customer transfer",
      body: "When both sides are customers of the institution, the fiat transfer remains inside its account and compliance perimeter.",
      left: "CUSTOMER A",
      middle: "CUSTOMER B",
      note: "inside your customer perimeter",
    },
    peer: {
      label: "OPEN P2P",
      title: "External peer-to-peer payment",
      body: "A Peer-style adapter supplies proof of an external fiat payment before crypto is released.",
      left: "FIAT PAYER",
      middle: "EXTERNAL PEER",
      note: "outside your customer perimeter",
    },
  }[mode];
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>FIAT CONNECTIONS</Label>
          <h2>Fiat settlement options</h2>
          <p>
            Provider, verified-customer and external peer-to-peer fiat routes
            connect to the same token FX market. The fiat model does not
            determine the FX market model.
          </p>
        </div>
      </div>
      <div className="fx-diagram-tabs">
        <button
          className={mode === "provider" ? "active" : ""}
          onClick={() => setMode("provider")}
        >
          Provider
        </button>
        <button
          className={mode === "customers" ? "active" : ""}
          onClick={() => setMode("customers")}
        >
          Your customers
        </button>
        <button
          className={mode === "peer" ? "active" : ""}
          onClick={() => setMode("peer")}
        >
          Open P2P
        </button>
      </div>
      <div className="fxn-stage fxn-fiat">
        <div className="fxn-fiat-copy">
          <span>{data.label}</span>
          <b>{data.title}</b>
          <p>{data.body}</p>
          <small>{data.note}</small>
        </div>
        <div className="fxn-fiat-flow">
          <div>
            <span>{data.left}</span>
            <b>Local fiat amount</b>
            <small>fiat</small>
          </div>
          <i>→</i>
          <div>
            <span>{data.middle}</span>
            <b>
              {mode === "peer"
                ? "payment proof"
                : mode === "customers"
                  ? "account transfer"
                  : "confirmation"}
            </b>
            <small>
              {mode === "peer"
                ? "external evidence"
                : mode === "customers"
                  ? "known accounts"
                  : "provider evidence"}
            </small>
          </div>
          <i>→</i>
          <div className="token">
            <span>STABLECOIN</span>
            <b>USDC</b>
            <small>ready for FX</small>
          </div>
          <i>→</i>
          <div className="core">
            <span>FX</span>
            <b>USDC → EURC</b>
            <small>same market</small>
          </div>
        </div>
        <div className="fxn-fiat-direct">
          <span>Already holding a stablecoin?</span>
          <b>Skip the fiat leg.</b>
        </div>
      </div>
    </section>
  );
}

export function TreasuryGraphic({ trade }: { trade: PublicTrade | null }) {
  const treasury = trade?.sourceStatus.find(
    (item) => item.sourceType === "BANK_TREASURY",
  );
  const used = trade?.sources.find((item) => item.type === "BANK_TREASURY");
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>BALANCE SHEET</Label>
          <h2>Treasury and principal risk</h2>
          <p>
            Treasury and principal participate as sources inside the market.
            Positions and outstanding reservations consume hard asset limits;
            exhausted capacity is removed from the plan.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-treasury">
        <div className="fxn-limit">
          <span>TREASURY CAPACITY</span>
          <b>
            {treasury
              ? `${Number(BigInt(treasury.availableOutput) / 1000000n).toLocaleString("en-US")} EURC`
              : "—"}
          </b>
          <div className="fxn-legend">
            <span>
              {treasury?.eligible
                ? "eligible for this exchange"
                : "not eligible"}
            </span>
            <span>
              {treasury?.reason.replaceAll("_", " ").toLowerCase() ??
                "waiting for market state"}
            </span>
          </div>
        </div>
        <div className="fxn-next-trade">
          <span>THIS EXCHANGE</span>
          <b>{formatCurrency(trade?.to.amount, "EUR")}</b>
          <small>requested output</small>
        </div>
        <div className="fxn-split-arrow">→</div>
        <div className="fxn-treasury-answer">
          <div>
            <span>TREASURY USED</span>
            <b>{formatCurrency(used?.outputAmount, "EUR")}</b>
            <small>inside its limit</small>
          </div>
          <div>
            <span>OTHER SOURCES</span>
            <b>
              {trade
                ? `${Math.max(0, trade.sources.length - (used ? 1 : 0))} selected`
                : "—"}
            </b>
            <small>fill the rest</small>
          </div>
        </div>
        <div className="fxn-rule">
          <b>Reserved capacity cannot be promised twice.</b>
          <span>
            Risk is consumed when the quote is reserved, not after the market
            has moved.
          </span>
        </div>
      </div>
    </section>
  );
}

export function FinalityGraphic({ trade }: { trade: PublicTrade | null }) {
  const edges = trade?.settlement.edges ?? [];
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>SETTLEMENT</Label>
          <h2>Route finality</h2>
          <p>
            The selected token fills settle together in one router transaction.
            Fiat payments, internal ledgers, mints, redemptions and payouts keep
            the evidence and timing of the system that performs them.
          </p>
        </div>
      </div>
      <div className="fxn-stage fxn-finality">
        {edges.map((edge, index) => (
          <div key={edge.edgeId} className="fxn-finality-fragment">
            <div
              className={`fxn-leg ${edge.finalityClass === "ATOMIC" ? "atomic" : ""}`}
            >
              <span>{edge.edgeType.replaceAll("_", " ")}</span>
              <b>
                {edge.fromAsset} → {edge.toAsset}
              </b>
              <small>{edge.providerId}</small>
              <em>{edge.finalityClass.replaceAll("_", " ").toLowerCase()}</em>
            </div>
            {index < edges.length - 1 && <i>→</i>}
          </div>
        ))}
        {edges.length === 0 && (
          <div className="fxn-leg atomic">
            <span>TOKEN FX</span>
            <b>Waiting for route</b>
            <small>selected fills</small>
            <em>atomic</em>
          </div>
        )}
        <div className="fxn-finality-direct">
          <span>STABLECOIN → STABLECOIN</span>
          <b>Pure stablecoin FX enters the atomic centre directly.</b>
        </div>
      </div>
    </section>
  );
}

const MODELS = [
  {
    id: "provider",
    label: "Provider-led",
    sources: ["Outside providers", "Institutional quotes"],
  },
  {
    id: "mixed",
    label: "Mixed",
    sources: ["Customer orders", "Connected firms", "Outside providers"],
  },
  {
    id: "market",
    label: "Institution-operated",
    sources: [
      "Private customer market",
      "Issuers and institutions",
      "Treasury and principal",
      "External fallback",
    ],
  },
] as const;
export function DeploymentBlueprints() {
  const [model, setModel] = useState<(typeof MODELS)[number]["id"]>("mixed");
  const active = MODELS.find((x) => x.id === model)!;
  return (
    <section className="fxp-section fxn-section">
      <div className="fxp-section-head">
        <div>
          <Label>DEPLOYMENT</Label>
          <h2>Operating configurations</h2>
          <p>
            The same customer interface and API can run with provider-led, mixed
            or institution-operated liquidity behind it.
          </p>
        </div>
      </div>
      <div className="fx-diagram-tabs">
        {MODELS.map((x) => (
          <button
            key={x.id}
            className={model === x.id ? "active" : ""}
            onClick={() => setModel(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="fxn-stage fxn-deploy">
        <div className="fxn-deploy-copy">
          <span>MODEL</span>
          <b>{active.label}</b>
          <p>
            {active.id === "provider"
              ? "Start with connected providers."
              : active.id === "mixed"
                ? "Use your own flow and connected firms together."
                : "Make your own market primary and keep providers available."}
          </p>
        </div>
        <div className="fxn-deploy-sources">
          {active.sources.map((item) => (
            <div key={item}>
              <Dot
                kind={
                  item.includes("External") || item.includes("Outside")
                    ? "external"
                    : item.includes("Treasury")
                      ? "treasury"
                      : item.includes("firm") || item.includes("Issuer")
                        ? "firm"
                        : "own"
                }
              />
              <b>{item}</b>
              <span>connected to the same market</span>
            </div>
          ))}
        </div>
        <div className="fxn-deploy-constant">
          <span>CUSTOMER</span>
          <b>Same exchange screen.</b>
          <small>What changes is behind it.</small>
        </div>
      </div>
    </section>
  );
}
