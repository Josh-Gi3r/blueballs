import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import { setWorkerSql } from "../../packages/sqlite-compat/src/index.js";

const INSTANCE = "blueballs-public-sandbox";

export class BlueballsBankApi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      setWorkerSql(this.ctx.storage.sql);
      const [{ FAMILIES }, api] = await Promise.all([
        import("../../src/endpoints.ts"),
        import("../../apps/api/src/server.js"),
      ]);
      api.registerCatalogue(FAMILIES.flatMap((family) => family.endpoints));
      this.port = api.API_PORT;
    });
  }

  async fetch(request) {
    await this.ready;
    setWorkerSql(this.ctx.storage.sql);
    return handleAsNodeRequest(this.port, request);
  }
}

export default {
  async fetch(request, env) {
    return env.BANK_API.getByName(INSTANCE).fetch(request);
  },
};
