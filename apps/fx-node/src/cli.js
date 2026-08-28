import { FiatSettlementStore } from "../../../packages/fx-fiat/src/index.js";
import { FxMarketService } from "../../../packages/fx-market/src/index.js";

import { PrivateMarketQuoteCoordinator } from "./quote-coordinator.js";
import { createPublicReferenceRuntime } from "./public-reference-runtime.js";
import { createFxNodeServer } from "./server.js";

const mode = process.env.FX_NODE_MODE ?? "reference-sandbox";
if (!["reference-sandbox", "private-sandbox"].includes(mode)) {
  throw new Error(
    'FX_NODE_MODE supports "reference-sandbox" or "private-sandbox" only. Production mode must provide real signature, policy and execution adapters rather than falling back silently.',
  );
}

const host = process.env.FX_NODE_HOST ?? "127.0.0.1";
const port = Number(process.env.FX_NODE_PORT ?? "8788");
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("FX_NODE_PORT invalid");

const apiKey = process.env.FX_NODE_API_KEY ?? "bb_test_local_fx";
const corsOrigins = (
  process.env.FX_NODE_CORS_ORIGINS ??
  "http://localhost:5280,http://127.0.0.1:5280"
)
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
    // matches the deployed worker: aggregate depth is public, individual orders
    // and maker identity are not
    publicDepth: true,
    corsOrigins,
  });
} else {
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
  // publicDepth matches the deployed worker: local and production must agree on
  // what is reachable without a key, or the auth model gets tested against the
  // wrong surface.
  node = createFxNodeServer({
    market,
    quotes,
    fiat,
    apiKey,
    corsOrigins,
    publicDepth: true,
  });
}

const address = await node.listen({ host, port });
console.log(
  `Blueballs FX node (${mode.toUpperCase()}) listening on http://${address.address}:${address.port}`,
);
console.log(
  `API key: ${process.env.FX_NODE_API_KEY ? "configured from FX_NODE_API_KEY" : "using documented local test default"}`,
);
console.log(`Browser origins: ${corsOrigins.join(", ") || "none"}`);
console.log("Execution adapter: NOT CONFIGURED (execute will fail closed)");
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
  runtime.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
