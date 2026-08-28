import { hashRef } from "./settlement-store.js";
import { hashFiatIntent } from "./intent.js";

function requireStore(store) {
  if (!store || typeof store.acceptAttestation !== "function") {
    throw new TypeError("FiatSettlementStore required");
  }
}

export class InternalLedgerVerifier {
  constructor({
    store,
    verifierId = "internal-ledger",
    now = () => Date.now(),
  } = {}) {
    requireStore(store);
    this.store = store;
    this.verifierId = verifierId;
    this.now = now;
    this.store.registerVerifier({
      verifierId,
      verifierType: "INTERNAL_LEDGER",
    });
  }

  attest(intent, ledgerEvent) {
    if (!ledgerEvent || ledgerEvent.status !== "POSTED") {
      return { status: "REJECTED", reason: "LEDGER_EVENT_NOT_POSTED" };
    }
    if (ledgerEvent.intentId !== intent.intentId) {
      return { status: "REJECTED", reason: "INTENT_MISMATCH" };
    }

    const attestation = {
      attestationId: `internal:${ledgerEvent.eventId}`,
      intentId: intent.intentId,
      intentHash: hashFiatIntent(intent),
      verifierId: this.verifierId,
      paymentId: ledgerEvent.eventId,
      currency: ledgerEvent.currency,
      amount: String(ledgerEvent.amount),
      payerRefHash: hashRef(ledgerEvent.payerAccountRef),
      payeeRefHash: hashRef(ledgerEvent.payeeAccountRef),
      settledAt: ledgerEvent.postedAt,
      issuedAt: this.now(),
      expiresAt: Math.min(intent.expiresAt, this.now() + 60_000),
      status: "VERIFIED",
      proofRef: ledgerEvent.eventId,
    };

    try {
      const result = this.store.acceptAttestation(attestation);
      return { status: "VERIFIED", ...result, attestation };
    } catch (error) {
      return { status: "REJECTED", reason: error.message, code: error.code };
    }
  }
}

export class AttestedPaymentVerifier {
  constructor({ store, verifierId, verifierType = "ATTESTED_PAYMENT" } = {}) {
    requireStore(store);
    if (typeof verifierId !== "string" || verifierId.length === 0) {
      throw new TypeError("verifierId required");
    }
    this.store = store;
    this.verifierId = verifierId;
    this.store.registerVerifier({ verifierId, verifierType });
  }

  verify(intent, evidence) {
    if (!evidence || typeof evidence !== "object") {
      return { status: "REJECTED", reason: "EVIDENCE_REQUIRED" };
    }
    if (evidence.status === "PENDING") return { status: "PENDING" };
    if (evidence.status === "MANUAL_REVIEW") {
      return {
        status: "MANUAL_REVIEW",
        reason: evidence.reason ?? "PROVIDER_REVIEW",
      };
    }
    if (evidence.status !== "VERIFIED") {
      return {
        status: "REJECTED",
        reason: evidence.reason ?? "PROVIDER_REJECTED",
      };
    }

    const attestation = {
      attestationId: evidence.attestationId,
      intentId: intent.intentId,
      intentHash: evidence.intentHash,
      verifierId: this.verifierId,
      paymentId: evidence.paymentId,
      currency: evidence.currency,
      amount: String(evidence.amount),
      payerRefHash: evidence.payerRefHash,
      payeeRefHash: evidence.payeeRefHash,
      settledAt: evidence.settledAt,
      issuedAt: evidence.issuedAt,
      expiresAt: evidence.expiresAt,
      status: "VERIFIED",
      proofRef: evidence.proofRef ?? null,
    };

    try {
      const result = this.store.acceptAttestation(attestation);
      return { status: "VERIFIED", ...result, attestation };
    } catch (error) {
      return { status: "REJECTED", reason: error.message, code: error.code };
    }
  }
}
