/** Builder sandbox — turns a structured product brief into an isolated,
 * tenant-owned test environment backed by the protected Blueballs ledger.
 *
 * This is deliberately configuration, not arbitrary code execution. Generated
 * customer applications may change presentation and flows; only this trusted
 * route module can provision accounts or post money.
 */

import {
  route, db, ksuid, need, must, paginate, now, ApiError, RAILS, RATES,
  post, balanceOf, fromMinor, positiveMinor, collection, visibleTo, principalId,
} from "../kernel.js";

const projects = collection("builderProjects");
const journeys = collection("builderJourneys");

const CAPABILITIES = new Set([
  "accounts", "onboarding", "transfers", "cards", "wallets", "fx",
  "savings", "business", "payment_links", "webhooks",
]);
const MARKET_CURRENCIES = {
  SG: ["SGD", "USD", "USDX"], MY: ["MYR", "USD", "USDX"],
  GB: ["GBP", "EUR", "USD"], EU: ["EUR", "GBP", "USD"],
  US: ["USD", "USDX"], GLOBAL: ["USD", "EUR", "GBP", "SGD"],
};
const MARKET_RAILS = {
  SG: ["paynow", "wire"], MY: ["wire"], GB: ["faster_payments", "sepa"],
  EU: ["sepa_instant", "sepa"], US: ["ach", "wire"],
  GLOBAL: ["sepa_instant", "faster_payments", "ach", "wire", "paynow"],
};
const SEED_USERS = [
  ["Maya Chen", "maya@example.test"],
  ["Idris Rahman", "idris@example.test"],
  ["Sofia Martins", "sofia@example.test"],
];
const SEED_AMOUNTS = ["10000.00", "5000.00", "2500.00"];

function cleanText(value, field, max = 500) {
  const text = String(value ?? "").trim();
  if (!text) throw new ApiError("validation-error", 400, `${field} is required`);
  if (text.length > max) throw new ApiError("validation-error", 400, `${field} must be ${max} characters or fewer`);
  return text;
}

function uniqueCodes(value, allowed, field, fallback, max = 8) {
  const input = Array.isArray(value) && value.length ? value : fallback;
  const codes = [...new Set(input.map((item) => String(item).trim().toUpperCase()))];
  if (!codes.length || codes.length > max) {
    throw new ApiError("validation-error", 400, `${field} must contain between 1 and ${max} values`);
  }
  const unknown = codes.find((code) => !allowed.has(code));
  if (unknown) throw new ApiError("validation-error", 400, `Unsupported ${field} value ${unknown}`);
  return codes;
}

function inferMarket(brief) {
  const lower = brief.toLowerCase();
  if (/singapore|\bsg\b/.test(lower)) return "SG";
  if (/malaysia|\bmy\b/.test(lower)) return "MY";
  if (/united kingdom|\buk\b|britain/.test(lower)) return "GB";
  if (/europe|\beu\b/.test(lower)) return "EU";
  if (/united states|\busa?\b|america/.test(lower)) return "US";
  return "GLOBAL";
}

function inferCapabilities(brief) {
  const lower = brief.toLowerCase();
  const selected = ["accounts", "onboarding", "transfers"];
  const hints = [
    ["cards", /card|spend/], ["wallets", /wallet|crypto|stablecoin/],
    ["fx", /fx|exchange|currency|cross.border/], ["savings", /saving|vault/],
    ["business", /business|company|sme|merchant/],
    ["payment_links", /payment link|qr|invoice/], ["webhooks", /webhook|api/],
  ];
  for (const [capability, pattern] of hints) if (pattern.test(lower)) selected.push(capability);
  return [...new Set(selected)];
}

