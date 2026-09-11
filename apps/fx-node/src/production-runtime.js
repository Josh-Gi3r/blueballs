import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FACTORY_NAMES = [
  "createBlueballsFxProductionRuntime",
  "createBlueballsFxRuntime",
  "createRuntime",
];

function moduleSpecifier(value, cwd = process.cwd()) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      "FX_NODE_PRODUCTION_ADAPTER must name a production runtime adapter module",
    );
  }
  const ref = value.trim();
  if (
    ref.startsWith("file:") ||
    ref.startsWith("node:") ||
    ref.startsWith("data:")
  ) {
    return ref;
  }
  if (isAbsolute(ref) || ref.startsWith("./") || ref.startsWith("../")) {
    return pathToFileURL(resolve(cwd, ref)).href;
  }
  return ref;
}

function factoryFrom(module) {
  for (const name of FACTORY_NAMES) {
    if (typeof module?.[name] === "function") return module[name];
  }
  if (typeof module?.default === "function") return module.default;
  throw new Error(
    `FX production adapter must export one of ${FACTORY_NAMES.join(", ")} or a default factory`,
  );
}

function assertMethod(value, method, label) {
  if (!value || typeof value[method] !== "function") {
    throw new Error(`FX production runtime ${label} must expose ${method}()`);
  }
}

export function validateProductionRuntime(runtime) {
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    throw new Error("FX production adapter factory must return a runtime object");
  }

  assertMethod(runtime.market, "aggregateDepth", "market");
  assertMethod(runtime.market, "admitOrder", "market");
  assertMethod(runtime.market, "listOrdersForMaker", "market");
  assertMethod(runtime.market, "cancelOrderOffchain", "market");
  assertMethod(runtime.market, "getRoute", "market");

  assertMethod(runtime.quotes, "reserveExactOutput", "quotes");
  assertMethod(runtime.quotes, "getQuote", "quotes");
  assertMethod(runtime.quotes, "getPrivateQuote", "quotes");
  assertMethod(runtime.quotes, "markSubmitted", "quotes");
  assertMethod(runtime.quotes, "confirm", "quotes");
  assertMethod(runtime.quotes, "fail", "quotes");

  assertMethod(runtime.fiat, "createIntent", "fiat");
  assertMethod(runtime.fiat, "getIntent", "fiat");
  assertMethod(runtime.fiat, "reserveIntent", "fiat");
  assertMethod(runtime.fiat, "submitIntent", "fiat");
  assertMethod(runtime.fiat, "acceptAttestation", "fiat");
  assertMethod(runtime.fiat, "settleVerifiedIntent", "fiat");

  assertMethod(runtime.executionAdapter, "submit", "executionAdapter");

  if (runtime.close !== undefined && typeof runtime.close !== "function") {
    throw new Error("FX production runtime close must be a function when provided");
  }
  if (runtime.publicDepth !== undefined && typeof runtime.publicDepth !== "boolean") {
    throw new Error("FX production runtime publicDepth must be boolean when provided");
  }

  return runtime;
}

export async function loadProductionRuntime({
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  const specifier = moduleSpecifier(env.FX_NODE_PRODUCTION_ADAPTER, cwd);
  let module;
  try {
    module = await import(specifier);
  } catch (error) {
    const wrapped = new Error(
      `Unable to load FX production adapter ${env.FX_NODE_PRODUCTION_ADAPTER}: ${error.message}`,
    );
    wrapped.cause = error;
    throw wrapped;
  }

  const factory = factoryFrom(module);
  const runtime = await factory({ env });
  return validateProductionRuntime(runtime);
}
