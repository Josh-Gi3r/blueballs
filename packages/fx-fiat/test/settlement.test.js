import test from "node:test";
import assert from "node:assert/strict";

import { FiatSettlementStore, hashFiatIntent, hashRef } from "../src/index.js";

const NOW = 1_000_000;

function intent(id = "fiat-1") {
  return {
    intentId: id,
    routeId: "route-1",
    edgeId: "edge-1",
    edgeType: "VERIFIED_FIAT_PAYMENT",
    finalityClass: "ATTESTED_EXTERNAL",
    payerParticipantId: "payer",
    payeeParticipantId: "payee",
    payerAccountRef: "bank:payer",
    payeeAccountRef: "bank:payee",
    currency: "MYR",
    amount: "10000",
    rail: "DUITNOW",
    providerId: "provider-1",
    policyAuthorizationId: "auth-1",
    createdAt: NOW,
    expiresAt: NOW + 60_000,
    nonce: "1",
  };
}

function attestation(i, overrides = {}) {
  return {
    attestationId: `att-${i.intentId}`,
    intentId: i.intentId,
    intentHash: hashFiatIntent(i),
    verifierId: "verifier-1",
    paymentId: `payment-${i.intentId}`,
    currency: i.currency,
    amount: i.amount,
    payerRefHash: hashRef(i.payerAccountRef),
    payeeRefHash: hashRef(i.payeeAccountRef),
    settledAt: NOW + 1_000,
    issuedAt: NOW + 1_100,
    expiresAt: NOW + 30_000,
    status: "VERIFIED",
    proofRef: "opaque:proof",
    ...overrides,
  };
}

function submitted(store, id = "fiat-1") {
  const i = intent(id);
  store.createIntent(i);
  store.reserveIntent(i.intentId);
  store.submitIntent(i.intentId, `submission:${id}`);
  return i;
}

test("fiat intent hash is deterministic bytes32 hex", () => {
  const first = hashFiatIntent(intent());
  const second = hashFiatIntent({ ...intent() });
  assert.equal(first, second);
  assert.match(first, /^0x[0-9a-f]{64}$/);
});

test("external fiat intent cannot be cancelled after submission", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  const i = submitted(store);
  assert.throws(
    () => store.cancelIntent(i.intentId),
    /cannot transition SUBMITTED to CANCELLED/,
  );
  assert.equal(store.getIntent(i.intentId).state, "SUBMITTED");
  store.close();
});

test("verified attestation must match exact intent economics and counterparties", () => {
  for (const [field, value, message] of [
    ["currency", "SGD", /currency mismatch/],
    ["amount", "9999", /amount mismatch/],
    ["payerRefHash", hashRef("wrong-payer"), /payer mismatch/],
    ["payeeRefHash", hashRef("wrong-payee"), /payee mismatch/],
    ["intentHash", `0x${"11".repeat(32)}`, /intent hash mismatch/],
  ]) {
    const store = new FiatSettlementStore({ now: () => NOW });
    store.registerVerifier({ verifierId: "verifier-1", verifierType: "TEE" });
    const i = submitted(store, `intent-${field}`);
    assert.throws(
      () => store.acceptAttestation(attestation(i, { [field]: value })),
      message,
    );
    assert.equal(store.getIntent(i.intentId).state, "SUBMITTED");
    store.close();
  }
});

test("disabled verifier cannot attest a fiat payment", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({
    verifierId: "verifier-1",
    verifierType: "TEE",
    enabled: false,
  });
  const i = submitted(store);
  assert.throws(
    () => store.acceptAttestation(attestation(i)),
    /verifier not enabled/,
  );
  store.close();
});

test("one payment id cannot satisfy two intents", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({ verifierId: "verifier-1", verifierType: "TEE" });

  const first = submitted(store, "first");
  store.acceptAttestation(attestation(first, { paymentId: "shared-payment" }));

  const second = submitted(store, "second");
  assert.throws(
    () =>
      store.acceptAttestation(
        attestation(second, { paymentId: "shared-payment" }),
      ),
    (error) => error.code === "PAYMENT_REPLAY",
  );
  assert.equal(store.getIntent(second.intentId).state, "SUBMITTED");
  store.close();
});

test("duplicate attestation delivery is idempotent", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({
    verifierId: "verifier-1",
    verifierType: "BANK_API",
  });
  const i = submitted(store);
  const proof = attestation(i);
  assert.deepEqual(store.acceptAttestation(proof), {
    duplicate: false,
    attestationId: proof.attestationId,
  });
  assert.deepEqual(store.acceptAttestation(proof), {
    duplicate: true,
    attestationId: proof.attestationId,
  });
  assert.equal(store.getIntent(i.intentId).state, "VERIFIED");
  store.close();
});

test("verified intent settles once and duplicate settlement event is idempotent", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({
    verifierId: "verifier-1",
    verifierType: "INTERNAL_LEDGER",
  });
  const i = submitted(store);
  store.acceptAttestation(attestation(i));

  assert.deepEqual(store.settleVerifiedIntent(i.intentId, "event-1"), {
    duplicate: false,
  });
  assert.equal(store.getIntent(i.intentId).state, "SETTLED");
  assert.deepEqual(store.settleVerifiedIntent(i.intentId, "event-1"), {
    duplicate: true,
  });
  store.close();
});

test("unsubmitted intent can expire but submitted intent requires explicit failure/review", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  const a = intent("unsubmitted");
  a.expiresAt = NOW + 10;
  store.createIntent(a);
  store.reserveIntent(a.intentId);
  assert.equal(store.expireIntents(NOW + 11), 1);
  assert.equal(store.getIntent(a.intentId).state, "EXPIRED");

  const b = submitted(store, "submitted");
  assert.equal(store.expireIntents(NOW + 100_000), 0);
  assert.equal(store.getIntent(b.intentId).state, "SUBMITTED");
  store.failIntent(b.intentId, "BANK_RETURNED_PAYMENT");
  assert.equal(store.getIntent(b.intentId).state, "FAILED");
  store.close();
});
