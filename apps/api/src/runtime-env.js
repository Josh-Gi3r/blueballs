/** Explicit banking runtime environment.
 *
 * Node processes read process.env. Cloudflare Workers configure their env object
 * before importing the banking runtime, so correctness never depends on an
 * implicit process.env bridge for mode, limits or background-worker ownership.
 */
let configuredEnvironment = null;

// A few legacy modules still read process.env at module initialization. Mirror
// only non-secret configuration that affects banking semantics until those reads
// are fully retired. Provider tokens, payload-encryption keys and bootstrap
// secrets stay exclusively in their explicit env objects.
const PROCESS_ENV_COMPAT = Object.freeze([
  "BANK_API_MODE",
  "CLOUDFLARE_WORKER",
  "PORT",
  "PUBLIC_SITE_URL",
  "PAYMENT_LINK_BASE_URL",
  "CORS_ORIGINS",
  "TRUST_PROXY",
  "BLUEBALLS_GIT_SHA",
  "RATE_LIMIT_PER_MIN",
  "SOURCE_RATE_LIMIT_PER_MIN",
  "TENANT_RATE_LIMIT_PER_MIN",
  "BODY_LIMIT_BYTES",
  "IDEMPOTENCY_TTL_MS",
  "SANDBOX_KEY_LIFETIME_HOURS",
  "EVENT_RETENTION_PER_TENANT",
  "OPERATOR_API_KEY_HASH",
  "WEBHOOK_DELIVERY_MODE",
  "WEBHOOK_ALLOWED_HOSTS",
  "WEBHOOK_MAX_CONCURRENCY",
  "WEBHOOK_LEASE_MS",
  "WEBHOOK_PUMP_MS",
  "WEBHOOK_RETRY_DELAYS_MS",
  "BANK_PROVIDER_LEASE_MS",
  "BANK_PROVIDER_PUMP_MS",
  "BANK_PROVIDER_RETRY_DELAYS_MS",
]);

export function configureBankingRuntimeEnvironment(env) {
  if (env !== null && (typeof env !== "object" || Array.isArray(env))) {
    throw new TypeError("banking runtime environment must be an object or null");
  }
  configuredEnvironment = env;

  if (env) {
    for (const name of PROCESS_ENV_COMPAT) {
      const value = env[name];
      if (value === undefined || value === null) continue;
      process.env[name] = String(value);
    }
  }
  return configuredEnvironment;
}

export function bankingRuntimeEnvironment() {
  return configuredEnvironment ?? process.env;
}

export function bankingEnv(name, fallback = undefined) {
  const value = bankingRuntimeEnvironment()?.[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

export function bankingFlag(name, fallback = false) {
  const raw = bankingEnv(name, fallback ? "true" : "false");
  if (!new Set(["true", "false"]).has(String(raw))) {
    throw new Error(`${name} must be true or false`);
  }
  return String(raw) === "true";
}

export { PROCESS_ENV_COMPAT };
