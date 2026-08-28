import { demoFxCall, WEBSITE_FX_DEMO_LABEL } from "./fx/demoRuntime";
import { createSingleFlight } from "./singleFlight.js";

/** Live client for the Blueballs API. The docs page runs real requests through this. */

const IS_PRODUCTION_BUILD = Boolean((import.meta as any).env?.PROD);

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (IS_PRODUCTION_BUILD ? "" : "http://localhost:5290");

/**
 * When a standalone FX node is configured, the page uses it. A normal static
 * website build has no server process, so it falls back to the embedded seeded
 * demo instead of rendering an empty/offline product.
 */
export const FX_NODE_BASE = (import.meta as any).env?.VITE_FX_NODE_BASE || "";
const REMOTE_FX_CONFIGURED = IS_PRODUCTION_BUILD || Boolean(FX_NODE_BASE);
export const FX_RUNTIME_MODE: "node" | "demo" = REMOTE_FX_CONFIGURED
  ? "node"
  : "demo";
export const FX_RUNTIME_LABEL = REMOTE_FX_CONFIGURED
  ? FX_NODE_BASE || "same-origin Cloudflare FX API"
  : WEBSITE_FX_DEMO_LABEL;
export const fxNodeConfigured = () => true;
export const fxUsingWebsiteDemo = () => FX_RUNTIME_MODE === "demo";

const KEY_STORAGE = "bb_sandbox_key";

/** Sandbox credentials are tab-scoped. Closing the tab clears the bearer key;
 *  the API also expires it server-side. This avoids turning an exploratory
 *  browser session into a permanent tenant credential. */
export const getKey = () => sessionStorage.getItem(KEY_STORAGE);
export const setKey = (k: string) => sessionStorage.setItem(KEY_STORAGE, k);
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
      error: "API paths must stay on this origin under /v2.",
    };
  }
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const key = getKey();
    if (useKey && key) headers["x-api-key"] = key;

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, status: res.status, ms, body: parsed };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: null,
      error: `Could not reach ${API_BASE}. Is the API running?`,
    };
  }
}

/** Fire a request at the running legacy/general Blueballs API. */
export async function call(
  method: string,
  path: string,
  body?: unknown,
  useKey = true,
): Promise<ApiResult> {
  const result = await requestApi(method, path, body, useKey);
  if (useKey && result.status === 401 && getKey()) {
    clearKey();
    const replacement = await provisionKey();
    if (replacement) return requestApi(method, path, body, true);
  }
  return result;
}

/**
 * Use the standalone FX node when configured. Otherwise use the embedded
 * browser demo so the public website remains complete and interactive.
 */
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
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const res = await fetch(FX_NODE_BASE.replace(/\/$/, "") + path, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, status: res.status, ms, body: parsed };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: null,
      error: `Could not reach ${FX_NODE_BASE}. Is the sandbox FX node running?`,
    };
  }
}

/** Self-serve signup — no approval step, exactly as documented. */
export async function signup(email: string) {
  const r = await call("POST", "/v2/auth/signup", { email }, false);
  const key = (r.body as any)?.key;
  if (key) setKey(key);
  return r;
}

/** Is the API reachable right now? Drives the live/offline badge. */
export async function ping(): Promise<boolean> {
  const r = await call("GET", "/v2", undefined, false);
  return r.ok;
}

/** Real platform counts when the general API is running. */
export type SiteStats = {
  accounts: number;
  customers: number;
  transfers: number;
  currencies: number;
  rails: number;
  endpoints_implemented: number;
  endpoints_catalogued: number;
};
export async function getStats(): Promise<SiteStats | null> {
  const r = await call("GET", "/v2/site/stats", undefined, false);
  return r.ok ? (r.body as SiteStats) : null;
}

/** Sensible example body per endpoint so "Try it" does something meaningful. */
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

/** Silently provisions a sandbox key if the visitor doesn't have one yet, so the
 *  hero FX widget and the quote-latency figure can hit the real API with zero
 *  clicks — same self-serve signup a developer would use, just automatic. */
const provisionKey = createSingleFlight(async (): Promise<string | null> => {
  const existing = getKey();
  if (existing) return existing;
  const email = `visitor-${crypto.randomUUID()}@blueballs.local`;
  const r = await signup(email);
  return (r.body as any)?.key ?? null;
});

export async function ensureKey(): Promise<string | null> {
  return getKey() ?? provisionKey();
}
