import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  FiatSettlementStore,
  SettlementGraph,
} from "../../../packages/fx-fiat/src/index.js";
import { FxMarketService } from "../../../packages/fx-market/src/index.js";
import {
  createMarketAuthorizationVerifier,
  createSettlementAuthorizationVerifier,
  FxPolicyEngine,
} from "../../../packages/fx-policy/src/index.js";
import {
  PrincipalQuoteEngine,
  PrincipalRiskBook,
  ReferencePriceEngine,
} from "../../../packages/fx-pricing/src/index.js";

import { IntegratedQuoteCoordinator } from "./integrated-quote-coordinator.js";
import {
  ReferenceLiquidityAdapter,
  ReferenceLiquidityBook,
} from "./reference-liquidity.js";
import {
  PrincipalLiquidityAdapter,
  PrivateMarketLiquidityAdapter,
} from "./source-adapters.js";

const DAY = 24 * 60 * 60 * 1000;
const UNIT = 1_000_000n;

export const REFERENCE_ASSETS = Object.freeze({
  USDC: {
    id: "0x0000000000000000000000000000000000000011",
    symbol: "USDC",
    decimals: 6,
    kind: "token",
  },
  EURC: {
    id: "0x0000000000000000000000000000000000000022",
    symbol: "EURC",
    decimals: 6,
    kind: "token",
  },
  BRL_DEPOSIT: {
    id: "0x0000000000000000000000000000000000000033",
    symbol: "BRL deposit claim",
    decimals: 6,
    kind: "token",
  },
  BRL: { id: "BRL", symbol: "BRL", decimals: 2, kind: "fiat" },
  EUR: { id: "EUR", symbol: "EUR", decimals: 2, kind: "fiat" },
});

const ASSET_LOOKUP = new Map(
  Object.values(REFERENCE_ASSETS).flatMap((asset) => [
    [asset.id, asset],
    [asset.id.toLowerCase(), asset],
    [asset.symbol, asset],
    [asset.symbol.toLowerCase(), asset],
  ]),
);

export function referenceAsset(value) {
  if (typeof value !== "string") return null;
  return (
    ASSET_LOOKUP.get(value) ?? ASSET_LOOKUP.get(value.toLowerCase()) ?? null
  );
}

function hash(value) {
  return `0x${createHash("sha256").update(String(value)).digest("hex")}`;
}

function pathsFor({ dataDir = null, memory = false } = {}) {
  if (memory) {
    return {
      policy: ":memory:",
      market: ":memory:",
      liquidity: ":memory:",
      risk: ":memory:",
      quotes: ":memory:",
      fiat: ":memory:",
    };
  }
  const root = dataDir ?? "./blueballs-fx-data";
  mkdirSync(root, { recursive: true });
  return {
    policy: join(root, "policy.db"),
    market: join(root, "market.db"),
    liquidity: join(root, "liquidity.db"),
    risk: join(root, "risk.db"),
    quotes: join(root, "quotes.db"),
    fiat: join(root, "fiat.db"),
  };
}

function ensureParticipant(policy, participant) {
  policy.upsertParticipant(participant);
}

function ensureCredential(
  policy,
  { participantId, credentialType, providerRef, now },
) {
  const existing = policy.db
    .prepare(
      `
    SELECT * FROM fx_credentials
    WHERE participant_id = ? AND credential_type = ?
  `,
    )
    .get(participantId, credentialType);
  if (
    existing &&
    existing.status === "PASSED" &&
    (existing.expires_at === null || existing.expires_at > now + DAY)
  ) {
    return;
  }
  policy.upsertCredential({
    participantId,
    credentialType,
    status: "PASSED",
    providerRef,
    issuedAt: now,
    expiresAt: now + 365 * DAY,
  });
}

function ensureAccount(
  policy,
  participantId,
  accountRef,
  accountType = "WALLET",
) {
  const existing = policy.db
    .prepare("SELECT * FROM fx_accounts WHERE account_ref = ?")
    .get(accountRef);
  if (!existing) policy.mapAccount({ participantId, accountRef, accountType });
  else if (existing.participant_id !== participantId)
    throw new Error(`account ${accountRef} belongs to another participant`);
}

