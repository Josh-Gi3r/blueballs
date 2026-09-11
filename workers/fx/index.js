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
      setWorkerSql(this.ctx.storage);
      runtimeReady ??= (async () => {
        const [{ createPublicReferenceRuntime }, { createFxNodeServer }] =
          await Promise.all([
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
          monetary: runtime.monetary,
          apiKey: env.FX_API_KEY,
          // Public-reference worker uses one internal key for authenticated
          // sandbox mutations. Production CLI deployments require a separate
          // FX_NODE_OPERATOR_API_KEY for finality/evidence routes.
          operatorApiKey: env.FX_API_KEY,
          // Aggregate depth is a published figure by design. Individual orders
          // and maker identity stay behind authenticated routes.
          publicDepth: true,
          corsOrigins: [],
          sourceCommit: env.BLUEBALLS_GIT_SHA || "development",
        });
        await node.listen({ port: FX_PORT });
      })();
      await runtimeReady;
    });
  }

  async fetch(request) {
    await this.ready;
    setWorkerSql(this.ctx.storage);
    return handleAsNodeRequest(FX_PORT, request);
  }
}

export default {
  async fetch(request, env) {
    const response = await env.FX_API.getByName(INSTANCE).fetch(request);
    const headers = new Headers(response.headers);
    headers.set(
      "x-blueballs-source-commit",
      env.BLUEBALLS_GIT_SHA || "development",
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
