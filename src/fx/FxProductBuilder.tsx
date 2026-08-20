import { DeviceShell } from "../Device";
import type { FinalFxContext } from "./final-fx-context";
import type { ExecutionPlaneId, FiatPlaneId, JourneyId, LiquidityPlaneId } from "./final-fx-definitions";

const FUNDING_LABELS: Record<FiatPlaneId, string> = {
  hybrid: "Internal balance",
  own: "Internal account",
  provider: "Provider deposit",
  issuer: "Issuer mint",
  bank: "Bank transfer",
  p2p: "Verified P2P payment",
  none: "Customer stablecoin",
};

const FUNDING_DETAILS: Record<FiatPlaneId, string> = {
  hybrid: "Customer balance held by the institution",
  own: "Customer account held by the institution",
  provider: "Deposit confirmed by a banking or payments provider",
  issuer: "Fiat deposit followed by stablecoin minting",
  bank: "External bank transfer",
  p2p: "Verified P2P payment followed by token release",
  none: "Stablecoin already available in the customer wallet",
};

const DELIVERY_LABELS: Record<FiatPlaneId, string> = {
  hybrid: "External payout",
  own: "Internal credit",
  provider: "Provider payout",
  issuer: "Issuer redemption",
  bank: "Bank payout",
  p2p: "Redemption / off-ramp",
  none: "Stablecoin delivery",
};

const DELIVERY_DETAILS: Record<FiatPlaneId, string> = {
  hybrid: "External payout to the recipient",
  own: "Credit to the recipient's internal account",
  provider: "Payout through the connected provider or bank rail",
  issuer: "Stablecoin redemption followed by fiat payout",
  bank: "External bank payout",
  p2p: "Separate redemption, payout or P2P off-ramp",
  none: "Output stablecoin delivered to the customer wallet",
};

const SECTION_LINKS = [
  { id: "walkthrough", title: "Complete flow", description: "Who does each step" },
  { id: "market", title: "Private market", description: "Who can provide liquidity" },
  { id: "route", title: "Customer quote", description: "How sources are combined" },
  { id: "privacy", title: "Privacy", description: "What stays private" },
  { id: "settlement", title: "Settlement", description: "What is final or pending" },
  { id: "lab", title: "Failures", description: "How the route responds" },
] as const;

