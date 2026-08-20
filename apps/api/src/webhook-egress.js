import { ApiError } from "./lib.js";

export const WEBHOOK_DELIVERY_MODE = process.env.WEBHOOK_DELIVERY_MODE === "allowlist" ? "allowlist" : "disabled";
const allowedTargets = new Set(
  String(process.env.WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((target) => target.trim().toLowerCase())
    .filter(Boolean)
);
const MAX_CONCURRENCY = Number(process.env.WEBHOOK_MAX_CONCURRENCY || 8);
let active = 0;
const waiting = [];

function configuredTarget(parsed) {
  const defaultPort = parsed.port || "443";
  const withPort = `${parsed.hostname.toLowerCase()}:${defaultPort}`;
  return allowedTargets.has(withPort) || (defaultPort === "443" && allowedTargets.has(parsed.hostname.toLowerCase()));
}

export function validateWebhookUrl(value) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new ApiError("validation-error", 400, "url must be a valid HTTPS URL"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new ApiError("validation-error", 400, "url must use HTTPS without credentials or a fragment");
  }
  if (!configuredTarget(parsed)) {
    throw new ApiError("validation-error", 400, `Webhook target ${parsed.host} is not explicitly allowlisted`);
  }
  return parsed.toString();
}

async function acquire() {
  if (active < MAX_CONCURRENCY) { active += 1; return; }
  await new Promise((resolve) => waiting.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  waiting.shift()?.();
}

export async function fetchWebhook(value, init) {
  if (WEBHOOK_DELIVERY_MODE !== "allowlist") {
    throw new ApiError("service-unavailable", 503, "Webhook delivery is disabled on this host");
  }
  const target = validateWebhookUrl(value);
  await acquire();
  try {
    const response = await fetch(target, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error("Webhook redirects are not followed");
    }
    await response.body?.cancel();
    return response;
  } finally {
    release();
  }
}
