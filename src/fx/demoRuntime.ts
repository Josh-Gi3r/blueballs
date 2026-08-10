import type {
  MarketState,
  PublicTrade,
  Scenario,
  SettlementEdge,
  SourceAllocation,
  SourceStatus,
  SourceType,
} from "./model";

type DemoApiResult = {
  ok: boolean;
  status: number;
  ms: number;
  body: unknown;
  error?: string;
};

type SourceDefinition = {
  type: SourceType;
  sourceId: string;
  label: string;
  rate: number;
  capacityEur: number;
  reason: string;
};

const SCENARIOS: Scenario[] = [
  { id: "balanced", label: "Balanced reference market" },
  { id: "lp_offline", label: "Institutional LP offline" },
  { id: "issuer_policy_blocked", label: "Issuer authorisation revoked" },
  { id: "treasury_near_limit", label: "Treasury inventory nearly exhausted" },
  { id: "principal_limit", label: "Bank principal at its hard limit" },
  { id: "reference_outage", label: "Reference pricing unavailable" },
];

const SOURCES: SourceDefinition[] = [
  {
    type: "PRIVATE_MARKET",
    sourceId: "customer-liquidity",
    label: "Customer liquidity",
    rate: 6.035,
    capacityEur: 1_250,
    reason: "SIGNED_AND_POLICY_AUTHORISED",
  },
  {
    type: "ISSUER",
    sourceId: "eurc-issuer",
    label: "Issuer",
    rate: 6.045,
    capacityEur: 1_500,
    reason: "POLICY_AUTHORISED",
  },
  {
    type: "NEOBANK",
    sourceId: "regional-bank",
    label: "Another institution",
    rate: 6.06,
    capacityEur: 900,
    reason: "POLICY_AUTHORISED",
  },
  {
    type: "INSTITUTIONAL_LP",
    sourceId: "institutional-lp",
    label: "Institutional LP",
    rate: 6.07,
    capacityEur: 1_800,
    reason: "POLICY_AUTHORISED",
  },
  {
    type: "BANK_TREASURY",
    sourceId: "bank-treasury",
    label: "Treasury",
    rate: 6.08,
    capacityEur: 1_200,
    reason: "WITHIN_INVENTORY_LIMIT",
  },
  {
    type: "BANK_PRINCIPAL",
    sourceId: "bank-principal",
    label: "Bank balance sheet",
    rate: 6.095,
    capacityEur: 5_000,
    reason: "WITHIN_RISK_LIMIT",
  },
];

const SETTLEMENT_EDGES: SettlementEdge[] = [
  {
    edgeId: "demo-pix-payment",
    edgeType: "VERIFIED_FIAT_PAYMENT",
    finalityClass: "ATTESTED_EXTERNAL",
    fromAsset: "BRL",
    toAsset: "BRLX",
    providerId: "demo-pix",
  },
  {
    edgeId: "demo-token-fx",
    edgeType: "TOKEN_SWAP",
    finalityClass: "ATOMIC",
    fromAsset: "BRLX",
    toAsset: "EURC",
    providerId: "blueballs-router",
  },
  {
    edgeId: "demo-eur-redemption",
    edgeType: "ISSUER_REDEEM",
    finalityClass: "ASYNC_EXTERNAL",
    fromAsset: "EURC",
    toAsset: "EUR",
    providerId: "demo-eur-issuer",
  },
];

let activeScenario = "balanced";
let serial = 0;
const trades = new Map<string, PublicTrade>();

function wait(ms = 90) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ok(body: unknown, status = 200, ms = 90): DemoApiResult {
  return { ok: true, status, ms, body };
}

function fail(message: string, status = 400, code = "DEMO_ERROR", details?: unknown): DemoApiResult {
  return {
    ok: false,
    status,
    ms: 90,
    body: { error: { code, message, ...(details === undefined ? {} : { details }) } },
  };
}

function atomic(value: number, decimals = 6) {
  return Math.round(value * (10 ** decimals)).toString();
}

function money(value: number) {
  return value.toFixed(2);
}

function scenarioSource(definition: SourceDefinition): SourceDefinition & { eligible: boolean; statusReason: string } {
  let eligible = true;
  let capacityEur = definition.capacityEur;
  let statusReason = definition.reason;

  if (activeScenario === "lp_offline" && definition.type === "INSTITUTIONAL_LP") {
    eligible = false;
    capacityEur = 0;
    statusReason = "SOURCE_OFFLINE";
  }
  if (activeScenario === "issuer_policy_blocked" && definition.type === "ISSUER") {
    eligible = false;
    statusReason = "AUTHORISATION_REVOKED";
  }
  if (activeScenario === "treasury_near_limit" && definition.type === "BANK_TREASURY") {
    capacityEur = 200;
    statusReason = "NEAR_INVENTORY_LIMIT";
  }
  if (activeScenario === "principal_limit" && definition.type === "BANK_PRINCIPAL") {
    capacityEur = 300;
    statusReason = "NEAR_RISK_LIMIT";
  }
  if (activeScenario === "reference_outage" && definition.type === "BANK_PRINCIPAL") {
    eligible = false;
    capacityEur = 0;
    statusReason = "REFERENCE_PRICE_UNAVAILABLE";
  }

  return { ...definition, eligible, capacityEur, statusReason };
}

