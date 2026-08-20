import { DeviceShell } from "../Device";
import type { FinalFxContext } from "./final-fx-context";
import { INITIAL_STATE, type CorridorId, type JourneyId } from "./final-fx-definitions";

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

export function HeroSection({ ctx }: { ctx: FinalFxContext }) {
  const {
    state,
    setState,
    corridor,
    journey,
    output,
    sources,
    status,
    effectiveRate,
    scrollTo,
    changeCorridor,
    JOURNEYS,
    SCENARIO_CATALOG,
    formatNumber,
    money,
    setJourneyState,
  } = ctx;
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy fade-up">
          <div className="hero-kicker"><i /> FX INFRASTRUCTURE · WEBSITE SIMULATION</div>
          <h1>Build and operate your own FX market.</h1>
          <p>
            Blueballs lets a financial institution quote fiat and stablecoin exchanges using
            customer orders, issuer liquidity, professional makers, treasury and approved external
            venues. This page simulates the exchange flow, source selection and settlement states.
          </p>
          <div className="hero-actions">
            <button className="btn" type="button" onClick={() => scrollTo("walkthrough")}>Run the walkthrough</button>
            <button className="btn secondary" type="button" onClick={() => scrollTo("inspect")}>Review implementation status</button>
          </div>
          <div className="hero-proof">
            <div><span>LIQUIDITY SOURCES</span><b>Customer orders, issuers, professional makers, treasury and external venues can contribute to one quote.</b></div>
            <div><span>FX SETUPS</span><b>Use internal accounts, a payments provider, issuer mint and redemption, open P2P or a token-only route.</b></div>
            <div><span>SETTLEMENT STATUS</span><b>Each leg reports its own state. Token settlement can be atomic; external fiat legs are not.</b></div>
          </div>
        </div>

        <div className="hero-machine fade-up" aria-label="Simulated customer exchange and route">
          <div className="fx-device-holder hero-device-holder">
            <DeviceShell badge="SIMULATION" scale={0.88}>
              <div className="fx-device-exchange hero-device-content">
                <div className="fx-device-title">Exchange</div>
                <div className="fx-device-field">
                  <div><span>FROM</span><small>{corridor.from}</small></div>
                  <b>{money(corridor, state.amount, "from")}</b>
                </div>
                <div className="fx-device-swap">⇅</div>
                <div className="fx-device-field receive">
                  <div><span>TO</span><small>{corridor.to}</small></div>
                  <b>{status.complete ? money(corridor, output, "to") : "No quote"}</b>
                </div>
                <div className="fx-device-meta">
                  <div><span>Illustrative rate</span><b>1 {corridor.from} = {formatNumber(effectiveRate, 4)} {corridor.to}</b></div>
                  <div><span>Liquidity</span><b>{sources.length ? `${sources.length} selected sources` : "Unavailable"}</b></div>
                  <div><span>Route</span><b>{state.journey === "stable" ? "Token-only" : "Fiat + token legs"}</b></div>
                  <div><span>Status</span><b>{status.complete ? "Quote ready" : status.label}</b></div>
                </div>
                <button type="button" onClick={() => scrollTo("route")}>Review exchange</button>
                <div className="fx-device-foot">Illustrative website simulation · no money moves</div>
              </div>
            </DeviceShell>
          </div>

          <div className="machine-side">
            <div className="machine-side-head"><span>SIMULATED SOURCE ALLOCATION</span><b>{journey.label.toUpperCase()}</b></div>
            <div className="machine-card">
              <h3>Selected liquidity for this quote.</h3>
              <div className="machine-route">
                {sources.map((source) => (
                  <div className="machine-route-row" key={source.id}>
                    <i /><span>{source.label}</span><b>{money(corridor, (output * source.pct) / 100, "to")}</b>
                  </div>
                ))}
                {sources.length === 0 && (
                  <div className="machine-route-row"><i style={{ background: "#b4453c" }} /><span>{status.label}</span><b>—</b></div>
                )}
              </div>
              <div className="machine-total"><span>SIMULATION RESULT</span><b>{status.complete ? "Full amount covered by simulated allocations" : "No complete simulated route"}</b></div>
            </div>
            <div className="machine-note">
              {state.scenario === "normal" ? journey.summary : `${SCENARIO_CATALOG[state.scenario].label}: ${SCENARIO_CATALOG[state.scenario].short}`}
            </div>
          </div>
        </div>
      </div>

      <div className="sim-console fade-up" aria-label="Simulation controls">
        <div className="sim-field">
          <label htmlFor="bbfx-corridor">CORRIDOR</label>
          <select id="bbfx-corridor" value={state.corridor} onChange={(event: { target: { value: string } }) => changeCorridor(event.target.value as CorridorId)}>
            <option value="usd-eur">USD → EUR · USDC → EURC</option>
            <option value="eur-brl">EUR → BRL · EURC → BRLT</option>
            <option value="usdc-eurc">USDC → EURC · token-only</option>
          </select>
        </div>
        <div className="sim-field">
          <label htmlFor="bbfx-amount">AMOUNT</label>
          <input id="bbfx-amount" inputMode="decimal" value={state.amount || ""} onChange={(event: { target: { value: string } }) => {
            const parsed = Number(event.target.value.replace(/[^0-9.]/g, ""));
            setState((current) => ({ ...current, amount: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 }));
          }} />
        </div>
        <div className="sim-field">
          <label htmlFor="bbfx-journey">FX SETUP</label>
          <select id="bbfx-journey" value={state.journey} onChange={(event: { target: { value: string } }) => setState((current) => setJourneyState(current, event.target.value as JourneyId))}>
            {Object.entries(JOURNEYS).map(([id, item]) => <option value={id} key={id}>{item.label}</option>)}
          </select>
        </div>
        <button className="btn secondary sim-reset" type="button" onClick={() => setState({ ...INITIAL_STATE })}>Reset</button>
      </div>
    </section>
  );
}

