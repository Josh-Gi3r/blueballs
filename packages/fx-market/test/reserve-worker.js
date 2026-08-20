import { parentPort, workerData } from 'node:worker_threads';

import { SqliteFxMarket } from '../src/index.js';

const book = new SqliteFxMarket({
  path: workerData.path,
  signatureVerifier: async () => true,
  policyAuthorizer: async () => ({ eligible: true }),
  now: () => workerData.now,
});

parentPort.on('message', (message) => {
  if (message !== 'go') return;
  try {
    const route = book.reserveExactOutput({
      routeId: workerData.routeId,
      inputToken: workerData.inputToken,
      outputToken: workerData.outputToken,
      desiredOutput: workerData.desiredOutput,
      expiresAt: workerData.expiresAt,
    });
    parentPort.postMessage({ ok: true, route });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  } finally {
    book.close();
    parentPort.close();
  }
});

parentPort.postMessage({ ready: true });
