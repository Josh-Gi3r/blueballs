import {
  CORRIDORS,
  JOURNEYS,
  money,
  type Corridor,
  type FinalityLeg,
  type InspectorView,
  type JourneyId,
  type ScenarioDetail,
  type ScenarioId,
  type SimulationState,
  type Source,
} from "./final-fx-definitions";

export function scenarioDetail(
  state: SimulationState,
  corridor: Corridor,
  sources: Source[],
): ScenarioDetail {
  const tokenLegDetail =
    state.executionPlane === "internal"
      ? "simulated internal transfer"
      : state.executionPlane === "external"
        ? "simulated external-venue state"
        : "simulated reference-contract result";

  const base: Record<ScenarioId, ScenarioDetail> = {
    normal: {
      title: "Normal simulated route",
      flow: [
        ["Customer request", "accepted", "done"],
        ["Policy check", "selected sources eligible", "done"],
        ["Source allocation", `${sources.length} sources selected`, "done"],
        ["Token leg", tokenLegDetail, "done"],
        [
          "Output leg",
          state.journey === "stable" ? "not required" : "simulated next step",
          "done",
        ],
      ],
      timeline: [
        ["Request created", "Amount, assets and customer limits recorded"],
        ["Sources evaluated", "Ineligible sources excluded"],
        ["Allocation calculated", "Full amount covered by simulated capacity"],
        ["Preview returned", "No money or capacity moved"],
      ],
      event: {
        event: "SIMULATED_QUOTE_READY",
        state: "PREVIEW",
        routeComplete: true,
        moneyMoved: false,
      },
      assurances: [
        [
          "Simulation only",
          "The page does not submit a payment or token transaction.",
        ],
        ["Illustrative capacity", "No real liquidity is reserved."],
        [
          "Inspector updates",
          "The request, route and event examples reflect the current selections.",
        ],
      ],
    },
    maker_offline: {
      title: "Professional maker unavailable",
      flow: [
        ["Customer request", "unchanged", "done"],
        ["Professional maker", "unavailable", "failed"],
        ["Route recalculated", "remaining sources reallocated", "done"],
        ["Customer quote", "new illustrative rate shown", "done"],
      ],
      timeline: [
        ["Source status changed", "Professional maker marked unavailable"],
        ["Eligibility refreshed", "Unavailable source removed"],
        ["Route recalculated", "Remaining sources reallocated"],
        ["New preview returned", "Customer can review the updated amount"],
      ],
      event: {
        event: "SOURCE_UNAVAILABLE",
        source: "professional_maker",
        action: "recalculate_route",
        quoteStatus: "REPRICED",
        moneyMoved: false,
      },
      assurances: [
        [
          "Unavailable source excluded",
          "The maker is removed before the new allocation is shown.",
        ],
        ["Quote is recalculated", "The previous price is not reused."],
        [
          "Treasury limit enforced",
          "Any replacement treasury allocation remains within its configured limit.",
        ],
      ],
    },
    issuer_revoked: {
      title: "Issuer authorisation revoked",
      flow: [
        ["Customer request", "unchanged", "done"],
        ["Issuer policy", "authorisation revoked", "failed"],
        ["Issuer liquidity", "excluded before pricing", "failed"],
        ["Customer quote", "recalculated from eligible sources", "done"],
      ],
      timeline: [
        ["Policy changed", "Issuer no longer authorised"],
        [
          "Eligibility checked again",
          "Issuer excluded before price comparison",
        ],
        ["Allocation recalculated", "Only eligible sources remain"],
        ["New preview returned", "No revoked source reaches token execution"],
      ],
      event: {
        event: "POLICY_AUTHORIZATION_REVOKED",
        source: "issuer",
        excludedBeforePricing: true,
        moneyMoved: false,
      },
      assurances: [
        [
          "Policy applied before pricing",
          "A revoked source is not treated as executable liquidity.",
        ],
        [
          "Remaining sources listed",
          "The allocation identifies every selected source.",
        ],
        ["Simulation only", "No money or liquidity moved."],
      ],
    },
    treasury_limit: {
      title: "Treasury limit reached",
      flow: [
        ["Customer request", "unchanged", "done"],
        ["Treasury capacity", "limit reached", "failed"],
        ["Alternative sources", "evaluated", "pending"],
        [
          "Customer result",
          sources.length >= 3
            ? "complete without treasury"
            : "no complete route",
          sources.length >= 3 ? "done" : "failed",
        ],
      ],
      timeline: [
        ["Exposure checked", "Open positions and reservations included"],
        ["Treasury excluded", "No additional balance-sheet capacity available"],
        ["Route recalculated", "Remaining sources evaluated"],
        [
          "Result returned",
          sources.length >= 3
            ? "Alternative route available"
            : "No quote available",
        ],
      ],
      event: {
        event: "PRINCIPAL_LIMIT_REACHED",
        source: "treasury",
        action: sources.length >= 3 ? "route_without_treasury" : "refuse_quote",
        moneyMoved: false,
      },
      assurances: [
        [
          "Exposure limit enforced",
          "A higher spread cannot override the configured limit.",
        ],
        [
          "Reservations included",
          "Active reservations reduce available treasury capacity.",
        ],
        [
          "Full coverage required",
          "No quote is returned unless the complete amount can be supported.",
        ],
      ],
    },
    quote_expired: {
      title: "Quote expired",
      flow: [
        ["Quote preview", "illustrative validity window", "done"],
        ["Expiration time", "reached", "failed"],
        ["Execution", "blocked", "failed"],
        ["Next action", "request a new quote", "pending"],
      ],
      timeline: [
        ["Preview created", "Customer amount and limits shown"],
        ["Expiry reached", "Previous rate no longer valid"],
        ["Execution blocked", "Expired quote cannot continue"],
        ["New quote required", "Sources and price must be evaluated again"],
      ],
      event: {
        event: "QUOTE_EXPIRED",
        state: "EXPIRED",
        action: "REPRICE",
        moneyMoved: false,
      },
      assurances: [
        ["Expired quote blocked", "The customer must receive a new quote."],
        [
          "Expiry enforced",
          "The validity period is part of the quote conditions.",
        ],
        ["No money moved", "The simulation stops before settlement."],
      ],
    },
    proof_replay: {
      title: "P2P payment proof replay detected",
      flow: [
        ["Payment intent", "created", "done"],
        ["Payment evidence", "reference #7291 submitted", "done"],
        ["Replay check", "payment identifier already used", "failed"],
        ["Token release", "rejected", "failed"],
        ["FX route", "not started", "pending"],
      ],
      timeline: [
        ["Intent created", "Offer and payment terms recorded"],
        ["Evidence submitted", "Payment reference #7291"],
        ["Replay detected", "Payment identifier already consumed"],
        [
          "Token release rejected",
          "No stablecoin released and no FX trade created",
        ],
        [
          "Manual resolution may be required",
          "The external fiat payment remains a separate issue",
        ],
      ],
      event: {
        event: "PAYMENT_REPLAY",
        paymentReference: "#7291",
        action: "REJECT_TOKEN_RELEASE",
        fxTradeCreated: false,
        externalFiatMayExist: true,
      },
      assurances: [
        [
          "No second token release",
          "One payment identifier cannot release tokens twice.",
        ],
        ["No FX trade created", "The token exchange does not start."],
        [
          "External payment tracked separately",
          "Support may still need to resolve the off-chain payment.",
        ],
      ],
    },
    payout_pending: {
      title: "External payout pending",
      flow: [
        ["Input available", "confirmed", "done"],
        [
          "Token exchange",
          `${corridor.fromToken} → ${corridor.toToken} marked complete in simulation`,
          "done",
        ],
        ["External payout", "submitted", "pending"],
        ["Customer transaction", "reconciling", "pending"],
      ],
      timeline: [
        ["Token result", "Simulation marks the token leg complete"],
        ["Payout submitted", "External reference recorded"],
        ["Confirmation pending", "No final payout evidence received"],
        ["No automatic resubmission", "Duplicate payout risk avoided"],
      ],
      event: {
        event: "PAYOUT_PENDING",
        tokenFx: "SIMULATED_COMPLETE",
        payout: "SUBMITTED",
        transaction: "RECONCILING",
        retry: false,
      },
      assurances: [
        [
          "Separate states",
          "Token settlement and fiat payout are tracked independently.",
        ],
        [
          "Pending remains pending",
          "The route is not marked successful or failed without evidence.",
        ],
        [
          "No automatic resubmission",
          "The expected operator action is to reconcile, not submit another payout.",
        ],
      ],
    },
    reference_outage: {
      title: "Reference price unavailable",
      flow: [
        ["Customer request", "received", "done"],
        ["Reference price", "unavailable", "failed"],
        ["Treasury source", "removed", "failed"],
        ["Independent sources", "evaluated separately", "pending"],
        [
          "Customer result",
          sources.length ? "route without treasury" : "no complete route",
          sources.length ? "done" : "failed",
        ],
      ],
      timeline: [
        ["Reference price unavailable", "Treasury pricing disabled"],
        ["Treasury source removed", "No fallback rate assumed"],
        [
          "Allocation recalculated",
          "Independently priced orders and issuer quotes remain eligible",
        ],
        [
          "Result returned",
          sources.length ? "Alternative route available" : "No quote available",
        ],
      ],
      event: {
        event: "REFERENCE_PRICE_UNAVAILABLE",
        source: "treasury",
        action: sources.length ? "route_without_treasury" : "NO_ROUTE",
        moneyMoved: false,
      },
      assurances: [
        [
          "No fallback rate",
          "Treasury pricing stops when the reference price is unavailable.",
        ],
        [
          "Independent sources retained",
          "Signed orders and firm quotes can still be considered on their own terms.",
        ],
        [
          "Full coverage required",
          "No quote is returned when the requested amount cannot be supported.",
        ],
      ],
    },
  };
  return base[state.scenario];
}

