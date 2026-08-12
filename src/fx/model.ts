import type { ApiResult } from "../api";

export const REPO = "https://github.com/Josh-Gi3r/blueballs";
export const source = (path: string) => `${REPO}/blob/main/${path}`;

export type SourceType =
  | "PRIVATE_MARKET"
  | "ISSUER"
  | "INSTITUTIONAL_LP"
  | "NEOBANK"
  | "BANK_TREASURY"
  | "BANK_PRINCIPAL";

export type SourceAllocation = {
  type: SourceType;
  sourceId: string;
  input?: string;
  output?: string;
  inputAtomic?: string;
  outputAtomic?: string;
  inputAmount?: string;
  outputAmount?: string;
};

export type SourceStatus = {
  sourceType: SourceType;
  sourceId: string;
  label: string;
  eligible: boolean;
  availableOutput: string;
  reason: string;
};

export type SettlementEdge = {
  edgeId: string;
  edgeType: string;
  finalityClass: string;
  fromAsset: string;
  toAsset: string;
  providerId: string;
  metadata?: Record<string, unknown>;
};

export type PublicTrade = {
  object: "fx_trade_preview" | "fx_trade";
  id?: string;
  quoteId?: string;
  routeId?: string;
  state: "PREVIEW" | "RESERVED" | "SUBMITTED" | "CONFIRMED" | "RELEASED" | "EXPIRED" | "FAILED";
  createdAt?: number;
  expiresAt: number;
  from: { asset: string; symbol: string; requested?: string; charged?: string; atomic: string };
  to: { asset: string; symbol: string; amount: string; atomic: string };
  rate: string;
  sources: SourceAllocation[];
  sourceStatus: SourceStatus[];
  tokenRoute: {
    inputAsset: string;
    inputSymbol: string;
    inputAtomic: string;
    outputAsset: string;
    outputSymbol: string;
    outputAtomic: string;
  };
  settlement: {
    guarantee: { atomic?: boolean; class?: string; finalityClasses?: string[] };
    edges: SettlementEdge[];
  };
  evidence: { reserved: boolean; label: string; note: string };
  customerAuthorization?: {
    authorizationId: string;
    expiresAt: number;
    policyId: string;
    policyVersion: number;
  };
  submissionRef?: string | null;
  eventId?: string | null;
  failureReason?: string | null;
};

export type Scenario = { id: string; label: string };
export type MarketState = { id: string; sources: SourceStatus[]; reference: { available: boolean } };
export type HeroView = "customer" | "bank" | "api";
export type DevView = "request" | "response" | "events" | "source";
export type SimulatorKey = "balanced" | "oneWay90" | "lpDisappears" | "issuerDisappears" | "principalLimit" | "referenceOutage" | "chainCongestion" | "recovery";
export type SimulationResult = {
  requestedOrders: number;
  filledOrders: number;
  fillRatePct: number;
  volumeFillPct: number;
  routeComposition: Record<string, string>;
  rejections: { RISK_LIMIT: number; NO_LIQUIDITY: number };
  settlementFailures: number;
  peakPrincipalExposureAbs: string;
  principalHardLimit: string;
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  PRIVATE_MARKET: "Customer liquidity",
  ISSUER: "Issuer",
  INSTITUTIONAL_LP: "Institutional LP",
  NEOBANK: "Another institution",
  BANK_TREASURY: "Treasury",
  BANK_PRINCIPAL: "Bank balance sheet",
};

export const SCENARIO_COPY: Record<string, { title: string; short: string }> = {
  balanced: { title: "Balanced market", short: "All six source classes can compete." },
  lp_offline: { title: "LP offline", short: "The route rebuilds without the institutional LP." },
  issuer_policy_blocked: { title: "Issuer revoked", short: "The issuer is removed before price comparison." },
  treasury_near_limit: { title: "Treasury nearly used", short: "Only a small amount of treasury inventory remains." },
  principal_limit: { title: "Balance sheet at limit", short: "The configured principal limit has been reached." },
  reference_outage: { title: "Reference price unavailable", short: "The bank stops quoting its own balance sheet." },
};

export const SIMULATOR_OPTIONS: Array<{ id: SimulatorKey; label: string }> = [
  { id: "balanced", label: "Balanced flow" },
  { id: "oneWay90", label: "90% one-way" },
  { id: "lpDisappears", label: "LP disappears" },
  { id: "issuerDisappears", label: "Issuer disappears" },
  { id: "principalLimit", label: "Principal limit" },
  { id: "referenceOutage", label: "Reference outage" },
  { id: "chainCongestion", label: "Chain congestion" },
  { id: "recovery", label: "Outage + recovery" },
];

export function formatCurrency(value: string | number | undefined, currency: "BRL" | "EUR") {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const formatted = number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "BRL" ? `R$${formatted}` : `€${formatted}`;
}

export function formatAtomic(value: string, decimals = 6) {
  const atomic = BigInt(value || "0");
  const scale = 10n ** BigInt(decimals);
  return Number(atomic / scale).toLocaleString("en-US");
}

export function sanitizeAmount(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const [whole = "", ...fractions] = cleaned.split(".");
  const fraction = fractions.join("").slice(0, 2);
  return fractions.length > 0 ? `${whole || "0"}.${fraction}` : whole;
}

export function errorMessage(result: ApiResult) {
  const body = result.body as { error?: { message?: string } } | null;
  return result.error ?? body?.error?.message ?? `FX node returned ${result.status}`;
}
