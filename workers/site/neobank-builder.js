import { Agent } from "agents";
import { BANK_OPENAPI_YAML } from "./openapi.generated.js";
import { OPENAPI_YAML as FX_OPENAPI_YAML } from "../../apps/fx-node/src/openapi.generated.js";

export const BUILDER_MODEL = "@cf/moonshotai/kimi-k2.6";

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
    if (methodMatch) { method = methodMatch[1].toUpperCase(); summary = ""; }
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
- Banking API: 180 operations across onboarding, customers, accounts, receiving details, wallets, recipients, destinations, quotes, transfers, cards, authorisations, disputes, vaults, credit, policies, approvals, organisations, ledger, fees, rails, QR/payment links, bills/subscriptions, webhooks, events, sandbox and reference data.
- Financial core: tenant isolation, exact decimal money, double-entry ledger, idempotency and atomic transactions.
- FX: policy, exact pricing, liquidity, market, fiat settlement, SDK, node runtime, Durable Object runtime and Solidity settlement contracts.
- Builder inputs: name, brief, audience, markets, currencies, capabilities, rails and brand personality.
- Supported markets: SG, MY, GB, EU, US, GLOBAL.
- Supported currencies: SGD, MYR, GBP, EUR, USD, USDX, EURX, SGDX, MYRX.
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
  if (typeof result?.result?.response === "string") return result.result.response;
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  throw new Error("The Builder model returned an unsupported response");
}

function cleanJson(value) {
  const text = String(value).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

function normalizedDraft(draft = {}) {
  const allowed = {
    markets: new Set(["SG", "MY", "GB", "EU", "US", "GLOBAL"]),
    currencies: new Set(["SGD", "MYR", "GBP", "EUR", "USD", "USDX", "EURX", "SGDX", "MYRX"]),
    capabilities: new Set(["accounts", "onboarding", "transfers", "cards", "wallets", "fx", "savings", "business", "payment_links", "webhooks"]),
    rails: new Set(["paynow", "faster_payments", "sepa_instant", "sepa", "ach", "wire"]),
  };
  const list = (key, fallback = []) => [...new Set((Array.isArray(draft[key]) ? draft[key] : fallback)
    .map((item) => String(item).trim())
    .filter((item) => allowed[key].has(item)))];
  const accent = /^#[0-9a-f]{6}$/i.test(draft.brand?.accent ?? "") ? draft.brand.accent : "#0868FF";
  return {
    name: String(draft.name ?? "").trim().slice(0, 80),
    brief: String(draft.brief ?? "").trim().slice(0, 2000),
    audience: String(draft.audience ?? "").trim().slice(0, 240),
    markets: list("markets"),
    currencies: list("currencies"),
    capabilities: list("capabilities", ["accounts", "onboarding", "transfers"]),
    rails: list("rails"),
    brand: {
      accent,
      personality: String(draft.brand?.personality ?? "clear, credible and human").trim().slice(0, 120),
    },
  };
}

export class NeobankBuilder extends Agent {
  initialState = { messages: [] };

  async onRequest(request) {
    if (request.method === "GET") {
      return Response.json({ messages: this.state.messages, model: BUILDER_MODEL });
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Send a JSON body with a message." }, { status: 400 });
    }
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > 4000) {
      return Response.json({ error: "Write a message between 1 and 4,000 characters." }, { status: 400 });
    }

    try {
      const turn = await runBuilderTurn(this.env.AI, this.state.messages, message);
      this.setState({ messages: turn.messages });
      return Response.json({ reply: turn.reply, ready: turn.ready, draft: turn.draft, model: BUILDER_MODEL });
    } catch (error) {
      console.error("Builder model call failed", error);
      return Response.json({ error: "The Builder Agent is temporarily unavailable." }, { status: 502 });
    }
  }
}

export async function runBuilderTurn(ai, previousMessages, message) {
    const history = [...previousMessages, { role: "user", content: message }].slice(-20);
    const result = await ai.run(BUILDER_MODEL, {
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      temperature: 0.2,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      chat_template_kwargs: { thinking: false },
    });
    const parsed = cleanJson(textFrom(result));
    const reply = String(parsed.reply ?? "").trim().slice(0, 2000);
    if (!reply) throw new Error("The Builder model returned an empty reply");
    const draft = normalizedDraft(parsed.draft);
    const messages = [...history, { role: "assistant", content: reply }].slice(-20);
    return { reply, ready: Boolean(parsed.ready), draft, messages };
}
