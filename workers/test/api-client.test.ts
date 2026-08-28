import { afterEach, describe, expect, it, vi } from "vitest";
import { call, getKey, isSameOriginApiPath, setKey } from "../../src/api";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("browser API client", () => {
  it("never sends a sandbox bearer key to a user-entered origin", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setKey("bb_sandbox_secret");

    expect(isSameOriginApiPath("/v2/accounts?limit=1")).toBe(true);
    expect(isSameOriginApiPath("//attacker.example/collect")).toBe(false);
    expect(isSameOriginApiPath("https://attacker.example/collect")).toBe(false);
    const result = await call("GET", "//attacker.example/collect");

    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replaces an expired tab key once and retries the rejected request", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    setKey("bb_sandbox_expired");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ type: "authentication-error" }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        Response.json({ key: "bb_sandbox_replacement" }, { status: 201 }),
      )
      .mockResolvedValueOnce(Response.json({ id: "quote_example" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await call("POST", "/v2/quotes", {
      from: "EUR",
      to: "USD",
      amount: "1.00",
    });

    expect(result.ok).toBe(true);
    expect(getKey()).toBe("bb_sandbox_replacement");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers["x-api-key"]).toBe(
      "bb_sandbox_replacement",
    );
  });
});
