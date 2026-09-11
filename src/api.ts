import { demoFxCall, WEBSITE_FX_DEMO_LABEL } from "./fx/demoRuntime";
import { createSingleFlight } from "./singleFlight.js";

/** Browser client for the canonical Blueballs banking and FX HTTP contracts. */
const IS_PRODUCTION_BUILD = Boolean((import.meta as any).env?.PROD);

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (IS_PRODUCTION_BUILD ? "" : "http://localhost:5290");

/**
 * Production serves FX through the same-origin Worker binding. Local website
 * development can point at a standalone FX node; when none is configured the
 * product surface uses the deterministic browser market lab.
 */
export const FX_NODE_BASE = (import.meta as any).env?.VITE_FX_NODE_BASE || "";
const REMOTE_FX_CONFIGURED = IS_PRODUCTION_BUILD || Boolean(FX_NODE_BASE);
export const FX_RUNTIME_MODE: "node" | "demo" = REMOTE_FX_CONFIGURED
  ? "node"
  : "demo";
export const FX_RUNTIME_LABEL = REMOTE_FX_CONFIGURED
  ? FX_NODE_BASE || "same-origin Blueballs FX runtime"
  : WEBSITE_FX_DEMO_LABEL;
export const fxNodeConfigured = () => true;
export const fxUsingWebsiteDemo = () => FX_RUNTIME_MODE === "demo";

const KEY_STORAGE = "bb_sandbox_key";

/** Sandbox credentials are tab-scoped and disappear when the tab session ends. */
export const getKey = () => sessionStorage.getItem(KEY_STORAGE);
export const setKey = (key: string) => sessionStorage.setItem(KEY_STORAGE, key);
export const clearKey = () => sessionStorage.removeItem(KEY_STORAGE);

export type ApiResult = {
  ok: boolean;
  status: number;
  ms: number;
  body: unknown;
  error?: string;
};

export function isSameOriginApiPath(path: string): boolean {
  return /^\/v2(?:[/?]|$)/.test(path) && !path.startsWith("//");
}

async function requestApi(
  method: string,
  path: string,
  body: unknown,
  useKey: boolean,
): Promise<ApiResult> {
  const started = performance.now();
  if (!isSameOriginApiPath(path)) {
    return {
      ok: false,
      status: 400,
      ms: 0,
      body: null,
      error: "Banking API paths must stay under /v2 on the configured origin.",
    };
  }

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const key = getKey();
    if (useKey && key) headers["x-api-key"] = key;

    const response = await fetch(API_BASE + path, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Preserve non-JSON responses for the developer console.
    }
    return { ok: response.ok, status: response.status, ms, body: parsed };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: null,
      error: `Could not reach ${API_BASE || "the same-origin Blueballs API"}.`,
    };
  }
}

/** Execute one request against the canonical banking API. */
export async function call(
  method: string,
  path: string,
  body?: unknown,
  useKey = true,
): Promise<ApiResult> {
  return requestApi(method, path, body, useKey);
}

/** Execute one request against the canonical FX HTTP surface. */
export async function fxCall(
  method: string,
  path: string,
  body?: unknown,
  _authenticated = true,
): Promise<ApiResult> {
  if (!REMOTE_FX_CONFIGURED) {
    return demoFxCall(method, path, body);
  }

  const started = performance.now();
  const base = FX_NODE_BASE.replace(/\/$/, "");
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const response = await fetch(base + path, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Preserve non-JSON responses for inspection.
    }
    return { ok: response.ok, status: response.status, ms, body: parsed };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: null,
      error: `Could not reach ${base || "the same-origin Blueballs FX runtime"}.`,
    };
  }
}

/** Issue a self-serve scoped sandbox credential. */
export async function signup(email: string) {
  const result = await call("POST", "/v2/auth/signup", { email }, false);
  const key = (result.body as any)?.key;
  if (key) setKey(key);
  return result;
}

/** Public health probe used by the website status indicator. */
export async function ping(): Promise<boolean> {
  const result = await call("GET", "/v2", undefined, false);
  return result.ok;
}

export type SiteStats = {
  accounts: number;
  customers: number;
  transfers: number;
  currencies: number;
  rails: number;
  endpoints_implemented: number;
  endpoints_catalogued: number;
};

/** Aggregate, non-tenant platform counts exposed by the public site endpoint. */
export async function getStats(): Promise<SiteStats | null> {
  const result = await call("GET", "/v2/site/stats", undefined, false);
  return result.ok ? (result.body as SiteStats) : null;
}

/** Example request bodies used by the interactive developer catalogue. */
export function sampleBody(method: string, path: string): unknown | undefined {
  if (method === "GET" || method === "DELETE") return undefined;
  if (path === "/v2/auth/signup") return { email: "you@example.com" };
  if (path === "/v2/customers")
    return { type: "individual", name: "Ada Lovelace" };
  if (path === "/v2/accounts") return { customer: "cus_…", currency: "EUR" };
  if (path === "/v2/quotes")
    return { from: "EUR", to: "SGD", amount: "5000.00" };
  if (path === "/v2/transfers")
    return { from: "acc_…", amount: "2400.00", rail: "sepa_instant" };
  if (path === "/v2/recipients") return { name: "Marta Ilves" };
  if (path === "/v2/vaults")
    return { account: "acc_…", name: "House deposit", target: "20000.00" };
  if (path === "/v2/cards") return { account: "acc_…", form: "virtual" };
  if (path === "/v2/orgs") return { name: "Kessler Ltd" };
  if (path === "/v2/webhooks")
    return {
      url: "https://example.com/hook",
      events: ["transfer.status_changed"],
    };
  if (path === "/v2/qr/generate")
    return {
      merchant: { name: "Coffee Corner", city: "Singapore", country: "SG" },
      currency: "SGD",
      amount: "23.75",
    };
  return {};
}

/**
 * Bootstrap a sandbox credential for an explicit sandbox experience. The
 * marketing/product pages never call this function during ordinary browsing.
 */
const provisionKey = createSingleFlight(async (): Promise<string | null> => {
  const existing = getKey();
  if (existing) return existing;
  const email = `visitor-${crypto.randomUUID()}@blueballs.local`;
  const result = await signup(email);
  return (result.body as any)?.key ?? null;
});

export async function ensureKey(): Promise<string | null> {
  return getKey() ?? provisionKey();
}