export default function FxProductBuilder({ ctx }: { ctx: FinalFxContext }) {
  const {
    state,
    setState,
    corridor,
    journey,
    output,
    sources,
    status,
    legs,
    available,
    scrollTo,
    CORRIDORS,
    FIAT_OPTIONS,
    LIQUIDITY_OPTIONS,
    EXECUTION_OPTIONS,
    money,
    setJourneyState,
  } = ctx;

  const customSetup =
    state.fiatPlane !== journey.fiat ||
    state.liquidityPlane !== journey.liquidity ||
    state.executionPlane !== journey.execution;

  const changeFundingModel = (fiatPlane: FiatPlaneId) => {
    const journeyByFiat: Record<FiatPlaneId, JourneyId> = {
      hybrid: "hybrid",
      own: "own",
      provider: "provider",
      issuer: "issuer",
      bank: "hybrid",
      p2p: "p2p",
      none: "stable",
    };

    setState((current) => {
      let corridorId = current.corridor;
      let amount = current.amount;
      if (fiatPlane === "none") {
        corridorId = "usdc-eurc";
        amount = CORRIDORS[corridorId].defaultAmount;
      } else if (current.corridor === "usdc-eurc") {
        corridorId = "usd-eur";
        amount = CORRIDORS[corridorId].defaultAmount;
      }
      return {
        ...current,
        journey: journeyByFiat[fiatPlane],
        fiatPlane,
        corridor: corridorId,
        amount,
        scenario: "normal",
        journeyStep: 0,
        journeyPlaying: true,
      };
    });
  };

  const finalityClasses = [...new Set(legs.map((leg) => leg.class))];
  const finalityLabel = finalityClasses.length === 1 ? finalityClasses[0] : "MIXED FINALITY";

  const sectionValues: Record<(typeof SECTION_LINKS)[number]["id"], string> = {
    walkthrough: customSetup ? "Custom setup" : journey.label,
    market: sources.length ? `${sources.length} sources` : "No route",
    route: status.complete ? money(corridor, output, "to") : "No quote",
    privacy: state.executionPlane === "blueballs" ? "Selected fills only" : state.executionPlane === "internal" ? "Internal transfer" : "External venue",
    settlement: finalityLabel,
    lab: `${available.length} scenarios`,
  };

  return (
    <section className="section fx-product-builder" id="compose">
      <div className="section-inner">
        <div className="section-head fade-up">
          <div className="eyebrow">BUILD THE FX PRODUCT</div>
          <div>
            <h2>Configure one exchange and see the product and backend change together.</h2>
            <p>
              Choose how money enters and leaves, where the FX liquidity comes from and how the token leg settles.
              The customer view, backend route and every section below use these same choices.
            </p>
          </div>
        </div>

        <div className="fx-builder-shell fade-up">
          <div className="fx-builder-statusbar">
            <div>
              <span>PRESET</span>
              <b>{journey.label}</b>
            </div>
            <div>
              <span>CURRENT SETUP</span>
              <b>{customSetup ? "Custom" : "Preset unchanged"}</b>
            </div>
            {customSetup && (
              <button type="button" onClick={() => setState((current) => setJourneyState(current, current.journey))}>
                Reset to preset
              </button>
            )}
          </div>

          <div className="fx-builder-controls-row" aria-label="FX product configuration">
            <label className="fx-builder-control-card">
              <span>1 · MONEY IN + OUT</span>
              <b>How does the customer fund the exchange and receive the result?</b>
              <div className="fx-select-wrap">
                <select value={state.fiatPlane} aria-label="Money in and out" onChange={(event: { target: { value: string } }) => changeFundingModel(event.target.value as FiatPlaneId)}>
                  {Object.entries(FIAT_OPTIONS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                </select>
              </div>
            </label>

            <label className="fx-builder-control-card">
              <span>2 · FX LIQUIDITY</span>
              <b>Who supplies the rate and the amount available to trade?</b>
              <div className="fx-select-wrap">
                <select value={state.liquidityPlane} aria-label="FX liquidity" onChange={(event: { target: { value: string } }) => setState((current) => ({ ...current, liquidityPlane: event.target.value as LiquidityPlaneId, scenario: "normal" }))}>
                  {Object.entries(LIQUIDITY_OPTIONS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                </select>
              </div>
            </label>

            <label className="fx-builder-control-card dark">
              <span>3 · TOKEN SETTLEMENT</span>
              <b>Where is the selected token exchange executed?</b>
              <div className="fx-select-wrap">
                <select value={state.executionPlane} aria-label="Token settlement" onChange={(event: { target: { value: string } }) => setState((current) => ({ ...current, executionPlane: event.target.value as ExecutionPlaneId, scenario: "normal" }))}>
                  {Object.entries(EXECUTION_OPTIONS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                </select>
              </div>
            </label>
          </div>

          <div className="fx-builder-preview-grid">
            <div className="fx-builder-customer">
              <div className="fx-builder-panel-head">
                <span>CUSTOMER EXPERIENCE</span>
                <b>The exchange your customer sees</b>
              </div>

              <div className="fx-device-holder">
                <DeviceShell badge="SIMULATION">
                  <div className="fx-device-exchange">
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
                      <div><span>Funding</span><b>{FUNDING_LABELS[state.fiatPlane]}</b></div>
                      <div><span>Delivery</span><b>{DELIVERY_LABELS[state.fiatPlane]}</b></div>
                      <div><span>Liquidity</span><b>{sources.length ? `${sources.length} sources` : "Unavailable"}</b></div>
                      <div><span>Status</span><b>{status.complete ? "Quote ready" : status.label}</b></div>
                    </div>
                    <button type="button" onClick={() => scrollTo("route")}>Review quote</button>
                    <div className="fx-device-foot">Illustrative website simulation · no money moves</div>
                  </div>
                </DeviceShell>
              </div>
            </div>

            <div className="fx-builder-backend">
              <div className="fx-builder-panel-head dark">
                <span>BLUEBALLS BACKEND</span>
                <b>The same exchange behind the customer screen</b>
              </div>

              <div className="fx-backend-summary">
                <div><span>INPUT</span><b>{FUNDING_DETAILS[state.fiatPlane]}</b></div>
                <i>→</i>
                <div><span>FX</span><b>{corridor.fromToken} → {corridor.toToken}</b></div>
                <i>→</i>
                <div><span>OUTPUT</span><b>{DELIVERY_DETAILS[state.fiatPlane]}</b></div>
              </div>

              <div className="fx-backend-flow">
                <div className="fx-backend-node">
                  <i>01</i><div><span>INPUT CONFIRMED</span><b>{FUNDING_DETAILS[state.fiatPlane]}</b></div>
                </div>
                <div className="fx-backend-connector" />
                <div className="fx-backend-node">
                  <i>02</i><div><span>POLICY</span><b>Customer, account, corridor, ticket size and source eligibility are checked before pricing.</b></div>
                </div>
                <div className="fx-backend-connector" />
                <div className="fx-backend-node route-node">
                  <i>03</i>
                  <div>
                    <span>LIQUIDITY + ROUTING</span>
                    <b>{sources.length ? `${sources.length} eligible sources cover the quote` : "No complete source allocation"}</b>
                    <small>{LIQUIDITY_OPTIONS[state.liquidityPlane]}</small>
                    {sources.length > 0 && <div className="fx-backend-sources">{sources.map((source) => <em key={source.id}>{source.label}</em>)}</div>}
                  </div>
                </div>
                <div className="fx-backend-connector" />
                <div className="fx-backend-node">
                  <i>04</i><div><span>TOKEN SETTLEMENT</span><b>{EXECUTION_OPTIONS[state.executionPlane]}</b></div>
                </div>
                <div className="fx-backend-connector" />
                <div className="fx-backend-node">
                  <i>05</i><div><span>OUTPUT CONFIRMATION</span><b>{DELIVERY_DETAILS[state.fiatPlane]}</b></div>
                </div>
              </div>

              <div className="fx-backend-result">
                <div><span>CUSTOMER RESULT</span><b>{status.complete ? money(corridor, output, "to") : "No quote"}</b></div>
                <div><span>ROUTE STATUS</span><b>{status.complete ? finalityLabel : status.label}</b></div>
              </div>
            </div>
          </div>

          <div className="fx-builder-connections">
            <div className="fx-builder-connections-head">
              <div><span>FOLLOW THIS SAME EXCHANGE</span><b>Open any layer below without changing context.</b></div>
              <small>Every section is reading the configuration above, not starting a new example.</small>
            </div>
            <div className="fx-builder-links">
              {SECTION_LINKS.map((item, index) => (
                <button type="button" key={item.id} onClick={() => scrollTo(item.id)}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span>{item.title}</span>
                  <small>{item.description}</small>
                  <b>{sectionValues[item.id]}</b>
                  <em>Open →</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