export function WalkthroughSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, setState, corridor, journey, journeySteps, activeStep, JOURNEYS, setJourneyState } = ctx;
  return (
    <section className="section" id="walkthrough">
      <div className="section-inner">
        <SectionHead eyebrow="01 · COMPLETE FLOW" title="Choose how funds enter, exchange and reach the recipient.">
          Each walkthrough shows the complete transaction: customer or account checks, input funds, token FX, payout and reconciliation. The same policy and routing modules can support internal accounts, providers, issuers, P2P or token-only exchange.
        </SectionHead>
        <div className="journey-tabs fade-up">
          {Object.entries(JOURNEYS).map(([id, item]) => (
            <button type="button" key={id} className={state.journey === id ? "active" : ""} onClick={() => setState((current) => setJourneyState(current, id as JourneyId))}>{item.label}</button>
          ))}
        </div>
        <div className="walkthrough-shell fade-up">
          <div className="walkthrough-top">
            <div className="walkthrough-summary">
              <span className="small-label">SELECTED FLOW</span><h3>{journey.title}</h3><p>{journey.summary}</p>
              <div className="status-row">{journey.status.map(([label, tone]) => <span className={`status-chip ${tone}`} key={label}>{label}</span>)}</div>
            </div>
            <div className="journey-stage">
              <div className="journey-stage-head">
                <div><span className="small-label">TRANSACTION FLOW</span><b>{corridor.from} input → {corridor.to} output</b></div>
                <button className="journey-play" type="button" onClick={() => setState((current) => ({ ...current, journeyPlaying: !current.journeyPlaying }))}>{state.journeyPlaying ? "Pause flow" : "Play flow"}</button>
              </div>
              <div className="journey-line">
                {journeySteps.map((step, index) => (
                  <div className="journey-step-wrap" key={`${step.owner}-${step.title}`}>
                    <button type="button" className={`journey-step ${step.kind === "core" ? "core" : ""} ${state.journeyStep === index ? "active" : ""}`} onClick={() => setState((current) => ({ ...current, journeyStep: index, journeyPlaying: false }))}>
                      <span>{step.owner}</span><b>{step.title}</b><small>{step.finality}</small>
                    </button>
                    {index < journeySteps.length - 1 && <span className="journey-arrow">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="journey-detail">
            <div><span className="small-label">{activeStep.owner}</span><h3>{activeStep.title}</h3><p>{activeStep.detail}</p></div>
            <div className="ownership-tags">{[...new Set(journeySteps.map((step) => step.owner))].map((owner) => <span key={owner}>{owner}</span>)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketSection({ ctx }: { ctx: FinalFxContext }) {
  const { state, setState, settlePulse, setSettlePulse, corridor, output, sources, BASE_SOURCES, formatNumber, money, tokenMoney } = ctx;
  return (
    <section className="section" id="market">
      <div className="section-inner">
        <SectionHead eyebrow="02 · PRIVATE MARKET" title="Let customers and institutions provide FX liquidity.">
          The repository includes private customer and business orders alongside issuer inventory, professional quotes and treasury capacity. Orders can fill partially. A production deployment must provide a real signature verifier for maker orders.
        </SectionHead>
        <div className="market-stage fade-up">
          <svg className="flow-svg" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
            <path id="bbfx-path-customer" d="M 236 190 C 330 110, 380 170, 450 240" />
            <path id="bbfx-path-maker" d="M 964 290 C 855 210, 820 210, 750 260" />
            <path id="bbfx-path-back" d="M 450 325 C 360 350, 330 320, 236 280" />
            <circle r="4" fill="#ffffff"><animateMotion dur="3.4s" repeatCount="indefinite" begin=".2s"><mpath href="#bbfx-path-maker" /></animateMotion></circle>
            <circle r="4" fill="#ffffff"><animateMotion dur="3.1s" repeatCount="indefinite" begin="1.5s"><mpath href="#bbfx-path-customer" /></animateMotion></circle>
            <circle r="4" fill="#ffffff"><animateMotion dur="3.6s" repeatCount="indefinite" begin="2.4s"><mpath href="#bbfx-path-back" /></animateMotion></circle>
          </svg>

          <div className="fx-market-device">
            <DeviceShell scale={0.78}>
              <div className="fx-device-market-content">
                <div className="fx-device-market-kicker">CUSTOMER</div>
                <div className="fx-device-title">Exchange now</div>
                <div className="fx-device-field"><div><span>FROM</span><small>{corridor.from}</small></div><b>{money(corridor, state.amount, "from")}</b></div>
                <div className="fx-device-swap">⇅</div>
                <div className="fx-device-field receive"><div><span>TO</span><small>{corridor.to}</small></div><b>{money(corridor, output, "to")}</b></div>
                <div className="fx-device-market-stat"><span>Liquidity</span><b>{sources.length ? `${sources.length} selected sources` : "No complete route"}</b></div>
                <button type="button" onClick={() => setSettlePulse((value) => value + 1)}>Replay exchange flow</button>
              </div>
            </DeviceShell>
          </div>

          <div className="market-core">
            <div className="market-core-head"><span>PRIVATE FX MARKET</span><b>{corridor.pairLabel}</b></div>
            <h3>Orders, inventory and firm quotes can contribute to one quote.</h3>
            <div className="book-rows">
              {BASE_SOURCES.map((source, index) => {
                const selected = sources.find((item) => item.id === source.id);
                const availableWidth = index === 0 ? 68 : 85 - index * 9;
                const filledWidth = selected ? Math.max(5, selected.pct) : 0;
                return (
                  <div className={`book-row ${source.id === "customer" ? "customer" : ""}`} key={source.id}>
                    <span>{source.label}</span><div className="depth-bar"><i style={{ width: `${availableWidth}%` }} /><u style={{ width: `${filledWidth}%` }} /></div><strong>{selected ? `${formatNumber(selected.pct, 0)}% selected` : "not selected"}</strong>
                  </div>
                );
              })}
            </div>
            <div key={settlePulse} className={`market-settle ${sources.length > 0 && !["quote_expired", "proof_replay"].includes(state.scenario) ? "on" : ""}`}>
              <span>SIMULATED TOKEN FILLS</span><b>{sources.length ? `${sources.length} fills passed to the selected token-settlement step` : "No token settlement is prepared"}</b>
            </div>
          </div>

          <div className="fx-market-device">
            <DeviceShell scale={0.78}>
              <div className="fx-device-market-content">
                <div className="fx-device-market-kicker">CUSTOMER OR BUSINESS</div>
                <div className="fx-device-title">Place an FX order</div>
                <div className="fx-device-order-card"><span>PAIR</span><b>{corridor.pairLabel}</b></div>
                <div className="fx-device-order-card"><span>OFFER</span><b>{tokenMoney(corridor.toToken, output * 0.2)}</b></div>
                <div className="fx-device-order-card"><span>LIMIT RATE</span><b>1 {corridor.fromToken} = {formatNumber(corridor.rate * 1.0013, 4)} {corridor.toToken}</b></div>
                <div className="fx-device-market-stat"><span>Order visibility</span><b>Private to the institution</b></div>
                <button className={state.customerLiquidity ? "secondary-state" : ""} type="button" onClick={() => setState((current) => ({ ...current, customerLiquidity: !current.customerLiquidity, scenario: "normal" }))}>{state.customerLiquidity ? "Remove sample order" : "Add sample order"}</button>
              </div>
            </DeviceShell>
          </div>
        </div>
      </div>
    </section>
  );
}
