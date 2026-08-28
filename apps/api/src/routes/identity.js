/** IDENTITY family — apps/api/src/routes/identity.js
 *
 *  Owns: Auth & API keys, Customers (update/delete), Onboarding applications,
 *  Accounts (update/close), Receiving details.
 *
 *  Storage note: `db` (from kernel.js) only ships collections for the resources
 *  server.js already needed (keys, customers, accounts, ...). kernel.js does not
 *  re-export the PersistentMap class itself, and this family must not edit
 *  kernel.js/lib.js. The two genuinely new resource types this file introduces
 *  (applications, receiving-details records) still need to survive a server
 *  restart like everything else, so this file replicates lib.js's PersistentMap
 *  pattern locally — same SQLite file, its own table per collection — and
 *  attaches the result onto the shared `db` object. Everything that already has
 *  a persisted home (keys, customers, accounts) is read/written straight
 *  through the existing db.* collections instead.
 */

import {
  route,
  db,
  ksuid,
  need,
  must,
  paginate,
  now,
  ApiError,
  emit,
  randomBytes,
  balanceOf,
  fromMinor,
  RAILS,
  visibleTo,
  collection,
  principalId,
} from "../kernel.js";
import { hashKey } from "../lib.js";
import {
  ibanGenerate,
  abaGenerate,
} from "../../../../packages/validation/src/index.js";

// New collections this family owns, attached onto the shared `db` object.
db.applications ??= collection("applications"); // app_ -> application
db.details ??= collection("details"); // adt_ -> receiving-details record

/* =========================================================================
 * Auth & API keys
 * ========================================================================= */

/** Issue a new key on the same account (email) as the caller's current key. */
route(
  "POST",
  "/v2/keys",
  ({ body, key }) => {
    const requestedScope = body.scope ?? key.scope ?? "sandbox";
    if (requestedScope !== key.scope) {
      throw new ApiError(
        "forbidden",
        403,
        "A key can only create another key with the same scope",
      );
    }
    const secret = "bb_sandbox_" + randomBytes(18).toString("base64url");
    const requestedHours =
      body.lifetime_hours ??
      Number(process.env.SANDBOX_KEY_LIFETIME_HOURS || 24);
    if (
      !Number.isSafeInteger(requestedHours) ||
      requestedHours < 1 ||
      requestedHours > 168
    ) {
      throw new ApiError(
        "validation-error",
        400,
        "lifetime_hours must be between 1 and 168",
      );
    }
    const expires = new Date(
      Date.now() + requestedHours * 60 * 60 * 1000,
    ).toISOString();
    const rec = {
      id: ksuid("key"),
      tenant_id: principalId(key),
      email: key.email,
      scope: requestedScope,
      created_at: now(),
      expires,
    };
    db.keys.set(hashKey(secret), rec);
    emit(
      "key.issued",
      { id: rec.id, scope: rec.scope },
      { tenantId: rec.tenant_id },
    );
    return {
      ...rec,
      key: secret,
      note: `This sandbox key expires at ${expires}. This is the only time the key is shown.`,
    };
  },
  { created: true },
);

route("GET", "/v2/keys/:id", ({ params, key }) => {
  const rec = [...db.keys.values()].find(
    (k) => k.id === params.id && k.tenant_id === principalId(key),
  );
  if (!rec) throw new ApiError("not-found", 404, `No key ${params.id}`);
  return rec;
});

route("DELETE", "/v2/keys/:id", ({ params, key }) => {
  const entry = [...db.keys.entries()].find(
    ([, v]) => v.id === params.id && v.tenant_id === principalId(key),
  );
  if (!entry) throw new ApiError("not-found", 404, `No key ${params.id}`);
  db.keys.delete(entry[0]);
  emit("key.revoked", { id: params.id }, { tenantId: principalId(key) });
  return { id: params.id, object: "key", revoked: true };
});

/** Incident response: revoke every key on the caller's account, including the one in use. */
route("DELETE", "/v2/keys", ({ key }) => {
  const hashes = [...db.keys.entries()]
    .filter(([, v]) => v.tenant_id === principalId(key))
    .map(([h]) => h);
  for (const h of hashes) db.keys.delete(h);
  emit(
    "key.revoked_all",
    { tenant_id: principalId(key), count: hashes.length },
    { tenantId: principalId(key) },
  );
  return { object: "list", data: [], revoked: hashes.length };
});

/* =========================================================================
 * Customers — update / soft delete
 * ========================================================================= */