export function inspectorPayload(
  view: InspectorView,
  state: SimulationState,
  corridor: Corridor,
  output: number,
  sources: Source[],
  legs: FinalityLeg[],
  scenario: ScenarioDetail,
  status: { label: string; complete: boolean },
) {
  const values: Record<
    InspectorView,
    { label: string; status: string; value: string }
  > = {
    request: {
      label: "WEBSITE SIMULATION INPUT",
      status: status.label,
      value: JSON.stringify(
        {
          simulation: true,
          corridor: `${corridor.from}/${corridor.to}`,
          amount: state.amount.toFixed(2),
          tokenPair: `${corridor.fromToken}/${corridor.toToken}`,
          fxSetup: state.journey,
        },
        null,
        2,
      ),
    },
    route: {
      label: "EXAMPLE ROUTE OBJECT",
      status: status.label,
      value: JSON.stringify(
        {
          object: "fx_trade_preview",
          state: status.complete ? "PREVIEW" : "STOPPED",
          customer: {
            sends: money(corridor, state.amount, "from"),
            receives: status.complete ? money(corridor, output, "to") : null,
          },
          tokenRoute: `${corridor.fromToken} → ${corridor.toToken}`,
          allocations: sources.map((source) => ({
            source: source.label,
            sharePct: Number(source.pct.toFixed(2)),
            output: money(corridor, (output * source.pct) / 100, "to"),
          })),
          reservation: "SIMULATED_ONLY",
        },
        null,
        2,
      ),
    },
    policy: {
      label: "EXAMPLE POLICY DECISION",
      status:
        state.scenario === "issuer_revoked" ? "SOURCE EXCLUDED" : "ELIGIBLE",
      value: JSON.stringify(
        {
          rule: "COMPLIANCE_PRECEDES_LIQUIDITY",
          customer: "eligible",
          account: "eligible",
          corridor: `${corridor.from}/${corridor.to}`,
          ticket: state.amount,
          excludedSources:
            state.scenario === "issuer_revoked"
              ? ["issuer"]
              : state.scenario === "maker_offline"
                ? ["professional_maker"]
                : [],
          note: "Only eligible sources are included in price comparison.",
        },
        null,
        2,
      ),
    },
    finality: {
      label: "EXAMPLE SETTLEMENT GRAPH",
      status:
        legs.length === 1
          ? legs[0].class
          : new Set(legs.map((leg) => leg.class)).size === 1
            ? legs[0].class
            : "MIXED_FINALITY",
      value: JSON.stringify(
        {
          guarantee:
            legs.length === 1
              ? legs[0].class
              : new Set(legs.map((leg) => leg.class)).size === 1
                ? legs[0].class
                : "MIXED_FINALITY",
          edges: legs.map((leg) => ({
            edge: leg.label,
            mechanism: leg.type,
            finality: leg.class,
          })),
          singleAtomicBoundaryInReferenceModel:
            legs.length === 1 && legs[0].atomic === true,
        },
        null,
        2,
      ),
    },
    events: {
      label: "EXAMPLE EVENTS",
      status: scenario.event.event,
      value: JSON.stringify(
        [
          { type: "trade.preview.created", simulated: true },
          { type: "policy.eligibility.checked", simulated: true },
          {
            type: scenario.event.event.toLowerCase(),
            ...scenario.event,
            simulated: true,
          },
        ],
        null,
        2,
      ),
    },
    source: {
      label: "SOURCE PACKAGES",
      status: "WEBSITE SIMULATION",
      value: [
        "Website: fixed simulation; no backend calls",
        "Private market: packages/fx-market",
        "Cross-source routing: packages/fx-liquidity",
        "Participation policy: packages/fx-policy",
        "Principal pricing and risk: packages/fx-pricing",
        "Fiat intent and evidence: packages/fx-fiat",
        "Atomic token contracts: packages/fx-contracts",
        "Reference runtime: apps/fx-node",
        "",
        "The website does not call the reference runtime or token contracts.",
        "Commercial provider, issuer, P2P and production execution adapters are not connected.",
      ].join("\n"),
    },
  };
  return values[view];
}

export function setJourneyState(
  current: SimulationState,
  journeyId: JourneyId,
): SimulationState {
  const journey = JOURNEYS[journeyId];
  let corridor = current.corridor;
  let amount = current.amount;
  if (journeyId === "stable") {
    corridor = "usdc-eurc";
    amount = CORRIDORS[corridor].defaultAmount;
  } else if (corridor === "usdc-eurc") {
    corridor = "usd-eur";
    amount = CORRIDORS[corridor].defaultAmount;
  }
  return {
    ...current,
    journey: journeyId,
    corridor,
    amount,
    fiatPlane: journey.fiat,
    liquidityPlane: journey.liquidity,
    executionPlane: journey.execution,
    scenario: "normal",
    journeyStep: 0,
    journeyPlaying: true,
  };
}
