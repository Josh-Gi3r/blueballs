/** Provider-neutral production transport.
 *
 * Blueballs core speaks one small protocol to a deployment-owned provider
 * gateway. The gateway maps canonical operations to the institution's actual
 * bank, card processor, KYC vendor, custody system or payment rail.
 */
import { enforceProviderResultContract } from "./provider-result-contract.js";

const PROTOCOL_VERSION = "2026-09-11";
const MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const OUTCOMES = new Set(["succeeded", "pending", "failed", "ambiguous"]);

let injectedTransport = null;
let configuredEnvironment = null;

function positiveInteger(value, fallback, { min = 1, max = 60_000 } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Provider timeout must be an integer between ${min} and ${max}ms`);
  }
  return parsed;
}

function validateGatewayUrl(value, allowInsecureLocalhost = false) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("BANK_PROVIDER_GATEWAY_URL must be a valid URL");
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error(
      "BANK_PROVIDER_GATEWAY_URL must not contain credentials or a fragment",
    );
  }
  const localhost = new Set(["localhost", "127.0.0.1", "::1"]).has(
    parsed.hostname,
  );
  const allowedProtocol =
    parsed.protocol === "https:" ||
    (allowInsecureLocalhost && localhost && parsed.protocol === "http:");
  if (!allowedProtocol) {
    throw new Error(
      "BANK_PROVIDER_GATEWAY_URL must use HTTPS (HTTP is allowed only for localhost when BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST=true)",
    );
  }
  return parsed.toString();
}

function environmentConfig(env = process.env) {
  const url = env.BANK_PROVIDER_GATEWAY_URL;
  const token = env.BANK_PROVIDER_GATEWAY_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) {
    throw new Error(
      "BANK_PROVIDER_GATEWAY_URL and BANK_PROVIDER_GATEWAY_TOKEN must be configured together",
    );
  }
  if (String(token).length < 16) {
    throw new Error("BANK_PROVIDER_GATEWAY_TOKEN must contain at least 16 characters");
  }
  return {
    url: validateGatewayUrl(
      url,
      String(env.BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST || "false") === "true",
    ),
    token: String(token),
    timeoutMs: positiveInteger(env.BANK_PROVIDER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, {
      min: 100,
      max: 60_000,
    }),
  };
}

/** Cloudflare passes secrets/vars through the Worker env object. Configure that
 * exact object before route modules load rather than relying on process.env
 * population behavior. */
export function configureProviderEnvironment(env) {
  configuredEnvironment = environmentConfig(env);
  return !!configuredEnvironment;
}

/** Test/self-host extension point. The transport receives one canonical
 * envelope and returns the same normalized result contract as the HTTP gateway. */
export function setProviderTransport(transport) {
  if (transport !== null && typeof transport !== "function") {
    throw new TypeError("provider transport must be a function or null");
  }
  injectedTransport = transport;
}

function activeConfig() {
  return configuredEnvironment ?? environmentConfig(process.env);
}

export function providerTransportAvailable() {
  return !!injectedTransport || !!activeConfig();
}

async function readLimitedJson(response) {
  if (!response.body) return {};
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(
          `Provider response exceeded ${MAX_RESPONSE_BYTES} bytes`,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Provider gateway response must be a JSON object");
  }
  return parsed;
}

function retryAfterMs(response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  if (/^\d+$/.test(raw.trim())) return Number(raw.trim()) * 1000;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp)
    ? Math.max(0, timestamp - Date.now())
    : null;
}

function normalizeResult(value, fallback = {}) {
  const outcome = value?.outcome;
  if (!OUTCOMES.has(outcome)) {
    throw new Error(
      "Provider gateway 2xx response requires outcome=succeeded|pending|failed|ambiguous",
    );
  }
  const retryAfter = value.retry_after_ms;
  if (
    retryAfter !== undefined &&
    retryAfter !== null &&
    (!Number.isSafeInteger(retryAfter) || retryAfter < 0 || retryAfter > 86_400_000)
  ) {
    throw new Error(
      "Provider retry_after_ms must be an integer between 0 and 86400000",
    );
  }
  return {
    outcome,
    provider_reference:
      value.provider_reference === undefined || value.provider_reference === null
        ? null
        : String(value.provider_reference),
    provider_state:
      value.provider_state === undefined || value.provider_state === null
        ? null
        : String(value.provider_state),
    funds_state:
      value.funds_state === undefined || value.funds_state === null
        ? null
        : String(value.funds_state),
    retry_after_ms: retryAfter ?? null,
    error_code:
      value.error_code === undefined || value.error_code === null
        ? null
        : String(value.error_code),
    result:
      value.result && typeof value.result === "object" && !Array.isArray(value.result)
        ? value.result
        : null,
    ...fallback,
  };
}

function ambiguousResult(envelope, errorCode, fallback = {}) {
  return {
    outcome: "ambiguous",
    provider_reference: envelope.provider_reference ?? null,
    provider_state: null,
    funds_state: null,
    retry_after_ms: null,
    error_code: errorCode,
    result: null,
    ...fallback,
  };
}

function checked(envelope, result) {
  return enforceProviderResultContract(envelope, result);
}

function responseEvidence(envelope, parsed, response, outcome, errorCode) {
  return checked(envelope, {
    outcome,
    provider_reference: parsed.provider_reference ?? envelope.provider_reference ?? null,
    provider_state: parsed.provider_state ?? null,
    funds_state: parsed.funds_state ?? null,
    retry_after_ms: retryAfterMs(response),
    error_code: parsed.error_code ?? errorCode,
    result: null,
    transport: "http",
    status_code: response.status,
  });
}

/** Send one provider operation. `job_id` is the provider idempotency key for the
 * lifetime of the operation, across submission and reconciliation attempts.
 *
 * HTTP status is part of the financial evidence. A non-2xx response can never
 * declare success merely because its JSON body says `outcome: succeeded`.
 * 408/425/5xx are ambiguous; 429 is retryable; other 4xx responses may be
 * terminal only when they do not contradict the capability-specific funds
 * state contract. */
export async function sendProviderOperation(envelope) {
  if (injectedTransport) {
    try {
      const result = await injectedTransport(structuredClone(envelope));
      return checked(
        envelope,
        normalizeResult(result, { transport: "injected", status_code: null }),
      );
    } catch {
      return checked(
        envelope,
        ambiguousResult(envelope, "custom_transport_ambiguous", {
          transport: "injected",
          status_code: null,
        }),
      );
    }
  }

  const config = activeConfig();
  if (!config) {
    const error = new Error("No production provider gateway is configured");
    error.code = "PROVIDER_UNAVAILABLE";
    throw error;
  }

  const body = JSON.stringify({
    protocol_version: PROTOCOL_VERSION,
    ...envelope,
  });
  let response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        "x-blueballs-provider-protocol": PROTOCOL_VERSION,
        "x-idempotency-key": envelope.job_id,
        "x-blueballs-command-id": envelope.command_id ?? "",
      },
      body,
    });
  } catch {
    return checked(
      envelope,
      ambiguousResult(envelope, "transport_ambiguous", {
        transport: "http",
        status_code: null,
      }),
    );
  }

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    return checked(
      envelope,
      ambiguousResult(envelope, "provider_redirect_rejected", {
        transport: "http",
        status_code: response.status,
      }),
    );
  }

  let parsed = {};
  try {
    parsed = await readLimitedJson(response);
  } catch {
    return checked(
      envelope,
      ambiguousResult(envelope, "provider_protocol_error", {
        transport: "http",
        status_code: response.status,
      }),
    );
  }

  if (response.ok) {
    try {
      return checked(
        envelope,
        normalizeResult(parsed, {
          transport: "http",
          status_code: response.status,
        }),
      );
    } catch {
      return checked(
        envelope,
        ambiguousResult(envelope, "provider_protocol_error", {
          transport: "http",
          status_code: response.status,
        }),
      );
    }
  }

  if (response.status === 429) {
    return responseEvidence(
      envelope,
      parsed,
      response,
      "retry",
      "provider_rate_limited",
    );
  }

  if (
    response.status >= 500 ||
    response.status === 408 ||
    response.status === 425
  ) {
    return responseEvidence(
      envelope,
      parsed,
      response,
      "ambiguous",
      `provider_http_${response.status}`,
    );
  }

  // A 4xx HTTP response and a body claiming success are contradictory evidence.
  // Never finalize money from that combination; reconcile instead.
  if (parsed.outcome === "succeeded" || parsed.outcome === "pending") {
    return responseEvidence(
      envelope,
      parsed,
      response,
      "ambiguous",
      "provider_http_outcome_conflict",
    );
  }

  if (parsed.outcome === "ambiguous") {
    return responseEvidence(
      envelope,
      parsed,
      response,
      "ambiguous",
      parsed.error_code ?? `provider_http_${response.status}`,
    );
  }

  return responseEvidence(
    envelope,
    parsed,
    response,
    "failed",
    `provider_http_${response.status}`,
  );
}
