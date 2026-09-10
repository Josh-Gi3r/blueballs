/** Production command -> provider-operation mapping.
 *
 * Sandbox routes may generate deterministic reference artifacts. Production
 * mode strips those artifacts before commit and queues a durable provider job in
 * the same local transaction. Provider payloads are sealed before they enter the
 * durable outbox so identity/account/card/custody data is not stored as plaintext
 * job JSON.
 */
import { ApiError, post, toMinor } from "./lib.js";
import { publicShape } from "./public-shape.js";
import { sealProviderPayload } from "./provider-payload-crypto.js";
import { providerTransportAvailable } from "./provider-transport.js";

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

function protectedPayload(value) {
  if (!providerTransportAvailable()) {
    throw new ApiError(
      "service-unavailable",
      503,
      "No production provider adapter is configured for this operation",
    );
  }
  try {
    return sealProviderPayload(publicShape(value ?? {}));
  } catch (error) {
    throw new ApiError(
      "service-unavailable",
      503,
      error?.code === "PROVIDER_PAYLOAD_TOO_LARGE"
        ? "Provider payload exceeds the configured secure outbox limit"
        : "Production provider payload encryption is not configured correctly",
    );
  }
}

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

function reserveCustodyTransfer({ db, commandId, queue, resource, wallet }) {
  const amount = resource.amount?.amount;
  const currency = resource.amount?.currency;
  if (!wallet || typeof amount !== "string" || !currency) {
    throw new Error("Custody transfer requires a wallet and exact money object");
  }
  const minor = toMinor(amount);

  // The generic wallet handler has already debited the wallet and credited its
  // sandbox/reference external account. Replace that staged destination with a
  // custody clearing reservation in the same transaction. No customer money is
  // declared externally settled until the provider confirms finality.
  post(
    [
      {
        account: "external:wallet_send",
        currency,
        amount: -minor,
      },
      {
        account: "clearing:custody",
        currency,
        amount: minor,
      },
    ],
    `custody reservation ${resource.id}`,
  );

  const job = queue({
    capability: "custody.transfer",
    action: "submit",
    resource_type: resource.object === "approval" ? "approval" : "wallet_send",
    resource_id: resource.id,
    owner: wallet.owner,
    payload: protectedPayload({
      wallet: publicShape(wallet),
      transfer: {
        id: resource.id,
        wallet: wallet.id,
        amount: { amount, currency },
        to: resource.to,
        approval: resource.approval ?? null,
      },
    }),
  });

  rewriteCurrentEvent(
    db,
    commandId,
    "wallet.sent",
    "wallet.send_requested",
    {
      id: resource.id,
      wallet: wallet.id,
      amount: { amount, currency },
      to: resource.to,
      approval: resource.approval ?? null,
      status: "funds_reserved",
      provider_operation_id: job.id,
    },
  );
  return job;
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

  if (method === "POST" && pattern === "/v2/wallets") {
    const wallet = db.wallets?.get(result.id);
    if (!wallet) throw new Error(`Wallet ${result.id} vanished before provider queue`);

    // The generic product handler creates a plausible on-chain address for the
    // sandbox. Production must never expose or persist that address as though a
    // custodian actually provisioned it.
    wallet.address = null;
    wallet.status = "pending_provisioning";
    wallet.provider_reference = null;
    wallet.provider_state = null;
    wallet.reconciliation_required = false;

    const job = queue({
      capability: "custody.wallet",
      action: "create",
      resource_type: "wallet",
      resource_id: wallet.id,
      owner: wallet.owner,
      payload: protectedPayload({
        wallet: publicShape(wallet),
        customer: publicShape(db.customers.get(wallet.customer)),
      }),
    });
    wallet.provider_operation_id = job.id;
    wallet.provider_status = "queued";
    rewriteCurrentEvent(
      db,
      commandId,
      "wallet.created",
      "wallet.provisioning_requested",
      wallet,
    );
    return { ...wallet, balance: result.balance };
  }

  if (
    method === "POST" &&
    pattern === "/v2/wallets/:id/send" &&
    result.status === "sent"
  ) {
    const wallet = db.wallets?.get(result.wallet);
    const job = reserveCustodyTransfer({
      db,
      commandId,
      queue,
      resource: result,
      wallet,
    });
    return {
      ...result,
      status: "funds_reserved",
      provider_operation_id: job.id,
      provider_status: "queued",
    };
  }

  if (
    method === "POST" &&
    pattern === "/v2/approvals/:id/approve" &&
    result.status === "executed" &&
    result.wallet &&
    result.amount
  ) {
    const wallet = db.wallets?.get(result.wallet);
    const resource = {
      ...result,
      object: "approval",
      approval: result.id,
    };
    const job = reserveCustodyTransfer({
      db,
      commandId,
      queue,
      resource,
      wallet,
    });
    result.provider_operation_id = job.id;
    result.provider_status = "queued";
    result.execution_status = "funds_reserved";
    return result;
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
