import { useState } from "react";
import { Label } from "./Primitives";
import {
  formatAtomic,
  formatCurrency,
  source,
  type PublicTrade,
} from "./model";

const ROUTES = [
  {
    id: "fiat-fiat",
    label: "Fiat → fiat",
    input: "Local fiat",
    output: "Local fiat",
    inEdge: true,
    outEdge: true,
  },
  {
    id: "fiat-token",
    label: "Fiat → stablecoin",
    input: "Local fiat",
    output: "Stablecoin",
    inEdge: true,
    outEdge: false,
  },
  {
    id: "token-fiat",
    label: "Stablecoin → fiat",
    input: "Stablecoin",
    output: "Local fiat",
    inEdge: false,
    outEdge: true,
  },
  {
    id: "token-token",
    label: "Stablecoin → stablecoin",
    input: "Stablecoin",
    output: "Stablecoin",
    inEdge: false,
    outEdge: false,
  },
] as const;

const EDGES = [
  {
    id: "provider",
    label: "Provider / Bridge",
    perimeter: "Provider and institution-controlled",
    onboard:
      "The customer opens an account and completes the KYC/KYB required by the product and provider arrangement.",
    enter:
      "The provider confirms local fiat and supplies or releases the stablecoin balance.",
    exit: "The provider receives stablecoin and completes the local payout under its own settlement state.",
    evidence: "Provider payment confirmation",
  },
  {
    id: "customers",
    label: "Your customers",
    perimeter: "Inside your customer and account perimeter",
    onboard:
      "Both sides are customers or businesses already verified and attributable to accounts inside the institution.",
    enter:
      "A transfer between those known accounts supplies the fiat-side value without introducing an anonymous counterparty.",
    exit: "The recipient receives the corresponding internal or local payment after the verified account movement.",
    evidence: "Authoritative account or payment event",
  },
  {
    id: "issuer",
    label: "Issuer",
    perimeter: "Issuer and institution-controlled",
    onboard:
      "The customer or institution uses an approved issuer account and the issuer's supported fiat corridor.",
    enter:
      "The issuer mints after it receives fiat. The mint is a separate route edge before the FX transaction.",
    exit: "The issuer redeems stablecoin and pays fiat out. Redemption and payout keep their own timing.",
    evidence: "Issuer mint or redemption event",
  },
  {
    id: "ledger",
    label: "Internal ledger",
    perimeter: "Inside your account and ledger perimeter",
    onboard:
      "The institution has already verified the customer or business and linked the relevant internal accounts.",
    enter:
      "An authoritative posted ledger event makes the fiat-side value available to the route.",
    exit: "The institution posts the corresponding internal balance movement after the exchange reaches the required state.",
    evidence: "Authoritative ledger event",
  },
  {
    id: "bank",
    label: "Bank rail",
    perimeter: "Institution-controlled account with external rail timing",
    onboard:
      "The customer or business is linked to an account and a supported local bank-payment corridor.",
    enter:
      "The bank rail confirms incoming money under its own pending, submitted and confirmed states.",
    exit: "A payout is submitted to the rail and remains external until bank evidence confirms or rejects it.",
    evidence: "Bank payment state",
  },
  {
    id: "peer",
    label: "Peer / open P2P",
    perimeter: "Outside your own customer/KYC perimeter",
    onboard:
      "Your product creates an intent, but the external payer or recipient is not automatically one of your verified customers.",
    enter:
      "A peer pays fiat through an external payment app. Verified proof allows the crypto side to be released.",
    exit: "The external peer receives or makes the fiat payment and the adapter verifies the exact intent before token release.",
    evidence: "External payment proof",
  },
] as const;

