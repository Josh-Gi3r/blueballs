import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

async function request(method, path, { operator = false, body } = {}) {
  return exports.default.fetch(
    new Request(`https://worker.test${path}`, {
      method,
      headers: {
        ...(operator ? { authorization: "Bearer worker-test-operator" } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe("FX Worker public reference boundary", () => {
  it("keeps reads and preview public while authenticating every mutation", async () => {
    expect((await request("GET", "/v2/fx/reference/scenario")).status).toBe(
      200,
    );
    expect(
      (
        await request("POST", "/v2/fx/reference/trades/preview", {
          body: { inputAmount: "50000.00" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("POST", "/v2/fx/reference/scenario", {
          body: { id: "lp_offline" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("POST", "/v2/fx/reference/trades", {
          body: { inputAmount: "50000.00", expiresInMs: 30000 },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("POST", "/v2/fx/reference/scenario", {
          operator: true,
          body: { id: "balanced" },
        })
      ).status,
    ).toBe(200);
  });
});
