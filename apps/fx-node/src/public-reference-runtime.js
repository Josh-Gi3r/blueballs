import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import { createMarketAuthorizationVerifier } from "../../../packages/fx-policy/src/index.js";
import {
  atomic,
  INSTRUMENT_KINDS,
  MonetaryEngine,
} from "../../../packages/fx-monetary/src/index.js";
import { ReferencePriceEngine } from "../../../packages/fx-pricing/src/index.js";

import {
  CompositePrincipalLiquidityAdapter,
  pairKey,
} from "./composite-principal-adapter.js";
import { IntegratedQuoteCoordinator } from "./integrated-quote-coordinator.js";
import {
  createReferenceRuntime,
  REFERENCE_ASSETS,
  referenceAsset,
} from "./reference-runtime.js";
import { ReferenceTradeCoordinator } from "./reference-trade-coordinator.js";
import { PrincipalLiquidityAdapter } from "./source-adapters.js";

const DAY = 24 * 60 * 60 * 1000;
const UNIT = 1_000_000n;
const BRL_DEPOSIT_PAIR = pairKey(
  REFERENCE_ASSETS.BRL_DEPOSIT.id,
  REFERENCE_ASSETS.EURC.id,
);
const USDC_PAIR = pairKey(REFERENCE_ASSETS.USDC.id, REFERENCE_ASSETS.EURC.id);

function digest(value) {
  return `0x${createHash("sha256").update(String(value)).digest("hex")}`;
}

function authorize(
  policy,
  { participantId, action, inputAsset, outputAsset, amount, accountRef },
) {
  const decision = policy.authorize({
    participantId,
    action,
    inputAsset,
    outputAsset,
    amount: String(amount),
    accountRef,
  });
  if (!decision.eligible) {
    throw new Error(
      `reference policy rejected ${participantId}: ${decision.reasons.join(", ")}`,
    );
  }
  return decision;
}

const BRL_DEPOSIT_STATIC_DEFINITIONS = Object.freeze([
  {
    // Stable storage ID retained for deployed-state compatibility; not a public ticker.
    sliceId: "reference:issuer-eurc:brlx-eurc",
    sourceType: "ISSUER",
    sourceId: "issuer-eurc",
    accountRef: "issuer-eurc:treasury",
    maxOutput: 2_000n * UNIT,
    inputNumerator: 6_055n,
    inputDenominator: 1_000n,
    label: "EURC issuer",
  },
  {
    sliceId: "reference:neobank-1:brlx-eurc",
    sourceType: "NEOBANK",
    sourceId: "neobank-1",
    accountRef: "neobank-1:treasury",
    maxOutput: 1_000n * UNIT,
    inputNumerator: 6_070n,
    inputDenominator: 1_000n,
    label: "Another institution",
  },
  {
    sliceId: "reference:institutional-lp-1:brlx-eurc",
    sourceType: "INSTITUTIONAL_LP",
    sourceId: "institutional-lp-1",
    accountRef: "institutional-lp-1:treasury",
    maxOutput: 2_000n * UNIT,
    inputNumerator: 6_082n,
    inputDenominator: 1_000n,
    label: "Institutional LP",
  },
  {
    sliceId: "reference:bank-treasury:brlx-eurc",
    sourceType: "BANK_TREASURY",
    sourceId: "bank-treasury",
    accountRef: "bank-treasury:inventory",
    maxOutput: 1_000n * UNIT,
    inputNumerator: 6_100n,
    inputDenominator: 1_000n,
    label: "Bank treasury",
  },
]);

async function seedBrlDepositPrivateOrder({ market, policy, now }) {
  const maker = "0x00000000000000000000000000000000000000a1";
  const existing = market
    .listOrdersForMaker(maker)
    .some(
      ({ order, state }) =>
        order.buyToken === REFERENCE_ASSETS.BRL_DEPOSIT.id.toLowerCase() &&
        order.sellToken === REFERENCE_ASSETS.EURC.id.toLowerCase() &&
        !["FILLED", "CANCELLED", "POLICY_BLOCKED"].includes(state),
    );
  if (existing) return;

  const sellAmount = (2_000n * UNIT).toString();
  const buyAmount = (12_080n * UNIT).toString();
  const authorization = authorize(policy, {
    participantId: "customer-maker",
    action: "PROVIDE_LIQUIDITY",
    inputAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
    outputAsset: REFERENCE_ASSETS.EURC.id,
    amount: sellAmount,
    accountRef: maker,
  });
  const order = {
    maker,
    sellToken: REFERENCE_ASSETS.EURC.id,
    buyToken: REFERENCE_ASSETS.BRL_DEPOSIT.id,
    sellAmount,
    buyAmount,
    recipient: maker,
    validAfter: 0,
    validUntil: Math.floor((now() + 365 * DAY) / 1000),
    epoch: 1,
    salt: digest(
      `public-reference-brl-deposit-eurc:${authorization.authorizationId}`,
    ),
  };
  await market.admitOrder({
    orderHash: digest(
      JSON.stringify({ order, authorizationId: authorization.authorizationId }),
    ),
    order,
    signature: "0x01",
    policyAuthorizationId: authorization.authorizationId,
    policySnapshotHash: authorization.policySnapshotHash,
  });
}

