import test from "node:test";
import assert from "node:assert/strict";

import { FxMarketService } from "../../fx-market/src/index.js";
import {
  FxPolicyEngine,
  createMarketAuthorizationVerifier,
} from "../src/index.js";

const NOW = 1_000_000;
const INPUT = "0x0000000000000000000000000000000000000011";
const OUTPUT = "0x0000000000000000000000000000000000000022";
const OTHER = "0x0000000000000000000000000000000000000033";
const MAKER = "0x00000000000000000000000000000000000000a1";

function hash(n) {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function setup() {
  const policy = new FxPolicyEngine({ now: () => NOW });
  policy.configurePolicy({
    policyId: "bank-fx",
    version: 1,
    enabledParticipantTypes: ["INSTITUTIONAL_LP"],
    requiredCredentials: { INSTITUTIONAL_LP: ["KYB", "SANCTIONS", "AML"] },
    allowedAssets: [INPUT, OUTPUT],
    allowedCorridors: [`${INPUT}/${OUTPUT}`],
    blockedJurisdictions: [],
    maxTicketByType: { INSTITUTIONAL_LP: "1000" },
    authorizationTtlMs: 60_000,
  });
  policy.upsertParticipant({
    participantId: "lp-1",
    participantType: "INSTITUTIONAL_LP",
    status: "ACTIVE",
    jurisdiction: "SG",
  });
  for (const credentialType of ["KYB", "SANCTIONS", "AML"]) {
    policy.upsertCredential({
      participantId: "lp-1",
      credentialType,
      status: "PASSED",
      providerRef: `provider:${credentialType}`,
      issuedAt: NOW - 100,
      expiresAt: NOW + 100_000,
    });
  }
  policy.mapAccount({ participantId: "lp-1", accountRef: MAKER });

  const authorizationVerifier = createMarketAuthorizationVerifier(policy);
  const market = new FxMarketService({
    now: () => NOW,
    signatureVerifier: async () => true,
    policyAuthorizer: async (admission) => {
      const result = authorizationVerifier(admission.policyAuthorizationId, {
        inputAsset: admission.order.buyToken,
        outputAsset: admission.order.sellToken,
        amount: admission.order.sellAmount,
        accountRef: admission.order.maker,
        policySnapshotHash: admission.policySnapshotHash,
      });
      return result.valid
        ? { eligible: true }
        : { eligible: false, reason: result.reason };
    },
    authorizationVerifier,
  });
  return { policy, market };
}

function authorize(policy, amount = "100") {
  const decision = policy.authorize({
    participantId: "lp-1",
    action: "PROVIDE_LIQUIDITY",
    inputAsset: INPUT,
    outputAsset: OUTPUT,
    amount,
    accountRef: MAKER,
  });
  assert.equal(decision.eligible, true);
  return decision;
}

function admission(decision, id = 1, sellAmount = "100") {
  return {
    orderHash: hash(id),
    signature: "0x01",
    policyAuthorizationId: decision.authorizationId,
    policySnapshotHash: decision.policySnapshotHash,
    order: {
      maker: MAKER,
      sellToken: OUTPUT,
      buyToken: INPUT,
      sellAmount,
      buyAmount: "200",
      recipient: MAKER,
      validAfter: 0,
      validUntil: 4_000_000_000,
      epoch: 1,
      salt: hash(10_000 + id),
    },
  };
}

function failSanctions(policy) {
  policy.upsertCredential({
    participantId: "lp-1",
    credentialType: "SANCTIONS",
    status: "FAILED",
    providerRef: "provider:SANCTIONS",
    issuedAt: NOW,
    expiresAt: NOW + 100_000,
  });
}

test("authorization context is bound to action corridor amount and maker account", async () => {
  const { policy, market } = setup();
  const decision = authorize(policy, "100");

  await assert.rejects(
    () => market.admitOrder(admission(decision, 1, "101")),
    /AMOUNT_EXCEEDS_AUTHORIZATION/,
  );

  const wrongPair = admission(decision, 2, "100");
  wrongPair.order.sellToken = OTHER;
  await assert.rejects(
    () => market.admitOrder(wrongPair),
    /OUTPUT_ASSET_MISMATCH/,
  );

  const wrongMaker = admission(decision, 3, "100");
  wrongMaker.order.maker = "0x00000000000000000000000000000000000000b2";
  wrongMaker.order.recipient = wrongMaker.order.maker;
  await assert.rejects(
    () => market.admitOrder(wrongMaker),
    /ACCOUNT_ATTRIBUTION_MISMATCH/,
  );

  market.close();
  policy.close();
});

test("credential change after admission removes order before reservation", async () => {
  const { policy, market } = setup();
  const decision = authorize(policy);
  const order = admission(decision, 10);
  await market.admitOrder(order);

  failSanctions(policy);

  assert.deepEqual(
    market.aggregateDepth({ inputToken: INPUT, outputToken: OUTPUT }),
    [],
  );
  assert.equal(market.getOrder(order.orderHash).state, "POLICY_BLOCKED");
  assert.throws(
    () =>
      market.reserveExactOutput({
        routeId: "r-before-reserve",
        inputToken: INPUT,
        outputToken: OUTPUT,
        desiredOutput: "100",
        expiresAt: NOW + 10_000,
      }),
    /insufficient eligible liquidity/,
  );

  market.close();
  policy.close();
});

test("credential change after reservation blocks route before submission", async () => {
  const { policy, market } = setup();
  const decision = authorize(policy);
  const order = admission(decision, 20);
  await market.admitOrder(order);

  market.reserveExactOutput({
    routeId: "r-before-submit",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "100",
    expiresAt: NOW + 10_000,
  });
  failSanctions(policy);

  assert.throws(
    () => market.markRouteSubmitted("r-before-submit", "0xtx"),
    (error) => error.code === "POLICY_AUTHORIZATION_INVALID",
  );
  assert.equal(market.getRoute("r-before-submit").state, "RELEASED");
  assert.equal(market.getOrder(order.orderHash).state, "POLICY_BLOCKED");

  market.close();
  policy.close();
});

test("credential change after submission does not rewrite in-flight settlement history", async () => {
  const { policy, market } = setup();
  const decision = authorize(policy);
  const order = admission(decision, 30);
  await market.admitOrder(order);

  market.reserveExactOutput({
    routeId: "r-submitted",
    inputToken: INPUT,
    outputToken: OUTPUT,
    desiredOutput: "100",
    expiresAt: NOW + 10_000,
  });
  market.markRouteSubmitted("r-submitted", "0xtx-submitted");

  failSanctions(policy);
  assert.equal(market.getRoute("r-submitted").state, "SUBMITTED");

  market.failSubmittedRoute({
    routeId: "r-submitted",
    eventId: "event-failed",
    reason: "CHAIN_REVERT",
  });
  assert.equal(market.getRoute("r-submitted").state, "FAILED");

  assert.deepEqual(
    market.aggregateDepth({ inputToken: INPUT, outputToken: OUTPUT }),
    [],
  );
  assert.equal(market.getOrder(order.orderHash).state, "POLICY_BLOCKED");

  market.close();
  policy.close();
});
