import assert from "node:assert/strict";
import test from "node:test";
import {
  configureProviderPayloadEnvironment,
  openProviderPayload,
  providerPayloadEncryptionReady,
  sealProviderPayload,
} from "../src/provider-payload-crypto.js";

const KEY_V1 = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const KEY_V2 = "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f";

const production = {
  BANK_API_MODE: "production",
  BANK_PROVIDER_PAYLOAD_KEY: KEY_V1,
  BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "v1",
};

test.afterEach(() => configureProviderPayloadEnvironment(null));

test("production provider payloads are AES-GCM ciphertext, not persisted plaintext", () => {
  const sensitive = {
    customer: { name: "Sensitive Customer" },
    document: "passport-base64-secret-value",
    account: { iban: "DE02120300000000202051" },
  };
  const sealed = sealProviderPayload(sensitive, production);
  assert.equal(sealed.format, "A256GCM");
  assert.equal(sealed.kid, "v1");
  assert.equal(JSON.stringify(sealed).includes("Sensitive Customer"), false);
  assert.equal(JSON.stringify(sealed).includes("passport-base64-secret-value"), false);
  assert.equal(JSON.stringify(sealed).includes("DE02120300000000202051"), false);
  assert.deepEqual(openProviderPayload(sealed, production), sensitive);
});

test("key rotation decrypts old jobs while new jobs use the active key", () => {
  const v1Env = {
    BANK_API_MODE: "production",
    BANK_PROVIDER_PAYLOAD_KEYS: JSON.stringify({ v1: KEY_V1, v2: KEY_V2 }),
    BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "v1",
  };
  const oldJob = sealProviderPayload({ marker: "old" }, v1Env);
  assert.equal(oldJob.kid, "v1");

  const v2Env = {
    ...v1Env,
    BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID: "v2",
  };
  const newJob = sealProviderPayload({ marker: "new" }, v2Env);
  assert.equal(newJob.kid, "v2");
  assert.deepEqual(openProviderPayload(oldJob, v2Env), { marker: "old" });
  assert.deepEqual(openProviderPayload(newJob, v2Env), { marker: "new" });
});

test("production refuses provider payload persistence without an encryption key", () => {
  assert.throws(
    () => sealProviderPayload({ secret: "nope" }, { BANK_API_MODE: "production" }),
    /require BANK_PROVIDER_PAYLOAD_KEY/,
  );
});

test("production refuses plaintext test envelopes", () => {
  const sandboxEnvelope = sealProviderPayload(
    { marker: "sandbox" },
    { BANK_API_MODE: "sandbox" },
  );
  assert.equal(sandboxEnvelope.format, "PLAINTEXT_TEST_ONLY");
  assert.throws(
    () => openProviderPayload(sandboxEnvelope, production),
    /refuses a plaintext provider payload envelope/,
  );
});

test("Worker-style explicit environment configuration makes the keyring available", () => {
  assert.equal(configureProviderPayloadEnvironment(production), true);
  assert.equal(providerPayloadEncryptionReady(), true);
  const sealed = sealProviderPayload({ marker: "configured" });
  assert.deepEqual(openProviderPayload(sealed), { marker: "configured" });
});
