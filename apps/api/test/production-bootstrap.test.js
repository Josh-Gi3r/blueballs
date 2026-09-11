import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ensureProductionBootstrap } from "../src/production-bootstrap.js";

const hashKey = (value) => createHash("sha256").update(value).digest("hex");
let sequence = 0;
const ksuid = (prefix) => `${prefix}_test_${++sequence}`;
const secret = "production-bootstrap-test-secret-0123456789abcdef";

function state() {
  return { tenants: new Map(), keys: new Map() };
}

test("fresh production state creates exactly one explicit bootstrap tenant and admin key", () => {
  const db = state();
  const result = ensureProductionBootstrap({
    db,
    hashKey,
    ksuid,
    mode: "production",
    env: {
      BANK_BOOTSTRAP_API_KEY: secret,
      BANK_BOOTSTRAP_EMAIL: "admin@example.test",
    },
  });
  assert.equal(db.tenants.size, 1);
  assert.equal(db.keys.size, 1);
  assert.equal(result.recovery, false);
  assert.equal([...db.keys.values()][0].tenant_id, result.tenant_id);
});

test("existing tenant data with every key revoked fails closed instead of creating a second tenant", () => {
  const db = state();
  db.tenants.set("ten_existing", {
    id: "ten_existing",
    email: "owner@example.test",
    mode: "production",
  });

  assert.throws(
    () =>
      ensureProductionBootstrap({
        db,
        hashKey,
        ksuid,
        mode: "production",
        env: { BANK_BOOTSTRAP_API_KEY: secret },
      }),
    /Refusing to create a new tenant implicitly/,
  );
  assert.equal(db.tenants.size, 1);
  assert.equal(db.keys.size, 0);
});

test("explicit credential recovery attaches a new admin key to the existing tenant", () => {
  const db = state();
  db.tenants.set("ten_existing", {
    id: "ten_existing",
    email: "owner@example.test",
    mode: "production",
  });

  const result = ensureProductionBootstrap({
    db,
    hashKey,
    ksuid,
    mode: "production",
    env: {
      BANK_BOOTSTRAP_API_KEY: secret,
      BANK_BOOTSTRAP_TENANT_ID: "ten_existing",
    },
  });
  assert.equal(result.tenant_id, "ten_existing");
  assert.equal(result.recovery, true);
  assert.equal(db.tenants.size, 1);
  assert.equal(db.keys.size, 1);
  assert.equal([...db.keys.values()][0].tenant_id, "ten_existing");
});

test("recovery refuses an unknown tenant id when production state already exists", () => {
  const db = state();
  db.tenants.set("ten_existing", { id: "ten_existing", mode: "production" });
  assert.throws(
    () =>
      ensureProductionBootstrap({
        db,
        hashKey,
        ksuid,
        mode: "production",
        env: {
          BANK_BOOTSTRAP_API_KEY: secret,
          BANK_BOOTSTRAP_TENANT_ID: "ten_wrong",
        },
      }),
    /does not identify an existing production tenant/,
  );
});
