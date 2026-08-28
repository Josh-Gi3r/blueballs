import {
  BASE_SOURCES,
  type Corridor,
  type FinalityLeg,
  type JourneyId,
  type JourneyStep,
  type LiquidityPlaneId,
  type ScenarioId,
  type SimulationState,
  type Source,
} from "./final-fx-definitions";

export function outputAmount(state: SimulationState, corridor: Corridor) {
  const penalty: Record<ScenarioId, number> = {
    normal: 0,
    maker_offline: 0.0011,
    issuer_revoked: 0.0016,
    treasury_limit: 0.0008,
    quote_expired: 0,
    proof_replay: 0,
    payout_pending: 0,
    reference_outage: 0.0032,
  };
  return state.amount * corridor.rate * (1 - penalty[state.scenario]);
}

export function selectedSources(state: SimulationState) {
  const profiles: Record<LiquidityPlaneId, Record<Source["id"], number>> = {
    mixed: { customer: 20, issuer: 25, maker: 35, treasury: 15, external: 5 },
    customer: {
      customer: 48,
      issuer: 18,
      maker: 19,
      treasury: 10,
      external: 5,
    },
    "issuer-heavy": {
      customer: 10,
      issuer: 50,
      maker: 25,
      treasury: 10,
      external: 5,
    },
    institutional: {
      customer: 0,
      issuer: 20,
      maker: 48,
      treasury: 27,
      external: 5,
    },
    external: {
      customer: 5,
      issuer: 12,
      maker: 18,
      treasury: 10,
      external: 55,
    },
  };

  const profile = profiles[state.liquidityPlane];
  let sources = BASE_SOURCES.map((source) => ({
    ...source,
    pct: profile[source.id],
  })).filter((source) => source.pct > 0);
  if (!state.customerLiquidity)
    sources = sources.filter((source) => source.id !== "customer");
  if (state.scenario === "maker_offline")
    sources = sources.filter((source) => source.id !== "maker");
  if (state.scenario === "issuer_revoked")
    sources = sources.filter((source) => source.id !== "issuer");
  if (
    state.scenario === "treasury_limit" ||
    state.scenario === "reference_outage"
  ) {
    sources = sources.filter((source) => source.id !== "treasury");
  }
  if (state.scenario === "quote_expired" || state.scenario === "proof_replay")
    return [];

  const total = sources.reduce((sum, source) => sum + source.pct, 0);
  if (total <= 0) return [];
  return sources.map((source) => ({
    ...source,
    pct: (source.pct / total) * 100,
  }));
}

export function routeStatus(state: SimulationState, sources: Source[]) {
  if (state.scenario === "quote_expired")
    return { label: "QUOTE EXPIRED", complete: false };
  if (state.scenario === "proof_replay")
    return { label: "PAYMENT PROOF REJECTED", complete: false };
  if (state.scenario === "payout_pending")
    return { label: "PAYOUT PENDING", complete: true };
  if (state.scenario === "reference_outage" && sources.length < 3) {
    return { label: "NO COMPLETE ROUTE", complete: false };
  }
  return { label: "SIMULATED QUOTE READY", complete: true };
}

export function executionCoreStep(
  state: SimulationState,
  corridor: Corridor,
): JourneyStep {
  if (state.executionPlane === "internal") {
    return {
      owner: "YOUR INSTITUTION",
      title: `${corridor.fromToken} → ${corridor.toToken}`,
      detail:
        "The institution records the token exchange on its own ledger. It is not an on-chain atomic transaction.",
      kind: "core",
      finality: "AUTHORITATIVE LEDGER",
    };
  }
  if (state.executionPlane === "external") {
    return {
      owner: "EXTERNAL VENUE",
      title: `${corridor.fromToken} → ${corridor.toToken}`,
      detail:
        "An approved external venue executes the token leg. The route remains pending until that venue supplies confirmation evidence.",
      kind: "core",
      finality: "EXTERNAL EXECUTION",
    };
  }
  return {
    owner: "BLUEBALLS",
    title: `${corridor.fromToken} → ${corridor.toToken}`,
    detail:
      "The router selects eligible customer orders, issuer inventory, professional quotes and treasury capacity. The reference contracts define the atomic settlement boundary, but this website does not submit a transaction.",
    kind: "core",
    finality: "REFERENCE ATOMIC BOUNDARY",
  };
}

