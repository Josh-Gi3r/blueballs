import assert from "node:assert/strict";
import test from "node:test";
import {
  PROVIDER_CAPABILITIES,
  PROVIDER_CAPABILITY_KEYS,
} from "../../../spec/provider-capabilities.mjs";
import { enforceProviderResultContract } from "../src/provider-result-contract.js";
import {
  createDeterministicProviderTransport,
  deterministicProviderResult,
} from "./helpers/fake-provider.js";

function envelope(entry, index) {
  return {
    job_id: `prv_conformance_${index}`,
    capability: entry.capability,
    action: entry.action,
    phase: "submit",
    resource: { type: "fixture", id: `fixture_${index}` },
    tenant_id: "ten_conformance",
    command_id: `cmd_conformance_${index}`,
    provider_reference: null,
    attempt: 1,
    payload: { fixture: true },
  };
}

test("deterministic fake provider implements every declared production capability", async () => {
  const transport = createDeterministicProviderTransport();
  const seen = new Set();

  for (const [index, entry] of PROVIDER_CAPABILITIES.entries()) {
    const claimed = envelope(entry, index);
    const raw = await transport(claimed);
    const checked = enforceProviderResultContract(claimed, raw);
    assert.equal(
      checked.outcome,
      "succeeded",
      `${entry.capability}:${entry.action} fixture must satisfy its finality contract`,
    );
    assert.ok(checked.provider_reference);
    seen.add(`${entry.capability}:${entry.action}`);

    assert.deepEqual(
      deterministicProviderResult(claimed),
      raw,
      "fake adapter must be deterministic for the same job id",
    );
  }

  assert.deepEqual([...seen].sort(), [...PROVIDER_CAPABILITY_KEYS].sort());
});

test("fake provider refuses undeclared capabilities instead of inventing behavior", () => {
  assert.throws(
    () =>
      deterministicProviderResult({
        job_id: "prv_unknown",
        capability: "unknown.capability",
        action: "submit",
      }),
    /does not implement unknown\.capability:submit/,
  );
});