function blueprintFrom(body) {
  need(body, ["name", "brief", "audience"]);
  const name = cleanText(body.name, "name", 80);
  const brief = cleanText(body.brief, "brief", 2000);
  const audience = cleanText(body.audience, "audience", 240);
  const inferredMarket = inferMarket(brief);
  const markets = uniqueCodes(
    body.markets,
    new Set(Object.keys(MARKET_CURRENCIES)),
    "markets",
    [inferredMarket],
    5,
  );
  const fallbackCurrencies = [...new Set(markets.flatMap((market) => MARKET_CURRENCIES[market]))].slice(0, 4);
  const currencies = uniqueCodes(body.currencies, new Set(Object.keys(RATES)), "currencies", fallbackCurrencies, 6);
  const capabilities = uniqueCodes(
    body.capabilities,
    new Set([...CAPABILITIES].map((item) => item.toUpperCase())),
    "capabilities",
    inferCapabilities(brief).map((item) => item.toUpperCase()),
    10,
  ).map((item) => item.toLowerCase());
  const possibleRails = [...new Set(markets.flatMap((market) => MARKET_RAILS[market]))];
  const rails = uniqueCodes(
    body.rails?.map?.((item) => String(item).toUpperCase()),
    new Set(Object.keys(RAILS).map((item) => item.toUpperCase())),
    "rails",
    possibleRails.map((item) => item.toUpperCase()),
    6,
  ).map((item) => item.toLowerCase()).filter((rail) => currencies.includes(RAILS[rail].currency));
  const accent = /^#[0-9a-f]{6}$/i.test(body.brand?.accent ?? "") ? body.brand.accent : "#0868FF";
  const personality = String(body.brand?.personality ?? "clear, credible and human").trim().slice(0, 120);

  return {
    name, brief, audience, markets, currencies, capabilities, rails,
    brand: { accent, personality },
    providers: {
      identity: "sandbox simulator",
      payments: "sandbox rails",
      cards: capabilities.includes("cards") ? "sandbox card records" : "disabled",
      wallets: capabilities.includes("wallets") ? "sandbox wallet records" : "disabled",
      ai: "Cloudflare Workers AI · Kimi K2.6",
    },
    trust_boundary: {
      configurable: ["application UI", "customer journeys", "brand", "product rules", "provider adapters"],
      protected: ["ledger", "balances", "idempotency", "transaction state", "FX reservations"],
    },
  };
}

function projectAccounts(project) {
  return (project.resources?.accounts ?? []).map((id) => {
    const account = db.accounts.get(id);
    return account ? {
      ...account,
      balance: { amount: fromMinor(balanceOf(account.id, account.currency)), currency: account.currency },
    } : null;
  }).filter(Boolean);
}

function publicProject(project) {
  const { owner: _owner, ...safe } = project;
  const customers = (project.resources?.customers ?? []).map((id) => db.customers.get(id)).filter(Boolean)
    .map(({ owner: _customerOwner, ...customer }) => customer);
  const recentJourneys = visibleTo([...journeys.values()], { tenant_id: project.owner })
    .filter((journey) => journey.project === project.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12)
    .map(({ owner: _journeyOwner, ...journey }) => journey);
  return { ...safe, customers, accounts: projectAccounts(project).map(({ owner: _accountOwner, ...account }) => account), journeys: recentJourneys };
}

route("POST", "/v2/builder/projects", ({ body, key }) => {
  const stamp = now();
  const project = {
    id: ksuid("prj"), object: "sandbox_project", status: "blueprint_ready",
    owner: principalId(key), blueprint: blueprintFrom(body),
    plan: {
      active_users_included: 10000,
      ai: "bring_your_own",
      third_party_costs: "pass_through",
      real_money: false,
    },
    build: {
      state: "not_started",
      steps: [
        ["product", "Product architecture"], ["financial", "Financial primitives"],
        ["experience", "Customer experience"], ["data", "Tenant data"],
        ["qa", "Sandbox verification"], ["deploy", "Preview environment"],
      ].map(([id, label]) => ({ id, label, status: "queued", completed_at: null })),
    },
    environment: null,
    resources: { customers: [], accounts: [] },
    created_at: stamp, updated_at: stamp,
  };
  projects.set(project.id, project);
  return publicProject(project);
}, { created: true });

route("GET", "/v2/builder/projects", ({ url, key }) => paginate(
  visibleTo([...projects.values()], key)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(publicProject),
  url,
));

route("GET", "/v2/builder/projects/:id", ({ params, key }) => publicProject(must(projects, params.id, "sandbox project", key)));