export function buildJourneySteps(
  state: SimulationState,
  corridor: Corridor,
): JourneyStep[] {
  const commonFx = executionCoreStep(state, corridor);
  const byJourney: Record<JourneyId, JourneyStep[]> = {
    hybrid: [
      {
        owner: "YOUR INSTITUTION",
        title: "Customer and account verified",
        detail:
          "The institution can attribute the customer and account. Account, corridor and ticket-size rules are applied to the exchange request.",
        finality: "POLICY + ACCOUNT STATE",
      },
      {
        owner: "YOUR LEDGER",
        title: `${corridor.from} balance available`,
        detail:
          "An internal balance or a confirmed deposit makes the input amount available for the route.",
        finality: "AUTHORITATIVE LEDGER",
      },
      commonFx,
      {
        owner: "PAYOUT ADAPTER",
        title: `${corridor.to} payout submitted`,
        detail:
          "The output is sent to the selected payout provider or recipient account. Submission is not final until the required evidence is received.",
        finality: "ASYNC EXTERNAL",
      },
      {
        owner: "BLUEBALLS",
        title: "Reconcile each route leg",
        detail:
          "Each leg is updated from its own confirmation evidence. An unconfirmed result remains unconfirmed and is not retried automatically.",
        finality: "MIXED FINALITY",
      },
    ],
    own: [
      {
        owner: "YOUR INSTITUTION",
        title: "Customer requests an exchange",
        detail:
          "The input and output accounts are held by the institution and attributed to known customers or businesses.",
        finality: "POLICY",
      },
      {
        owner: "YOUR LEDGER",
        title: `${corridor.from} account debit`,
        detail:
          "The institution records the input-side debit on its authoritative ledger.",
        finality: "AUTHORITATIVE LEDGER",
      },
      commonFx,
      {
        owner: "YOUR LEDGER",
        title: `${corridor.to} account credit`,
        detail:
          "The output account is credited after the exchange reaches the settlement state required by the institution.",
        finality: "AUTHORITATIVE LEDGER",
      },
    ],
    provider: [
      {
        owner: "PROVIDER",
        title: "Customer approved",
        detail:
          "A banking or payments provider may perform KYC or KYB and create the required account or payment instructions.",
        finality: "EXTERNAL PROVIDER STATE",
      },
      {
        owner: "PROVIDER",
        title: `${corridor.from} deposit confirmed`,
        detail:
          "The provider confirms receipt of the input funds and makes the input stablecoin available. Supported assets and timing depend on the provider integration.",
        finality: "ASYNC EXTERNAL",
      },
      commonFx,
      {
        owner: "PROVIDER",
        title: `${corridor.to} payout submitted`,
        detail:
          "The provider or connected bank rail starts the recipient payout.",
        finality: "ASYNC EXTERNAL",
      },
      {
        owner: "BLUEBALLS",
        title: "Reconcile provider events",
        detail:
          "Deposit confirmation, token FX and payout confirmation remain separate route states even when the customer sees one transaction.",
        finality: "MIXED FINALITY",
      },
    ],
    issuer: [
      {
        owner: "ISSUER",
        title: `${corridor.from} deposit confirmed`,
        detail:
          "The issuer confirms eligible input funds or an approved account balance before minting tokenised value.",
        finality: "ISSUER EVIDENCE",
      },
      {
        owner: "ISSUER",
        title: `${corridor.fromToken} minted`,
        detail:
          "Minting is a separate settlement leg. The FX route starts only after executable token value is available.",
        finality: "ATTESTED EXTERNAL",
      },
      commonFx,
      {
        owner: "ISSUER",
        title: `${corridor.toToken} redemption accepted`,
        detail:
          "The output stablecoin is submitted for redemption under the issuer’s limits, cut-offs and confirmation process.",
        finality: "ASYNC EXTERNAL",
      },
      {
        owner: "PAYOUT RAIL",
        title: `${corridor.to} payout confirmed`,
        detail:
          "The recipient receives fiat after the issuer or payout provider confirms the external payment leg.",
        finality: "ASYNC EXTERNAL",
      },
    ],
    p2p: [
      {
        owner: "EXTERNAL PEER",
        title: `${corridor.fromToken} offer published`,
        detail:
          "A peer publishes the available stablecoin amount, accepted fiat methods, rate and order limits. This is a fiat-to-token offer, not a token-FX order.",
        finality: "P2P CAPACITY",
      },
      {
        owner: "CUSTOMER",
        title: "Payment intent created",
        detail:
          "The selected offer, fiat amount, token amount, payee and expiry are bound before the customer sends the external payment.",
        finality: "RESERVED INTENT",
      },
      {
        owner: "EXTERNAL VERIFIER",
        title: `${corridor.from} payment verified`,
        detail:
          "A permitted verifier confirms the specific external payment. Reused, mismatched or expired evidence cannot authorise token release.",
        finality: "ATTESTED EXTERNAL",
      },
      {
        owner: "P2P ESCROW",
        title: `${corridor.fromToken} released`,
        detail:
          "The stablecoin is released after the payment evidence is accepted. The released balance can then enter the Blueballs FX market.",
        finality: "CONDITIONAL TOKEN RELEASE",
      },
      commonFx,
      {
        owner: "EXIT ADAPTER",
        title: `${corridor.toToken} → ${corridor.to}`,
        detail:
          "A separate issuer redemption, provider payout or P2P off-ramp is required before the recipient receives fiat.",
        finality: "ASYNC EXTERNAL",
      },
    ],
    stable: [
      {
        owner: "CUSTOMER WALLET",
        title: `${corridor.fromToken} available`,
        detail:
          "The customer already holds the input token. No fiat deposit or minting leg is required.",
        finality: "TOKEN BALANCE",
      },
      commonFx,
      {
        owner: "CUSTOMER WALLET",
        title: `${corridor.toToken} delivered`,
        detail:
          "The output remains on-chain or in a supported token account. There is no external fiat payout to reconcile.",
        finality: "TOKEN DELIVERY",
      },
    ],
  };
  return byJourney[state.journey];
}

