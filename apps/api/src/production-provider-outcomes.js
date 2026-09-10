/** Provider outcome -> canonical banking state transitions.
 *
 * These handlers run inside the provider outbox's serialized SQLite unit of
 * work, so provider evidence, resource state, ledger movements, events and audit
 * correlation commit together.
 */
import { balanceOf, db, emit, post, toMinor } from "./lib.js";
import {
  openProviderReconciliationCase,
  registerProviderOutcomeHandler,
} from "./provider-outbox.js";

const now = () => new Date().toISOString();
const SAFE_REFUND_STATES = new Set([
  "not_sent",
  "returned",
  "rejected_before_submission",
]);

function attachProviderEvidence(resource, job, result) {
  resource.provider_operation_id = job.id;
  resource.provider_reference =
    result.provider_reference ?? job.provider_reference ?? null;
  resource.provider_state = result.provider_state ?? job.provider_state ?? null;
  resource.provider_status = result.outcome;
}

function setTransferStatus(transfer, status, reason = null) {
  const previous = transfer.status;
  transfer.status = status;
  transfer.status_reason = reason;
  for (const leg of transfer.legs ?? []) leg.status = status;
  transfer.updated_at = now();
  if (previous !== status) {
    emit(
      "transfer.status_changed",
      {
        id: transfer.id,
        previous_status: previous,
        current_status: status,
        status_reason: reason,
      },
      { tenantId: transfer.owner },
    );
  }
}

registerProviderOutcomeHandler(
  "payments.transfer",
  "submit",
  async ({ job, result }) => {
    const transfer = db.transfers.get(job.resource_id);
    if (!transfer) return;
    attachProviderEvidence(transfer, job, result);

    if (result.outcome === "pending") {
      setTransferStatus(
        transfer,
        transfer.status === "funds_received" ? "submitted" : transfer.status,
        "provider_processing",
      );
      transfer.submitted_at ??= now();
      return;
    }

    if (result.outcome === "ambiguous") {
      setTransferStatus(transfer, "confirming", "provider_outcome_ambiguous");
      transfer.reconciliation_required = true;
      return;
    }

    if (result.outcome === "succeeded") {
      const amount = toMinor(transfer.amount.amount);
      // The clearing balance represented funds reserved for the provider. Once
      // final external settlement is confirmed, move that reservation to an
      // external settlement system account before declaring the transfer final.
      post(
        [
          {
            account: `clearing:${transfer.rail}`,
            currency: transfer.amount.currency,
            amount: -amount,
          },
          {
            account: `external:settled:${transfer.rail}`,
            currency: transfer.amount.currency,
            amount,
          },
        ],
        `provider settlement ${transfer.id}`,
      );
      transfer.reconciliation_required = false;
      transfer.settled_at = now();
      setTransferStatus(transfer, "settled", null);
      return;
    }

    if (result.outcome === "failed") {
      if (SAFE_REFUND_STATES.has(result.funds_state)) {
        const amount = toMinor(transfer.amount.amount);
        post(
          [
            {
              account: `clearing:${transfer.rail}`,
              currency: transfer.amount.currency,
              amount: -amount,
            },
            {
              account: transfer.from,
              currency: transfer.amount.currency,
              amount,
            },
          ],
          `provider failure refund ${transfer.id}`,
        );
        transfer.refunded_at = now();
        transfer.reconciliation_required = false;
        setTransferStatus(
          transfer,
          "failed",
          result.error_code ?? "provider_rejected",
        );
        return;
      }

      // Never refund a transfer whose external funds position is unknown. Doing
      // so could create customer money while the provider also completed it.
      transfer.reconciliation_required = true;
      setTransferStatus(
        transfer,
        "confirming",
        result.error_code ?? "provider_failure_funds_state_unknown",
      );
      openProviderReconciliationCase(
        job,
        "transfer_failure_requires_funds_reconciliation",
        result,
      );
    }
  },
);

const CARD_SAFE_FIELDS = [
  "last4",
  "bin",
  "expires",
  "processor_token",
  "network",
  "status_reason",
];

