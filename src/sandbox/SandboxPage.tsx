import { useEffect, useMemo, useState } from "react";
import { BrandLockup } from "../Brand";
import { call, ensureKey } from "../api";
import "./sandbox.css";

type Blueprint = {
  name: string;
  brief: string;
  audience: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  brand: { accent: string; personality: string };
  providers: Record<string, string>;
  trust_boundary: { configurable: string[]; protected: string[] };
};

type SandboxProject = {
  id: string;
  status: "blueprint_ready" | "building" | "ready";
  blueprint: Blueprint;
  plan: {
    active_users_included: number;
    ai: string;
    third_party_costs: string;
    real_money: boolean;
  };
  build: {
    state: string;
    steps: Array<{ id: string; label: string; status: string }>;
  };
  environment: null | {
    id: string;
    mode: string;
    state: string;
    path: string;
    real_money: boolean;
  };
  customers: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    decision: string;
  }>;
  accounts: Array<{
    id: string;
    customer: string;
    label: string;
    currency: string;
    balance: { amount: string; currency: string };
  }>;
  journeys: Array<{
    id: string;
    recipient: string;
    rail: string;
    status: string;
    amount: { amount: string; currency: string };
    created_at: string;
  }>;
};

type FormState = {
  name: string;
  brief: string;
  audience: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  brand: { accent: string; personality: string };
};

type BuilderMessage = { role: "assistant" | "user"; content: string };

const INITIAL: FormState = {
  name: "",
  brief: "",
  audience: "",
  markets: ["SG"],
  currencies: ["SGD", "USD", "USDC"],
  capabilities: ["accounts", "onboarding", "transfers", "cards", "fx"],
  rails: ["paynow", "wire"],
  brand: { accent: "#0868FF", personality: "clear, credible and human" },
};

const PRESETS = [
  {
    label: "Creator finance",
    name: "Maker Bank",
    brief:
      "A Singapore account and card product for independent designers, with simple cross-border FX and invoice payments.",
    audience: "Independent designers and small studios",
    markets: ["SG"],
    currencies: ["SGD", "USD", "USDC"],
    capabilities: [
      "accounts",
      "onboarding",
      "transfers",
      "cards",
      "fx",
      "payment_links",
    ],
    rails: ["paynow", "wire"],
  },
  {
    label: "Community wallet",
    name: "Neighbourhood",
    brief:
      "A community wallet for local members to hold money, pay merchants and create payment links.",
    audience: "Community members and local merchants",
    markets: ["GLOBAL"],
    currencies: ["USD", "EUR", "USDC"],
    capabilities: [
      "accounts",
      "onboarding",
      "wallets",
      "transfers",
      "payment_links",
    ],
    rails: ["wire", "sepa_instant"],
  },
  {
    label: "Freelancer banking",
    name: "Solo",
    brief:
      "Business accounts for UK freelancers with faster payments, savings pots, cards and bookkeeping-ready webhooks.",
    audience: "UK freelancers and sole traders",
    markets: ["GB"],
    currencies: ["GBP", "EUR", "USD"],
    capabilities: [
      "accounts",
      "onboarding",
      "business",
      "transfers",
      "cards",
      "savings",
      "webhooks",
    ],
    rails: ["faster_payments", "sepa"],
  },
] as const;

const MARKET_OPTIONS = [
  ["SG", "Singapore"],
  ["MY", "Malaysia"],
  ["GB", "United Kingdom"],
  ["EU", "Europe"],
  ["US", "United States"],
  ["GLOBAL", "Global"],
] as const;
const CURRENCIES = ["SGD", "MYR", "GBP", "EUR", "USD", "USDC", "EURC"];
const CAPABILITIES = [
  ["accounts", "Accounts"],
  ["onboarding", "Onboarding"],
  ["transfers", "Transfers"],
  ["cards", "Cards"],
  ["wallets", "Wallets"],
  ["fx", "FX"],
  ["savings", "Savings"],
  ["business", "Business"],
  ["payment_links", "Payment links"],
  ["webhooks", "Webhooks"],
] as const;
const RAILS = [
  ["paynow", "PayNow"],
  ["faster_payments", "Faster Payments"],
  ["sepa_instant", "SEPA Instant"],
  ["sepa", "SEPA"],
  ["ach", "ACH"],
  ["wire", "Wire"],
] as const;
const STAGES = ["Brief", "Blueprint", "Build", "Test", "Launch"];

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function errorDetail(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "detail" in body)
    return String((body as { detail: unknown }).detail);
  return fallback;
}

