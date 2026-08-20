import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("API starts, signs up a sandbox principal and persists its key across restart", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const discovery = await api.request("GET", "/v2");
  assert.equal(discovery.status, 200);
  assert.equal(discovery.body.name, "Blueballs API");

  const signup = await api.signup("smoke@example.test");
  assert.match(signup.key, /^bb_sandbox_/);

  const beforeRestart = await api.request("GET", "/v2/keys", { key: signup.key });
  assert.equal(beforeRestart.status, 200);
  assert.equal(beforeRestart.body.data.length, 1);

  await api.restart();

  const afterRestart = await api.request("GET", "/v2/keys", { key: signup.key });
  assert.equal(afterRestart.status, 200);
  assert.equal(afterRestart.body.data.length, 1);
  assert.equal(afterRestart.body.data[0].id, signup.id);
});
