/** Cross-product resource lifecycle invariants.
 *
 * Route handlers own their domain logic, but some prerequisites span product
 * families and must be identical everywhere. This module is deliberately small:
 * it prevents new financial/provider work from being created against logically
 * closed/deleted resources before the handler can mutate state.
 */
import { ApiError } from "./lib.js";
import { bankingEnv } from "./runtime-env.js";

function owned(collection, id, key, noun) {
  const row = collection?.get(id);
  if (!row || !key?.tenant_id || row.owner !== key.tenant_id) {
    throw new ApiError("not-found", 404, `No ${noun} ${id}`);
  }
  return row;
}

function activeCustomer(db, id, key) {
  const customer = owned(db.customers, id, key, "customer");
  if (customer.deleted === true) {
    throw new ApiError(
      "conflict",
      409,
      `Customer ${customer.id} is deleted and cannot receive new financial products`,
    );
  }
  return customer;
}

function openAccount(db, id, key) {
  const account = owned(db.accounts, id, key, "account");
  if (account.status === "closed") {
    throw new ApiError(
      "conflict",
      409,
      `Account ${account.id} is closed and cannot be used for new operations`,
    );
  }
  return account;
}

function customerDependencies(db, customerId) {
  const linked = [];
  if ([...db.accounts.values()].some((row) => row.customer === customerId)) {
    linked.push("account records");
  }
  if (db.wallets && [...db.wallets.values()].some((row) => row.customer === customerId)) {
    linked.push("wallets");
  }
  if (db.cards && [...db.cards.values()].some((row) => row.customer === customerId)) {
    linked.push("cards");
  }
  if (
    db.applications &&
    [...db.applications.values()].some(
      (row) => row.customer === customerId && row.status !== "completed",
    )
  ) {
    linked.push("incomplete onboarding applications");
  }
  if (
    db.mandates &&
    [...db.mandates.values()].some(
      (row) => row.customer === customerId && row.status === "active",
    )
  ) {
    linked.push("active mandates");
  }
  if (
    db.subscriptions &&
    [...db.subscriptions.values()].some(
      (row) => row.customer === customerId && row.status === "active",
    )
  ) {
    linked.push("active subscriptions");
  }
  return linked;
}

/** Run after authentication, route permission and request-contract validation.
 * Foreign resources stay 404 to preserve tenant-isolation semantics. */
export function assertResourceLifecycle({ method, pattern, ctx, db }) {
  const body = ctx.body ?? {};
  const key = ctx.key;

  if (method === "PATCH" && pattern === "/v2/customers/:id") {
    activeCustomer(db, ctx.params.id, key);
    return;
  }

  if (method === "DELETE" && pattern === "/v2/customers/:id") {
    const customer = activeCustomer(db, ctx.params.id, key);
    const dependencies = customerDependencies(db, customer.id);
    if (dependencies.length) {
      throw new ApiError(
        "conflict",
        409,
        `Customer ${customer.id} cannot be deleted while linked ${dependencies.join(", ")} remain`,
      );
    }
    return;
  }

  if (method === "POST" && pattern === "/v2/accounts") {
    activeCustomer(db, body.customer, key);
    return;
  }

  if (method === "PATCH" && pattern === "/v2/accounts/:id") {
    openAccount(db, ctx.params.id, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/applications") {
    if (body.customer) activeCustomer(db, body.customer, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/cards") {
    const customer = activeCustomer(db, body.customer, key);
    const account = openAccount(db, body.account, key);
    if (account.customer !== customer.id) {
      throw new ApiError(
        "validation-error",
        400,
        `Account ${account.id} does not belong to customer ${customer.id}`,
      );
    }
    return;
  }

  if (method === "POST" && pattern === "/v2/wallets") {
    activeCustomer(db, body.customer, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/accounts/:id/details") {
    openAccount(db, ctx.params.id, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/transfers") {
    openAccount(db, body.from, key);
    if (bankingEnv("BANK_API_MODE", "sandbox") === "production") {
      if (!body.recipient || !body.destination) {
        throw new ApiError(
          "validation-error",
          400,
          "Production transfers require an explicit tenant-owned recipient and destination; provider submission never guesses where customer money should land",
        );
      }
    }
    return;
  }

  if (method === "POST" && pattern === "/v2/vaults") {
    openAccount(db, body.account, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/credit") {
    openAccount(db, body.account, key);
    return;
  }

  if (method === "POST" && pattern === "/v2/applications/:id/submit") {
    const application = owned(db.applications, ctx.params.id, key, "application");
    if (application.customer) activeCustomer(db, application.customer, key);
  }
}