export default function SandboxPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [project, setProject] = useState<SandboxProject | null>(null);
  const [projects, setProjects] = useState<SandboxProject[]>([]);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState("Connecting to the sandbox…");
  const [error, setError] = useState("");
  const [payment, setPayment] = useState({
    from_account: "",
    amount: "125.00",
    recipient: "Studio Supplies",
    rail: "",
  });
  const [agentInput, setAgentInput] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentMessages, setAgentMessages] = useState<BuilderMessage[]>([
    {
      role: "assistant",
      content:
        "Tell me who you want to serve and what they should be able to do.",
    },
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await ensureKey();
      if (!alive) return;
      if (!key) {
        setBusy("");
        setError(
          "The sandbox API is unavailable. Start the local stack with pnpm dev and retry.",
        );
        return;
      }
      const result = await call("GET", "/v2/builder/projects");
      if (!alive) return;
      if (result.ok) {
        const rows = (
          (result.body as { data?: SandboxProject[] })?.data ?? []
        ).reverse();
        setProjects(rows);
        const requested = new URLSearchParams(window.location.search).get(
          "project",
        );
        const selected = rows.find((item) => item.id === requested);
        if (selected) {
          setProject(selected);
          setStage(selected.status === "ready" ? 3 : 1);
        }
      }
      setBusy("");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const primaryAccount = useMemo(
    () => project?.accounts?.[0] ?? null,
    [project],
  );
  useEffect(() => {
    if (!primaryAccount) return;
    setPayment((current) => ({
      ...current,
      from_account: current.from_account || primaryAccount.id,
      rail: current.rail || project?.blueprint.rails[0] || "sandbox",
    }));
  }, [primaryAccount, project]);

  async function createBlueprint() {
    setBusy("Designing your product blueprint…");
    setError("");
    const result = await call("POST", "/v2/builder/projects", form);
    setBusy("");
    if (!result.ok) {
      setError(errorDetail(result.body, "The blueprint could not be created."));
      return;
    }
    const next = result.body as SandboxProject;
    setProject(next);
    setProjects((items) => [next, ...items]);
    setStage(1);
    window.history.replaceState({}, "", `/sandbox?project=${next.id}`);
  }

  async function talkToBuilder() {
    const message = agentInput.trim();
    if (!message || agentBusy) return;
    setAgentInput("");
    setAgentMessages((items) => [...items, { role: "user", content: message }]);
    setAgentBusy(true);
    setError("");
    const result = await call("POST", "/v2/builder-agent/chat", { message });
    setAgentBusy(false);
    if (!result.ok) {
      // Builder chat is served by the site Worker, not the Node API, because it
      // routes to a stateful Cloudflare Agent. Under `pnpm dev` the route is
      // simply not there, and a bare 404 reads like a broken chat.
      setError(
        result.status === 404
          ? "Builder chat runs in the Cloudflare Worker. Start the full stack with `pnpm preview:cloudflare`, or fill the form directly — every other step of the journey works under `pnpm dev`."
          : errorDetail(result.body, "The Builder Agent could not respond."),
      );
      return;
    }
    const response = result.body as {
      reply: string;
      ready: boolean;
      draft: FormState;
    };
    setAgentMessages((items) => [
      ...items,
      { role: "assistant", content: response.reply },
    ]);
    setAgentReady(response.ready);
    setForm((current) => ({
      ...current,
      ...response.draft,
      name: response.draft.name || current.name,
      brief: response.draft.brief || current.brief,
      audience: response.draft.audience || current.audience,
      markets: response.draft.markets.length
        ? response.draft.markets
        : current.markets,
      currencies: response.draft.currencies.length
        ? response.draft.currencies
        : current.currencies,
      capabilities: response.draft.capabilities.length
        ? response.draft.capabilities
        : current.capabilities,
      rails: response.draft.rails.length ? response.draft.rails : current.rails,
      brand: response.draft.brand ?? current.brand,
    }));
  }

  async function provision() {
    if (!project) return;
    setStage(2);
    setBusy("Provisioning your isolated environment…");
    setError("");
    const result = await call(
      "POST",
      `/v2/builder/projects/${project.id}/provision`,
    );
    setBusy("");
    if (!result.ok) {
      setStage(1);
      setError(
        errorDetail(result.body, "The sandbox could not be provisioned."),
      );
      return;
    }
    const next = result.body as SandboxProject;
    setProject(next);
    setProjects((items) =>
      items.map((item) => (item.id === next.id ? next : item)),
    );
    setStage(3);
  }

  async function runPayment() {
    if (!project) return;
    setBusy("Settling a test payment through the protected ledger…");
    setError("");
    const result = await call(
      "POST",
      `/v2/builder/projects/${project.id}/test-payments`,
      payment,
    );
    setBusy("");
    if (!result.ok) {
      setError(errorDetail(result.body, "The test payment failed."));
      return;
    }
    const next = result.body as SandboxProject;
    setProject(next);
    setStage(3);
  }

  function resume(item: SandboxProject) {
    setProject(item);
    setStage(item.status === "ready" ? 3 : 1);
    window.history.replaceState({}, "", `/sandbox?project=${item.id}`);
  }

  function newProject() {
    setForm(INITIAL);
    setProject(null);
    setStage(0);
    setError("");
    window.history.replaceState({}, "", "/sandbox");
  }

  return (
    <div className="sb-page">
      <header className="sb-header">
        <button className="sb-brand" onClick={() => navigate("/home")}>
          <BrandLockup linked={false} />
          <span>BUILDER</span>
        </button>
        <div className="sb-env">
          <i /> BUILDER SANDBOX
        </div>
        <div className="sb-header-actions">
          {project && (
            <button className="sb-quiet" onClick={newProject}>
              New project
            </button>
          )}
          <button
            className="sb-close"
            aria-label="Exit sandbox"
            onClick={() => navigate("/home")}
          >
            ×
          </button>
        </div>
      </header>

      <div className="sb-progress" aria-label="Builder progress">
        {STAGES.map((label, index) => (
          <div
            className={index < stage ? "done" : index === stage ? "active" : ""}
            key={label}
          >
            <span>{index < stage ? "✓" : index + 1}</span>
            <b>{label}</b>
          </div>
        ))}
      </div>

      {busy && (
        <div className="sb-busy">
          <span />
          <strong>{busy}</strong>
        </div>
      )}
      {error && (
        <div className="sb-error">
          <strong>Something needs attention</strong>
          <span>{error}</span>
        </div>
      )}

      <main className="sb-main">
        {stage === 0 && (
          <div className="sb-brief-layout">
            <section className="sb-intro">
              <span className="sb-kicker">BLUEBALLS BUILDER</span>
              <h1>What financial product do you want to build?</h1>
              <p>
                Describe the people you serve. Blueballs will turn the idea into
                a structured product blueprint, provision test users and
                balances, then let you run the first transaction.
              </p>
              <div className="sb-promise">
                <b>Design, build and test in one workspace.</b>
                <span>
                  Your product blueprint and test environment stay together.
                </span>
              </div>
              {projects.length > 0 && (
                <div className="sb-recent">
                  <div className="sb-section-label">RECENT PROJECTS</div>
                  {projects.slice(0, 3).map((item) => (
                    <button key={item.id} onClick={() => resume(item)}>
                      <span
                        style={{ background: item.blueprint.brand.accent }}
                      />
                      <b>{item.blueprint.name}</b>
                      <small>{item.status.replace("_", " ")}</small>
                      <em>Open →</em>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="sb-form-card">
              <div className="sb-agent">
                <div className="sb-agent-head">
                  <div>
                    <span>BUILDER AGENT</span>
                    <b>Design the product in conversation</b>
                  </div>
                  <small>{agentReady ? "BLUEPRINT READY" : "KIMI K2.6"}</small>
                </div>
                <div className="sb-agent-messages">
                  {agentMessages.slice(-6).map((message, index) => (
                    <div
                      className={message.role}
                      key={`${message.role}-${index}`}
                    >
                      <span>{message.role === "assistant" ? "B" : "YOU"}</span>
                      <p>{message.content}</p>
                    </div>
                  ))}
                  {agentBusy && (
                    <div className="assistant thinking">
                      <span>B</span>
                      <p>Working through the product…</p>
                    </div>
                  )}
                </div>
                <form
                  className="sb-agent-input"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void talkToBuilder();
                  }}
                >
                  <textarea
                    value={agentInput}
                    onChange={(event) => setAgentInput(event.target.value)}
                    placeholder="Help me build a neobank for my gaming community…"
                  />
                  <button
                    type="submit"
                    disabled={!agentInput.trim() || agentBusy}
                  >
                    Send <span>→</span>
                  </button>
                </form>
                <small className="sb-agent-note">
                  Grounded in the Blueballs banking and FX API contracts. It
                  updates the blueprint as you talk.
                </small>
              </div>
              <div className="sb-form-divider">
                <span>REVIEW THE BLUEPRINT</span>
              </div>
              <div className="sb-presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      setForm({
                        ...INITIAL,
                        name: preset.name,
                        brief: preset.brief,
                        audience: preset.audience,
                        markets: [...preset.markets],
                        currencies: [...preset.currencies],
                        capabilities: [...preset.capabilities],
                        rails: [...preset.rails],
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label>
                Product name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Maker Bank"
                />
              </label>
              <label>
                What should it do?
                <textarea
                  value={form.brief}
                  onChange={(event) =>
                    setForm({ ...form, brief: event.target.value })
                  }
                  placeholder="Build accounts and cards for independent designers in Singapore…"
                />
              </label>
              <label>
                Who is it for?
                <input
                  value={form.audience}
                  onChange={(event) =>
                    setForm({ ...form, audience: event.target.value })
                  }
                  placeholder="Independent designers and small studios"
                />
              </label>
              <div className="sb-choice-group">
                <span>MARKETS</span>
                <div>
                  {MARKET_OPTIONS.map(([value, label]) => (
                    <button
                      className={form.markets.includes(value) ? "selected" : ""}
                      key={value}
                      onClick={() =>
                        setForm({
                          ...form,
                          markets: toggle(form.markets, value),
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sb-choice-group">
                <span>CURRENCIES</span>
                <div>
                  {CURRENCIES.map((value) => (
                    <button
                      className={
                        form.currencies.includes(value) ? "selected" : ""
                      }
                      key={value}
                      onClick={() =>
                        setForm({
                          ...form,
                          currencies: toggle(form.currencies, value),
                        })
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sb-choice-group">
                <span>CAPABILITIES</span>
                <div>
                  {CAPABILITIES.map(([value, label]) => (
                    <button
                      className={
                        form.capabilities.includes(value) ? "selected" : ""
                      }
                      key={value}
                      onClick={() =>
                        setForm({
                          ...form,
                          capabilities: toggle(form.capabilities, value),
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sb-choice-group">
                <span>RAILS</span>
                <div>
                  {RAILS.map(([value, label]) => (
                    <button
                      className={form.rails.includes(value) ? "selected" : ""}
                      key={value}
                      onClick={() =>
                        setForm({ ...form, rails: toggle(form.rails, value) })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sb-brand-row">
                <label>
                  Accent
                  <input
                    type="color"
                    value={form.brand.accent}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        brand: { ...form.brand, accent: event.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Personality
                  <input
                    value={form.brand.personality}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        brand: {
                          ...form.brand,
                          personality: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <button
                className="sb-primary"
                disabled={
                  !form.name || !form.brief || !form.audience || Boolean(busy)
                }
                onClick={createBlueprint}
              >
                Create blueprint <span>→</span>
              </button>
            </section>
          </div>
        )}

        {stage === 1 && project && (
          <div className="sb-blueprint-layout">
            <section className="sb-blueprint-title">
              <span className="sb-kicker">
                PRODUCT BLUEPRINT · {project.id.slice(-8).toUpperCase()}
              </span>
              <h1>{project.blueprint.name}</h1>
              <p>{project.blueprint.brief}</p>
              <div className="sb-blueprint-actions">
                <button className="sb-back" onClick={newProject}>
                  ← Start again
                </button>
                <button className="sb-primary" onClick={provision}>
                  Build the sandbox <span>→</span>
                </button>
              </div>
            </section>
            <section className="sb-blueprint-grid">
              <article>
                <span>WHO IT SERVES</span>
                <h3>{project.blueprint.audience}</h3>
                <p>
                  {project.blueprint.markets.join(" · ")} market configuration
                </p>
              </article>
              <article>
                <span>MONEY</span>
                <div className="sb-token-row">
                  {project.blueprint.currencies.map((item) => (
                    <b key={item}>{item}</b>
                  ))}
                </div>
                <p>
                  {project.blueprint.rails.join(" · ") || "Sandbox ledger only"}
                </p>
              </article>
              <article className="wide">
                <span>PRODUCT SURFACE</span>
                <div className="sb-cap-grid">
                  {project.blueprint.capabilities.map((item) => (
                    <b key={item}>
                      <i>✓</i>
                      {item.replace("_", " ")}
                    </b>
                  ))}
                </div>
              </article>
              <article>
                <span>BUILD MODEL</span>
                <h3>Configuration over generated banking code</h3>
                <p>
                  The blueprint assembles tested Blueballs products, APIs and FX
                  components.
                </p>
              </article>
              <article>
                <span>PLATFORM</span>
                <h3>Open-source core</h3>
                <p>
                  Fork the stack, extend the product and choose the services
                  behind it.
                </p>
              </article>
              <article className="wide boundary">
                <span>TRUST BOUNDARY</span>
                <div>
                  <p>
                    <b>Configurable</b>
                    {project.blueprint.trust_boundary.configurable.join(" · ")}
                  </p>
                  <i>→</i>
                  <p>
                    <b>Protected Blueballs core</b>
                    {project.blueprint.trust_boundary.protected.join(" · ")}
                  </p>
                </div>
              </article>
            </section>
          </div>
        )}

        {stage === 2 && project && (
          <div className="sb-build-view">
            <span className="sb-kicker">
              BUILDING {project.blueprint.name.toUpperCase()}
            </span>
            <h1>Assembling a working financial product.</h1>
            <p>
              Each specialist configures tested Blueballs primitives. The ledger
              and balances remain behind the protected core.
            </p>
            <div className="sb-build-list">
              {project.build.steps.map((step, index) => (
                <div key={step.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{step.label}</b>
                  <em>{busy ? "WORKING" : step.status.toUpperCase()}</em>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage >= 3 && project && project.status === "ready" && (
          <div className="sb-workspace">
            <section className="sb-workspace-head">
              <div>
                <span className="sb-kicker">
                  LIVE SANDBOX ·{" "}
                  {project.environment?.id.slice(-8).toUpperCase()}
                </span>
                <h1>{project.blueprint.name}</h1>
                <p>{project.blueprint.audience}</p>
              </div>
              <div className="sb-status-card">
                <span>
                  <i /> ENVIRONMENT READY
                </span>
                <b>Sandbox</b>
                <small>Persistent project data</small>
              </div>
            </section>

            <section className="sb-metrics">
              <article>
                <span>TEST USERS</span>
                <b>{project.customers.length}</b>
                <small>Approved sandbox identities</small>
              </article>
              <article>
                <span>ACCOUNTS</span>
                <b>{project.accounts.length}</b>
                <small>{project.blueprint.currencies.join(" · ")}</small>
              </article>
              <article>
                <span>CAPABILITIES</span>
                <b>{project.blueprint.capabilities.length}</b>
                <small>Configured product modules</small>
              </article>
              <article>
                <span>TEST PAYMENTS</span>
                <b>{project.journeys.length}</b>
                <small>Protected-ledger journeys</small>
              </article>
            </section>

            <div className="sb-workspace-grid">
              <section className="sb-panel sb-users">
                <div className="sb-panel-head">
                  <div>
                    <span>TEST DATA</span>
                    <h2>Customers and balances</h2>
                  </div>
                  <small>Persistent tenant state</small>
                </div>
                <div className="sb-user-table">
                  {project.customers.map((customer) => {
                    const accounts = project.accounts.filter(
                      (account) => account.customer === customer.id,
                    );
                    return (
                      <div key={customer.id} className="sb-user-row">
                        <span className="sb-avatar">
                          {customer.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <div>
                          <b>{customer.name}</b>
                          <small>{customer.email}</small>
                        </div>
                        <em>{customer.decision}</em>
                        <div className="sb-balances">
                          {accounts.map((account) => (
                            <span key={account.id}>
                              <b>{account.balance.amount}</b>
                              <small>{account.currency}</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="sb-panel sb-test-panel">
                <div className="sb-panel-head">
                  <div>
                    <span>RUN A JOURNEY</span>
                    <h2>Send a test payment</h2>
                  </div>
                  <small>Double-entry settlement</small>
                </div>
                <label>
                  From account
                  <select
                    value={payment.from_account}
                    onChange={(event) =>
                      setPayment({
                        ...payment,
                        from_account: event.target.value,
                      })
                    }
                  >
                    {project.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label} · {account.balance.amount}{" "}
                        {account.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sb-payment-row">
                  <label>
                    Amount
                    <input
                      value={payment.amount}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPayment({ ...payment, amount: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Rail
                    <select
                      value={payment.rail}
                      onChange={(event) =>
                        setPayment({ ...payment, rail: event.target.value })
                      }
                    >
                      {(project.blueprint.rails.length
                        ? project.blueprint.rails
                        : ["sandbox"]
                      ).map((rail) => (
                        <option key={rail}>{rail}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Recipient
                  <input
                    value={payment.recipient}
                    onChange={(event) =>
                      setPayment({ ...payment, recipient: event.target.value })
                    }
                  />
                </label>
                <button
                  className="sb-primary"
                  disabled={Boolean(busy)}
                  onClick={runPayment}
                >
                  Run payment <span>→</span>
                </button>
                <div className="sb-ledger-note">
                  <i>↳</i>
                  <p>
                    <b>Protected path</b>The builder cannot edit a balance. This
                    action posts balanced debit and credit legs through the
                    Blueballs core.
                  </p>
                </div>
              </section>
            </div>

            <section className="sb-panel sb-activity">
              <div className="sb-panel-head">
                <div>
                  <span>ACTIVITY</span>
                  <h2>Test payment history</h2>
                </div>
                <small>{project.journeys.length} settled</small>
              </div>
              {project.journeys.length === 0 ? (
                <div className="sb-empty">
                  Your first payment will appear here.
                </div>
              ) : (
                project.journeys.map((journey) => (
                  <div className="sb-activity-row" key={journey.id}>
                    <span>↗</span>
                    <div>
                      <b>{journey.recipient}</b>
                      <small>
                        {journey.rail.replace("_", " ")} ·{" "}
                        {new Date(journey.created_at).toLocaleString()}
                      </small>
                    </div>
                    <em>{journey.status}</em>
                    <strong>
                      −{journey.amount.amount} {journey.amount.currency}
                    </strong>
                  </div>
                ))
              )}
            </section>

            <section className="sb-launch">
              <div>
                <span className="sb-kicker">NEXT · TAKE IT FURTHER</span>
                <h2>Turn this blueprint into your product.</h2>
                <p>
                  Keep the Blueballs application contract, choose the services
                  for your market and move from test journeys to your
                  deployment.
                </p>
              </div>
              <a href="https://github.com/Josh-Gi3r/blueballs">
                Clone the stack{" "}
                <span>MIT licence · run the whole thing yourself</span>
              </a>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
