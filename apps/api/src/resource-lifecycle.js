/** Cross-product resource lifecycle invariants.
 *
 * Route handlers own their domain logic, but some prerequisites span product
 * families and must be identical everywhere. This module is deliberately small:
 * it prevents new financial/provider work from being created against logically
 * closed/deleted resources before the handler can mutate state.
 */
import { ApiError } from "./lib.js";

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

/** Run after authentication, route permission and request-contract validation.
 * Foreign resources stay 404 to preserve tenant-isolation semantics. */
export function assertResourceLifecycle({ method, pattern, ctx, db }) {
  const body = ctx.body ?? {};
  const key = ctx.key;

  if (method === "POST" && pattern === "/v2/accounts") {
    activeCustomer(db, body.customer, key);
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
