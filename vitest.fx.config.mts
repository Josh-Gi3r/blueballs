import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.fx.jsonc" },
      miniflare: { bindings: { FX_API_KEY: "worker-test-operator" } },
    }),
  ],
  test: {
    include: ["workers/fx/test/**/*.test.js"],
  },
});