route("PATCH", "/v2/customers/:id", ({ params, body, key }) => {
  const c = must(db.customers, params.id, "customer", key);
  if (body.name !== undefined) c.name = body.name;
  if (body.email !== undefined) c.email = body.email;
  if (body.client_reference_id !== undefined)
    c.client_reference_id = body.client_reference_id;
  c.updated_at = now();
  db.customers.set(c.id, c);
  emit("customer.updated", c, { tenantId: c.owner });
  return c;
});

/** Soft delete — blocked while the customer still has any account record. */
route("DELETE", "/v2/customers/:id", ({ params, key }) => {
  const c = must(db.customers, params.id, "customer", key);
  const hasAccounts = [...db.accounts.values()].some(
    (a) => a.customer === c.id,
  );
  if (hasAccounts) {
    throw new ApiError(
      "conflict",
      409,
      `Customer ${c.id} still has accounts; close them before deleting the customer`,
    );
  }
  c.deleted = true;
  c.deleted_at = now();
  db.customers.set(c.id, c);
  emit("customer.deleted", { id: c.id }, { tenantId: c.owner });
  return {
    id: c.id,
    object: "customer",
    deleted: true,
    deleted_at: c.deleted_at,
  };
});

/* =========================================================================
 * Onboarding applications
 * ========================================================================= */

/** Once an application is completed, its content is frozen. */
function guardMutable(app) {
  if (app.status === "completed") {
    throw new ApiError(
      "conflict",
      409,
      `Application ${app.id} is already completed and can no longer be edited`,
    );
  }
}

route(
  "POST",
  "/v2/applications",
  ({ body, key }) => {
    need(body, ["type"]);
    if (!["individual", "business"].includes(body.type)) {
      throw new ApiError(
        "validation-error",
        400,
        "type must be individual or business",
        [
          {
            field: "type",
            message: "must be individual or business",
            code: "invalid_value",
          },
        ],
      );
    }
    const app = {
      id: ksuid("app"),
      type: body.type,
      customer: body.customer ?? null,
      status: "pending",
      decision: null,
      business: body.type === "business" ? {} : null,
      individual: body.type === "individual" ? {} : null,
      individuals: [],
      documents: [],
      attestations: [],
      edd: null,
      client_reference_id: body.client_reference_id ?? null,
      owner: principalId(key),
      created_at: now(),
      updated_at: now(),
      submitted_at: null,
    };
    db.applications.set(app.id, app);
    emit("application.created", app, { tenantId: app.owner });
    return app;
  },
  { created: true },
);

route("GET", "/v2/applications", ({ url, key }) =>
  paginate(visibleTo([...db.applications.values()], key), url),
);

route("GET", "/v2/applications/:id", ({ params, key }) =>
  must(db.applications, params.id, "application", key),
);

route("PATCH", "/v2/applications/:id/business", ({ params, body, key }) => {
  const app = must(db.applications, params.id, "application", key);
  guardMutable(app);
  app.business = { ...(app.business ?? {}), ...body };
  app.updated_at = now();
  return app;
});

route("PATCH", "/v2/applications/:id/individual", ({ params, body, key }) => {
  const app = must(db.applications, params.id, "application", key);
  guardMutable(app);
  app.individual = { ...(app.individual ?? {}), ...body };
  app.updated_at = now();
  return app;
});

/** Associated individuals — beneficial owners, directors, signers. */
route(
  "POST",
  "/v2/applications/:id/individuals",
  ({ params, body, key }) => {
    const app = must(db.applications, params.id, "application", key);
    guardMutable(app);
    need(body, ["name"]);
    const ind = { id: ksuid("ind"), ...body, created_at: now() };
    app.individuals.push(ind);
    app.updated_at = now();
    emit(
      "application.individual_added",
      { id: app.id, individual: ind.id },
      { tenantId: app.owner },
    );
    return ind;
  },
  { created: true },
);

route(
  "PATCH",
  "/v2/applications/:id/individuals/:iid",
  ({ params, body, key }) => {
    const app = must(db.applications, params.id, "application", key);
    guardMutable(app);
    const ind = app.individuals.find((i) => i.id === params.iid);
    if (!ind)
      throw new ApiError(
        "not-found",
        404,
        `No individual ${params.iid} on application ${app.id}`,
      );
    Object.assign(ind, body, { id: ind.id, updated_at: now() });
    app.updated_at = now();
    return ind;
  },
);

