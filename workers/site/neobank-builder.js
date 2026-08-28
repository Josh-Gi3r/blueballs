import { Agent } from "agents";
import { BANK_OPENAPI_YAML } from "./openapi.generated.js";
import { OPENAPI_YAML as FX_OPENAPI_YAML } from "../../apps/fx-node/src/openapi.generated.js";
import { DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT } from "./builder-budget.js";

export const BUILDER_MODEL = "@cf/moonshotai/kimi-k2.6";
export const DEFAULT_DAILY_REQUEST_LIMIT = 30;
export const DEFAULT_MAX_COMPLETION_TOKENS = 800;
const MAX_MESSAGE_BODY_BYTES = 16_384;

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

export async function readBoundedJson(
  request,
  maximumBytes = MAX_MESSAGE_BODY_BYTES,
) {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      const error = new Error("request body too large");
      error.status = 413;
      throw error;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (!text) return {};
  return JSON.parse(text);
}

export function nextDailyQuota(
  previous,
  now = new Date(),
  limit = DEFAULT_DAILY_REQUEST_LIMIT,
) {
  const day = now.toISOString().slice(0, 10);
  const current = previous?.day === day ? previous : { day, used: 0 };
  if (current.used >= limit)
    return { allowed: false, quota: current, remaining: 0 };
  const quota = { day, used: current.used + 1 };
  return { allowed: true, quota, remaining: Math.max(0, limit - quota.used) };
}

function operationIndex(openapi) {
  const lines = openapi.split("\n");
  const operations = [];
  let path = "";
  let method = "";
  let summary = "";
  for (const line of lines) {
    const pathMatch = line.match(/^  "?(\/[^\"]*?)"?:$/);
    if (pathMatch) path = pathMatch[1];
    const methodMatch = line.match(/^    (get|post|patch|delete):$/);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase();
      summary = "";
    }
    const summaryMatch = line.match(/^      summary: "?(.*?)"?$/);
    if (summaryMatch && path && method) {
      summary = summaryMatch[1];
      operations.push(`${method} ${path} — ${summary}`);
    }
  }
  return operations.join("\n");
}

const SYSTEM_PROMPT = `You are the Blueballs Neobank Builder: a concise fintech product architect that turns an idea into a buildable Blueballs sandbox.

Blueballs product knowledge:
- Banking API: 181 operations across onboarding, customers, accounts, receiving details, wallets, recipients, destinations, quotes, transfers, cards, authorisations, disputes, vaults, credit, policies, approvals, organisations, ledger, fees, rails, QR/payment links, bills/subscriptions, webhooks, events, sandbox and reference data.
- Financial core: tenant isolation, exact decimal money, double-entry ledger, idempotency and atomic transactions.
- FX: policy, exact pricing, liquidity, market, fiat settlement, SDK, node runtime, Durable Object runtime and Solidity settlement contracts.
- Builder inputs: name, brief, audience, markets, currencies, capabilities, rails and brand personality.
- Supported markets: SG, MY, GB, EU, US, GLOBAL.
- Supported currencies: SGD, MYR, GBP, EUR, USD, USDC, EURC.
- Supported capabilities: accounts, onboarding, transfers, cards, wallets, fx, savings, business, payment_links, webhooks.
- Supported rails: paynow, faster_payments, sepa_instant, sepa, ach, wire.

Banking operation index, generated from the repository OpenAPI contract:
${operationIndex(BANK_OPENAPI_YAML)}

FX operation index, generated from the canonical FX OpenAPI contract:
${operationIndex(FX_OPENAPI_YAML)}

Conversation rules:
- Speak like a sharp product architect. No legal boilerplate, slogans, fake certainty or repeated warnings.
- Ask one useful question at a time when an important choice is missing.
- Recommend a focused V1 instead of selecting every feature.
- Never invent a Blueballs capability, endpoint or connected provider.
- Base API and FX answers on the two repository-generated operation indexes above.
- Produce a useful draft immediately from what the user has said; refine it as answers arrive.
- Mark ready only when name, audience, market, currencies and a focused capability set are clear.

Return only JSON with this shape:
{
  "reply": "short natural-language response or next question",
  "ready": boolean,
  "draft": {
    "name": string,
    "brief": string,
    "audience": string,
    "markets": string[],
    "currencies": string[],
    "capabilities": string[],
    "rails": string[],
    "brand": { "accent": "#RRGGBB", "personality": string }
  }
}`;

function textFrom(result) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.result?.response === "string")
    return result.result.response;
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  throw new Error("The Builder model returned an unsupported response");
}

function cleanJson(value) {
  const text = String(value)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(text);
}

