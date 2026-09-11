import { FiatSettlementStore } from "../../../packages/fx-fiat/src/index.js";
import { FxMarketService } from "../../../packages/fx-market/src/index.js";

import { PrivateMarketQuoteCoordinator } from "./quote-coordinator.js";
import { createPublicReferenceRuntime } from "./public-reference-runtime.js";
import { loadProductionRuntime } from "./production-runtime.js";
import { createFxNodeServer } from "./server.js";

const mode = process.env.FX_NODE_MODE ?? "reference-sandbox";
if (!["reference-sandbox", "private-sandbox", "production"].includes(mode)) {
  throw new Error(
    'FX_NODE_MODE must be "reference-sandbox", "private-sandbox" or "production"',
  );
}

const production = mode === "production";
const host = process.env.FX_NODE_HOST ?? "127.0.0.1";
const port = Number(process.env.FX_NODE_PORT ?? "8788");
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("FX_NODE_PORT invalid");
}

const configuredApiKey = process.env.FX_NODE_API_KEY;
if (production && (!configuredApiKey || configuredApiKey.length < 32)) {
  throw new Error(
    "FX_NODE_API_KEY must contain at least 32 characters in production mode",
  );
}
const apiKey = configuredApiKey ?? "bb_test_local_fx";

const configuredOperatorApiKey = process.env.FX_NODE_OPERATOR_API_KEY;
if (
  production &&
  (!configuredOperatorApiKey || configuredOperatorApiKey.length < 32)
) {
  throw new Error(
    "FX_NODE_OPERATOR_API_KEY must contain at least 32 characters in production mode",
  );
}
if (
  production &&
  configuredOperatorApiKey === configuredApiKey
) {
  throw new Error(
    "FX_NODE_OPERATOR_API_KEY must be distinct from FX_NODE_API_KEY in production mode",
  );
}
const operatorApiKey = configuredOperatorApiKey ?? apiKey;
const sourceCommit = process.env.BLUEBALLS_GIT_SHA ?? "development";

const corsDefault = production
  ? ""
  : "http://localhost:5280,http://127.0.0.1:5280";
const corsOrigins = (process.env.FX_NODE_CORS_ORIGINS ?? corsDefault)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let runtime;
let node;

if (mode === "reference-sandbox") {
  runtime = await createPublicReferenceRuntime({
    dataDir: process.env.FX_NODE_DATA_DIR ?? "./blueballs-fx-data",
  });
  node = createFxNodeServer({
    market: runtime.market,
    quotes: runtime.quotes,
    fiat: runtime.fiat,
    inspector: runtime.inspector,
    trades: runtime.trades,
    scenario: runtime.scenario,
    monetary: runtime.monetary,
    apiKey,
    operatorApiKey,
    publicDepth: true,
    corsOrigins,
    sourceCommit,
  });
} else if (mode === "private-sandbox") {
  const dbPath = process.env.FX_NODE_DB ?? "./blueballs-fx.db";
  const quoteDbPath =
    process.env.FX_NODE_QUOTE_DB ?? "./blueballs-fx-quotes.db";
  const market = new FxMarketService({
    path: dbPath,
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true, sandbox: true }),
  });
  const quotes = new PrivateMarketQuoteCoordinator({
    market,
    path: quoteDbPath,
  });
  const fiat = new FiatSettlementStore({ path: dbPath });
  runtime = {
    market,
    quotes,
    fiat,
    close() {
      quotes.close();
      fiat.close();
      market.close();
    },
  };
  node = createFxNodeServer({
    market,
    quotes,
    fiat,
    apiKey,
    operatorApiKey,
    corsOrigins,
    publicDepth: true,
    sourceCommit,
  });
} else {
  runtime = await loadProductionRuntime();
  node = createFxNodeServer({
    market: runtime.market,
    quotes: runtime.quotes,
    fiat: runtime.fiat,
    executionAdapter: runtime.executionAdapter,
    apiKey,
    operatorApiKey,
    corsOrigins,
    publicDepth: runtime.publicDepth === true,
    sourceCommit,
  });
}

const address = await node.listen({ host, port });
console.log(
  `Blueballs FX node (${mode.toUpperCase()}) listening on http://${address.address}:${address.port}`,
);
console.log(
  `Client API key: ${configuredApiKey ? "configured" : "local sandbox default"}`,
);
console.log(
  `Operator API key: ${configuredOperatorApiKey ? "configured separately" : "local sandbox default"}`,
);
console.log(`Browser origins: ${corsOrigins.join(", ") || "none"}`);
console.log(`Source commit: ${sourceCommit}`);
console.log(
  production
    ? "Execution: production adapter active"
    : "Execution: adapter-driven; configure a production runtime for live execution",
);
if (mode === "reference-sandbox") {
  console.log(
    "Reference trade: BRL → internal BRL deposit claim → multi-source EURC → EUR",
  );
  console.log(
    "Reference market: customer orders + issuer + LP + neobank + treasury + principal",
  );
}

async function shutdown(signal) {
  console.log(`\n${signal}: closing Blueballs FX node`);
  await node.close();
  await runtime.close?.();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
