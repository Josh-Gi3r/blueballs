import { FiatSettlementStore } from '../../../packages/fx-fiat/src/index.js';
import { FxMarketService } from '../../../packages/fx-market/src/index.js';
import { PrivateMarketQuoteCoordinator } from './quote-coordinator.js';
import { createFxNodeServer } from './server.js';

const mode = process.env.FX_NODE_MODE ?? 'sandbox';
if (mode !== 'sandbox') {
  throw new Error(
    'FX_NODE_MODE currently supports only "sandbox". Production mode must provide real signature, policy and execution adapters rather than falling back silently.',
  );
}

const host = process.env.FX_NODE_HOST ?? '127.0.0.1';
const port = Number(process.env.FX_NODE_PORT ?? '8788');
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('FX_NODE_PORT invalid');

const apiKey = process.env.FX_NODE_API_KEY ?? 'bb_test_local_fx';
const dbPath = process.env.FX_NODE_DB ?? './blueballs-fx.db';
const quoteDbPath = process.env.FX_NODE_QUOTE_DB ?? './blueballs-fx-quotes.db';

// Explicit sandbox behavior: signature and policy admission are permissive so a
// developer can exercise the market immediately. This is never selected in a
// production mode and execution remains unconfigured unless separately supplied.
const market = new FxMarketService({
  path: dbPath,
  signatureVerifier: async () => true,
  policyAuthorizer: async () => ({ eligible: true, sandbox: true }),
});
const quotes = new PrivateMarketQuoteCoordinator({ market, path: quoteDbPath });
const fiat = new FiatSettlementStore({ path: dbPath });
const node = createFxNodeServer({ market, quotes, fiat, apiKey });

const address = await node.listen({ host, port });
console.log(`Blueballs FX node (SANDBOX) listening on http://${address.address}:${address.port}`);
console.log(`API key: ${apiKey}`);
console.log('Execution adapter: NOT CONFIGURED (execute will fail closed)');

async function shutdown(signal) {
  console.log(`\n${signal}: closing Blueballs FX node`);
  await node.close();
  quotes.close();
  fiat.close();
  market.close();
  process.exit(0);
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
