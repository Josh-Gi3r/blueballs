import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import { setWorkerSql } from "../../packages/sqlite-compat/src/index.js";

// v2 intentionally starts with empty pre-release state. The previous sandbox
// cannot be migrated safely because email was used as an unverified principal.
const INSTANCE = "blueballs-public-sandbox-v2";

export class BlueballsBankApi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      setWorkerSql(this.ctx.storage);
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
    setWorkerSql(this.ctx.storage);
    return handleAsNodeRequest(this.port, request);
  }
}

export default {
  async fetch(request, env) {
    return env.BANK_API.getByName(INSTANCE).fetch(request);
  },
};