export function executionFinalityLeg(
  state: SimulationState,
  corridor: Corridor,
): FinalityLeg {
  if (state.executionPlane === "internal") {
    return {
      kick: "TOKEN LEG",
      label: `${corridor.fromToken} → ${corridor.toToken}`,
      type: "internal token transfer",
      class: "AUTHORITATIVE LEDGER",
      atomic: false,
    };
  }
  if (state.executionPlane === "external") {
    return {
      kick: "TOKEN LEG",
      label: `${corridor.fromToken} → ${corridor.toToken}`,
      type: "external execution venue",
      class: "ASYNC EXTERNAL",
      atomic: false,
    };
  }
  return {
    kick: "TOKEN LEG",
    label: `${corridor.fromToken} → ${corridor.toToken}`,
    type: "selected token fills",
    class: "ATOMIC · REFERENCE",
    atomic: true,
  };
}

export function finalityLegs(
  state: SimulationState,
  corridor: Corridor,
): FinalityLeg[] {
  const core = executionFinalityLeg(state, corridor);
  if (state.journey === "stable") return [core];
  if (state.journey === "own") {
    return [
      {
        kick: "INPUT LEG",
        label: `${corridor.from} account debit`,
        type: "internal ledger entry",
        class: "AUTHORITATIVE LEDGER",
      },
      core,
      {
        kick: "OUTPUT LEG",
        label: `${corridor.to} account credit`,
        type: "internal ledger entry",
        class: "AUTHORITATIVE LEDGER",
      },
    ];
  }
  if (state.journey === "issuer") {
    return [
      {
        kick: "INPUT LEG",
        label: `${corridor.from} → ${corridor.fromToken}`,
        type: "issuer mint",
        class: "ATTESTED EXTERNAL",
      },
      core,
      {
        kick: "OUTPUT LEG",
        label: `${corridor.toToken} → ${corridor.to}`,
        type: "issuer redemption and payout",
        class: "ASYNC EXTERNAL",
      },
    ];
  }
  if (state.journey === "p2p") {
    return [
      {
        kick: "INPUT LEG",
        label: `${corridor.from} payment → ${corridor.fromToken}`,
        type: "verified P2P payment and token release",
        class: "ATTESTED EXTERNAL",
      },
      core,
      {
        kick: "OUTPUT LEG",
        label: `${corridor.toToken} → ${corridor.to}`,
        type: "redemption or payout adapter",
        class: "ASYNC EXTERNAL",
      },
    ];
  }
  return [
    {
      kick: "INPUT LEG",
      label: `${corridor.from} → ${corridor.fromToken}`,
      type:
        state.journey === "provider"
          ? "provider-confirmed deposit"
          : "account or provider funding",
      class: "ASYNC EXTERNAL",
    },
    core,
    {
      kick: "OUTPUT LEG",
      label: `${corridor.toToken} → ${corridor.to}`,
      type: "external payout",
      class: "ASYNC EXTERNAL",
    },
  ];
}

export function availableScenarios(journey: JourneyId): ScenarioId[] {
  const ids: ScenarioId[] = [
    "normal",
    "maker_offline",
    "issuer_revoked",
    "treasury_limit",
    "quote_expired",
    "reference_outage",
  ];
  if (journey === "p2p") ids.splice(5, 0, "proof_replay");
  if (["hybrid", "provider", "issuer", "p2p"].includes(journey))
    ids.push("payout_pending");
  return ids;
}
