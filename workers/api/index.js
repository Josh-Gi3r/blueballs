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

      // Provider credentials and encryption material belong to Worker secret
      // storage. Configure both before route/provider modules load; production
      // safety must not depend on process.env bridging semantics.
      const [providerTransport, providerPayloadCrypto] = await Promise.all([
        import("../../apps/api/src/provider-transport.js"),
        import("../../apps/api/src/provider-payload-crypto.js"),
      ]);
      providerTransport.configureProviderEnvironment(env);
      providerPayloadCrypto.configureProviderPayloadEnvironment(env);

      const [{ FAMILIES }, api, webhookOutbox, providerOutbox] = await Promise.all([
        import("../../src/endpoints.ts"),
        import("../../apps/api/src/server.js"),
        import("../../apps/api/src/webhook-outbox.js"),
        import("../../apps/api/src/provider-outbox.js"),
      ]);
      api.registerCatalogue(FAMILIES.flatMap((family) => family.endpoints));
      this.port = api.API_PORT;
      this.webhookOutbox = webhookOutbox;
      this.providerOutbox = providerOutbox;
      await this.scheduleBackgroundAlarm();
    });
  }

  nextBackgroundAt() {
    const candidates = [
      this.webhookOutbox?.nextWebhookOutboxAt?.() ?? null,
      this.providerOutbox?.nextProviderOutboxAt?.() ?? null,
    ].filter((value) => Number.isFinite(value));
    return candidates.length ? Math.min(...candidates) : null;
  }

  async scheduleBackgroundAlarm() {
    const next = this.nextBackgroundAt();
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
    // Outbox rows are committed before the Node-compatible handler resolves.
    // Scheduling from durable state here means neither webhook nor provider work
    // depends on an untracked promise surviving request completion.
    await this.scheduleBackgroundAlarm();
    return response;
  }

  async alarm() {
    await this.ready;
    setWorkerSql(this.ctx.storage);
    try {
      await Promise.all([
        this.webhookOutbox?.drainWebhookOutbox?.() ?? Promise.resolve([]),
        this.providerOutbox?.drainProviderOutbox?.() ?? Promise.resolve([]),
      ]);
    } finally {
      await this.scheduleBackgroundAlarm();
    }
  }
}

export default {
  async fetch(request, env) {
    return env.BANK_API.getByName(INSTANCE).fetch(request);
  },
};
