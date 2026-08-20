import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("sqlite compatibility inside the Durable Objects runtime", () => {
  it("commits successful callbacks and persists them across RPC calls", async () => {
    const probe = env.TRANSACTION_PROBE.getByName("commit-and-restart-shape");
    await expect(probe.write("one")).resolves.toBe("one");
    await expect(probe.values()).resolves.toEqual(["one"]);

    await evictDurableObject(probe);
    const restartedInstance = env.TRANSACTION_PROBE.getByName("commit-and-restart-shape");
    await expect(restartedInstance.values()).resolves.toEqual(["one"]);
  });

  it("rolls back a thrown callback without partial persisted state", async () => {
    const probe = env.TRANSACTION_PROBE.getByName("rollback");
    await expect(probe.write("must-disappear", { rollback: true })).resolves.toEqual({ error: "forced rollback" });
    await expect(probe.values()).resolves.toEqual([]);
  });

  it("rejects unsupported transaction-control SQL instead of swallowing it", async () => {
    const probe = env.TRANSACTION_PROBE.getByName("transaction-sql");
    await expect(probe.transactionSqlIsRejected()).resolves.toBe(true);
  });
});
