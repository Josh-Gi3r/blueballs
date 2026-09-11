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
    createdAt: NOW - 1_000,
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
    settledAt: NOW - 100,
    issuedAt: NOW,
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

test("fiat intent hash is deterministic bytes32 hex and requires explicit nonce", () => {
  const first = hashFiatIntent(intent());
  const second = hashFiatIntent({ ...intent() });
  assert.equal(first, second);
  assert.match(first, /^0x[0-9a-f]{64}$/);
  const missing = intent("missing-nonce");
  delete missing.nonce;
  assert.throws(() => hashFiatIntent(missing), /nonce required/);
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

test("future-dated payment evidence is rejected", () => {
  for (const [field, value] of [
    ["settledAt", NOW + 1],
    ["issuedAt", NOW + 1],
  ]) {
    const store = new FiatSettlementStore({ now: () => NOW });
    store.registerVerifier({ verifierId: "verifier-1", verifierType: "TEE" });
    const i = submitted(store, `future-${field}`);
    assert.throws(
      () => store.acceptAttestation(attestation(i, { [field]: value })),
      new RegExp(`${field} invalid`),
    );
    assert.equal(store.getIntent(i.intentId).state, "SUBMITTED");
    store.close();
  }
});

test("observed payment timestamp cannot be in the future", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  const i = submitted(store, "future-observation");
  assert.throws(() => store.observePayment(i.intentId, NOW + 1), /observedAt invalid/);
  assert.equal(store.getIntent(i.intentId).state, "SUBMITTED");
  store.close();
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

test("one provider payment id cannot satisfy two intents even through different verifiers", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({ verifierId: "verifier-1", verifierType: "TEE" });
  store.registerVerifier({ verifierId: "verifier-2", verifierType: "BANK_API" });

  const first = submitted(store, "first");
  store.acceptAttestation(attestation(first, { paymentId: "shared-payment" }));

  const second = submitted(store, "second");
  assert.throws(
    () =>
      store.acceptAttestation(
        attestation(second, {
          attestationId: "att-second-other-verifier",
          verifierId: "verifier-2",
          paymentId: "shared-payment",
        }),
      ),
    (error) => error.code === "PAYMENT_REPLAY",
  );
  assert.equal(store.getIntent(second.intentId).state, "SUBMITTED");
  store.close();
});

test("duplicate attestation delivery is idempotent only for identical evidence", () => {
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
  assert.deepEqual(store.acceptAttestation({ ...proof }), {
    duplicate: true,
    attestationId: proof.attestationId,
  });
  assert.throws(
    () => store.acceptAttestation({ ...proof, proofRef: "different-proof" }),
    /different evidence/,
  );
  assert.equal(store.getIntent(i.intentId).state, "VERIFIED");
  store.close();
});

test("verified intent settles once and settlement event ids cannot cross intents", () => {
  const store = new FiatSettlementStore({ now: () => NOW });
  store.registerVerifier({
    verifierId: "verifier-1",
    verifierType: "INTERNAL_LEDGER",
  });
  const first = submitted(store, "settle-first");
  store.acceptAttestation(attestation(first));

  assert.deepEqual(store.settleVerifiedIntent(first.intentId, "event-1"), {
    duplicate: false,
  });
  assert.equal(store.getIntent(first.intentId).state, "SETTLED");
  assert.deepEqual(store.settleVerifiedIntent(first.intentId, "event-1"), {
    duplicate: true,
  });

  const second = submitted(store, "settle-second");
  store.acceptAttestation(attestation(second));
  assert.throws(
    () => store.settleVerifiedIntent(second.intentId, "event-1"),
    (error) => error.code === "PAYMENT_REPLAY",
  );
  assert.equal(store.getIntent(second.intentId).state, "VERIFIED");
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
