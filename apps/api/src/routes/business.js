/** BUSINESS family — Policies, Approval chains, Organisations, Wallets,
 *  Recipients (get/update/delete), Destinations.
 *
 *  Owns exactly this file. Registers routes via `route(...)` from ../kernel.js
 *  and never touches server.js / kernel.js / lib.js.
 *
 *  Storage note: kernel's `db` only exposes tables lib.js already defines
 *  (customers, accounts, recipients, quotes, transfers, ledger, events, keys,
 *  idempotency). Policies / approval chains / orgs / wallets are new resource
 *  types this family owns, so they live in local in-memory Maps below —
 *  same shape and access pattern as `db.customers`/`db.recipients`, just not
 *  persisted to sqlite across restarts. Recipients and their nested
 *  destinations DO use `db.recipients`, matching how server.js already
 *  stores them (a destination is a plain object living inside
 *  `recipient.destinations[]`, not a standalone table).
 */

import {
  route, db, ksuid, need, must, paginate, now,
  ApiError, toMinor, fromMinor, post, balanceOf, emit, RAILS, randomBytes, collection } from "../kernel.js";

/* ---------------- local stores (see storage note above) ---------------- */
const policies = collection("policies");       // pol_ -> { id, name, rules[], attached[], owner, created_at }
const chains = collection("chains");         // apc_ -> { id, name, threshold, approvers[], steps, resource, owner, created_at }
const approvalQueue = collection("approvalQueue");  // apr_ -> { id, chain, wallet, amount, to, status, decisions[], required, created_at }
const orgs = collection("orgs");           // org_ -> { id, name, owner, members[], created_at }
const wallets = collection("wallets");        // wal_ -> { id, customer, currency, network, address, approval_chain, owner, created_at }

/* ---------------- helpers ---------------- */
const ALLOWED_ATTACH_TYPES = ["account", "wallet", "card"];
const ORG_ROLES = ["owner", "admin", "member"];

function findDestination(id) {
  for (const r of db.recipients.values()) {
    const d = r.destinations.find((x) => x.id === id);
    if (d) return { recipient: r, destination: d };
  }
  throw new ApiError("not-found", 404, `No destination ${id}`);
}

