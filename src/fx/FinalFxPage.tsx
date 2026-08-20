import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_SOURCES,
  CORRIDORS,
  EXECUTION_OPTIONS,
  FIAT_OPTIONS,
  INITIAL_STATE,
  JOURNEYS,
  LIQUIDITY_OPTIONS,
  SCENARIO_CATALOG,
  formatNumber,
  money,
  tokenMoney,
  type CorridorId,
  type FiatPlaneId,
  type JourneyId,
  type SimulationState,
} from "./final-fx-definitions";
import {
  availableScenarios,
  buildJourneySteps,
  finalityLegs,
  outputAmount,
  routeStatus,
  selectedSources,
} from "./final-fx-engine";
import { inspectorPayload, scenarioDetail, setJourneyState } from "./final-fx-scenarios";
import type { FinalFxContext } from "./final-fx-context";
import { HeroSection, MarketSection, WalkthroughSection } from "./FinalFxSectionsA";
import { PrivacySection, RouteSection, SettlementSection } from "./FinalFxSectionsB";
import { ClosingSection, InspectSection, LabSection, TreasurySection } from "./FinalFxSectionsC";
import FxProductBuilder from "./FxProductBuilder";
import "./final-fx-page-1.css";
import "./final-fx-page-2.css";
import "./final-fx-page-3.css";
import "./final-fx-builder.css";
import "./final-fx-settlement.css";

