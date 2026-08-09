import { FiatSettlementStore } from '../../../packages/fx-fiat/src/index.js';
import { FxMarketService } from '../../../packages/fx-market/src/index.js';

import { PrivateMarketQuoteCoordinator } from './quote-coordinator.js';
import { createReferenceRuntime } from './reference-runtime.js';
import { createFxNodeServer } from './server.js';

const mode = process.env.FX_NODE_MODE ?? 'reference-sandbox';
if (!['reference-sandbox', 'private-sandbox'].includes(mode)) {
  throw new Error(
    'FX_NODE_MODE supports "reference-sandbox" or "private-sandbox" only. Production mode must provide real signature, policy and execution adapters rather than falling back silently.',
  );
}

const host = process.env.FX_NODE_HOST ?? '127.0.0.1';
const port = Number(process.env.FX_NODE_PORT ?? '8788');
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('FX_NODE_PORT invalid');

const apiKey = process.env.FX_NODE_API_KEY ?? 'bb_test_local_fx';
let runtime;
let node;

if (mode === 'reference-sandbox') {
  runtime = await createReferenceRuntime({
    dataDir: process.env.FX_NODE_DATA_DIR ?? './blueballs-fx-data',
  });
  node = createFxNodeServer({
    market: runtime.market,
    quotes: runtime.quotes,
    fiat: runtime.fiat,
    inspector: runtime.inspector,
    apiKey,
  });
} else {
  const dbPath = process.env.FX_NODE_DB ?? './blueballs-fx.db';
  const quoteDbPath = process.env.FX_NODE_QUOTE_DB ?? './blueballs-fx-quotes.db';
  const market = new FxMarketService({
    path: dbPath,
    signatureVerifier: async () => true,
    policyAuthorizer: async () => ({ eligible: true, sandbox: true }),
  });
  const quotes = new PrivateMarketQuoteCoordinator({ market, path: quoteDbPath });
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
  node = createFxNodeServer({ market, quotes, fiat, apiKey });
}

const address = await node.listen({ host, port });
console.log(`Blueballs FX node (${mode.toUpperCase()}) listening on http://${address.address}:${address.port}`);
console.log(`API key: ${apiKey}`);
console.log('Execution adapter: NOT CONFIGURED (execute will fail closed)');
if (mode === 'reference-sandbox') {
  console.log('Reference market: policy + private orders + issuer + LP + neobank + treasury + principal');
}

async function shutdown(signal) {
  console.log(`\n${signal}: closing Blueballs FX node`);
  await node.close();
  runtime.close();
  process.exit(0);
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