function sourceStatus(): SourceStatus[] {
  return SOURCES.map(scenarioSource).map((source) => ({
    sourceType: source.type,
    sourceId: source.sourceId,
    label: source.label,
    eligible: source.eligible,
    availableOutput: atomic(source.capacityEur),
    reason: source.statusReason,
  }));
}

function marketState(): MarketState {
  return {
    id: activeScenario,
    sources: sourceStatus(),
    reference: { available: activeScenario !== "reference_outage" },
  };
}

function allocate(inputBrl: number) {
  let remaining = inputBrl;
  const allocations: SourceAllocation[] = [];

  const available = SOURCES
    .map(scenarioSource)
    .filter((source) => source.eligible && source.capacityEur > 0)
    .sort((left, right) => left.rate - right.rate);

  for (const source of available) {
    if (remaining <= 0.005) break;
    const maximumInput = source.capacityEur * source.rate;
    const usedInput = Math.min(remaining, maximumInput);
    const output = usedInput / source.rate;
    if (usedInput <= 0.005 || output <= 0) continue;

    allocations.push({
      type: source.type,
      sourceId: source.sourceId,
      input: atomic(usedInput),
      output: atomic(output),
      inputAtomic: atomic(usedInput),
      outputAtomic: atomic(output),
      inputAmount: money(usedInput),
      outputAmount: money(output),
    });
    remaining -= usedInput;
  }

  if (remaining > 0.01) {
    return {
      complete: false as const,
      remaining,
      allocations,
      output: allocations.reduce((sum, item) => sum + Number(item.outputAmount ?? 0), 0),
    };
  }

  return {
    complete: true as const,
    remaining: 0,
    allocations,
    output: allocations.reduce((sum, item) => sum + Number(item.outputAmount ?? 0), 0),
  };
}

