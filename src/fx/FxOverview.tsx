import {
  CustomerAndMaker,
  DeploymentBlueprints,
  FiatModels,
  FinalityGraphic,
  InstitutionalControl,
  OneTradeManyWays,
  PrivateSettlement,
  ProductExchangeVisual,
  ProviderParticipation,
  TreasuryGraphic,
} from "./ArchitectureStory";
import { Label } from "./Primitives";
import { AllocationMap } from "./TradeViews";
import {
  SCENARIO_COPY,
  type MarketState,
  type PublicTrade,
  type Scenario,
} from "./model";

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

export function FxOverview(props: OverviewProps) {
  return (
    <>
      <section className="fxp-section fxm-hero">
        <div className="fxm-hero-copy">
          <Label>OPEN-SOURCE FX INFRASTRUCTURE</Label>
          <h1>Build and operate FX.</h1>
        </div>
        <ProductExchangeVisual trade={props.trade} />
        <div className="fxm-hero-detail">
          <p>
            Operate a private FX market inside your product. Customers,
            businesses, issuers, market makers, financial institutions, treasury
            and connected providers can supply liquidity to the same exchange.
          </p>
          <p>
            Keep identity, orders, pricing, matching and risk controls private.
            Settle the selected token fills atomically on-chain.
          </p>
          <div className="fxm-hero-actions">
            <a href="#fx-market">See the market</a>
            <a href="#fx-proof">Run the implementation</a>
          </div>
        </div>
      </section>

      <div id="fx-market">
        <PrivateSettlement />
      </div>
      <CustomerAndMaker trade={props.trade} />
      <OneTradeManyWays trade={props.trade} />
      <ProviderParticipation />
      <FiatModels />
      <InstitutionalControl />
      <TreasuryGraphic trade={props.trade} />
      <FinalityGraphic trade={props.trade} />
      <DeploymentBlueprints />

      <section id="fx-proof" className="fxp-section fxn-section fxm-proof">
        <div className="fxp-section-head">
          <div>
            <Label>RUNNING IMPLEMENTATION</Label>
            <h2>Live transaction and failure scenarios</h2>
            <p>
              The BRL to EUR transaction below comes from the FX node in this
              repository. Change the amount or remove a source to see the
              planner rebuild the same exchange.
            </p>
          </div>
          <span
            className={`fxm-runtime ${props.runtimeReachable ? "online" : "offline"}`}
          >
            {props.loading
              ? "connecting"
              : props.runtimeReachable
                ? "runtime connected"
                : "runtime unavailable"}
          </span>
        </div>
        <div className="fxm-controls">
          <label>
            <span>Customer sends</span>
            <div>
              <b>R$</b>
              <input
                inputMode="decimal"
                value={props.amount}
                onChange={(event) => props.onAmountChange(event.target.value)}
              />
              <button
                type="button"
                disabled={props.busy}
                onClick={props.onPreview}
              >
                Reprice
              </button>
            </div>
          </label>
          <div className="fxm-scenarios">
            {props.scenarios.map((item) => (
              <button
                type="button"
                key={item.id}
                className={props.activeScenario === item.id ? "active" : ""}
                disabled={props.busy}
                onClick={() => props.onScenarioChange(item.id)}
              >
                <b>{SCENARIO_COPY[item.id]?.title ?? item.label}</b>
                <span>{SCENARIO_COPY[item.id]?.short ?? ""}</span>
              </button>
            ))}
          </div>
        </div>
        {props.error && <div className="fxm-error">{props.error}</div>}
        <AllocationMap
          trade={props.trade}
          selected={props.selectedSource}
          onSelect={props.onSourceSelect}
        />
        <div className="fxm-proof-links">
          <a
            href="https://github.com/Josh-Gi3r/blueballs"
            target="_blank"
            rel="noreferrer"
          >
            View the source
          </a>
          <a
            href="https://github.com/Josh-Gi3r/blueballs#quickstart"
            target="_blank"
            rel="noreferrer"
          >
            Run it locally
          </a>
          <a
            href="https://github.com/Josh-Gi3r/blueballs/tree/main/spec/fx"
            target="_blank"
            rel="noreferrer"
          >
            Read the FX specification
          </a>
        </div>
      </section>
    </>
  );
}
