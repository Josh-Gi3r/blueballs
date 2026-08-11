import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import { setWorkerSql } from "../../packages/sqlite-compat/src/index.js";

const INSTANCE = "blueballs-public-reference-fx";
const FX_PORT = 8788;
let runtimeReady;

export class BlueballsFxApi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      setWorkerSql(this.ctx.storage.sql);
      runtimeReady ??= (async () => {
        const [{ createPublicReferenceRuntime }, { createFxNodeServer }] = await Promise.all([
          import("../../apps/fx-node/src/public-reference-runtime.js"),
          import("../../apps/fx-node/src/server.js"),
        ]);
        const runtime = await createPublicReferenceRuntime({ memory: true });
        const node = createFxNodeServer({
          market: runtime.market,
          quotes: runtime.quotes,
          fiat: runtime.fiat,
          inspector: runtime.inspector,
          trades: runtime.trades,
          scenario: runtime.scenario,
          apiKey: env.FX_API_KEY,
          corsOrigins: [],
        });
        await node.listen({ port: FX_PORT });
      })();
      await runtimeReady;
    });
  }

  async fetch(request) {
    await this.ready;
    setWorkerSql(this.ctx.storage.sql);
    return handleAsNodeRequest(FX_PORT, request);
  }
}

export default {
  async fetch(request, env) {
    return env.FX_API.getByName(INSTANCE).fetch(request);
  },
};
