/** Explicit banking runtime environment.
 *
 * Node processes read process.env. Cloudflare Workers configure their env object
 * before importing the banking runtime, so correctness never depends on an
 * implicit process.env bridge for mode, limits, secrets or background-worker
 * ownership.
 */
let configuredEnvironment = null;

export function configureBankingRuntimeEnvironment(env) {
  if (env !== null && (typeof env !== "object" || Array.isArray(env))) {
    throw new TypeError("banking runtime environment must be an object or null");
  }
  configuredEnvironment = env;
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
