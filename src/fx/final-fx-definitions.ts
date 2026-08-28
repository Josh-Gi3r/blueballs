export type CorridorId = "usd-eur" | "eur-brl" | "usdc-eurc";
export type JourneyId =
  "hybrid" | "own" | "provider" | "issuer" | "p2p" | "stable";
export type ScenarioId =
  | "normal"
  | "maker_offline"
  | "issuer_revoked"
  | "treasury_limit"
  | "quote_expired"
  | "proof_replay"
  | "payout_pending"
  | "reference_outage";
export type LiquidityPlaneId =
  "mixed" | "customer" | "issuer-heavy" | "institutional" | "external";
export type FiatPlaneId =
  "hybrid" | "own" | "provider" | "issuer" | "bank" | "p2p" | "none";
export type ExecutionPlaneId = "blueballs" | "internal" | "external";
export type InspectorView =
  "request" | "route" | "policy" | "finality" | "events" | "source";
export type CapabilityTone =
  "built" | "reference" | "not-connected" | "simulated";
export type FlowTone = "done" | "failed" | "pending";

export type Corridor = {
  id: CorridorId;
  from: string;
  to: string;
  fromToken: string;
  toToken: string;
  fromSymbol: string;
  toSymbol: string;
  rate: number;
  defaultAmount: number;
  pairLabel: string;
  illustrativeSpreadBps: number;
};

export type Journey = {
  label: string;
  title: string;
  summary: string;
  status: Array<[string, CapabilityTone]>;
  fiat: FiatPlaneId;
  liquidity: LiquidityPlaneId;
  execution: ExecutionPlaneId;
};

export type Source = {
  id: "customer" | "issuer" | "maker" | "treasury" | "external";
  label: string;
  pct: number;
  type: string;
  rateAdj: number;
};

export type JourneyStep = {
  owner: string;
  title: string;
  detail: string;
  finality: string;
  kind?: "core";
};

export type FinalityLeg = {
  kick: string;
  label: string;
  type: string;
  class: string;
  atomic?: boolean;
};

export type ScenarioDetail = {
  title: string;
  flow: Array<[string, string, FlowTone]>;
  timeline: Array<[string, string]>;
  event: Record<string, unknown> & { event: string };
  assurances: Array<[string, string]>;
};

export type SimulationState = {
  corridor: CorridorId;
  amount: number;
  journey: JourneyId;
  scenario: ScenarioId;
  customerLiquidity: boolean;
  inspector: InspectorView;
  journeyStep: number;
  journeyPlaying: boolean;
  fiatPlane: FiatPlaneId;
  liquidityPlane: LiquidityPlaneId;
  executionPlane: ExecutionPlaneId;
};

export const CORRIDORS: Record<CorridorId, Corridor> = {
  "usd-eur": {
    id: "usd-eur",
    from: "USD",
    to: "EUR",
    fromToken: "USDC",
    toToken: "EURC",
    fromSymbol: "$",
    toSymbol: "€",
    rate: 0.9238,
    defaultAmount: 10_000,
    pairLabel: "USDC / EURC",
    illustrativeSpreadBps: 18,
  },
  "eur-brl": {
    id: "eur-brl",
    from: "EUR",
    to: "BRL",
    fromToken: "EURC",
    toToken: "BRLT",
    fromSymbol: "€",
    toSymbol: "R$",
    rate: 6.19,
    defaultAmount: 25_000,
    pairLabel: "EURC / BRLT",
    illustrativeSpreadBps: 24,
  },
  "usdc-eurc": {
    id: "usdc-eurc",
    from: "USDC",
    to: "EURC",
    fromToken: "USDC",
    toToken: "EURC",
    fromSymbol: "",
    toSymbol: "",
    rate: 0.9252,
    defaultAmount: 50_000,
    pairLabel: "USDC / EURC",
    illustrativeSpreadBps: 11,
  },
};

