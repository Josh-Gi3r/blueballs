/** Live client for the Blueballs API. The docs page runs real requests through this —
 *  nothing on the site is faked. */

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5290";

/**
 * The proven FX runtime is intentionally separate from the legacy monolithic API.
 * These values must point only at a sandbox/demo FX node when used in a browser build.
 */
export const FX_NODE_BASE = (import.meta as any).env?.VITE_FX_NODE_BASE || "";
export const FX_NODE_KEY = (import.meta as any).env?.VITE_FX_NODE_KEY || "";
export const fxNodeConfigured = () => Boolean(FX_NODE_BASE && FX_NODE_KEY);

const KEY_STORAGE = "bb_sandbox_key";

export const getKey = () => localStorage.getItem(KEY_STORAGE);
export const setKey = (k: string) => localStorage.setItem(KEY_STORAGE, k);
export const clearKey = () => localStorage.removeItem(KEY_STORAGE);

export type ApiResult = {
  ok: boolean;
  status: number;
  ms: number;
  body: unknown;
  error?: string;
};

/** Fire a real request at the running legacy/general Blueballs API. */
export async function call(
  method: string,
  path: string,
  body?: unknown,
  useKey = true
): Promise<ApiResult> {
  const started = performance.now();
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const key = getKey();
    if (useKey && key) headers["x-api-key"] = key;

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    return { ok: res.ok, status: res.status, ms, body: parsed };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: null,
      error: `Could not reach ${API_BASE}. Is the API running?`,
    };
  }
}

/**
 * Fire a request at the standalone, release-gated Blueballs FX node.
 * There is deliberately no fallback to the older /v2/fx routes in apps/api.
 */
export async function fxCall(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<ApiResult> {
  const started = performance.now();
  if (!FX_NODE_BASE) {
    return {
      ok: false,
      status: 0,
      ms: 0,
      body: null,
      error: "Live FX node is not configured. Set VITE_FX_NODE_BASE for sandbox mode.",
    };
  }
  if (authenticated && !FX_NODE_KEY) {
    return {
      ok: false,
      status: 0,
      ms: 0,
      body: null,
      error: "Live FX node key is not configured. Use a sandbox/demo key only in browser builds.",
    };
  }

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (authenticated) headers.authorization = `Bearer ${FX_NODE_KEY}`;
    const res = await fetch(FX_NODE_BASE.replace(/\/$/, "") + path, {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
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

/** Real, live platform counts — powers the site's stat tiles and ticker.
 *  Not invented: this hits the running API and reports what it says. */
export type SiteStats = {
  accounts: number; customers: number; transfers: number;
  currencies: number; rails: number;
  endpoints_implemented: number; endpoints_catalogued: number;
};
export async function getStats(): Promise<SiteStats | null> {
  const r = await call("GET", "/v2/site/stats", undefined, false);
  return r.ok ? (r.body as SiteStats) : null;
}

/** Silently provisions a sandbox key if the visitor doesn't have one yet, so the
 *  hero FX widget and the quote-latency figure can hit the real API with zero
 *  clicks — same self-serve signup a developer would use, just automatic. */
export async function ensureKey(): Promise<string | null> {
  const existing = getKey();
  if (existing) return existing;
  const email = `visitor-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@blueballs.local`;
  const r = await signup(email);
  return (r.body as any)?.key ?? null;
}

/** Sensible example body per endpoint so "Try it" does something meaningful. */
export function sampleBody(method: string, path: string): unknown | undefined {
  if (method === "GET" || method === "DELETE") return undefined;
  if (path === "/v2/auth/signup") return { email: "you@example.com" };
  if (path === "/v2/customers") return { type: "individual", name: "Ada Lovelace" };
  if (path === "/v2/accounts") return { customer: "cus_…", currency: "EUR" };
  if (path === "/v2/quotes") return { from: "EUR", to: "SGD", amount: "5000.00" };
  if (path === "/v2/transfers") return { from: "acc_…", amount: "2400.00", rail: "sepa_instant" };
  if (path === "/v2/recipients") return { name: "Marta Ilves" };
  if (path === "/v2/vaults") return { account: "acc_…", name: "House deposit", target: "20000.00" };
  if (path === "/v2/cards") return { account: "acc_…", form: "virtual" };
  if (path === "/v2/orgs") return { name: "Kessler Ltd" };
  if (path === "/v2/webhooks") return { url: "https://example.com/hook", events: ["transfer.status_changed"] };
  if (path === "/v2/qr/generate")
    return { merchant: { name: "Coffee Corner", city: "Singapore", country: "SG" }, currency: "SGD", amount: "23.75" };
  return {};
}
