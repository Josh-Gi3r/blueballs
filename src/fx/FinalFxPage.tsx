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
import {
  inspectorPayload,
  scenarioDetail,
  setJourneyState,
} from "./final-fx-scenarios";
import type { FinalFxContext } from "./final-fx-context";
import {
  HeroSection,
  MarketSection,
  WalkthroughSection,
} from "./FinalFxSectionsA";
import {
  PrivacySection,
  RouteSection,
  SettlementSection,
} from "./FinalFxSectionsB";
import {
  ClosingSection,
  InspectSection,
  LabSection,
  TreasurySection,
} from "./FinalFxSectionsC";
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
  const journeySteps = useMemo(
    () => buildJourneySteps(state, corridor),
    [state, corridor],
  );
  const available = useMemo(
    () => availableScenarios(state.journey),
    [state.journey],
  );
  const scenario = useMemo(
    () => scenarioDetail(state, corridor, sources),
    [state, corridor, sources],
  );
  const legs = useMemo(() => finalityLegs(state, corridor), [state, corridor]);
  const inspector = useMemo(
    () =>
      inspectorPayload(
        state.inspector,
        state,
        corridor,
        output,
        sources,
        legs,
        scenario,
        status,
      ),
    [state, corridor, output, sources, legs, scenario, status],
  );

  const activeStep = (journeySteps[
    Math.min(state.journeyStep, journeySteps.length - 1)
  ] ?? journeySteps[0])!;
  const effectiveRate =
    state.amount > 0 ? output / state.amount : corridor.rate;

  useEffect(() => {
    if (available.includes(state.scenario)) return;
    setState((current) => ({ ...current, scenario: "normal" }));
  }, [available, state.scenario]);

  useEffect(() => {
    if (!state.journeyPlaying || journeySteps.length === 0) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setState((current) => ({
        ...current,
        journeyStep: (current.journeyStep + 1) % journeySteps.length,
      }));
    }, 2_600);
    return () => window.clearInterval(timer);
  }, [state.journeyPlaying, journeySteps.length]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12 },
    );
    root
      .querySelectorAll(".fade-up")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    rootRef.current
      ?.querySelector(`#${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changeCorridor = (corridorId: CorridorId) => {
    const next = CORRIDORS[corridorId];
    setState((current) => {
      if (corridorId === "usdc-eurc")
        return {
          ...setJourneyState(current, "stable"),
          corridor: corridorId,
          amount: next.defaultAmount,
          scenario: "normal",
          journeyStep: 0,
        };
      if (current.journey === "stable")
        return {
          ...setJourneyState(current, "hybrid"),
          corridor: corridorId,
          amount: next.defaultAmount,
          scenario: "normal",
          journeyStep: 0,
        };
      return {
        ...current,
        corridor: corridorId,
        amount: next.defaultAmount,
        scenario: "normal",
        journeyStep: 0,
      };
    });
  };

  const changeFiatPlane = (fiatPlane: FiatPlaneId) => {
    const journeyByFiat: Record<FiatPlaneId, JourneyId> = {
      hybrid: "hybrid",
      own: "own",
      provider: "provider",
      issuer: "issuer",
      bank: "hybrid",
      p2p: "p2p",
      none: "stable",
    };
    const nextJourney = journeyByFiat[fiatPlane];
    setState((current) => ({
      ...setJourneyState(current, nextJourney),
      fiatPlane,
    }));
  };

  const riskLimit = 1_000_000;
  const activeReservations =
    state.scenario === "treasury_limit" ? 998_500 : 82_000;
  const treasury = sources.find((source) => source.id === "treasury");
  const riskUsed = treasury ? (state.amount * treasury.pct) / 100 : 0;
  const riskConsumed = Math.min(riskLimit, activeReservations + riskUsed);
  const riskRemaining = Math.max(0, riskLimit - riskConsumed);
  const riskPct = Math.min(100, (riskConsumed / riskLimit) * 100);

  const executionCopy =
    state.executionPlane === "internal"
      ? {
          label: "INSTITUTION LEDGER · INTERNAL SETTLEMENT",
          row: "approved internal transfer",
          seal: "Blueballs coordinates the selected token amounts through the institution-owned ledger boundary.",
        }
      : state.executionPlane === "external"
        ? {
            label: "EXTERNAL TOKEN VENUE · ADAPTER EXECUTION",
            row: "provider quote allocation",
            seal: "Blueballs preserves the venue submission, confirmation and reconciliation lifecycle as canonical route state.",
          }
        : {
            label: "BLUEBALLS ATOMIC ROUTER · TOKEN SETTLEMENT",
            row: "selected signed fill",
            seal: "The AtomicRouter binds taker authority, maker economics and institution policy in one all-or-revert token transaction.",
          };

  let tokenTruth =
    state.executionPlane === "blueballs"
      ? "Blueballs contracts provide a single atomic settlement boundary for all selected token fills in the route."
      : state.executionPlane === "internal"
        ? "Institution-owned ledger settlement keeps the token exchange inside the banking core with exact accounting."
        : "External venue execution retains provider-native finality while Blueballs owns submission and reconciliation state.";
  let journeyTruth =
    state.journey === "stable"
      ? "The selected route is a pure token corridor with one token finality domain."
      : "Fiat and provider edges retain their own finality while Blueballs coordinates the complete end-to-end transaction state.";

  if (state.scenario === "proof_replay") {
    tokenTruth =
      "Replay protection rejects reused settlement evidence before the token exchange can advance.";
    journeyTruth =
      "External payment evidence remains independently reconcilable, preserving a complete financial audit trail.";
  } else if (state.scenario === "payout_pending") {
    tokenTruth = "The token leg has reached its final state.";
    journeyTruth =
      "The customer transaction remains pending until the external payout supplies its confirmation evidence.";
  } else if (state.journey === "stable") {
    tokenTruth =
      state.executionPlane === "blueballs"
        ? "The token-only route uses the Blueballs atomic settlement boundary."
        : state.executionPlane === "internal"
          ? "The token-only route settles through institution-owned ledger accounting."
          : "The token-only route executes through the configured venue adapter and provider-native confirmation lifecycle.";
  }

  const routeRationale = [
    "Policy check passed for the customer, account, corridor and amount",
    "Only currently eligible liquidity sources were included",
    status.complete
      ? "The selected allocation covers the full customer amount"
      : "Available eligible capacity does not cover the full customer amount",
    state.scenario === "treasury_limit"
      ? "Treasury capacity was removed because the configured exposure limit was reached"
      : state.scenario === "reference_outage"
        ? "Principal capacity was removed because the reference-price control was unavailable"
        : "Treasury allocation remains inside the configured exposure limit",
  ];

  const ctx: FinalFxContext = {
    state,
    setState,
    settlePulse,
    setSettlePulse,
    corridor,
    journey,
    output,
    sources,
    status,
    journeySteps,
    available,
    scenario,
    legs,
    inspector,
    activeStep,
    effectiveRate,
    scrollTo,
    changeCorridor,
    changeFiatPlane,
    riskLimit,
    activeReservations,
    treasury,
    riskUsed,
    riskConsumed,
    riskRemaining,
    riskPct,
    executionCopy,
    tokenTruth,
    journeyTruth,
    routeRationale,
    CORRIDORS,
    JOURNEYS,
    FIAT_OPTIONS,
    LIQUIDITY_OPTIONS,
    EXECUTION_OPTIONS,
    BASE_SOURCES,
    SCENARIO_CATALOG,
    formatNumber,
    money,
    tokenMoney,
    setJourneyState,
  };

  return (
    <div ref={rootRef} className="bbfx" aria-label="Blueballs FX architecture lab">
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