registerProviderOutcomeHandler(
  "cards.issuing",
  "issue",
  async ({ job, result }) => {
    const card = db.cards?.get(job.resource_id);
    if (!card) return;
    attachProviderEvidence(card, job, result);

    if (result.outcome === "pending" || result.outcome === "ambiguous") {
      card.status = "pending_issuance";
      card.status_reason =
        result.outcome === "ambiguous"
          ? "provider_outcome_ambiguous"
          : "provider_processing";
      card.reconciliation_required = result.outcome === "ambiguous";
      card.updated_at = now();
      return;
    }

    if (result.outcome === "failed") {
      card.status = "issuance_failed";
      card.status_reason = result.error_code ?? "provider_rejected";
      card.reconciliation_required = false;
      card.updated_at = now();
      return;
    }

    const providerCard = result.result ?? {};
    for (const field of CARD_SAFE_FIELDS) {
      if (providerCard[field] !== undefined) card[field] = providerCard[field];
    }
    // Never persist sensitive authentication data even if a badly-behaved
    // gateway includes it in a response.
    delete card.pan;
    delete card.cvv;
    delete card.cvc;
    delete card.pin;

    if (card.last4 !== null && !/^\d{4}$/.test(String(card.last4))) {
      card.last4 = null;
    }
    if (
      card.bin !== null &&
      card.bin !== undefined &&
      !/^\d{6,8}$/.test(String(card.bin))
    ) {
      card.bin = null;
    }
    card.status = ["active", "pending_activation"].includes(providerCard.status)
      ? providerCard.status
      : card.type === "physical"
        ? "pending_activation"
        : "active";
    card.status_reason = providerCard.status_reason ?? null;
    card.issued_at = now();
    card.updated_at = card.issued_at;

    if (!card.provider_reference && !card.processor_token && !card.last4) {
      card.status = "pending_issuance";
      card.status_reason = "provider_result_missing_card_reference";
      card.reconciliation_required = true;
      openProviderReconciliationCase(
        job,
        "card_issue_success_missing_reference",
        result,
      );
    } else {
      card.reconciliation_required = false;
    }

    emit(
      "card.issued",
      {
        id: card.id,
        status: card.status,
        last4: card.last4,
        provider_reference: card.provider_reference,
      },
      { tenantId: card.owner },
    );
  },
);

const RECEIVING_FIELDS = [
  "type",
  "iban",
  "bic",
  "account_number",
  "routing_number",
  "sort_code",
  "proxy",
  "address",
  "network",
];

registerProviderOutcomeHandler(
  "accounts.receiving_details",
  "issue",
  async ({ job, result }) => {
    const detail = db.details?.get(job.resource_id);
    if (!detail) return;
    attachProviderEvidence(detail, job, result);

    if (result.outcome === "pending" || result.outcome === "ambiguous") {
      detail.status = "pending_provisioning";
      detail.reconciliation_required = result.outcome === "ambiguous";
      detail.updated_at = now();
      return;
    }

    if (result.outcome === "failed") {
      detail.status = "provisioning_failed";
      detail.error_code = result.error_code ?? "provider_rejected";
      detail.reconciliation_required = false;
      detail.updated_at = now();
      return;
    }

    const instrument = result.result?.instrument ?? result.result ?? {};
    for (const field of RECEIVING_FIELDS) {
      if (instrument[field] !== undefined) detail[field] = instrument[field];
    }
    const hasIdentifier = ["iban", "account_number", "proxy", "address"].some(
      (field) => typeof detail[field] === "string" && detail[field].length > 0,
    );
    if (!hasIdentifier) {
      detail.status = "pending_provisioning";
      detail.reconciliation_required = true;
      openProviderReconciliationCase(
        job,
        "receiving_detail_success_missing_instrument",
        result,
      );
    } else {
      detail.status = "active";
      detail.reconciliation_required = false;
      detail.issued_at = now();
      emit(
        "account_details.issued",
        {
          id: detail.id,
          account: detail.account,
          rail: detail.rail,
          status: detail.status,
        },
        { tenantId: detail.owner },
      );
    }
    detail.updated_at = now();
  },
);

registerProviderOutcomeHandler(
  "identity.verification",
  "submit",
  async ({ job, result }) => {
    const application = db.applications?.get(job.resource_id);
    if (!application) return;
    attachProviderEvidence(application, job, result);

    if (result.outcome === "pending" || result.outcome === "ambiguous") {
      application.status = "compliance_review";
      application.reconciliation_required = result.outcome === "ambiguous";
      application.updated_at = now();
      return;
    }

    if (result.outcome === "failed") {
      // Provider/integration failure is not a negative KYC decision.
      application.status = "compliance_review";
      application.integration_error = result.error_code ?? "provider_failure";
      application.reconciliation_required = true;
      application.updated_at = now();
      openProviderReconciliationCase(
        job,
        "identity_provider_failure_requires_review",
        result,
      );
      return;
    }

    const decision = result.result?.decision;
    if (!["approved", "declined", "withdrawn"].includes(decision)) {
      application.status = "compliance_review";
      application.reconciliation_required = true;
      application.integration_error = "provider_result_missing_decision";
      application.updated_at = now();
      openProviderReconciliationCase(
        job,
        "identity_success_missing_canonical_decision",
        result,
      );
      return;
    }

    const previous = application.status;
    application.status = "completed";
    application.decision = decision;
    application.reconciliation_required = false;
    application.integration_error = null;
    application.completed_at = now();
    application.updated_at = application.completed_at;
    emit(
      "application.status_changed",
      {
        id: application.id,
        previous_status: previous,
        current_status: application.status,
        decision,
      },
      { tenantId: application.owner },
    );
  },
);

