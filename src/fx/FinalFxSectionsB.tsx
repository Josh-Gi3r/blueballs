import type { CSSProperties } from "react";
import type { FinalFxContext } from "./final-fx-context";
import type {
  ExecutionPlaneId,
  FiatPlaneId,
  LiquidityPlaneId,
} from "./final-fx-definitions";

export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: string;
}) {
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

export function RouteSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, corridor, output, sources, status, routeRationale, money } =
    ctx;
  return (
    <section className="section" id="route">
      <div className="section-inner">
        <SectionHead
          eyebrow="03 · ONE QUOTE"
          title="Combine several liquidity sources into one customer quote."
        >
          This simulation shows the routing model. Each source has its own rate,
          capacity, expiry and reservation rules. Only eligible sources are
          included, and no quote is shown unless the full amount can be covered.
        </SectionHead>
        <div
          className="route-stage fade-up"
          key={`${state.corridor}-${state.journey}-${state.scenario}-${state.liquidityPlane}-${state.customerLiquidity}`}
        >
          <div className="route-request">
            <span>CUSTOMER SENDS</span>
            <b>{money(corridor, state.amount, "from")}</b>
            <small>
              {corridor.from} → {corridor.to}
            </small>
          </div>
          <div className="route-sources">
            {sources.map((source, index) => (
              <div
                className="route-source lit"
                style={{ transitionDelay: `${index * 110}ms` }}
                key={source.id}
              >
                <span>{source.label}</span>
                <b>{money(corridor, (output * source.pct) / 100, "to")}</b>
                <small>{source.type}</small>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="route-source lit">
                <span>{status.label}</span>
                <b>—</b>
                <small>STOPPED</small>
              </div>
            )}
          </div>
          <div className="route-result">
            <span>CUSTOMER RECEIVES</span>
            <b>
              {status.complete ? money(corridor, output, "to") : "No quote"}
            </b>
            <small>
              {status.complete
                ? `${sources.length} selected sources · ${status.label.toLowerCase()}`
                : status.label}
            </small>
          </div>
        </div>
        <div className="route-rationale fade-up">
          {routeRationale.map((text, index) => (
            <div key={text}>
              <b>{index === 2 && !status.complete ? "×" : "✓"}</b>
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComposeSection({ ctx }: { ctx: FinalFxContext }) {
  const {
    state,
    setState,
    changeFiatPlane,
    FIAT_OPTIONS,
    LIQUIDITY_OPTIONS,
    EXECUTION_OPTIONS,
  } = ctx;
  return (
    <section className="section" id="compose">
      <div className="section-inner">
        <SectionHead
          eyebrow="04 · HOW THE EXCHANGE WORKS"
          title="Choose how the exchange is funded, priced and settled."
        >
          These are separate choices. A provider can handle deposits and payouts
          while customer orders or market makers supply the FX rate. A P2P
          on-ramp can release stablecoin that is then exchanged using issuer,
          maker, treasury or external-venue liquidity.
        </SectionHead>
        <div className="three-planes fade-up">
          <article className="plane">
            <span>MONEY IN AND OUT</span>
            <h3>How customers fund the exchange and receive the result.</h3>
            <p>
              Use internal accounts, a banking provider, issuer mint and
              redemption, a bank rail, open P2P or no fiat leg.
            </p>
            <select
              value={state.fiatPlane}
              aria-label="Money in and out"
              onChange={(event: { target: { value: string } }) =>
                changeFiatPlane(event.target.value as FiatPlaneId)
              }
            >
              {Object.entries(FIAT_OPTIONS).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </article>
          <article className="plane">
            <span>FX LIQUIDITY</span>
            <h3>Who supplies the rate and the available amount.</h3>
            <p>
              Use customer orders, issuer inventory, professional quotes,
              another institution, treasury or an external venue.
            </p>
            <select
              value={state.liquidityPlane}
              aria-label="FX liquidity"
              onChange={(event: { target: { value: string } }) =>
                setState((current) => ({
                  ...current,
                  liquidityPlane: event.target.value as LiquidityPlaneId,
                  scenario: "normal",
                }))
              }
            >
              {Object.entries(LIQUIDITY_OPTIONS).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </article>
          <article className="plane">
            <span>TOKEN SETTLEMENT</span>
            <h3>Where the selected token exchange is executed.</h3>
            <p>
              Choose the Blueballs reference contracts, an internal token
              transfer or an approved external venue. This page only simulates
              the result.
            </p>
            <select
              value={state.executionPlane}
              aria-label="Token settlement"
              onChange={(event: { target: { value: string } }) =>
                setState((current) => ({
                  ...current,
                  executionPlane: event.target.value as ExecutionPlaneId,
                  scenario: "normal",
                }))
              }
            >
              {Object.entries(EXECUTION_OPTIONS).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </article>
        </div>
      </div>
    </section>
  );
}

export function PrivacySection({ ctx }: { ctx: FinalFxContext }) {
  const { corridor, output, sources, executionCopy, money } = ctx;
  return (
    <section className="section" id="privacy">
      <div className="section-inner">
        <SectionHead
          eyebrow="05 · PRIVACY"
          title="See what stays private and what is sent for execution."
        >
          Customer identities, individual orders, prices, matching, policy
          decisions and exposure limits stay inside the institution. Only the
          selected token fills, maximum spend, minimum receive amount, recipient
          and expiry are sent to the chosen execution layer.
        </SectionHead>
        <div className="glass-stage fade-up">
          <div className="glass-room">
            <span className="glass-label">PRIVATE INSIDE THE INSTITUTION</span>
            <div className="glass-list">
              {sources.map((source) => (
                <div className="glass-row" key={source.id}>
                  <span className="glass-avatar">
                    {source.label.slice(0, 1)}
                  </span>
                  <span>{source.label}</span>
                  <b>{money(corridor, (output * source.pct) / 100, "to")}</b>
                  <small>private</small>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="glass-row">
                  <span className="glass-avatar">×</span>
                  <span>No selected fill</span>
                  <b>—</b>
                  <small>stopped</small>
                </div>
              )}
            </div>
            <div className="glass-foot">
              IDENTITIES · ORDERS · PRICES · POLICY · LIMITS
            </div>
          </div>
          <div className="glass-wall">
            <b>EXECUTION BOUNDARY</b>
            <span>selected fills only</span>
          </div>
          <div className="glass-chain">
            <span className="glass-label">{executionCopy.label}</span>
            <div className="chain-bundle">
              {sources.map((source) => (
                <div className="chain-fill" key={source.id}>
                  <span>{executionCopy.row}</span>
                  <b>{money(corridor, (output * source.pct) / 100, "to")}</b>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="chain-fill">
                  <span>NO TOKEN SUBMISSION</span>
                  <b>—</b>
                </div>
              )}
            </div>
            <div className="chain-seal">
              {sources.length
                ? executionCopy.seal
                : "No token execution is created for this simulated state."}
            </div>
            <div className="chain-note">
              NO CUSTOMER NAMES · NO COMPLETE ORDER BOOK · NO PUBLIC INDIVIDUAL
              ORDERS
            </div>
          </div>
          <i
            className="glass-particle"
            style={{ "--y": "30%", "--delay": "0s" } as CSSProperties}
          />
          <i
            className="glass-particle"
            style={{ "--y": "46%", "--delay": ".7s" } as CSSProperties}
          />
          <i
            className="glass-particle"
            style={{ "--y": "62%", "--delay": "1.4s" } as CSSProperties}
          />
        </div>
      </div>
    </section>
  );
}

export function SettlementSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, legs, tokenTruth, journeyTruth } = ctx;
  const overall =
    state.scenario === "payout_pending"
      ? "PAYOUT PENDING"
      : state.scenario === "proof_replay"
        ? "STOPPED BEFORE FX"
        : state.journey === "stable"
          ? "TOKEN ROUTE"
          : "MIXED FINALITY";
  const tokenIndex = Math.max(
    0,
    legs.findIndex((leg) => leg.kick === "TOKEN LEG"),
  );
  return (
    <section className="section" id="settlement">
      <div className="section-inner">
        <SectionHead
          eyebrow="06 · SETTLEMENT STATUS"
          title="See exactly which part of the customer transaction is final."
        >
          A customer sees one exchange, but its legs do not all settle the same
          way. The token exchange can use one atomic boundary while deposits,
          minting, redemption and payouts keep their own confirmation states.
        </SectionHead>

        <div className="settlement-board fade-up">
          <div className="settlement-board-head">
            <div>
              <span>CUSTOMER TRANSACTION</span>
              <b>{overall}</b>
            </div>
            <p>One product transaction, tracked as separate settlement legs.</p>
          </div>

          <div className="settlement-progress" aria-label="Settlement progress">
            {legs.map((leg, index) => (
              <div
                className={`settlement-progress-step ${leg.atomic ? "atomic" : ""}`}
                key={`${leg.kick}-${leg.label}`}
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <div>
                  <span>{leg.kick}</span>
                  <b>{leg.label}</b>
                  <small>{leg.type}</small>
                </div>
                <em>{leg.class}</em>
              </div>
            ))}
          </div>

          {legs[tokenIndex] && (
            <div
              className={`atomic-boundary-callout ${legs[tokenIndex].atomic ? "active" : ""}`}
            >
              <div className="atomic-bracket">
                <span>ATOMIC BOUNDARY</span>
                <i />
              </div>
              <div>
                <b>{legs[tokenIndex].label}</b>
                <p>{tokenTruth}</p>
              </div>
            </div>
          )}

          <div className="settlement-state-grid">
            {legs.map((leg) => (
              <article
                key={`state-${leg.kick}`}
                className={leg.atomic ? "token-state" : ""}
              >
                <span>{leg.kick}</span>
                <b>{leg.class}</b>
                <p>
                  {leg.atomic
                    ? "This boundary succeeds or reverts as one token transaction in the reference contract model."
                    : "This leg keeps its own confirmation evidence and can remain pending independently of the token exchange."}
                </p>
              </article>
            ))}
          </div>

          <div className="settlement-overall">
            <div>
              <span>TOKEN EXCHANGE</span>
              <b>{legs[tokenIndex]?.class ?? "NOT APPLICABLE"}</b>
              <p>{tokenTruth}</p>
            </div>
            <div>
              <span>COMPLETE CUSTOMER TRANSACTION</span>
              <b>{overall}</b>
              <p>{journeyTruth}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