function ensureAuthorization(
  policy,
  { participantId, action, inputAsset, outputAsset, amount, accountRef = null },
) {
  const rows = policy.db
    .prepare(
      `
    SELECT * FROM fx_authorizations
    WHERE participant_id = ?
      AND action = ?
      AND input_asset = ?
      AND output_asset = ?
      AND max_amount = ?
      AND revoked = 0
    ORDER BY issued_at DESC
  `,
    )
    .all(participantId, action, inputAsset, outputAsset, String(amount));

  for (const row of rows) {
    const snapshot = JSON.parse(row.decision_snapshot_json);
    if ((snapshot.accountRef ?? null) !== accountRef) continue;
    const status = policy.verifyAuthorization(row.authorization_id);
    if (status.valid) {
      return {
        eligible: true,
        authorizationId: row.authorization_id,
        participantId: row.participant_id,
        participantType: row.participant_type,
        action: row.action,
        inputAsset: row.input_asset,
        outputAsset: row.output_asset,
        maxAmount: row.max_amount,
        participantEpoch: row.participant_epoch,
        policyId: row.policy_id,
        policyVersion: row.policy_version,
        policySnapshotHash: row.policy_snapshot_hash,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
      };
    }
  }

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

function configureReferencePolicy(policy, now) {
  policy.configurePolicy({
    policyId: "blueballs-public-reference",
    version: 1,
    enabledParticipantTypes: [
      "CUSTOMER",
      "INSTITUTIONAL_LP",
      "ISSUER",
      "NEOBANK",
      "BANK_TREASURY",
      "BANK_PRINCIPAL",
      "FIAT_PROVIDER",
    ],
    requiredCredentials: {
      CUSTOMER: ["KYC", "SANCTIONS"],
      INSTITUTIONAL_LP: ["KYB", "SANCTIONS", "AML"],
      ISSUER: ["KYB", "SANCTIONS", "AML"],
      NEOBANK: ["KYB", "SANCTIONS", "AML"],
      BANK_TREASURY: ["KYB", "SANCTIONS", "AML"],
      BANK_PRINCIPAL: ["KYB", "SANCTIONS", "AML"],
      FIAT_PROVIDER: ["KYB", "SANCTIONS", "AML"],
    },
    allowedAssets: [
      REFERENCE_ASSETS.USDC.id,
      REFERENCE_ASSETS.EURC.id,
      REFERENCE_ASSETS.BRL_DEPOSIT.id,
      REFERENCE_ASSETS.BRL.id,
      REFERENCE_ASSETS.EUR.id,
    ],
    allowedCorridors: [
      `${REFERENCE_ASSETS.USDC.id}/${REFERENCE_ASSETS.EURC.id}`,
      `${REFERENCE_ASSETS.BRL.id}/${REFERENCE_ASSETS.BRL_DEPOSIT.id}`,
      `${REFERENCE_ASSETS.BRL_DEPOSIT.id}/${REFERENCE_ASSETS.EURC.id}`,
      `${REFERENCE_ASSETS.EURC.id}/${REFERENCE_ASSETS.EUR.id}`,
    ],
    blockedJurisdictions: [],
    maxTicketByType: {
      CUSTOMER: (1_000_000n * UNIT).toString(),
      INSTITUTIONAL_LP: (5_000_000n * UNIT).toString(),
      ISSUER: (5_000_000n * UNIT).toString(),
      NEOBANK: (5_000_000n * UNIT).toString(),
      BANK_TREASURY: (5_000_000n * UNIT).toString(),
      BANK_PRINCIPAL: (5_000_000n * UNIT).toString(),
      FIAT_PROVIDER: (5_000_000n * UNIT).toString(),
    },
    authorizationTtlMs: 30 * DAY,
  });

  const participants = [
    {
      participantId: "sandbox-customer",
      participantType: "CUSTOMER",
      jurisdiction: "BR",
    },
    {
      participantId: "customer-maker",
      participantType: "CUSTOMER",
      jurisdiction: "BR",
    },
    {
      participantId: "issuer-eurc",
      participantType: "ISSUER",
      jurisdiction: "US",
    },
    {
      participantId: "institutional-lp-1",
      participantType: "INSTITUTIONAL_LP",
      jurisdiction: "SG",
    },
    {
      participantId: "neobank-1",
      participantType: "NEOBANK",
      jurisdiction: "GB",
    },
    {
      participantId: "bank-treasury",
      participantType: "BANK_TREASURY",
      jurisdiction: "SG",
    },
    {
      participantId: "bank-principal",
      participantType: "BANK_PRINCIPAL",
      jurisdiction: "SG",
    },
    {
      participantId: "pix-provider",
      participantType: "FIAT_PROVIDER",
      jurisdiction: "BR",
    },
    {
      participantId: "brl-issuer",
      participantType: "ISSUER",
      jurisdiction: "BR",
    },
    {
      participantId: "eur-issuer",
      participantType: "ISSUER",
      jurisdiction: "EU",
    },
    {
      participantId: "atomic-router-provider",
      participantType: "NEOBANK",
      jurisdiction: "SG",
    },
  ];
  for (const participant of participants)
    ensureParticipant(policy, participant);

  for (const participant of participants) {
    const credentials =
      participant.participantType === "CUSTOMER"
        ? ["KYC", "SANCTIONS"]
        : ["KYB", "SANCTIONS", "AML"];
    for (const credentialType of credentials) {
      ensureCredential(policy, {
        participantId: participant.participantId,
        credentialType,
        providerRef: `reference:${credentialType.toLowerCase()}`,
        now,
      });
    }
  }

  ensureAccount(policy, "sandbox-customer", "sandbox-customer:wallet");
  ensureAccount(
    policy,
    "customer-maker",
    "0x00000000000000000000000000000000000000a1",
  );
  ensureAccount(policy, "issuer-eurc", "issuer-eurc:treasury");
  ensureAccount(policy, "institutional-lp-1", "institutional-lp-1:treasury");
  ensureAccount(policy, "neobank-1", "neobank-1:treasury");
  ensureAccount(policy, "bank-treasury", "bank-treasury:inventory");
  ensureAccount(policy, "bank-principal", "bank-principal:inventory");
  ensureAccount(
    policy,
    "pix-provider",
    "pix-provider:settlement",
    "BANK_ACCOUNT",
  );
  ensureAccount(policy, "brl-issuer", "brl-issuer:mint");
  ensureAccount(policy, "eur-issuer", "eur-issuer:redeem");
  ensureAccount(
    policy,
    "atomic-router-provider",
    "atomic-router-provider:router",
  );
}

async function seedPrivateMarket({ market, policy, now }) {
  const inputAsset = REFERENCE_ASSETS.USDC.id;
  const outputAsset = REFERENCE_ASSETS.EURC.id;
  if (
    market.aggregateDepth({ inputToken: inputAsset, outputToken: outputAsset })
      .length > 0
  )
    return;

  const maker = "0x00000000000000000000000000000000000000a1";
  const sellAmount = (25_000n * UNIT).toString();
  const buyAmount = (27_000n * UNIT).toString();
  const authorization = ensureAuthorization(policy, {
    participantId: "customer-maker",
    action: "PROVIDE_LIQUIDITY",
    inputAsset,
    outputAsset,
    amount: sellAmount,
    accountRef: maker,
  });
  const order = {
    maker,
    sellToken: outputAsset,
    buyToken: inputAsset,
    sellAmount,
    buyAmount,
    recipient: maker,
    validAfter: 0,
    validUntil: Math.floor((now + 365 * DAY) / 1000),
    epoch: 1,
    salt: hash(`reference-maker-salt:${authorization.authorizationId}`),
  };
  await market.admitOrder({
    orderHash: hash(
      JSON.stringify({ order, authorizationId: authorization.authorizationId }),
    ),
    order,
    signature: "0x01",
    policyAuthorizationId: authorization.authorizationId,
    policySnapshotHash: authorization.policySnapshotHash,
  });
}

function seedReferenceSources({ book, policy }) {
  const inputAsset = REFERENCE_ASSETS.USDC.id;
  const outputAsset = REFERENCE_ASSETS.EURC.id;
  const definitions = [
    {
      sliceId: "reference:issuer-eurc:usdc-eurc",
      sourceType: "ISSUER",
      sourceId: "issuer-eurc",
      accountRef: "issuer-eurc:treasury",
      maxOutput: 100_000n * UNIT,
      inputNumerator: 10_810n,
      inputDenominator: 10_000n,
      label: "EURC issuer",
    },
    {
      sliceId: "reference:neobank-1:usdc-eurc",
      sourceType: "NEOBANK",
      sourceId: "neobank-1",
      accountRef: "neobank-1:treasury",
      maxOutput: 75_000n * UNIT,
      inputNumerator: 10_820n,
      inputDenominator: 10_000n,
      label: "Other institution",
    },
    {
      sliceId: "reference:institutional-lp-1:usdc-eurc",
      sourceType: "INSTITUTIONAL_LP",
      sourceId: "institutional-lp-1",
      accountRef: "institutional-lp-1:treasury",
      maxOutput: 125_000n * UNIT,
      inputNumerator: 10_830n,
      inputDenominator: 10_000n,
      label: "Institutional LP",
    },
    {
      sliceId: "reference:bank-treasury:usdc-eurc",
      sourceType: "BANK_TREASURY",
      sourceId: "bank-treasury",
      accountRef: "bank-treasury:inventory",
      maxOutput: 75_000n * UNIT,
      inputNumerator: 10_860n,
      inputDenominator: 10_000n,
      label: "Bank treasury",
    },
  ];

  const authorizations = {};
  for (const definition of definitions) {
    const authorization = ensureAuthorization(policy, {
      participantId: definition.sourceId,
      action: "PROVIDE_LIQUIDITY",
      inputAsset,
      outputAsset,
      amount: definition.maxOutput.toString(),
      accountRef: definition.accountRef,
    });
    const existing = book.getSlice(definition.sliceId);
    book.upsertSlice({
      ...definition,
      inputAsset,
      outputAsset,
      maxOutput: existing?.maxOutput ?? definition.maxOutput.toString(),
      inputNumerator: definition.inputNumerator.toString(),
      inputDenominator: definition.inputDenominator.toString(),
      policyAuthorizationId: authorization.authorizationId,
      policySnapshotHash: authorization.policySnapshotHash,
      expiresAt: authorization.expiresAt,
      metadata: { label: definition.label, reference: true },
    });
    authorizations[definition.sourceId] = authorization.authorizationId;
  }
  return authorizations;
}

function createReferencePriceFeed(now) {
  const engine = new ReferencePriceEngine({
    now: () => now(),
    maxAgeMs: 60_000,
    minSources: 2,
    maxDeviationBps: 100,
  });
  const observations = [
    {
      sourceId: "reference-bank-a",
      base: REFERENCE_ASSETS.EURC.id,
      quote: REFERENCE_ASSETS.USDC.id,
      bid: "1.0838",
      ask: "1.0842",
      observedAt: now(),
      status: "OK",
    },
    {
      sourceId: "reference-bank-b",
      base: REFERENCE_ASSETS.EURC.id,
      quote: REFERENCE_ASSETS.USDC.id,
      bid: "1.0839",
      ask: "1.0843",
      observedAt: now(),
      status: "OK",
    },
    {
      sourceId: "reference-venue-c",
      base: REFERENCE_ASSETS.EURC.id,
      quote: REFERENCE_ASSETS.USDC.id,
      bid: "1.0840",
      ask: "1.0844",
      observedAt: now(),
      status: "OK",
    },
  ];

  return (inputAsset, outputAsset) => {
    if (
      inputAsset !== REFERENCE_ASSETS.USDC.id ||
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
    return engine.consensus({
      base: outputAsset,
      quote: inputAsset,
      observations: observations.map((item) => ({
        ...item,
        observedAt: now(),
      })),
    });
  };
}

function seedSettlementGraph({ graph, policy }) {
  const definitions = [
    {
      participantId: "pix-provider",
      accountRef: "pix-provider:settlement",
      edge: {
        // Stable storage ID retained for deployed-state compatibility.
        edgeId: "reference:brl-pix-brlx",
        edgeType: "VERIFIED_FIAT_PAYMENT",
        finalityClass: "ATTESTED_EXTERNAL",
        fromAsset: REFERENCE_ASSETS.BRL.id,
        toAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
        providerId: "pix-provider",
        capacity: (5_000_000n * UNIT).toString(),
        unitInput: "1",
        unitOutput: "10000",
        cost: "0",
        settlementWindowMs: 60_000,
        metadata: { rail: "PIX", label: "Verified BRL payment" },
      },
    },
    {
      participantId: "atomic-router-provider",
      accountRef: "atomic-router-provider:router",
      edge: {
        edgeId: "reference:brlx-eurc-atomic",
        edgeType: "TOKEN_SWAP",
        finalityClass: "ATOMIC",
        atomicGroup: "evm:reference",
        fromAsset: REFERENCE_ASSETS.BRL_DEPOSIT.id,
        toAsset: REFERENCE_ASSETS.EURC.id,
        providerId: "atomic-router-provider",
        capacity: (5_000_000n * UNIT).toString(),
        unitInput: "60800",
        unitOutput: "10000",
        cost: "0",
        metadata: { label: "Atomic BRL deposit claim/EURC FX" },
      },
    },
    {
      participantId: "eur-issuer",
      accountRef: "eur-issuer:redeem",
      edge: {
        edgeId: "reference:eurc-eur-redeem",
        edgeType: "ISSUER_REDEEM",
        finalityClass: "ASYNC_EXTERNAL",
        fromAsset: REFERENCE_ASSETS.EURC.id,
        toAsset: REFERENCE_ASSETS.EUR.id,
        providerId: "eur-issuer",
        capacity: (5_000_000n * UNIT).toString(),
        unitInput: "10000",
        unitOutput: "1",
        cost: "0",
        settlementWindowMs: 15 * 60_000,
        metadata: { label: "EURC redemption to EUR" },
      },
    },
  ];

  const authorizations = {};
  for (const definition of definitions) {
    const authorization = ensureAuthorization(policy, {
      participantId: definition.participantId,
      action: "SETTLE_FIAT_EDGE",
      inputAsset: definition.edge.fromAsset,
      outputAsset: definition.edge.toAsset,
      amount: definition.edge.capacity,
      accountRef: definition.accountRef,
    });
    graph.upsertEdge({
      ...definition.edge,
      policyAuthorizationId: authorization.authorizationId,
    });
    authorizations[definition.edge.edgeId] = authorization.authorizationId;
  }
  return {
    edgeIds: definitions.map(({ edge }) => edge.edgeId),
    authorizations,
  };
}

export async function createReferenceRuntime({
  dataDir = null,
  memory = false,
  now = () => Date.now(),
} = {}) {
  const paths = pathsFor({ dataDir, memory });
  const policy = new FxPolicyEngine({ path: paths.policy, now });
  configureReferencePolicy(policy, now());
  const marketVerifier = createMarketAuthorizationVerifier(policy);
  const settlementVerifier = createSettlementAuthorizationVerifier(policy);

  const market = new FxMarketService({
    path: paths.market,
    now,
    // Reference sandbox accepts a syntactically valid signature so the complete
    // market can be exercised locally. Production composition must replace this.
    signatureVerifier: async () => true,
    policyAuthorizer: async (admission) => {
      const result = marketVerifier(admission.policyAuthorizationId, {
        accountRef: admission.order.maker,
        inputAsset: admission.order.buyToken,
        outputAsset: admission.order.sellToken,
        amount: admission.order.sellAmount,
        policySnapshotHash: admission.policySnapshotHash,
      });
      return result.valid
        ? { eligible: true, authorizationId: result.authorizationId }
        : {
            eligible: false,
            reason: result.reason,
          };
    },
    authorizationVerifier: marketVerifier,
  });
  await seedPrivateMarket({ market, policy, now: now() });

  const referenceBook = new ReferenceLiquidityBook({
    path: paths.liquidity,
    now,
    authorizationVerifier: marketVerifier,
  });
  const sourceAuthorizations = seedReferenceSources({
    book: referenceBook,
    policy,
  });
  const staticAdapter = new ReferenceLiquidityAdapter(referenceBook);
  const privateAdapter = new PrivateMarketLiquidityAdapter({ market, now });

  const riskBook = new PrincipalRiskBook({
    path: paths.risk,
    now,
    limits: {
      [REFERENCE_ASSETS.USDC.id]: (1_000_000n * UNIT).toString(),
      [REFERENCE_ASSETS.EURC.id]: (1_000_000n * UNIT).toString(),
    },
  });
  const principalEngine = new PrincipalQuoteEngine({
    riskBook,
    baseSpreadBps: 25,
    minimumSpreadBps: 15,
    now,
  });
  const principalAuthorization = ensureAuthorization(policy, {
    participantId: "bank-principal",
    action: "PROVIDE_LIQUIDITY",
    inputAsset: REFERENCE_ASSETS.USDC.id,
    outputAsset: REFERENCE_ASSETS.EURC.id,
    amount: (500_000n * UNIT).toString(),
    accountRef: "bank-principal:inventory",
  });
  const referenceFor = createReferencePriceFeed(now);
  const principalAdapter = new PrincipalLiquidityAdapter({
    engine: principalEngine,
    riskBook,
    referenceFor,
    assetFor: referenceAsset,
    authorizationVerifier: marketVerifier,
    policyAuthorizationId: principalAuthorization.authorizationId,
    policySnapshotHash: principalAuthorization.policySnapshotHash,
    accountRef: "bank-principal:inventory",
    pricing: { corridorBps: 5, volatilityBps: 5 },
    now,
  });

  const quotes = new IntegratedQuoteCoordinator({
    market,
    policyEngine: policy,
    privateAdapter,
    referenceBook,
    staticAdapter,
    principalAdapter,
    assetFor: referenceAsset,
    path: paths.quotes,
    now,
  });

  const fiat = new FiatSettlementStore({ path: paths.fiat, now });
  const settlementGraph = new SettlementGraph({
    authorizationVerifier: settlementVerifier,
  });
  const settlementSeed = seedSettlementGraph({
    graph: settlementGraph,
    policy,
  });

  const inspector = {
    status() {
      const currentPolicy = policy.currentPolicy();
      return {
        mode: "REFERENCE_SANDBOX",
        canonicalFxRuntime: true,
        assets: Object.values(REFERENCE_ASSETS),
        sourceTypes: [
          "PRIVATE_MARKET",
          "ISSUER",
          "INSTITUTIONAL_LP",
          "NEOBANK",
          "BANK_TREASURY",
          "BANK_PRINCIPAL",
        ],
        policy: {
          policyId: currentPolicy.policyId,
          version: currentPolicy.version,
          snapshotHash: currentPolicy.snapshotHash,
        },
        execution: {
          configured: false,
          note: "HTTP execution fails closed until an execution adapter is supplied.",
        },
      };
    },
    policy() {
      const current = policy.currentPolicy();
      return {
        policyId: current.policyId,
        version: current.version,
        enabledParticipantTypes: current.enabledParticipantTypes,
        allowedAssets: current.allowedAssets,
        allowedCorridors: current.allowedCorridors,
        maxTicketByType: current.maxTicketByType,
        authorizationTtlMs: current.authorizationTtlMs,
      };
    },
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
    settlementRoute() {
      return settlementGraph.analyzeRoute(settlementSeed.edgeIds);
    },
  };

  return {
    assets: REFERENCE_ASSETS,
    paths,
    policy,
    market,
    referenceBook,
    riskBook,
    principalEngine,
    privateAdapter,
    staticAdapter,
    principalAdapter,
    quotes,
    fiat,
    settlementGraph,
    inspector,
    seed: {
      sourceAuthorizations,
      principalAuthorizationId: principalAuthorization.authorizationId,
      settlementAuthorizations: settlementSeed.authorizations,
    },
    close() {
      quotes.close();
      fiat.close();
      riskBook.close();
      referenceBook.close();
      market.close();
      policy.close();
    },
  };
}