/** Confirmation-of-Payee style name check. A no_match is a normal outcome. */
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
const normalizeName = (s) => String(s ?? "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
function nameCheck(held, given) {
  const a = normalizeName(held), b = normalizeName(given);
  if (!a || !b) return "no_match";
  if (a === b) return "match";
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (dist <= Math.max(2, Math.ceil(maxLen * 0.2))) return "close_match";
  const wa = new Set(a.split(" ")), wb = new Set(b.split(" "));
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  if (overlap > 0 && overlap >= Math.min(wa.size, wb.size)) return "close_match";
  return "no_match";
}

/** Execute a wallet send that cleared its approval chain — real double-entry. */
function executeWalletSend(a) {
  const w = wallets.get(a.wallet);
  const minor = toMinor(a.amount.amount);
  post([
    { account: w.id, currency: a.amount.currency, amount: -minor },
    { account: "external:wallet_send", currency: a.amount.currency, amount: minor },
  ], `approval ${a.id}`);
  emit("wallet.sent", { wallet: w.id, amount: a.amount.amount, currency: a.amount.currency, to: a.to, approval: a.id });
}

/* =========================================================================
 * POLICIES — rules attached to accounts, wallets and cards.
 * ========================================================================= */
route("POST", "/v2/policies", ({ body, key }) => {
  need(body, ["name"]);
  const p = {
    id: ksuid("pol"),
    name: body.name,
    rules: (body.rules ?? []).map((r) => ({ id: ksuid("rul"), ...r, created_at: now() })),
    attached: [],
    client_reference_id: body.client_reference_id ?? null,
    owner: key.id,
    created_at: now(),
  };
  policies.set(p.id, p);
  emit("policy.created", p);
  return p;
});

route("GET", "/v2/policies/:id", ({ params }) => must(policies, params.id, "policy"));

route("GET", "/v2/policies", ({ url, key }) =>
  paginate([...policies.values()].filter((p) => p.owner === key.id), url));

route("DELETE", "/v2/policies/:id", ({ params }) => {
  must(policies, params.id, "policy");
  policies.delete(params.id);
  return { id: params.id, deleted: true };
});

route("POST", "/v2/policies/:id/rules", ({ params, body }) => {
  const p = must(policies, params.id, "policy");
  need(body, ["type"]);
  const rule = { id: ksuid("rul"), ...body, created_at: now() };
  p.rules.push(rule);
  return rule;
});

route("PATCH", "/v2/policies/:id/rules/:rid", ({ params, body }) => {
  const p = must(policies, params.id, "policy");
  const rule = p.rules.find((r) => r.id === params.rid);
  if (!rule) throw new ApiError("not-found", 404, `No rule ${params.rid} on policy ${p.id}`);
  Object.assign(rule, body, { id: rule.id, updated_at: now() });
  return rule;
});

route("DELETE", "/v2/policies/:id/rules/:rid", ({ params }) => {
  const p = must(policies, params.id, "policy");
  const before = p.rules.length;
  p.rules = p.rules.filter((r) => r.id !== params.rid);
  if (p.rules.length === before) throw new ApiError("not-found", 404, `No rule ${params.rid} on policy ${p.id}`);
  return { id: params.rid, deleted: true };
});

/** Attaching an already-attached policy is idempotent, not an error. */
route("POST", "/v2/policies/:id/attach", ({ params, body }) => {
  const p = must(policies, params.id, "policy");
  need(body, ["type", "id"]);
  if (!ALLOWED_ATTACH_TYPES.includes(body.type)) {
    throw new ApiError("validation-error", 400, `type must be one of ${ALLOWED_ATTACH_TYPES.join(", ")}`);
  }
  if (body.type === "account" && !db.accounts.get(body.id)) throw new ApiError("not-found", 404, `No account ${body.id}`);
  if (body.type === "wallet" && !wallets.get(body.id)) throw new ApiError("not-found", 404, `No wallet ${body.id}`);
  const already = p.attached.some((a) => a.type === body.type && a.id === body.id);
  if (!already) p.attached.push({ type: body.type, id: body.id, attached_at: now() });
  return p;
});

route("POST", "/v2/policies/:id/detach", ({ params, body }) => {
  const p = must(policies, params.id, "policy");
  need(body, ["type", "id"]);
  p.attached = p.attached.filter((a) => !(a.type === body.type && a.id === body.id));
  return p;
});

/* =========================================================================
 * APPROVAL CHAINS — procedural, not cryptographic.
 * ========================================================================= */
route("POST", "/v2/approval-chains", ({ body, key }) => {
  need(body, ["name", "threshold"]);
  need(body.threshold, ["amount", "currency"]);
  toMinor(body.threshold.amount); // validates the decimal string
  const steps = body.steps ?? ((Array.isArray(body.approvers) && body.approvers.length) || 1);
  const c = {
    id: ksuid("apc"),
    name: body.name,
    threshold: { amount: body.threshold.amount, currency: String(body.threshold.currency).toUpperCase() },
    approvers: body.approvers ?? [],
    steps,
    resource: body.resource ?? null,
    owner: key.id,
    created_at: now(),
  };
  if (c.resource?.type === "wallet") {
    const w = wallets.get(c.resource.id);
    if (!w) throw new ApiError("not-found", 404, `No wallet ${c.resource.id}`);
    w.approval_chain = c.id;
  }
  chains.set(c.id, c);
  emit("approval_chain.created", c);
  return c;
});

route("GET", "/v2/approval-chains/:id", ({ params }) => must(chains, params.id, "approval chain"));

/** Pending approvals inbox. */
route("GET", "/v2/approvals", ({ url, key }) => {
  const status = url.searchParams.get("status") ?? "pending";
  const rows = [...approvalQueue.values()].filter((a) => {
    const w = wallets.get(a.wallet);
    const owned = !w || w.owner === key.id;
    return owned && (status === "all" || a.status === status);
  });
  return paginate(rows, url);
});

route("POST", "/v2/approvals/:id/approve", ({ params, body, key }) => {
  const a = must(approvalQueue, params.id, "approval");
  if (a.status !== "pending") throw new ApiError("conflict", 409, `Approval ${a.id} is already ${a.status}`);
  a.decisions.push({ approver: key.id, decision: "approve", comment: body.comment ?? null, at: now() });
  const approvals = a.decisions.filter((d) => d.decision === "approve").length;
  if (approvals >= a.required) {
    executeWalletSend(a);
    a.status = "executed";
    a.executed_at = now();
  }
  emit("approval.step_recorded", { id: a.id, status: a.status, decisions: a.decisions.length });
  return a;
});

route("POST", "/v2/approvals/:id/reject", ({ params, body, key }) => {
  const a = must(approvalQueue, params.id, "approval");
  if (a.status !== "pending") throw new ApiError("conflict", 409, `Approval ${a.id} is already ${a.status}`);
  a.decisions.push({ approver: key.id, decision: "reject", comment: body.reason ?? null, at: now() });
  a.status = "rejected";
  a.rejected_at = now();
  emit("approval.rejected", { id: a.id });
  return a;
});

/* =========================================================================
 * ORGANISATIONS — teams, roles, a real permission implication.
 * ========================================================================= */
route("POST", "/v2/orgs", ({ body, key }) => {
  need(body, ["name"]);
  const o = {
    id: ksuid("org"),
    name: body.name,
    owner: key.id,
    members: [{ id: ksuid("mem"), key: key.id, email: key.email ?? null, role: "owner", status: "active", joined_at: now() }],
    created_at: now(),
  };
  orgs.set(o.id, o);
  emit("org.created", o);
  return o;
});

route("GET", "/v2/orgs/:id", ({ params }) => must(orgs, params.id, "organisation"));

route("PATCH", "/v2/orgs/:id", ({ params, body }) => {
  const o = must(orgs, params.id, "organisation");
  if (body.name !== undefined) o.name = body.name;
  if (body.client_reference_id !== undefined) o.client_reference_id = body.client_reference_id;
  o.updated_at = now();
  return o;
});

route("POST", "/v2/orgs/:id/members", ({ params, body }) => {
  const o = must(orgs, params.id, "organisation");
  need(body, ["email", "role"]);
  if (!ORG_ROLES.includes(body.role)) {
    throw new ApiError("validation-error", 400, `role must be one of ${ORG_ROLES.join(", ")}`);
  }
  const m = { id: ksuid("mem"), key: null, email: body.email, role: body.role, status: "invited", joined_at: now() };
  o.members.push(m);
  emit("org.member_invited", { org: o.id, member: m.id, role: m.role });
  return m;
});

route("GET", "/v2/orgs/:id/members", ({ params, url }) => {
  const o = must(orgs, params.id, "organisation");
  return paginate(o.members, url);
});

/** Removing the last owner is refused — the real permission implication of the role. */
route("DELETE", "/v2/orgs/:id/members/:mid", ({ params }) => {
  const o = must(orgs, params.id, "organisation");
  const m = o.members.find((x) => x.id === params.mid);
  if (!m) throw new ApiError("not-found", 404, `No member ${params.mid} in org ${o.id}`);
  if (m.role === "owner" && o.members.filter((x) => x.role === "owner").length <= 1) {
    throw new ApiError("conflict", 409, "Cannot remove the last owner of an organisation");
  }
  o.members = o.members.filter((x) => x.id !== params.mid);
  emit("org.member_removed", { org: o.id, member: params.mid });
  return { id: params.mid, deleted: true };
});

/* =========================================================================
 * WALLETS — on-chain balances per asset/network, with policies attached.
 * ========================================================================= */
route("POST", "/v2/wallets", ({ body, key }) => {
  need(body, ["customer", "currency"]);
  const c = db.customers.get(body.customer);
  if (!c) throw new ApiError("not-found", 404, `No customer ${body.customer}`);
  const w = {
    id: ksuid("wal"),
    customer: c.id,
    currency: String(body.currency).toUpperCase(),
    network: body.network ?? "base",
    address: "0x" + randomBytes(20).toString("hex"),
    approval_chain: null,
    client_reference_id: body.client_reference_id ?? null,
    owner: key.id,
    created_at: now(),
  };
  wallets.set(w.id, w);
  emit("wallet.created", w);
  return { ...w, balance: { amount: "0.00", currency: w.currency } };
});

route("GET", "/v2/wallets/:id", ({ params }) => {
  const w = must(wallets, params.id, "wallet");
  return { ...w, balance: { amount: fromMinor(balanceOf(w.id, w.currency)), currency: w.currency } };
});

route("GET", "/v2/wallets", ({ url, key }) =>
  paginate([...wallets.values()].filter((w) => w.owner === key.id), url));

route("GET", "/v2/wallets/:id/balances", ({ params }) => {
  const w = must(wallets, params.id, "wallet");
  const currencies = new Set([w.currency]);
  for (const row of db.ledger.filter((r) => r.account === w.id)) currencies.add(row.currency);
  return {
    object: "list",
    data: [...currencies].map((c) => ({ currency: c, network: w.network, amount: fromMinor(balanceOf(w.id, c)) })),
  };
});

/** Wallet send: policy limits, then an approval chain threshold, then real double-entry via post(). */
route("POST", "/v2/wallets/:id/send", ({ params, body }) => {
  const w = must(wallets, params.id, "wallet");
  need(body, ["amount", "currency", "to"]);
  const currency = String(body.currency).toUpperCase();
  const minor = toMinor(body.amount);
  if (balanceOf(w.id, currency) < minor) {
    throw new ApiError("insufficient-balance", 400, `Wallet holds ${fromMinor(balanceOf(w.id, currency))} ${currency}`);
  }
  for (const p of policies.values()) {
    if (!p.attached.some((a) => a.type === "wallet" && a.id === w.id)) continue;
    for (const rule of p.rules) {
      if (rule.type === "max_amount" && String(rule.currency).toUpperCase() === currency && minor > toMinor(rule.amount)) {
        throw new ApiError("limit-exceeded", 400, `Policy ${p.id} caps sends at ${rule.amount} ${currency}`);
      }
    }
  }
  const chain = w.approval_chain ? chains.get(w.approval_chain) : null;
  if (chain && chain.threshold.currency === currency && minor >= toMinor(chain.threshold.amount)) {
    const a = {
      id: ksuid("apr"), chain: chain.id, wallet: w.id,
      amount: { amount: body.amount, currency }, to: body.to,
      status: "pending", decisions: [], required: chain.steps, created_at: now(),
    };
    approvalQueue.set(a.id, a);
    emit("approval.created", a);
    return { id: a.id, object: "wallet_send", wallet: w.id, amount: a.amount, to: body.to, status: "pending_approval", approval: a.id, created_at: a.created_at };
  }
  post([
    { account: w.id, currency, amount: -minor },
    { account: "external:wallet_send", currency, amount: minor },
  ], `wallet send ${w.id}`);
  emit("wallet.sent", { wallet: w.id, amount: body.amount, currency, to: body.to });
  return { id: ksuid("snd"), object: "wallet_send", wallet: w.id, amount: { amount: body.amount, currency }, to: body.to, status: "sent", created_at: now() };
});

route("GET", "/v2/wallets/:id/policies", ({ params, url }) => {
  const w = must(wallets, params.id, "wallet");
  const rows = [...policies.values()].filter((p) => p.attached.some((a) => a.type === "wallet" && a.id === w.id));
  return paginate(rows, url);
});

/* =========================================================================
 * RECIPIENTS — get / update / delete. (create + list already live in server.js)
 * A recipient is not an account: it just holds destinations, added below.
 * ========================================================================= */
route("GET", "/v2/recipients/:id", ({ params }) => must(db.recipients, params.id, "recipient"));

route("PATCH", "/v2/recipients/:id", ({ params, body }) => {
  const r = must(db.recipients, params.id, "recipient");
  if (body.name !== undefined) r.name = body.name;
  if (body.client_reference_id !== undefined) r.client_reference_id = body.client_reference_id;
  r.updated_at = now();
  db.recipients.set(r.id, r);
  return r;
});

route("DELETE", "/v2/recipients/:id", ({ params }) => {
  must(db.recipients, params.id, "recipient");
  db.recipients.delete(params.id);
  return { id: params.id, deleted: true };
});

/* =========================================================================
 * DESTINATIONS — where money lands, typed by rail. Same person, many rails.
 * ========================================================================= */
route("POST", "/v2/recipients/:id/destinations", ({ params, body }) => {
  const r = must(db.recipients, params.id, "recipient");
  need(body, ["rail", "name"]);
  const currency = body.currency ? String(body.currency).toUpperCase() : (RAILS[body.rail]?.currency ?? null);
  const d = { id: ksuid("dst"), ...body, currency, name_check: "unchecked", created_at: now() };
  r.destinations.push(d);
  db.recipients.set(r.id, r);
  emit("destination.created", { recipient: r.id, destination: d.id, rail: d.rail });
  return d;
});

route("GET", "/v2/destinations/:id", ({ params }) => {
  const { destination } = findDestination(params.id);
  return destination;
});

route("PATCH", "/v2/destinations/:id", ({ params, body }) => {
  const { recipient, destination } = findDestination(params.id);
  const nameChanged = body.name !== undefined && body.name !== destination.name;
  Object.assign(destination, body, { id: destination.id, created_at: destination.created_at, updated_at: now() });
  if (nameChanged) destination.name_check = "unchecked";
  db.recipients.set(recipient.id, recipient);
  return destination;
});

route("DELETE", "/v2/destinations/:id", ({ params }) => {
  const { recipient, destination } = findDestination(params.id);
  recipient.destinations = recipient.destinations.filter((d) => d.id !== destination.id);
  db.recipients.set(recipient.id, recipient);
  return { id: params.id, deleted: true };
});

/** Confirmation of Payee name check — a no_match is a normal outcome, not an error. */
route("POST", "/v2/destinations/:id/verify", ({ params, body }) => {
  const { recipient, destination } = findDestination(params.id);
  need(body, ["name"]);
  const result = nameCheck(destination.name, body.name);
  destination.name_check = result;
  destination.name_checked_at = now();
  db.recipients.set(recipient.id, recipient);
  return {
    destination: destination.id,
    recipient: recipient.id,
    checked_name: body.name,
    held_name: destination.name,
    result,
    checked_at: destination.name_checked_at,
  };
});
