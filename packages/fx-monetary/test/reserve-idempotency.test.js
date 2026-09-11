import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MonetaryEngine } from "../src/index.js";

const NOW = 1_000_000;

test("identical provider reserve evidence replays to one deposit before and after restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "bb-monetary-reserve-"));
  const path = join(dir, "monetary.sqlite");
  try {
    const first = new MonetaryEngine({ path, now: () => NOW });
    const created = first.createReserveDeposit({
      reserveCurrency: "USD",
      amount: "1000000",
      providerRef: "bank:settlement:123",
    });
    const replay = first.createReserveDeposit({
      reserveCurrency: "usd",
      amount: "1000000",
      providerRef: "bank:settlement:123",
    });
    assert.deepEqual(replay, created);

    const settled = first.settleReserveDeposit(created.depositId);
    assert.equal(settled.state, "SETTLED");
    assert.deepEqual(first.settleReserveDeposit(created.depositId), settled);
    assert.equal(
      first.events({ limit: 20 }).filter((event) => event.kind === "RESERVE_DEPOSIT_CREATED").length,
      1,
    );
    assert.equal(
      first.events({ limit: 20 }).filter((event) => event.kind === "RESERVE_DEPOSIT_SETTLED").length,
      1,
    );
    first.close();

    const second = new MonetaryEngine({ path, now: () => NOW + 5_000 });
    const afterRestart = second.createReserveDeposit({
      reserveCurrency: "USD",
      amount: "1000000",
      providerRef: "bank:settlement:123",
    });
    assert.equal(afterRestart.depositId, created.depositId);
    assert.equal(afterRestart.state, "SETTLED");
    assert.deepEqual(second.settleReserveDeposit(created.depositId), afterRestart);
    assert.equal(
      second.events({ limit: 20 }).filter((event) => event.kind === "RESERVE_DEPOSIT_CREATED").length,
      1,
    );
    assert.equal(
      second.events({ limit: 20 }).filter((event) => event.kind === "RESERVE_DEPOSIT_SETTLED").length,
      1,
    );
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provider reserve reference reuse with changed economics fails closed", () => {
  const engine = new MonetaryEngine({ now: () => NOW });
  try {
    const created = engine.createReserveDeposit({
      reserveCurrency: "USD",
      amount: "100",
      providerRef: "bank:settlement:collision",
    });
    assert.throws(
      () =>
        engine.createReserveDeposit({
          reserveCurrency: "USD",
          amount: "101",
          providerRef: "bank:settlement:collision",
        }),
      (error) =>
        error.code === "RESERVE_REPLAY" &&
        error.status === 409 &&
        error.details?.existingDepositId === created.depositId,
    );
    assert.throws(
      () =>
        engine.createReserveDeposit({
          reserveCurrency: "EUR",
          amount: "100",
          providerRef: "bank:settlement:collision",
        }),
      (error) => error.code === "RESERVE_REPLAY" && error.status === 409,
    );
  } finally {
    engine.close();
  }
});