registerProviderOutcomeHandler(
  "custody.wallet",
  "create",
  async ({ job, result }) => {
    const wallet = db.wallets?.get(job.resource_id);
    if (!wallet) return;
    attachProviderEvidence(wallet, job, result);

    if (result.outcome === "pending" || result.outcome === "ambiguous") {
      wallet.status = "pending_provisioning";
      wallet.reconciliation_required = result.outcome === "ambiguous";
      wallet.updated_at = now();
      return;
    }

    if (result.outcome === "failed") {
      wallet.status = "provisioning_failed";
      wallet.status_reason = result.error_code ?? "provider_rejected";
      wallet.reconciliation_required = false;
      wallet.updated_at = now();
      return;
    }

    const provisioned = result.result ?? {};
    wallet.address = provisioned.address;
    if (provisioned.network) wallet.network = provisioned.network;
    wallet.status = "active";
    wallet.status_reason = null;
    wallet.reconciliation_required = false;
    wallet.provisioned_at = now();
    wallet.updated_at = wallet.provisioned_at;
    emit(
      "wallet.provisioned",
      {
        id: wallet.id,
        network: wallet.network,
        address: wallet.address,
        provider_reference: wallet.provider_reference,
      },
      { tenantId: wallet.owner },
    );
  },
);

function custodySendEvent(job) {
  const rows = [...db.events];
  for (let index = rows.length - 1; index >= 0; index--) {
    const event = rows[index];
    if (
      event.command_id === job.command_id &&
      event.tenant_id === job.owner &&
      event.type === "wallet.send_requested"
    ) {
      return event;
    }
  }
  return null;
}

registerProviderOutcomeHandler(
  "custody.transfer",
  "submit",
  async ({ job, result }) => {
    const evidence = custodySendEvent(job);
    if (!evidence) {
      openProviderReconciliationCase(job, "custody_send_local_evidence_missing", result);
      return;
    }
    const walletId = evidence.data?.wallet;
    const money = evidence.data?.amount;
    const wallet = db.wallets?.get(walletId);
    if (!wallet || !money?.amount || !money?.currency) {
      openProviderReconciliationCase(job, "custody_send_local_evidence_invalid", result);
      return;
    }
    const amount = toMinor(money.amount);

    if (result.outcome === "pending") {
      emit(
        "wallet.send_submitted",
        {
          id: job.resource_id,
          wallet: wallet.id,
          amount: money,
          provider_operation_id: job.id,
          provider_reference: result.provider_reference ?? job.provider_reference ?? null,
        },
        { tenantId: wallet.owner },
      );
      return;
    }

    if (result.outcome === "ambiguous") {
      openProviderReconciliationCase(job, "custody_transfer_outcome_ambiguous", result);
      emit(
        "wallet.send_confirming",
        {
          id: job.resource_id,
          wallet: wallet.id,
          amount: money,
          provider_operation_id: job.id,
        },
        { tenantId: wallet.owner },
      );
      return;
    }

    if (result.outcome === "succeeded") {
      post(
        [
          { account: "clearing:custody", currency: money.currency, amount: -amount },
          {
            account: "external:settled:custody",
            currency: money.currency,
            amount,
          },
        ],
        `custody settlement ${job.resource_id}`,
      );
      emit(
        "wallet.send_settled",
        {
          id: job.resource_id,
          wallet: wallet.id,
          amount: money,
          provider_operation_id: job.id,
          provider_reference: result.provider_reference ?? job.provider_reference ?? null,
          settled_at: now(),
        },
        { tenantId: wallet.owner },
      );
      return;
    }

    if (result.outcome === "failed" && SAFE_REFUND_STATES.has(result.funds_state)) {
      post(
        [
          { account: "clearing:custody", currency: money.currency, amount: -amount },
          { account: wallet.id, currency: money.currency, amount },
        ],
        `custody failure refund ${job.resource_id}`,
      );
      emit(
        "wallet.send_failed",
        {
          id: job.resource_id,
          wallet: wallet.id,
          amount: money,
          provider_operation_id: job.id,
          error_code: result.error_code ?? "provider_rejected",
          refunded: true,
        },
        { tenantId: wallet.owner },
      );
      return;
    }

    if (result.outcome === "failed") {
      // Unknown/submitted funds state is never refunded automatically; that
      // could duplicate customer funds while the custodian also completed it.
      openProviderReconciliationCase(
        job,
        "custody_transfer_failure_requires_funds_reconciliation",
        result,
      );
      emit(
        "wallet.send_confirming",
        {
          id: job.resource_id,
          wallet: wallet.id,
          amount: money,
          provider_operation_id: job.id,
          error_code: result.error_code ?? "provider_failure_funds_state_unknown",
        },
        { tenantId: wallet.owner },
      );
    }
  },
);
