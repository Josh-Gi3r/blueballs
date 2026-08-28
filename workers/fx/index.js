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
          // Aggregate depth is a published figure by design — the model depends
          // on counterparties being able to see the curve. Individual orders and
          // maker identity stay behind the key.
          publicDepth: true,
          corsOrigins: [],
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
    if (new URL(request.url).pathname === "/health" && response.ok) {
      const body = await response.json();
      return Response.json(
        { ...body, source_commit: env.BLUEBALLS_GIT_SHA || "development" },
        {
          status: response.status,
          headers,
        },
      );
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