route("DELETE", "/v2/applications/:id/individuals/:iid", ({ params, key }) => {
  const app = must(db.applications, params.id, "application", key);
  guardMutable(app);
  const idx = app.individuals.findIndex((i) => i.id === params.iid);
  if (idx === -1)
    throw new ApiError(
      "not-found",
      404,
      `No individual ${params.iid} on application ${app.id}`,
    );
  app.individuals.splice(idx, 1);
  app.updated_at = now();
  return { id: params.iid, object: "individual", deleted: true };
});

/** Documents — content travels as a base64 string; this is a sandbox, not blob storage. */
route(
  "POST",
  "/v2/applications/:id/documents",
  ({ params, body, key }) => {
    const app = must(db.applications, params.id, "application", key);
    guardMutable(app);
    need(body, ["type", "content"]);
    const doc = {
      id: ksuid("doc"),
      type: body.type,
      filename: body.filename ?? null,
      content_type: body.content_type ?? "application/octet-stream",
      content: body.content,
      created_at: now(),
    };
    app.documents.push(doc);
    app.updated_at = now();
    emit(
      "application.document_uploaded",
      { id: app.id, document: doc.id },
      { tenantId: app.owner },
    );
    return doc;
  },
  { created: true },
);

route("GET", "/v2/applications/:id/documents/:did", ({ params, key }) => {
  const app = must(db.applications, params.id, "application", key);
  const doc = app.documents.find((d) => d.id === params.did);
  if (!doc)
    throw new ApiError(
      "not-found",
      404,
      `No document ${params.did} on application ${app.id}`,
    );
  return doc;
});

route("DELETE", "/v2/applications/:id/documents/:did", ({ params, key }) => {
  const app = must(db.applications, params.id, "application", key);
  guardMutable(app);
  const idx = app.documents.findIndex((d) => d.id === params.did);
  if (idx === -1)
    throw new ApiError(
      "not-found",
      404,
      `No document ${params.did} on application ${app.id}`,
    );
  app.documents.splice(idx, 1);
  app.updated_at = now();
  return { id: params.did, object: "document", deleted: true };
});

/** Submit for verification — lifecycle status only, decision is untouched. */
route("POST", "/v2/applications/:id/submit", ({ params, key }) => {
  const app = must(db.applications, params.id, "application", key);
  if (app.status !== "pending") {
    throw new ApiError(
      "conflict",
      409,
      `Application ${app.id} is already ${app.status}`,
    );
  }
  app.status = "submitted";
  app.submitted_at = now();
  app.updated_at = now();
  emit(
    "application.status_changed",
    { id: app.id, previous_status: "pending", current_status: "submitted" },
    { tenantId: app.owner },
  );
  return app;
});

route("POST", "/v2/applications/:id/attestation", ({ params, body, key }) => {
  const app = must(db.applications, params.id, "application", key);
  need(body, ["statement", "agreed"]);
  if (body.agreed !== true) {
    throw new ApiError(
      "validation-error",
      400,
      "Attestation must be agreed to",
      [{ field: "agreed", message: "must be true", code: "not_agreed" }],
    );
  }
  const att = {
    id: ksuid("att"),
    statement: body.statement,
    agreed: true,
    agreed_at: now(),
  };
  app.attestations.push(att);
  app.updated_at = now();
  emit(
    "application.attestation_submitted",
    { id: app.id, attestation: att.id },
    { tenantId: app.owner },
  );
  return att;
});

/** Enhanced due diligence. A sandbox shortcut: passing `decision` resolves the
 *  application straight to `completed`, same spirit as customers'
 *  POST /v2/customers/:id/verify — otherwise EDD just moves a submitted
 *  application into compliance_review while it records the extra fields. */
route("POST", "/v2/applications/:id/edd", ({ params, body, key }) => {
  const app = must(db.applications, params.id, "application", key);
  guardMutable(app);
  const { decision, ...eddFields } = body;
  app.edd = { ...(app.edd ?? {}), ...eddFields, updated_at: now() };
  const previous = app.status;
  if (decision !== undefined) {
    if (!["approved", "declined", "withdrawn"].includes(decision)) {
      throw new ApiError(
        "validation-error",
        400,
        "decision must be approved, declined or withdrawn",
        [
          {
            field: "decision",
            message: "must be approved, declined or withdrawn",
            code: "invalid_value",
          },
        ],
      );
    }
    app.decision = decision;
    app.status = "completed";
  } else if (app.status === "submitted") {
    app.status = "compliance_review";
  }
  app.updated_at = now();
  if (app.status !== previous) {
    emit(
      "application.status_changed",
      { id: app.id, previous_status: previous, current_status: app.status },
      { tenantId: app.owner },
    );
  }
  return app;
});

