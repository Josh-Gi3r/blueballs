import type { Dispatch, SetStateAction } from "react";
import {
  BASE_SOURCES, CORRIDORS, EXECUTION_OPTIONS, FIAT_OPTIONS, JOURNEYS, LIQUIDITY_OPTIONS, SCENARIO_CATALOG,
  formatNumber, money, tokenMoney, type Corridor, type CorridorId, type FinalityLeg, type FiatPlaneId, type Journey,
  type JourneyStep, type ScenarioDetail, type ScenarioId, type SimulationState, type Source,
} from "./final-fx-definitions";
import { setJourneyState } from "./final-fx-scenarios";

export type FinalFxContext = {
  state: SimulationState;
  setState: Dispatch<SetStateAction<SimulationState>>;
  settlePulse: number;
  setSettlePulse: Dispatch<SetStateAction<number>>;
  corridor: Corridor;
  journey: Journey;
  output: number;
  sources: Source[];
  status: { label: string; complete: boolean };
  journeySteps: JourneyStep[];
  available: ScenarioId[];
  scenario: ScenarioDetail;
  legs: FinalityLeg[];
  inspector: { label: string; status: string; value: string };
  activeStep: JourneyStep;
  effectiveRate: number;
  scrollTo: (id: string) => void;
  changeCorridor: (corridorId: CorridorId) => void;
  changeFiatPlane: (fiatPlane: FiatPlaneId) => void;
  riskLimit: number;
  activeReservations: number;
  treasury: Source | undefined;
  riskUsed: number;
  riskConsumed: number;
  riskRemaining: number;
  riskPct: number;
  executionCopy: { label: string; row: string; seal: string };
  tokenTruth: string;
  journeyTruth: string;
  routeRationale: string[];
  CORRIDORS: typeof CORRIDORS;
  JOURNEYS: typeof JOURNEYS;
  FIAT_OPTIONS: typeof FIAT_OPTIONS;
  LIQUIDITY_OPTIONS: typeof LIQUIDITY_OPTIONS;
  EXECUTION_OPTIONS: typeof EXECUTION_OPTIONS;
  BASE_SOURCES: typeof BASE_SOURCES;
  SCENARIO_CATALOG: typeof SCENARIO_CATALOG;
  formatNumber: typeof formatNumber;
  money: typeof money;
  tokenMoney: typeof tokenMoney;
  setJourneyState: typeof setJourneyState;
};