export default function FinalFxPage() {
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  const [settlePulse, setSettlePulse] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const corridor = CORRIDORS[state.corridor];
  const journey = JOURNEYS[state.journey];
  const output = outputAmount(state, corridor);
  const sources = useMemo(() => selectedSources(state), [state]);
  const status = routeStatus(state, sources);
  const journeySteps = useMemo(() => buildJourneySteps(state, corridor), [state, corridor]);
  const available = useMemo(() => availableScenarios(state.journey), [state.journey]);
  const scenario = useMemo(() => scenarioDetail(state, corridor, sources), [state, corridor, sources]);
  const legs = useMemo(() => finalityLegs(state, corridor), [state, corridor]);
  const inspector = useMemo(
    () => inspectorPayload(state.inspector, state, corridor, output, sources, legs, scenario, status),
    [state, corridor, output, sources, legs, scenario, status],
  );

  const activeStep = (journeySteps[Math.min(state.journeyStep, journeySteps.length - 1)] ?? journeySteps[0])!;
  const effectiveRate = state.amount > 0 ? output / state.amount : corridor.rate;

  useEffect(() => {
    if (available.includes(state.scenario)) return;
    setState((current) => ({ ...current, scenario: "normal" }));
  }, [available, state.scenario]);

  useEffect(() => {
    if (!state.journeyPlaying || journeySteps.length === 0) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setState((current) => ({ ...current, journeyStep: (current.journeyStep + 1) % journeySteps.length }));
    }, 2_600);
    return () => window.clearInterval(timer);
  }, [state.journeyPlaying, journeySteps.length]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("visible"); });
    }, { threshold: 0.12 });
    root.querySelectorAll(".fade-up").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changeCorridor = (corridorId: CorridorId) => {
    const next = CORRIDORS[corridorId];
    setState((current) => {
      if (corridorId === "usdc-eurc") return { ...setJourneyState(current, "stable"), corridor: corridorId, amount: next.defaultAmount, scenario: "normal", journeyStep: 0 };
      if (current.journey === "stable") return { ...setJourneyState(current, "hybrid"), corridor: corridorId, amount: next.defaultAmount, scenario: "normal", journeyStep: 0 };
      return { ...current, corridor: corridorId, amount: next.defaultAmount, scenario: "normal", journeyStep: 0 };
    });
  };

  const changeFiatPlane = (fiatPlane: FiatPlaneId) => {
    const journeyByFiat: Record<FiatPlaneId, JourneyId> = { hybrid: "hybrid", own: "own", provider: "provider", issuer: "issuer", bank: "hybrid", p2p: "p2p", none: "stable" };
    const nextJourney = journeyByFiat[fiatPlane];
    setState((current) => ({ ...setJourneyState(current, nextJourney), fiatPlane }));
  };

  const riskLimit = 1_000_000;
  const activeReservations = state.scenario === "treasury_limit" ? 998_500 : 82_000;
  const treasury = sources.find((source) => source.id === "treasury");
  const riskUsed = treasury ? (state.amount * treasury.pct) / 100 : 0;
  const riskConsumed = Math.min(riskLimit, activeReservations + riskUsed);
  const riskRemaining = Math.max(0, riskLimit - riskConsumed);
  const riskPct = Math.min(100, (riskConsumed / riskLimit) * 100);

  const executionCopy = state.executionPlane === "internal"
    ? { label: "INTERNAL TOKEN TRANSFER · SIMULATION", row: "approved internal transfer", seal: "The institution would record the selected token amounts on its own ledger." }
    : state.executionPlane === "external"
      ? { label: "EXTERNAL TOKEN VENUE · NOT CONNECTED", row: "external quote allocation", seal: "A deployment would use the venue's own submission and confirmation states." }
      : { label: "BLUEBALLS TOKEN CONTRACTS · REFERENCE", row: "selected fill", seal: "The reference contracts require all selected fills in one transaction to succeed or revert together." };

  let tokenTruth = state.executionPlane === "blueballs"
    ? "The reference contracts support atomic settlement when all selected fills share one transaction. This website and the default FX runtime do not submit that transaction."
    : state.executionPlane === "internal"
      ? "The institution records the token exchange as an internal ledger transfer. It is not an on-chain atomic transaction."
      : "The token leg is assigned to an approved external venue and remains pending until that venue supplies confirmation evidence.";
  let journeyTruth = state.journey === "stable"
    ? "The selected route contains no fiat deposit, mint, redemption or payout leg."
    : "This route contains fiat or provider legs with separate confirmation states. The overall transaction has mixed finality.";

  if (state.scenario === "proof_replay") {
    tokenTruth = "No token exchange starts because the P2P token release is rejected before the stablecoin reaches the FX market.";
    journeyTruth = "The external fiat payment may still exist and may require manual resolution. The simulation does not treat it as cancelled or reversed.";
  } else if (state.scenario === "payout_pending") {
    tokenTruth = "The simulation marks the token leg complete.";
    journeyTruth = "The customer transaction remains pending because the external payout has not produced confirmation evidence.";
  } else if (state.journey === "stable") {
    tokenTruth = state.executionPlane === "blueballs"
      ? "The token-only route can use one reference atomic settlement boundary, but this website does not submit a transaction."
      : state.executionPlane === "internal"
        ? "The token-only route is recorded as an internal transfer rather than an on-chain atomic transaction."
        : "The token-only route uses an external execution venue and depends on that venue's confirmation process.";
  }

  const routeRationale = [
    "Simulated policy check passed for the customer, account, corridor and amount",
    "Only sources marked eligible in this scenario were included",
    status.complete ? "The simulated allocation covers the full amount" : "The simulated allocation does not cover the full amount",
    state.scenario === "treasury_limit"
      ? "Treasury was removed because the simulated exposure limit was reached"
      : state.scenario === "reference_outage"
        ? "The principal source was removed because no reference price was available"
        : "The simulated treasury allocation remains within the configured limit",
  ];

  const ctx: FinalFxContext = {
    state, setState, settlePulse, setSettlePulse, corridor, journey, output, sources, status, journeySteps, available, scenario, legs,
    inspector, activeStep, effectiveRate, scrollTo, changeCorridor, changeFiatPlane, riskLimit, activeReservations, treasury, riskUsed,
    riskConsumed, riskRemaining, riskPct, executionCopy, tokenTruth, journeyTruth, routeRationale, CORRIDORS, JOURNEYS, FIAT_OPTIONS,
    LIQUIDITY_OPTIONS, EXECUTION_OPTIONS, BASE_SOURCES, SCENARIO_CATALOG, formatNumber, money, tokenMoney, setJourneyState,
  };

  return (
    <div ref={rootRef} className="bbfx" aria-label="Blueballs FX website simulation">
      <HeroSection ctx={ctx} />
      <FxProductBuilder ctx={ctx} />
      <WalkthroughSection ctx={ctx} />
      <MarketSection ctx={ctx} />
      <RouteSection ctx={ctx} />
      <PrivacySection ctx={ctx} />
      <SettlementSection ctx={ctx} />
      <TreasurySection ctx={ctx} />
      <LabSection ctx={ctx} />
      <InspectSection ctx={ctx} />
      <ClosingSection ctx={ctx} />
    </div>
  );
}