/* =========================================================================
 * Accounts — update / close
 * ========================================================================= */

route("PATCH", "/v2/accounts/:id", ({ params, body, key }) => {
  const a = must(db.accounts, params.id, "account", key);
  if (body.client_reference_id !== undefined)
    a.client_reference_id = body.client_reference_id;
  if (body.label !== undefined) a.label = body.label;
  a.updated_at = now();
  db.accounts.set(a.id, a);
  emit("account.updated", a, { tenantId: a.owner });
  return {
    ...a,
    balance: {
      amount: fromMinor(balanceOf(a.id, a.currency)),
      currency: a.currency,
    },
  };
});

/** Close — refuses a non-zero balance. */
route("DELETE", "/v2/accounts/:id", ({ params, key }) => {
  const a = must(db.accounts, params.id, "account", key);
  if (a.status === "closed")
    throw new ApiError("conflict", 409, `Account ${a.id} is already closed`);
  const bal = balanceOf(a.id, a.currency);
  if (bal !== 0n) {
    throw new ApiError(
      "conflict",
      409,
      `Account ${a.id} holds a non-zero balance of ${fromMinor(bal)} ${a.currency}; sweep it before closing`,
    );
  }
  a.status = "closed";
  a.closed_at = now();
  db.accounts.set(a.id, a);
  emit("account.closed", { id: a.id }, { tenantId: a.owner });
  return { ...a, balance: { amount: "0.00", currency: a.currency } };
});

/* =========================================================================
 * Receiving details
 * ========================================================================= */

const randomDigits = (n) => {
  let out = "";
  while (out.length < n)
    out += randomBytes(4).readUInt32BE(0).toString().padStart(10, "0");
  return out.slice(0, n);
};

// Same fictional Blueballs Bank institution codes used by account opening in
// server.js — fixed per rail, only the account part is generated per instrument.
const EUR_BANK_CODE = "50000888";
const USD_ROUTING_PREFIX = "05000088";

function instrumentFor(railId) {
  const rail = RAILS[railId];
  const cur = rail.currency;
  if (cur === "EUR") {
    const bban = EUR_BANK_CODE + randomDigits(10);
    return { type: "iban", iban: ibanGenerate("DE", bban), bic: "BLBLDEB2" };
  }
  if (cur === "GBP") {
    const sortCode = `${randomDigits(2)}-${randomDigits(2)}-${randomDigits(2)}`;
    return {
      type: "sort_code",
      account_number: randomDigits(8),
      sort_code: sortCode,
    };
  }
  if (cur === "USD") {
    return {
      type: "aba",
      account_number: randomDigits(10),
      routing_number: abaGenerate(USD_ROUTING_PREFIX),
    };
  }
  if (cur === "SGD") return { type: "paynow", proxy: "+65" + randomDigits(8) };
  return {
    type: "onchain",
    address: "0x" + randomBytes(20).toString("hex"),
    network: "base",
  };
}

route(
  "POST",
  "/v2/accounts/:id/details",
  ({ params, body, key }) => {
    const a = must(db.accounts, params.id, "account", key);
    need(body, ["rail"]);
    const rail = RAILS[body.rail];
    if (!rail) {
      throw new ApiError("validation-error", 400, `Unknown rail ${body.rail}`, [
        {
          field: "rail",
          message: `try one of: ${Object.keys(RAILS).join(", ")}`,
          code: "unknown_rail",
        },
      ]);
    }
    if (rail.currency !== a.currency) {
      throw new ApiError(
        "validation-error",
        400,
        `${rail.id} settles in ${rail.currency}, not ${a.currency}`,
      );
    }
    const rec = {
      id: ksuid("adt"),
      account: a.id,
      rail: rail.id,
      currency: rail.currency,
      status: "active",
      ...instrumentFor(rail.id),
      owner: principalId(key),
      created_at: now(),
    };
    db.details.set(rec.id, rec);
    emit("account_details.issued", rec, { tenantId: rec.owner });
    return rec;
  },
  { created: true },
);

route("GET", "/v2/accounts/:id/details", ({ params, url, key }) => {
  must(db.accounts, params.id, "account", key);
  return paginate(
    visibleTo(
      [...db.details.values()].filter((d) => d.account === params.id),
      key,
    ),
    url,
  );
});

route("GET", "/v2/details/:id", ({ params, key }) =>
  must(db.details, params.id, "account details", key),
);