export function ProductFlows({ trade }: { trade: PublicTrade | null }) {
  const [routeId, setRouteId] =
    useState<(typeof ROUTES)[number]["id"]>("fiat-fiat");
  const [edgeId, setEdgeId] =
    useState<(typeof EDGES)[number]["id"]>("provider");
  const route = ROUTES.find((item) => item.id === routeId)!;
  const edge = EDGES.find((item) => item.id === edgeId)!;
  return (
    <section className="fxp-section fxn-section fxn-deep-section fxn-product-flow">
      <div className="fxp-section-head">
        <div>
          <Label>COMPLETE PRODUCT FLOW</Label>
          <h2>From an onboarded customer to a completed exchange</h2>
          <p>
            Choose the exchange product and the way fiat enters or leaves. The
            edges change; the private FX market and atomic token exchange in the
            middle remain the same.
          </p>
        </div>
      </div>
      <div className="fxn-flow-controls">
        <div>
          <span>Exchange product</span>
          {ROUTES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={routeId === item.id ? "active" : ""}
              onClick={() => setRouteId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div>
          <span>Fiat connection</span>
          {EDGES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={edgeId === item.id ? "active" : ""}
              disabled={!route.inEdge && !route.outEdge}
              onClick={() => setEdgeId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="fxn-product-route">
        {route.inEdge && (
          <div className="fxn-route-phase edge">
            <span>1 · ONBOARD + MONEY IN</span>
            <b>{edge.label}</b>
            <p>{edge.onboard}</p>
            <p>{edge.enter}</p>
            <small>{edge.evidence}</small>
          </div>
        )}
        {!route.inEdge && (
          <div className="fxn-route-phase direct">
            <span>1 · EXISTING BALANCE</span>
            <b>{route.input}</b>
            <p>
              The exchange begins with tokenised money already held in the
              customer's account or wallet.
            </p>
            <small>No fiat entry leg</small>
          </div>
        )}
        <i>→</i>
        <div className="fxn-route-phase token">
          <span>2 · VALUE AVAILABLE</span>
          <b>{route.inEdge ? "Stablecoin balance" : route.input}</b>
          <p>
            The FX request now has tokenised input that can be reserved and
            exchanged.
          </p>
          <small>
            {routeId === "fiat-fiat" && trade
              ? `${formatAtomic(trade.tokenRoute.inputAtomic)} ${trade.tokenRoute.inputSymbol}`
              : "Input amount from the quote"}
          </small>
        </div>
        <i>→</i>
        <div className="fxn-route-phase market">
          <span>3 · PRIVATE FX MARKET</span>
          <b>Price, route and reserve</b>
          <p>
            Customer orders, issuers, institutions, treasury and providers
            compete through resting orders, inventory or JIT/RFQ.
          </p>
          <small>
            {trade?.sources.length ?? 0} sources selected for this exchange
          </small>
        </div>
        <i>→</i>
        <div className="fxn-route-phase atomic">
          <span>4 · ATOMIC TOKEN FX</span>
          <b>
            {routeId === "token-token"
              ? "Stablecoin swap"
              : "Selected maker fills"}
          </b>
          <p>
            Live policy, signatures, bounds, cancellations and partial-fill
            state are checked. Every selected token transfer settles or all
            revert.
          </p>
          <small>
            {routeId === "fiat-fiat" && trade
              ? `${formatAtomic(trade.tokenRoute.outputAtomic)} ${trade.tokenRoute.outputSymbol}`
              : "Output amount from the quote"}
          </small>
        </div>
        {route.outEdge && (
          <>
            <i>→</i>
            <div className="fxn-route-phase edge">
              <span>5 · MONEY OUT</span>
              <b>{edge.label}</b>
              <p>{edge.exit}</p>
              <small>
                External state · reconciled from {edge.evidence.toLowerCase()}
              </small>
            </div>
          </>
        )}
        {!route.outEdge && (
          <>
            <i>→</i>
            <div className="fxn-route-phase direct">
              <span>5 · DELIVER</span>
              <b>{route.output}</b>
              <p>
                The output remains on-chain or in the customer's supported token
                balance.
              </p>
              <small>No fiat payout leg</small>
            </div>
          </>
        )}
      </div>
      <div className="fxn-flow-facts">
        <p>
          <b>Compliance perimeter</b>
          {!route.inEdge && !route.outEdge
            ? "No fiat counterparty or payment edge in this route"
            : edge.perimeter}
        </p>
        <p>
          <b>What changes</b>Onboarding, payment evidence, mint/redemption and
          payout timing at the fiat edge.
        </p>
        <p>
          <b>What stays the same</b>The quote API, eligible liquidity,
          reservation, token FX settlement and reconciliation model.
        </p>
      </div>
    </section>
  );
}

export function ArchitecturePlanes() {
  return (
    <section className="fxp-section fxn-section fxn-deep-section">
      <div className="fxp-section-head">
        <div>
          <Label>ARCHITECTURE</Label>
          <h2>Market liquidity, fiat connectivity and token execution</h2>
          <p>
            These are separate decisions. A bank can operate a private market
            and use regulated fiat providers. A crypto-native product can use an
            open peer network at the fiat edge. Either can connect outside token
            venues when useful. None of those choices changes the market API or
            forces the other two.
          </p>
        </div>
      </div>
      <div className="fxn-architecture-planes">
        <article>
          <span>1 · MARKET LIQUIDITY</span>
          <h3>Who makes the FX price</h3>
          <p>
            Customer and business orders, issuers, professional makers, banks,
            treasury and principal supply liquidity to the private market.
          </p>
          <small>orders · inventory · JIT/RFQ</small>
        </article>
        <article>
          <span>2 · FIAT CONNECTIVITY</span>
          <h3>How fiat becomes or receives tokenised value</h3>
          <p>
            Providers such as Bridge, your own verified accounts, issuers,
            internal ledgers, bank rails and Peer-style P2P connect local money
            to the token route.
          </p>
          <small>payment, account, mint or proof evidence</small>
        </article>
        <article>
          <span>3 · TOKEN EXECUTION</span>
          <h3>Where selected token value is exchanged</h3>
          <p>
            The private market selects authorised fills for atomic settlement.
            Connected DEX aggregators or other token venues can supplement that
            capacity without becoming the fiat rail.
          </p>
          <small>private fills · external venues · atomic settlement</small>
        </article>
      </div>
      <div className="fxn-plane-join">
        <span>ONE PRODUCT SURFACE</span>
        <b>
          Choose each plane independently. The route joins them for one customer
          exchange.
        </b>
      </div>
    </section>
  );
}

const LIFECYCLE = [
  {
    id: "request",
    name: "Request",
    text: "The product sends the assets, amount and customer bounds. The amount stays a decimal string from the API to the planner; financial calculations do not use floating point.",
    fields: ["input asset", "output asset", "amount", "customer bounds"],
  },
  {
    id: "eligibility",
    name: "Eligibility",
    text: "Participant, account, credentials, corridor, asset, jurisdiction and ticket-size rules remove sources before their prices are compared.",
    fields: ["participant", "account", "credentials", "corridor rules"],
  },
  {
    id: "candidates",
    name: "Candidates",
    text: "Every remaining source is represented as executable price, capacity, expiry and authorisation data, whether it began as an order, inventory or a quote on request.",
    fields: ["price ratio", "capacity", "expiry", "authorisation"],
  },
  {
    id: "plan",
    name: "Plan",
    text: "The exact-output planner compares rational prices, takes the best eligible capacity first and combines sources until the complete output amount is filled. An incomplete route is refused.",
    fields: ["exact output", "ordered slices", "selected legs", "total input"],
  },
  {
    id: "reserve",
    name: "Reserve",
    text: "Selected capacity is held before the quote becomes firm. Sources reserve in order; if one fails, every earlier reservation is released in reverse order.",
    fields: ["route id", "reservation handles", "expiry", "reverse rollback"],
  },
  {
    id: "execute",
    name: "Execute",
    text: "The transaction checks live institution authorisation, maker signatures, customer bounds, cancellations, nonces and previous partial fills before moving token balances.",
    fields: ["live policy", "signed fills", "taker bounds", "nonce state"],
  },
  {
    id: "reconcile",
    name: "Reconcile",
    text: "Each leg changes state from its own evidence. A submitted transaction with an unknown outcome stays submitted until canonical evidence settles it; it is never retried blindly.",
    fields: [
      "submission ref",
      "event or payment evidence",
      "confirmed / failed",
      "idempotency",
    ],
  },
] as const;

export function ExchangeLifecycle({ trade }: { trade: PublicTrade | null }) {
  const [selected, setSelected] =
    useState<(typeof LIFECYCLE)[number]["id"]>("plan");
  const active = LIFECYCLE.find((step) => step.id === selected)!;
  return (
    <section className="fxp-section fxn-section fxn-deep-section">
      <div className="fxp-section-head">
        <div>
          <Label>QUOTE TO SETTLEMENT</Label>
          <h2>One lifecycle across every source and route</h2>
          <p>
            Customer orders, issuers, institutions, treasury and providers do
            not create separate execution systems. They enter the same checked,
            reserved and reconciled trade lifecycle.
          </p>
        </div>
      </div>
      <div className="fxn-lifecycle">
        <div className="fxn-lifecycle-rail">
          {LIFECYCLE.map((step, index) => (
            <button
              type="button"
              key={step.id}
              className={selected === step.id ? "active" : ""}
              onClick={() => setSelected(step.id)}
            >
              <span>{index + 1}</span>
              <b>{step.name}</b>
            </button>
          ))}
        </div>
        <div className="fxn-lifecycle-detail">
          <div>
            <span>{active.name.toUpperCase()}</span>
            <h3>{active.text}</h3>
          </div>
          <dl>
            {active.fields.map((field) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>checked</dd>
              </div>
            ))}
          </dl>
          <div className="fxn-lifecycle-live">
            <span>THIS EXCHANGE</span>
            <b>{trade?.state ?? "PREVIEW"}</b>
            <strong>
              {formatCurrency(trade?.from.charged, "BRL")} →{" "}
              {formatCurrency(trade?.to.amount, "EUR")}
            </strong>
            <small>{trade?.sources.length ?? 0} selected source legs</small>
          </div>
        </div>
      </div>
    </section>
  );
}

const PARTICIPANTS = [
  {
    id: "customer",
    name: "Customer or business",
    role: "Leaves a private signed order against a balance it controls, at a rate it chooses. The order can fill partially. Each completed fill exchanges at that rate, so the maker earns the spread it priced into the order.",
    modes: "Resting order",
    control: "Verified identity, attributable account and institution policy",
  },
  {
    id: "issuer",
    name: "Stablecoin issuer",
    role: "Supplies executable capacity in its currency and can connect mint or redemption as a separate fiat edge.",
    modes: "Order, inventory or firm quote",
    control: "Authorised source, pair, size, expiry and settlement account",
  },
  {
    id: "maker",
    name: "Market maker or LP",
    role: "Provides professional liquidity without requiring every firm to pre-fund or leave a permanent order in the market.",
    modes: "Order, available inventory or JIT/RFQ",
    control: "Participant, corridor, capacity, expiry and reservation rules",
  },
  {
    id: "institution",
    name: "Bank or other institution",
    role: "Connects its own currency position or quoting service to the same planner while keeping its customer and balance-sheet data private.",
    modes: "Inventory or firm quote",
    control: "KYB, approved accounts, policy authorisation and limits",
  },
  {
    id: "treasury",
    name: "Treasury and principal",
    role: "Uses institution-owned currency as market capacity. Open positions and outstanding quote reservations consume hard limits before new capacity is shown.",
    modes: "Configured inventory or principal quote",
    control:
      "Reference inputs, pricing components, appetite and hard asset limits",
  },
  {
    id: "external",
    name: "External token venue",
    role: "Supplies executable token liquidity through an adapter. It competes as another eligible source; it is not the fiat on-ramp and does not replace the institution's private market.",
    modes: "Executable inventory or venue quote",
    control:
      "Approved venue, pair, capacity, price, expiry and reservation rules",
  },
] as const;

export function ParticipantRoles() {
  const [selected, setSelected] = useState("customer");
  const active = PARTICIPANTS.find(
    (participant) => participant.id === selected,
  )!;
  return (
    <section className="fxp-section fxn-section fxn-deep-section">
      <div className="fxp-section-head">
        <div>
          <Label>WHO MAKES THE MARKET</Label>
          <h2>Different participants, one institution-operated market</h2>
          <p>
            Each participant supplies a different kind of natural currency
            position or professional capacity. The operator decides who may join
            and how that capacity can be used.
          </p>
        </div>
      </div>
      <div className="fxn-participants">
        <div className="fxn-participant-list">
          {PARTICIPANTS.map((participant) => (
            <button
              type="button"
              key={participant.id}
              className={selected === participant.id ? "active" : ""}
              onClick={() => setSelected(participant.id)}
            >
              {participant.name}
            </button>
          ))}
        </div>
        <div className="fxn-participant-detail">
          <span>ROLE IN THE MARKET</span>
          <h3>{active.name}</h3>
          <p>{active.role}</p>
          <dl>
            <div>
              <dt>Participation</dt>
              <dd>{active.modes}</dd>
            </div>
            <div>
              <dt>Institution control</dt>
              <dd>{active.control}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const IMPLEMENTATION = [
  [
    "apps/fx-node",
    "Coordinates quotes, source adapters and the complete trade lifecycle.",
    "apps/fx-node/src/quote-coordinator.js",
    "apps/fx-node/test/public-reference-runtime.test.js",
  ],
  [
    "fx-market",
    "Stores private signed orders, matches by price and time, reserves partial fills and exposes aggregate depth.",
    "packages/fx-market/src/market-service.js",
    "packages/fx-market/test/market.test.js",
  ],
  [
    "fx-liquidity",
    "Normalises source slices, plans exact output and rolls reservations back when a later source fails.",
    "packages/fx-liquidity/src/optimizer.js",
    "packages/fx-liquidity/test/liquidity.test.js",
  ],
  [
    "fx-pricing",
    "Builds principal prices from reference inputs and accounts for risk before capacity is quoted.",
    "packages/fx-pricing/src/principal-pricing.js",
    "packages/fx-pricing/test/principal-pricing.test.js",
  ],
  [
    "fx-policy",
    "Checks participant facts and issues short-lived authorisation bound to the trade and account.",
    "packages/fx-policy/src/policy-engine.js",
    "packages/fx-policy/test/policy.test.js",
  ],
  [
    "fx-fiat",
    "Tracks fiat intents, payment evidence, route graphs and the finality of each external leg.",
    "packages/fx-fiat/src/settlement-graph.js",
    "packages/fx-fiat/test/graph.test.js",
  ],
  [
    "fx-contracts",
    "Enforces maker authority, customer bounds, cancellation, partial fills, nonces and atomic token transfers.",
    "packages/fx-contracts/src/AtomicRouter.sol",
    "packages/fx-contracts/test/AtomicRouter.t.sol",
  ],
  [
    "fx-sdk",
    "Provides the JavaScript client for quote, reservation, execution and state APIs.",
    "packages/fx-sdk/src/index.js",
    "packages/fx-sdk/test/sdk.test.js",
  ],
  [
    "fx-simulator",
    "Runs deterministic flow, outage, risk-limit and settlement-failure scenarios.",
    "packages/fx-simulator/src/simulator.js",
    "packages/fx-simulator/test/simulator.test.js",
  ],
] as const;

export function ImplementationMap() {
  const [selected, setSelected] = useState<string>(IMPLEMENTATION[0][0]);
  const active = IMPLEMENTATION.find((item) => item[0] === selected)!;
  return (
    <section className="fxp-section fxn-section fxn-deep-section">
      <div className="fxp-section-head">
        <div>
          <Label>INSIDE THE REPOSITORY</Label>
          <h2>The code behind the exchange</h2>
          <p>
            The market, policy, planner, fiat state and settlement contracts are
            separate packages with tests at their financial boundaries. Select a
            package to see its responsibility and open the implementation.
          </p>
        </div>
      </div>
      <div className="fxn-implementation">
        <div className="fxn-implementation-list">
          {IMPLEMENTATION.map(([name]) => (
            <button
              type="button"
              key={name}
              className={selected === name ? "active" : ""}
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="fxn-implementation-detail">
          <span>RESPONSIBILITY</span>
          <h3>{active[0]}</h3>
          <p>{active[1]}</p>
          <a href={source(active[2])} target="_blank" rel="noreferrer">
            Open {active[2]}
          </a>
          <a href={source(active[3])} target="_blank" rel="noreferrer">
            Open {active[3]}
          </a>
        </div>
      </div>
    </section>
  );
}
