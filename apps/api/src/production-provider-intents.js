/** Production command -> provider-operation mapping.
 *
 * Sandbox routes may generate deterministic reference artifacts. Production
 * mode strips those artifacts before commit and queues a durable provider job in
 * the same local transaction. Provider payloads are sealed before they enter the
 * durable outbox so identity/account/card data is not stored as plaintext job JSON.
 */
import { publicShape } from "./public-shape.js";
import { sealProviderPayload } from "./provider-payload-crypto.js";

const RECEIVING_INSTRUMENT_FIELDS = [
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

const protectedPayload = (value) => sealProviderPayload(publicShape(value ?? {}));

function rewriteCurrentEvent(db, commandId, oldType, newType, data) {
  for (const event of db.events) {
    if (event.command_id !== commandId || event.type !== oldType) continue;
    event.type = newType;
    event.data = publicShape(data);
  }
}

function destinationFor(db, id) {
  if (!id) return null;
  for (const recipient of db.recipients.values()) {
    const destination = recipient.destinations?.find(
      (candidate) => candidate.id === id,
    );
    if (destination) return { recipient, destination };
  }
  return null;
}

/** Normalize a successful core handler result for production and atomically
 * queue any required external side effect. Returns the public resource source
 * that the route wrapper should serialize. */
export function prepareProductionProviderIntent({
  mode,
  method,
  pattern,
  ctx,
  result,
  db,
  commandId,
  queue,
}) {
  if (mode !== "production" || !result) return result;

  // Core accounts are valid internal ledger containers in production, but the
  // account handler also creates deterministic sandbox IBAN/ABA/PayNow details.
  // Those coordinates are teaching fixtures, never provider-issued instruments.
  // Production accounts therefore start without receiving coordinates and use
  // POST /v2/accounts/:id/details to provision a real provider-backed instrument.
  if (method === "POST" && pattern === "/v2/accounts") {
    const account = db.accounts.get(result.id);
    if (!account) {
      throw new Error(
        `Account ${result.id} vanished before production normalization`,
      );
    }
    account.details = null;
    rewriteCurrentEvent(
      db,
      commandId,
      "account.opened",
      "account.opened",
      account,
    );
    return {
      ...account,
      balance: result.balance,
    };
  }

  if (method === "POST" && pattern === "/v2/transfers") {
    const transfer = db.transfers.get(result.id);
    if (!transfer)
      throw new Error(`Transfer ${result.id} vanished before provider queue`);
    const destination = destinationFor(db, transfer.destination);
    const job = queue({
      capability: "payments.transfer",
      action: "submit",
      resource_type: "transfer",
      resource_id: transfer.id,
      owner: transfer.owner,
      payload: protectedPayload({
        transfer: publicShape(transfer),
        recipient: destination
          ? { id: destination.recipient.id, name: destination.recipient.name }
          : null,
        destination: destination ? publicShape(destination.destination) : null,
      }),
    });
    transfer.provider_operation_id = job.id;
    transfer.provider_status = "queued";
    return transfer;
  }

  if (method === "POST" && pattern === "/v2/cards") {
    const card = db.cards?.get(result.id);
    if (!card) throw new Error(`Card ${result.id} vanished before provider queue`);

    // The sandbox card generator creates plausible last4/BIN/expiry values.
    // They are never production issuer data and must not survive the command.
    card.last4 = null;
    card.bin = null;
    card.expires = null;
    card.status = "pending_issuance";
    card.status_reason = "provider_submission_pending";
    card.provider_reference = null;
    card.provider_state = null;

    const job = queue({
      capability: "cards.issuing",
      action: "issue",
      resource_type: "card",
      resource_id: card.id,
      owner: card.owner,
      payload: protectedPayload({
        card: publicShape(card),
        customer: publicShape(db.customers.get(card.customer)),
        account: publicShape(db.accounts.get(card.account)),
      }),
    });
    card.provider_operation_id = job.id;
    card.provider_status = "queued";
    rewriteCurrentEvent(
      db,
      commandId,
      "card.issued",
      "card.issuance_requested",
      card,
    );
    return card;
  }

  if (method === "POST" && pattern === "/v2/accounts/:id/details") {
    const detail = db.details?.get(result.id);
    if (!detail) {
      throw new Error(
        `Receiving-detail ${result.id} vanished before provider queue`,
      );
    }
    for (const field of RECEIVING_INSTRUMENT_FIELDS) delete detail[field];
    detail.status = "pending_provisioning";
    detail.provider_reference = null;
    detail.provider_state = null;

    const account = db.accounts.get(detail.account);
    const job = queue({
      capability: "accounts.receiving_details",
      action: "issue",
      resource_type: "receiving_detail",
      resource_id: detail.id,
      owner: detail.owner,
      payload: protectedPayload({
        account: publicShape(account),
        rail: detail.rail,
        currency: detail.currency,
      }),
    });
    detail.provider_operation_id = job.id;
    detail.provider_status = "queued";
    rewriteCurrentEvent(
      db,
      commandId,
      "account_details.issued",
      "account_details.issuance_requested",
      detail,
    );
    return detail;
  }

  if (method === "POST" && pattern === "/v2/applications/:id/submit") {
    const application = db.applications?.get(result.id);
    if (!application) {
      throw new Error(`Application ${result.id} vanished before provider queue`);
    }
    const job = queue({
      capability: "identity.verification",
      action: "submit",
      resource_type: "application",
      resource_id: application.id,
      owner: application.owner,
      payload: protectedPayload({ application: publicShape(application) }),
    });
    application.provider_operation_id = job.id;
    application.provider_status = "queued";
    return application;
  }

  return result;
}