function normalizedDraft(draft = {}) {
  const allowed = {
    markets: new Set(["SG", "MY", "GB", "EU", "US", "GLOBAL"]),
    currencies: new Set(["SGD", "MYR", "GBP", "EUR", "USD", "USDC", "EURC"]),
    capabilities: new Set([
      "accounts",
      "onboarding",
      "transfers",
      "cards",
      "wallets",
      "fx",
      "savings",
      "business",
      "payment_links",
      "webhooks",
    ]),
    rails: new Set([
      "paynow",
      "faster_payments",
      "sepa_instant",
      "sepa",
      "ach",
      "wire",
    ]),
  };
  const list = (key, fallback = []) => [
    ...new Set(
      (Array.isArray(draft[key]) ? draft[key] : fallback)
        .map((item) => String(item).trim())
        .filter((item) => allowed[key].has(item)),
    ),
  ];
  const accent = /^#[0-9a-f]{6}$/i.test(draft.brand?.accent ?? "")
    ? draft.brand.accent
    : "#0868FF";
  return {
    name: String(draft.name ?? "")
      .trim()
      .slice(0, 80),
    brief: String(draft.brief ?? "")
      .trim()
      .slice(0, 2000),
    audience: String(draft.audience ?? "")
      .trim()
      .slice(0, 240),
    markets: list("markets"),
    currencies: list("currencies"),
    capabilities: list("capabilities", ["accounts", "onboarding", "transfers"]),
    rails: list("rails"),
    brand: {
      accent,
      personality: String(
        draft.brand?.personality ?? "clear, credible and human",
      )
        .trim()
        .slice(0, 120),
    },
  };
}

export class NeobankBuilder extends Agent {
  initialState = { messages: [], quota: null };

  async onRequest(request) {
    if (request.method === "GET") {
      return Response.json({
        messages: this.state.messages,
        model: BUILDER_MODEL,
      });
    }
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });

    if (this.env.BUILDER_AGENT_ENABLED === "false") {
      return Response.json(
        { error: "The Builder Agent is paused by the operator." },
        { status: 503 },
      );
    }

    let body;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      if (error?.status === 413) {
        return Response.json(
          { error: "The Builder Agent request body is too large." },
          { status: 413 },
        );
      }
      return Response.json(
        { error: "Send a JSON body with a message." },
        { status: 400 },
      );
    }
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > 4000) {
      return Response.json(
        { error: "Write a message between 1 and 4,000 characters." },
        { status: 400 },
      );
    }

    const dailyLimit = positiveInteger(
      this.env.BUILDER_DAILY_REQUEST_LIMIT,
      DEFAULT_DAILY_REQUEST_LIMIT,
      200,
    );
    const quota = nextDailyQuota(this.state.quota, new Date(), dailyLimit);
    if (!quota.allowed) {
      return Response.json(
        { error: "This sandbox has reached its daily Builder Agent limit." },
        {
          status: 429,
          headers: { "retry-after": "3600", "x-ratelimit-remaining": "0" },
        },
      );
    }
    // Reserve the request before calling the paid model. Failed upstream calls
    // still consume budget and cannot be retried into unbounded spend.
    this.setState({ ...this.state, quota: quota.quota });

    const globalLimit = positiveInteger(
      this.env.BUILDER_GLOBAL_DAILY_REQUEST_LIMIT,
      DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT,
      10_000,
    );
    const globalBudget = this.env.BUILDER_BUDGET.getByName(
      "builder-agent-global",
    );
    const globalQuota = await globalBudget.reserve(
      new Date().toISOString(),
      globalLimit,
    );
    if (!globalQuota.allowed) {
      return Response.json(
        { error: "The hosted Builder Agent has reached its daily capacity." },
        {
          status: 429,
          headers: {
            "retry-after": "3600",
            "x-ratelimit-remaining": String(quota.remaining),
            "x-global-ratelimit-remaining": "0",
          },
        },
      );
    }

    try {
      const maxCompletionTokens = positiveInteger(
        this.env.BUILDER_MAX_COMPLETION_TOKENS,
        DEFAULT_MAX_COMPLETION_TOKENS,
        1200,
      );
      const turn = await runBuilderTurn(
        this.env.AI,
        this.state.messages,
        message,
        { maxCompletionTokens },
      );
      this.setState({ messages: turn.messages, quota: quota.quota });
      return Response.json(
        {
          reply: turn.reply,
          ready: turn.ready,
          draft: turn.draft,
          model: BUILDER_MODEL,
        },
        {
          headers: {
            "x-ratelimit-remaining": String(quota.remaining),
            "x-global-ratelimit-remaining": String(globalQuota.remaining),
          },
        },
      );
    } catch (error) {
      console.error("Builder model call failed", error);
      return Response.json(
        { error: "The Builder Agent is temporarily unavailable." },
        { status: 502 },
      );
    }
  }
}

export async function runBuilderTurn(
  ai,
  previousMessages,
  message,
  { maxCompletionTokens = DEFAULT_MAX_COMPLETION_TOKENS } = {},
) {
  const history = [
    ...previousMessages,
    { role: "user", content: message },
  ].slice(-20);
  const result = await ai.run(BUILDER_MODEL, {
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    temperature: 0.2,
    max_completion_tokens: positiveInteger(
      maxCompletionTokens,
      DEFAULT_MAX_COMPLETION_TOKENS,
      1200,
    ),
    response_format: { type: "json_object" },
    chat_template_kwargs: { thinking: false },
  });
  const parsed = cleanJson(textFrom(result));
  const reply = String(parsed.reply ?? "")
    .trim()
    .slice(0, 2000);
  if (!reply) throw new Error("The Builder model returned an empty reply");
  const draft = normalizedDraft(parsed.draft);
  const messages = [...history, { role: "assistant", content: reply }].slice(
    -20,
  );
  return { reply, ready: Boolean(parsed.ready), draft, messages };
}