function createBrlDepositReferenceFeed(now) {
  const state = { available: true };
  const engine = new ReferencePriceEngine({
    now,
    maxAgeMs: 60_000,
    minSources: 2,
    maxDeviationBps: 100,
  });

  return {
    quote(inputAsset, outputAsset) {
      if (
        inputAsset !== REFERENCE_ASSETS.BRL_DEPOSIT.id ||
        outputAsset !== REFERENCE_ASSETS.EURC.id
      ) {
        return {
          available: false,
          base: outputAsset,
          quote: inputAsset,
          reason: "REFERENCE_PAIR_NOT_CONFIGURED",
          sourceIds: [],
          confidence: "UNAVAILABLE",
        };
      }
      if (!state.available) {
        return {
          available: false,
          base: outputAsset,
          quote: inputAsset,
          reason: "REFERENCE_DISABLED_BY_SCENARIO",
          sourceIds: [],
          confidence: "UNAVAILABLE",
        };
      }
      const observedAt = now();
      return engine.consensus({
        base: outputAsset,
        quote: inputAsset,
        observations: [
          {
            sourceId: "reference-br-bank-a",
            base: outputAsset,
            quote: inputAsset,
            bid: "6.086",
            ask: "6.094",
            observedAt,
            status: "OK",
          },
          {
            sourceId: "reference-br-bank-b",
            base: outputAsset,
            quote: inputAsset,
            bid: "6.088",
            ask: "6.096",
            observedAt,
            status: "OK",
          },
          {
            sourceId: "reference-br-venue-c",
            base: outputAsset,
            quote: inputAsset,
            bid: "6.087",
            ask: "6.095",
            observedAt,
            status: "OK",
          },
        ],
      });
    },
    setAvailable(available) {
      state.available = Boolean(available);
    },
    status() {
      return { available: state.available };
    },
  };
}

function principalHeadroom(riskBook, asset) {
  const position = riskBook.getPosition(asset);
  const projected = BigInt(position.projected);
  const hardLimit = BigInt(position.hardLimit);
  const headroom = hardLimit - (projected < 0n ? -projected : projected);
  return headroom > 0n ? headroom : 0n;
}

/**
 * Adds the customer-facing BRL → EUR reference trade to the modular runtime built
 * in FX-0 through FX-10. The existing USDC/EURC proof corridor remains available;
 * the public page uses an internal BRL deposit claim and EURC so the phone, bank
 * view and settlement graph all
 * describe the same trade.
 */
