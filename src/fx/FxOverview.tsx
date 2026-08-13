import {
  CustomerAndMaker,
  DeploymentBlueprints,
  FiatModels,
  FinalityGraphic,
  InstitutionalControl,
  OneTradeManyWays,
  PrivateSettlement,
  ProviderParticipation,
  TreasuryGraphic,
} from "./ArchitectureStory";
import {
  ArchitecturePlanes,
  ExchangeLifecycle,
  ImplementationMap,
  ParticipantRoles,
  ProductFlows,
} from "./DeepDive";
import { Label } from "./Primitives";
import { FxHero } from "./FxHero";
import { DeveloperInspector } from "./Developer";
import { Packages } from "./Packages";
import { AllocationMap, ApiView } from "./TradeViews";
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
      <FxHero
        trade={props.trade}
        loading={props.loading}
        runtimeReachable={props.runtimeReachable}
      />

      <ProductFlows trade={props.trade} />
      <ArchitecturePlanes />
      <div id="fx-market">
        <PrivateSettlement />
      </div>
      <ParticipantRoles />
      <CustomerAndMaker trade={props.trade} />
      <OneTradeManyWays trade={props.trade} />
      <ProviderParticipation />
      <FiatModels />
      <InstitutionalControl />
      <TreasuryGraphic trade={props.trade} />
      <FinalityGraphic trade={props.trade} />
      <ExchangeLifecycle trade={props.trade} />
      <DeploymentBlueprints />
      <ImplementationMap />

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
        <div className="fxm-proof-api">
          <div>
            <Label>REQUEST</Label>
            <h3>The product calls one FX API.</h3>
            <p>
              The response carries the complete quote, selected source legs,
              settlement route and current evidence. Reservation, execution and
              reconciliation continue against the same trade lifecycle.
            </p>
          </div>
          <ApiView trade={props.trade} amount={props.amount} />
        </div>
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
      <DeveloperInspector trade={props.trade} amount={props.amount} />
      <Packages />
    </>
  );
}