export const JOURNEYS: Record<JourneyId, Journey> = {
  hybrid: {
    label: "Internal + external",
    title: "Internal input account with an external payout",
    summary:
      "The customer starts from an account in your institution. Customer orders, issuer liquidity, a professional maker and treasury may supply the quote. A provider or bank rail handles the payout when the recipient is outside your ledger.",
    status: [
      ["SIMULATION", "simulated"],
      ["ROUTING IMPLEMENTED", "built"],
      ["EXTERNAL ADAPTERS NOT CONNECTED", "not-connected"],
    ],
    fiat: "hybrid",
    liquidity: "mixed",
    execution: "blueballs",
  },
  own: {
    label: "Internal accounts",
    title: "Internal accounts on both sides",
    summary:
      "Your ledger records the input debit and output credit. Blueballs applies policy and selects liquidity for the token FX leg between those two ledger entries.",
    status: [
      ["SIMULATION", "simulated"],
      ["LEDGER MODEL IMPLEMENTED", "built"],
      ["TOKEN CONTRACTS REFERENCE", "reference"],
    ],
    fiat: "own",
    liquidity: "mixed",
    execution: "blueballs",
  },
  provider: {
    label: "Payments provider",
    title: "Provider handles deposits and payouts",
    summary:
      "A banking or payments provider, such as Bridge, may handle onboarding, virtual accounts, fiat deposits and payout rails. Blueballs handles policy, source selection, the FX route and transaction state between those external legs.",
    status: [
      ["SIMULATION", "simulated"],
      ["PROVIDER FLOW REFERENCE", "reference"],
      ["COMMERCIAL ADAPTER NOT CONNECTED", "not-connected"],
    ],
    fiat: "provider",
    liquidity: "mixed",
    execution: "blueballs",
  },
  issuer: {
    label: "Issuer mint / redeem",
    title: "Issuer mint and redemption",
    summary:
      "An issuer makes the input stablecoin available after receiving fiat. Blueballs routes the stablecoin exchange. The output issuer or a payout provider then redeems the output and pays the recipient.",
    status: [
      ["SIMULATION", "simulated"],
      ["FIAT SETTLEMENT MODEL REFERENCE", "reference"],
      ["ISSUER ADAPTER NOT CONNECTED", "not-connected"],
    ],
    fiat: "issuer",
    liquidity: "issuer-heavy",
    execution: "blueballs",
  },
  p2p: {
    label: "Open P2P",
    title: "Verified P2P payment and token release",
    summary:
      "A Peer-style venue can publish stablecoin inventory, accepted fiat methods, rates and limits. A payment intent reserves the offer. Accepted payment evidence releases the stablecoin, which can then enter the Blueballs FX market.",
    status: [
      ["SIMULATION", "simulated"],
      ["FIAT EVIDENCE MODEL REFERENCE", "reference"],
      ["P2P ADAPTER NOT CONNECTED", "not-connected"],
    ],
    fiat: "p2p",
    liquidity: "mixed",
    execution: "blueballs",
  },
  stable: {
    label: "Stablecoin-only",
    title: "Token-to-token exchange",
    summary:
      "The customer starts and ends with stablecoins. The route goes directly to the FX market, with no fiat deposit, mint, redemption or payout leg.",
    status: [
      ["SIMULATION", "simulated"],
      ["MARKET AND ROUTING IMPLEMENTED", "built"],
      ["ON-CHAIN EXECUTION REFERENCE", "reference"],
    ],
    fiat: "none",
    liquidity: "mixed",
    execution: "blueballs",
  },
};

export const FIAT_OPTIONS: Record<FiatPlaneId, string> = {
  hybrid: "Internal input account + external payout",
  own: "Internal verified accounts",
  provider: "Banking or payments provider",
  issuer: "Issuer mint and redemption",
  bank: "External bank transfer",
  p2p: "Open P2P payment and token release",
  none: "No fiat leg",
};

export const LIQUIDITY_OPTIONS: Record<LiquidityPlaneId, string> = {
  mixed: "Mixed private and institutional sources",
  customer: "Customer and business orders",
  "issuer-heavy": "Issuer-led liquidity",
  institutional: "Institutional quotes and treasury",
  external: "External venue + treasury fallback",
};

export const EXECUTION_OPTIONS: Record<ExecutionPlaneId, string> = {
  blueballs: "Blueballs reference token contracts",
  internal: "Internal token transfer",
  external: "Approved external execution venue",
};

export const BASE_SOURCES: Source[] = [
  {
    id: "customer",
    label: "Customer orders",
    pct: 20,
    type: "PRIVATE ORDER",
    rateAdj: -2,
  },
  {
    id: "issuer",
    label: "Issuer liquidity",
    pct: 25,
    type: "ISSUER INVENTORY",
    rateAdj: 0,
  },
  {
    id: "maker",
    label: "Professional maker",
    pct: 35,
    type: "FIRM QUOTE",
    rateAdj: 2,
  },
  {
    id: "treasury",
    label: "Treasury",
    pct: 15,
    type: "LIMITED PRINCIPAL",
    rateAdj: 5,
  },
  {
    id: "external",
    label: "External venue",
    pct: 5,
    type: "EXTERNAL QUOTE",
    rateAdj: 8,
  },
];

export const SCENARIO_CATALOG: Record<
  ScenarioId,
  { label: string; short: string }
> = {
  normal: { label: "Normal", short: "All selected sources are available." },
  maker_offline: {
    label: "Maker unavailable",
    short: "The route is recalculated without the professional maker.",
  },
  issuer_revoked: {
    label: "Issuer authorisation revoked",
    short: "The issuer is excluded before prices are compared.",
  },
  treasury_limit: {
    label: "Treasury limit reached",
    short: "No additional principal capacity is available.",
  },
  quote_expired: {
    label: "Quote expired",
    short: "A new quote is required before execution.",
  },
  proof_replay: {
    label: "Payment proof replay",
    short: "The payment identifier has already been used.",
  },
  payout_pending: {
    label: "Payout pending",
    short:
      "The token exchange is complete but the external payout is not final.",
  },
  reference_outage: {
    label: "Reference price unavailable",
    short:
      "Principal pricing stops until a valid reference price is available.",
  },
};

export const INITIAL_STATE: SimulationState = {
  corridor: "usd-eur",
  amount: 10_000,
  journey: "hybrid",
  scenario: "normal",
  customerLiquidity: true,
  inspector: "request",
  journeyStep: 0,
  journeyPlaying: true,
  fiatPlane: "hybrid",
  liquidityPlane: "mixed",
  executionPlane: "blueballs",
};

export const formatNumber = (value: number, digits = 2) =>
  Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const money = (
  corridor: Corridor,
  value: number,
  side: "from" | "to" = "from",
) => {
  const code = side === "from" ? corridor.from : corridor.to;
  const symbol = side === "from" ? corridor.fromSymbol : corridor.toSymbol;
  if (code === "USDC" || code === "EURC")
    return `${formatNumber(value, 2)} ${code}`;
  return `${symbol}${formatNumber(value, 2)}`;
};

export const tokenMoney = (code: string, value: number) =>
  `${formatNumber(value, 2)} ${code}`;