route("PATCH", "/v2/builder/projects/:id", ({ params, body, key }) => {
  const project = must(projects, params.id, "sandbox project", key);
  if (project.status !== "blueprint_ready") {
    throw new ApiError("conflict", 409, "A provisioned blueprint is immutable; create a new project to change financial configuration");
  }
  project.blueprint = blueprintFrom({ ...project.blueprint, ...body, brand: { ...project.blueprint.brand, ...body.brand } });
  project.updated_at = now();
  projects.set(project.id, project);
  return publicProject(project);
});

route("POST", "/v2/builder/projects/:id/provision", ({ params, key }) => {
  const project = must(projects, params.id, "sandbox project", key);
  if (project.status === "ready") return publicProject(project);
  if (project.status !== "blueprint_ready") throw new ApiError("conflict", 409, `Project ${project.id} is ${project.status}`);

  project.status = "building";
  project.build.state = "running";
  projects.set(project.id, project);
  const stamp = now();
  const currencies = project.blueprint.currencies.slice(0, 3);

  for (let index = 0; index < SEED_USERS.length; index++) {
    const [name, email] = SEED_USERS[index];
    const customer = {
      id: ksuid("cus"), type: "individual", name, email,
      status: "completed", decision: "approved", tier: 3,
      client_reference_id: `${project.id}:seed:${index}`,
      created_at: stamp, owner: project.owner,
    };
    db.customers.set(customer.id, customer);
    project.resources.customers.push(customer.id);

    for (const currency of currencies) {
      const account = {
        id: ksuid("acc"), customer: customer.id, currency, type: "holding",
        status: "open", label: `${name.split(" ")[0]}'s ${currency}`,
        details: { type: "sandbox", reference: `${project.id}:${currency}:${index + 1}` },
        created_at: stamp, owner: project.owner,
      };
      db.accounts.set(account.id, account);
      project.resources.accounts.push(account.id);
      const amount = SEED_AMOUNTS[index];
      const minor = positiveMinor(amount);
      post([
        { account: account.id, currency, amount: minor },
        { account: `external:sandbox:${project.id}`, currency, amount: -minor },
      ], `builder seed ${project.id}`);
    }
  }

  project.status = "ready";
  project.build = {
    state: "complete",
    steps: project.build.steps.map((step) => ({ ...step, status: "complete", completed_at: stamp })),
  };
  project.environment = {
    id: ksuid("env"), mode: "sandbox", state: "ready",
    path: `/sandbox?project=${project.id}`, real_money: false, created_at: stamp,
  };
  project.updated_at = stamp;
  projects.set(project.id, project);
  return publicProject(project);
});

route("POST", "/v2/builder/projects/:id/test-payments", ({ params, body, key }) => {
  const project = must(projects, params.id, "sandbox project", key);
  if (project.status !== "ready") throw new ApiError("conflict", 409, "Provision the project before running a payment");
  need(body, ["from_account", "amount", "recipient"]);
  if (!project.resources.accounts.includes(body.from_account)) {
    throw new ApiError("not-found", 404, `No project account ${body.from_account}`);
  }
  const account = must(db.accounts, body.from_account, "account", key);
  const minor = positiveMinor(body.amount);
  if (balanceOf(account.id, account.currency) < minor) {
    throw new ApiError("insufficient-balance", 400, `Account holds ${fromMinor(balanceOf(account.id, account.currency))} ${account.currency}`);
  }
  const recipient = cleanText(body.recipient, "recipient", 120);
  const journey = {
    id: ksuid("jny"), object: "sandbox_test_payment", project: project.id,
    from_account: account.id, recipient,
    amount: { amount: body.amount, currency: account.currency },
    rail: body.rail && project.blueprint.rails.includes(body.rail) ? body.rail : project.blueprint.rails[0] ?? "sandbox",
    status: "settled", owner: project.owner, created_at: now(),
  };
  post([
    { account: account.id, currency: account.currency, amount: -minor },
    { account: `external:sandbox:payout:${project.id}`, currency: account.currency, amount: minor },
  ], `builder test payment ${journey.id}`);
  journeys.set(journey.id, journey);
  project.updated_at = journey.created_at;
  projects.set(project.id, project);
  return publicProject(project);
});
