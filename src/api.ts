import { demoFxCall, WEBSITE_FX_DEMO_LABEL } from "./fx/demoRuntime";

/** Live client for the Blueballs API. The docs page runs real requests through this. */

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5290";

/**
 * When a standalone FX node is configured, the page uses it. A normal static
 * website build has no server process, so it falls back to the embedded seeded
 * demo instead of rendering an empty/offline product.
 */
export const FX_NODE_BASE = (import.meta as any).env?.VITE_FX_NODE_BASE || "";
export const FX_NODE_KEY = (import.meta as any).env?.VITE_FX_NODE_KEY || "";
const REMOTE_FX_CONFIGURED = Boolean(FX_NODE_BASE && FX_NODE_KEY);
export const FX_RUNTIME_MODE: "node" | "demo" = REMOTE_FX_CONFIGURED ? "node" : "demo";
export const FX_RUNTIME_LABEL = REMOTE_FX_CONFIGURED ? FX_NODE_BASE : WEBSITE_FX_DEMO_LABEL;
export const fxNodeConfigured = () => true;
export const fxUsingWebsiteDemo = () => FX_RUNTIME_MODE === "demo";

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

/** Fire a request at the running legacy/general Blueballs API. */
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

/**
 * Use the standalone FX node when configured. Otherwise use the embedded
 * browser demo so the public website remains complete and interactive.
 */
export async function fxCall(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<ApiResult> {
  if (!REMOTE_FX_CONFIGURED) {
    return demoFxCall(method, path, body);
  }

  const started = performance.now();
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

/** Real platform counts when the general API is running. */
export type SiteStats = {
  accounts: number; customers: number; transfers: number;
  currencies: number; rails: number;
  endpoints_implemented: number; endpoints_catalogued: number;
};
export async function getStats(): Promise<SiteStats | null> {
  const r = await call("GET", "/v2/site/stats", undefined, false);
  return r.ok ? (r.body as SiteStats) : null;
}