function buildTrade(inputAmount: string, reserved: boolean): PublicTrade | DemoApiResult {
  const input = Number(inputAmount);
  if (!Number.isFinite(input) || input <= 0) {
    return fail("Enter a BRL amount above zero.", 400, "VALIDATION_ERROR");
  }

  const allocation = allocate(input);
  if (!allocation.complete) {
    return fail(
      "The demo market cannot fill the whole trade under this scenario.",
      409,
      "NO_LIQUIDITY",
      { unfilledBrl: money(allocation.remaining), scenario: activeScenario },
    );
  }

  const output = allocation.output;
  const effectiveRate = input / output;
  const expiresAt = Date.now() + (reserved ? 60_000 : 30_000);

  const base: PublicTrade = {
    object: reserved ? "fx_trade" : "fx_trade_preview",
    state: reserved ? "RESERVED" : "PREVIEW",
    createdAt: Date.now(),
    expiresAt,
    from: {
      asset: "BRL",
      symbol: "BRL",
      requested: money(input),
      charged: money(input),
      atomic: Math.round(input * 100).toString(),
    },
    to: {
      asset: "EUR",
      symbol: "EUR",
      amount: money(output),
      atomic: Math.round(output * 100).toString(),
    },
    rate: effectiveRate.toFixed(6),
    sources: allocation.allocations,
    sourceStatus: sourceStatus(),
    tokenRoute: {
      inputAsset: "BRLX",
      inputSymbol: "BRLX",
      inputAtomic: atomic(input),
      outputAsset: "EURC",
      outputSymbol: "EURC",
      outputAtomic: atomic(output),
    },
    settlement: {
      guarantee: {
        atomic: false,
        class: "MIXED_FINALITY",
        finalityClasses: ["ATTESTED_EXTERNAL", "ATOMIC", "ASYNC_EXTERNAL"],
      },
      edges: SETTLEMENT_EDGES,
    },
    evidence: {
      reserved,
      label: reserved ? "WEBSITE DEMO · RESERVED" : "WEBSITE DEMO PREVIEW",
      note: reserved
        ? "Seeded demo capacity is held for this browser session."
        : "Seeded demo data. No money moves.",
    },
  };

  if (!reserved) return base;

  serial += 1;
  const id = serial.toString().padStart(4, "0");
  return {
    ...base,
    id: `trade_demo_${id}`,
    quoteId: `quote_demo_${id}`,
    routeId: `route_demo_${id}`,
    customerAuthorization: {
      authorizationId: `auth_demo_${id}`,
      expiresAt,
      policyId: "website-demo-policy",
      policyVersion: 1,
    },
  };
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

function tradeIdFrom(path: string) {
  return decodeURIComponent(path.split("/").at(-1) ?? "");
}

export const WEBSITE_FX_DEMO_LABEL = "embedded website demo";

export async function demoFxCall(method: string, path: string, body?: unknown): Promise<DemoApiResult> {
  const started = performance.now();
  await wait();
  const payload = bodyRecord(body);

  if (method === "GET" && path === "/v2/fx/reference/status") {
    return ok({
      mode: "WEBSITE_DEMO",
      canonicalFxRuntime: false,
      note: "Embedded seeded demo used when no FX node is configured.",
      publicReferenceTrade: { from: "BRL", to: "EUR", tokenCorridor: "BRLX/EURC" },
      scenarios: SCENARIOS,
    }, 200, Math.round(performance.now() - started));
  }

  if (method === "GET" && path === "/v2/fx/reference/policy") {
    return ok({
      policyId: "website-demo-policy",
      version: 1,
      rule: "eligible sources compete on price and capacity",
    }, 200, Math.round(performance.now() - started));
  }

  if (method === "GET" && (path === "/v2/fx/reference/scenario" || path === "/v2/fx/reference/market")) {
    const current = marketState();
    return ok(
      path.endsWith("scenario") ? { current, available: SCENARIOS } : current,
      200,
      Math.round(performance.now() - started),
    );
  }

  if (method === "POST" && path === "/v2/fx/reference/scenario") {
    const id = String(payload.id ?? "");
    if (!SCENARIOS.some((scenario) => scenario.id === id)) {
      return fail("Unknown demo scenario.", 400, "VALIDATION_ERROR");
    }
    activeScenario = id;
    return ok(marketState(), 200, Math.round(performance.now() - started));
  }

  if (method === "GET" && path.startsWith("/v2/fx/reference/liquidity")) {
    return ok({ object: "list", data: sourceStatus() }, 200, Math.round(performance.now() - started));
  }

  if (method === "GET" && path === "/v2/fx/reference/settlement-route") {
    return ok({
      fromAsset: "BRL",
      toAsset: "EUR",
      guarantee: { atomic: false, class: "MIXED_FINALITY" },
      edges: SETTLEMENT_EDGES,
    }, 200, Math.round(performance.now() - started));
  }

  if (method === "POST" && path === "/v2/fx/reference/trades/preview") {
    const result = buildTrade(String(payload.inputAmount ?? ""), false);
    if ("ok" in result) return result;
    return ok(result, 200, Math.round(performance.now() - started));
  }

  if (method === "POST" && path === "/v2/fx/reference/trades") {
    const result = buildTrade(String(payload.inputAmount ?? ""), true);
    if ("ok" in result) return result;
    if (result.id) trades.set(result.id, result);
    return ok(result, 201, Math.round(performance.now() - started));
  }

  const executeMatch = path.match(/^\/v2\/fx\/reference\/trades\/([^/]+)\/execute$/);
  if (method === "POST" && executeMatch) {
    const id = decodeURIComponent(executeMatch[1]);
    const trade = trades.get(id);
    if (!trade) return fail("Demo trade not found.", 404, "NOT_FOUND");
    const confirmed: PublicTrade = {
      ...trade,
      state: "CONFIRMED",
      submissionRef: `submission_${id}`,
      eventId: `event_${id}`,
      evidence: {
        reserved: true,
        label: "WEBSITE DEMO · COMPLETE",
        note: "Simulated receipt. No money moved.",
      },
    };
    trades.set(id, confirmed);
    return ok(
      { trade: confirmed, execution: { status: "CONFIRMED", demo: true } },
      202,
      Math.round(performance.now() - started),
    );
  }

  const tradeMatch = path.match(/^\/v2\/fx\/reference\/trades\/([^/]+)$/);
  if (tradeMatch) {
    const id = decodeURIComponent(tradeMatch[1]);
    const trade = trades.get(id);
    if (!trade) return fail("Demo trade not found.", 404, "NOT_FOUND");

    if (method === "GET") {
      return ok(trade, 200, Math.round(performance.now() - started));
    }
    if (method === "DELETE") {
      const released: PublicTrade = {
        ...trade,
        state: "RELEASED",
        evidence: {
          reserved: false,
          label: "WEBSITE DEMO · RELEASED",
          note: "The seeded reservation was released.",
        },
      };
      trades.set(id, released);
      return ok(released, 200, Math.round(performance.now() - started));
    }
  }

  return fail(`The embedded demo does not implement ${method} ${path}.`, 404, "NOT_FOUND");
}
