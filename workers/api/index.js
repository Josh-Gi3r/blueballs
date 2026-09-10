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
      const [{ FAMILIES }, api, webhookOutbox] = await Promise.all([
        import("../../src/endpoints.ts"),
        import("../../apps/api/src/server.js"),
        import("../../apps/api/src/webhook-outbox.js"),
      ]);
      api.registerCatalogue(FAMILIES.flatMap((family) => family.endpoints));
      this.port = api.API_PORT;
      this.webhookOutbox = webhookOutbox;
      await this.scheduleWebhookAlarm();
    });
  }

  async scheduleWebhookAlarm() {
    if (!this.webhookOutbox) return;
    const next = this.webhookOutbox.nextWebhookOutboxAt();
    if (next === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    // An alarm in the past is scheduled just ahead of now rather than spinning
    // synchronously inside the current request.
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, next));
  }

  async fetch(request) {
    await this.ready;
    setWorkerSql(this.ctx.storage);
    const response = await handleAsNodeRequest(this.port, request);
    // Any event/outbox rows created by this request are committed before the
    // Node-compatible handler resolves, so the alarm can be scheduled from the
    // durable state here. Delivery itself never runs as an untracked promise.
    await this.scheduleWebhookAlarm();
    return response;
  }

  async alarm() {
    await this.ready;
    setWorkerSql(this.ctx.storage);
    try {
      await this.webhookOutbox.drainWebhookOutbox();
    } finally {
      await this.scheduleWebhookAlarm();
    }
  }
}

export default {
  async fetch(request, env) {
    return env.BANK_API.getByName(INSTANCE).fetch(request);
  },
};