export async function createPublicReferenceRuntime({
  dataDir = null,
  memory = false,
  now = () => Date.now(),
} = {}) {
  const base = await createReferenceRuntime({ dataDir, memory, now });
  const marketVerifier = createMarketAuthorizationVerifier(base.policy);

  await seedBrlDepositPrivateOrder({
    market: base.market,
    policy: base.policy,
    now,
  });
  base.riskBook.configureAsset(
    REFERENCE_ASSETS.BRL_DEPOSIT.id,
    (1_000_000n * UNIT).toString(),
  );

  const sourceAuthorizations = new Map();
  function restoreStaticSources(overrides = {}) {
    for (const definition of BRL_DEPOSIT_STATIC_DEFINITIONS) {
      const override = overrides[definition.sourceId] ?? {};
      const maxOutput = BigInt(override.maxOutput ?? definition.maxOutput);
      const authorization = authorize(base.policy, {
        participantId: definition.sourceId,
        action: "PROVIDE_LIQUIDITY",
        inputAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
        outputAsset: REFERENCE_ASSETS.EURC.id,
        amount: definition.maxOutput.toString(),
        accountRef: definition.accountRef,
      });
      base.referenceBook.upsertSlice({
        ...definition,
        inputAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
        outputAsset: REFERENCE_ASSETS.EURC.id,
        maxOutput: maxOutput.toString(),
        inputNumerator: BigInt(
          override.inputNumerator ?? definition.inputNumerator,
        ).toString(),
        inputDenominator: definition.inputDenominator.toString(),
        policyAuthorizationId: authorization.authorizationId,
        policySnapshotHash: authorization.policySnapshotHash,
        expiresAt: authorization.expiresAt,
        online: override.online !== false,
        metadata: { label: definition.label, publicReference: true },
      });
      sourceAuthorizations.set(
        definition.sourceId,
        authorization.authorizationId,
      );
    }
  }
  restoreStaticSources();

  const brlDepositReferenceFeed = createBrlDepositReferenceFeed(now);
  const principalAuthorization = authorize(base.policy, {
    participantId: "bank-principal",
    action: "PROVIDE_LIQUIDITY",
    inputAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
    outputAsset: REFERENCE_ASSETS.EURC.id,
    amount: (500_000n * UNIT).toString(),
    accountRef: "bank-principal:inventory",
  });
  const brlDepositPrincipalAdapter = new PrincipalLiquidityAdapter({
    engine: base.principalEngine,
    riskBook: base.riskBook,
    referenceFor: (inputAsset, outputAsset) =>
      brlDepositReferenceFeed.quote(inputAsset, outputAsset),
    assetFor: referenceAsset,
    authorizationVerifier: marketVerifier,
    policyAuthorizationId: principalAuthorization.authorizationId,
    policySnapshotHash: principalAuthorization.policySnapshotHash,
    accountRef: "bank-principal:inventory",
    sourceId: "bank-principal",
    pricing: { corridorBps: 5, volatilityBps: 5 },
    now,
  });
  const principalAdapter = new CompositePrincipalLiquidityAdapter({
    [USDC_PAIR]: base.principalAdapter,
    [BRL_DEPOSIT_PAIR]: brlDepositPrincipalAdapter,
  });

  // Replace the first-stage quote coordinator with one that can price both proof corridors.
  base.quotes.expire(Number.MAX_SAFE_INTEGER);
  base.quotes.close();
  const quotes = new IntegratedQuoteCoordinator({
    market: base.market,
    policyEngine: base.policy,
    privateAdapter: base.privateAdapter,
    referenceBook: base.referenceBook,
    staticAdapter: base.staticAdapter,
    principalAdapter,
    assetFor: referenceAsset,
    path: base.paths.quotes,
    now,
  });

  let currentScenario = "balanced";

  function sourceStatus() {
    const privateDepth = base.market.aggregateDepth({
      inputToken: REFERENCE_ASSETS.BRL_DEPOSIT.id,
      outputToken: REFERENCE_ASSETS.EURC.id,
    });
    const privateOutput = privateDepth.reduce(
      (sum, level) => sum + BigInt(level.availableSell),
      0n,
    );
    const rows = [
      {
        sourceType: "PRIVATE_MARKET",
        sourceId: "private-market:0",
        label: "Customer liquidity",
        eligible: privateOutput > 0n,
        availableOutput: privateOutput.toString(),
        reason:
          privateOutput > 0n
            ? "SIGNED_AND_POLICY_AUTHORISED"
            : "NO_OPEN_ORDERS",
      },
    ];

    for (const definition of BRL_DEPOSIT_STATIC_DEFINITIONS) {
      const slice = base.referenceBook.getSlice(definition.sliceId);
      const verification = slice
        ? base.policy.verifyAuthorization(slice.policyAuthorizationId)
        : { valid: false, reason: "NOT_CONFIGURED" };
      const available = slice
        ? BigInt(slice.maxOutput) - BigInt(slice.reservedOutput)
        : 0n;
      rows.push({
        sourceType: definition.sourceType,
        sourceId: definition.sourceId,
        label: definition.label,
        eligible:
          Boolean(slice?.online) &&
          verification.valid === true &&
          available > 0n,
        availableOutput: (available > 0n ? available : 0n).toString(),
        reason: !slice
          ? "NOT_CONFIGURED"
          : !slice.online
            ? "SOURCE_OFFLINE"
            : verification.valid !== true
              ? verification.reason
              : available <= 0n
                ? "NO_AVAILABLE_CAPACITY"
                : "POLICY_AUTHORISED",
      });
    }

    const reference = brlDepositReferenceFeed.status();
    const principalAuthorizationStatus = base.policy.verifyAuthorization(
      principalAuthorization.authorizationId,
    );
    rows.push({
      sourceType: "BANK_PRINCIPAL",
      sourceId: "bank-principal",
      label: "Bank balance sheet",
      eligible:
        reference.available &&
        principalAuthorizationStatus.valid === true &&
        principalHeadroom(base.riskBook, REFERENCE_ASSETS.BRL_DEPOSIT.id) > 0n,
      availableOutput: principalHeadroom(
        base.riskBook,
        REFERENCE_ASSETS.EURC.id,
      ).toString(),
      reason: !reference.available
        ? "REFERENCE_UNAVAILABLE"
        : principalAuthorizationStatus.valid !== true
          ? principalAuthorizationStatus.reason
          : principalHeadroom(base.riskBook, REFERENCE_ASSETS.BRL_DEPOSIT.id) <=
              0n
            ? "RISK_LIMIT"
            : "POLICY_AUTHORISED",
    });
    return rows;
  }

  const scenario = {
    list() {
      return [
        { id: "balanced", label: "Balanced reference market" },
        { id: "lp_offline", label: "Institutional LP offline" },
        {
          id: "issuer_policy_blocked",
          label: "Issuer policy authorisation revoked",
        },
        {
          id: "treasury_near_limit",
          label: "Treasury inventory nearly exhausted",
        },
        {
          id: "principal_limit",
          label: "Bank principal at its hard risk limit",
        },
        { id: "reference_outage", label: "Reference pricing unavailable" },
      ];
    },
    current() {
      return {
        id: currentScenario,
        sources: sourceStatus(),
        reference: brlDepositReferenceFeed.status(),
      };
    },
    apply(id) {
      if (!this.list().some((item) => item.id === id)) {
        const error = new Error(`unknown reference scenario: ${id}`);
        error.code = "VALIDATION_ERROR";
        throw error;
      }

      quotes.expire(Number.MAX_SAFE_INTEGER);
      brlDepositReferenceFeed.setAvailable(true);
      base.riskBook.setSettledPosition(REFERENCE_ASSETS.BRL_DEPOSIT.id, "0");
      base.riskBook.setSettledPosition(REFERENCE_ASSETS.EURC.id, "0");
      restoreStaticSources();

      if (id === "lp_offline") {
        base.referenceBook.setOnline(
          "reference:institutional-lp-1:brlx-eurc",
          false,
        );
      } else if (id === "issuer_policy_blocked") {
        base.policy.revokeAuthorization(
          sourceAuthorizations.get("issuer-eurc"),
        );
      } else if (id === "treasury_near_limit") {
        restoreStaticSources({ "bank-treasury": { maxOutput: 200n * UNIT } });
      } else if (id === "principal_limit") {
        base.riskBook.setSettledPosition(
          REFERENCE_ASSETS.BRL_DEPOSIT.id,
          (995_000n * UNIT).toString(),
        );
        base.riskBook.setSettledPosition(
          REFERENCE_ASSETS.EURC.id,
          (-995_000n * UNIT).toString(),
        );
      } else if (id === "reference_outage") {
        brlDepositReferenceFeed.setAvailable(false);
      }

      currentScenario = id;
      return this.current();
    },
  };

  const tradesPath =
    memory || base.paths.quotes === ":memory:"
      ? ":memory:"
      : join(dirname(base.paths.quotes), "trades.db");
  const trades = new ReferenceTradeCoordinator({
    quotes,
    settlementGraph: base.settlementGraph,
    settlementEdgeIds: base.seed.settlementAuthorizations
      ? Object.keys(base.seed.settlementAuthorizations)
      : [],
    assets: REFERENCE_ASSETS,
    sourceStatus,
    referenceFor: (inputAsset, outputAsset) =>
      brlDepositReferenceFeed.quote(inputAsset, outputAsset),
    path: tradesPath,
    now,
  });

  const monetaryPath =
    memory || base.paths.quotes === ":memory:"
      ? ":memory:"
      : join(dirname(base.paths.quotes), "monetary.db");
  const monetaryEngine = new MonetaryEngine({ path: monetaryPath, now });
  monetaryEngine.disableInstrument("IDRX");
  monetaryEngine.disableInstrument("SGDX");
  monetaryEngine.configureInstrument({
    code: "USD",
    name: "Reference USD-backed stablecoin sandbox instrument",
    kind: INSTRUMENT_KINDS.STABLECOIN,
    reserveCurrency: "USD",
    decimals: 6,
  });
  monetaryEngine.configureInstrument({
    code: "EUR",
    name: "Reference EUR tokenized bank-deposit sandbox instrument",
    kind: INSTRUMENT_KINDS.TOKENIZED_DEPOSIT,
    reserveCurrency: "EUR",
    decimals: 6,
  });

  const monetary = {
    health: () => monetaryEngine.health(),
    instruments: () => monetaryEngine.listInstruments(),
    createReserveDeposit: (body) => monetaryEngine.createReserveDeposit(body),
    settleReserveDeposit: (depositId) =>
      monetaryEngine.settleReserveDeposit(depositId),
    getReserveDeposit: (depositId) =>
      monetaryEngine.getReserveDeposit(depositId),
    setRiskCapital: (body) => monetaryEngine.setRiskCapital(body),
    mint: (instrumentCode, body) =>
      monetaryEngine.mint({ ...body, instrumentCode }),
    redeem: (instrumentCode, body) =>
      monetaryEngine.redeem({ ...body, instrumentCode }),
    createReceipt: (body) => monetaryEngine.createReceipt(body),
    getReceipt: (receiptId) => monetaryEngine.getReceipt(receiptId),
    consumeReceipt: (receiptId) => monetaryEngine.consumeReceipt(receiptId),
    events: (options) => monetaryEngine.events(options),
    previewRemittance(body) {
      if (
        (body.inputCurrency ?? "BRL") !== "BRL" ||
        (body.outputCurrency ?? "EUR") !== "EUR"
      ) {
        const error = new Error(
          "the monetary reference preview supports BRL to EUR",
        );
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      const inputAtomic = atomic(body.inputAmount, "inputAmount");
      const inputAmount = `${inputAtomic / 100n}.${(inputAtomic % 100n).toString().padStart(2, "0")}`;
      return trades.previewExactInput({
        inputAmount,
        from: "BRL",
        to: "EUR",
      });
    },
  };

  const inspector = {
    status() {
      const original = base.inspector.status();
      return {
        ...original,
        publicReferenceTrade: {
          from: "BRL",
          to: "EUR",
          tokenCorridor: "BRL deposit claim/EURC",
          previewEndpoint: "/v2/fx/reference/trades/preview",
          reserveEndpoint: "/v2/fx/reference/trades",
        },
        monetaryEngine: {
          mode: "reference-sandbox",
          instruments: ["USD", "EUR"],
          healthEndpoint: "/v2/fx/reference/monetary/health",
          remittancePreviewEndpoint:
            "/v2/fx/reference/monetary/remittance/preview",
        },
        scenarios: scenario.list(),
      };
    },
    policy: () => base.inspector.policy(),
    liquidity({
      inputAsset,
      outputAsset,
      exactOutput = (1n * UNIT).toString(),
    }) {
      const input = referenceAsset(inputAsset);
      const output = referenceAsset(outputAsset);
      if (!input || !output) throw new Error("unknown reference asset");
      const expiresAt = now() + 15_000;
      return quotes
        .candidateSlices({
          inputAsset: input.id,
          outputAsset: output.id,
          exactOutput: String(exactOutput),
          expiresAt,
        })
        .map((slice) => ({
          sourceType: slice.sourceType,
          sourceId: slice.sourceId,
          inputAsset: slice.inputAsset,
          outputAsset: slice.outputAsset,
          maxOutput: slice.maxOutput,
          inputNumerator: slice.inputNumerator,
          inputDenominator: slice.inputDenominator,
          expiresAt: slice.expiresAt,
        }));
    },
    settlementRoute: () => base.inspector.settlementRoute(),
    marketState: () => scenario.current(),
  };

  return {
    ...base,
    quotes,
    trades,
    monetary,
    scenario,
    inspector,
    principalAdapter,
    brlDepositPrincipalAdapter,
    brlDepositReferenceFeed,
    close() {
      trades.close();
      monetaryEngine.close();
      quotes.close();
      base.fiat.close();
      base.riskBook.close();
      base.referenceBook.close();
      base.market.close();
      base.policy.close();
    },
  };
}

export { BRL_DEPOSIT_STATIC_DEFINITIONS };
