import assert from "node:assert/strict";
import test from "node:test";
import { matchProvidersForBlueprint } from "../../src/ecosystem/matching.ts";

test("Blueprint provider matching returns bounded capability-relevant results", () => {
  const matches = matchProvidersForBlueprint({
    markets: ["SG"],
    capabilities: ["cards"],
    rails: ["paynow"],
  });

  assert.ok(matches.length > 0);
  assert.ok(matches.length <= 6);
  assert.ok(
    matches.every((match) =>
      match.provider.categories.some((category) =>
        ["cards", "sponsor"].includes(category),
      ),
    ),
  );
  assert.ok(matches.some((match) => match.matchedRegions.length > 0));
});

test("matching favors declared market fit for otherwise relevant providers", () => {
  const matches = matchProvidersForBlueprint(
    {
      markets: ["US"],
      capabilities: ["accounts"],
      rails: ["ach"],
    },
    20,
  );

  const column = matches.find((match) => match.provider.id === "column");
  assert.ok(column, "US account infrastructure should include Column");
  assert.ok(column.matchedRegions.includes("US"));
  assert.ok(column.matchedRails.includes("ach"));
});

test("matching is deterministic and does not invent results without a capability fit", () => {
  const input = {
    markets: ["GB"],
    capabilities: ["business", "cards", "webhooks"],
    rails: ["faster_payments"],
  };
  const first = matchProvidersForBlueprint(input).map((match) => match.provider.id);
  const second = matchProvidersForBlueprint(input).map((match) => match.provider.id);

  assert.deepEqual(first, second);
  assert.deepEqual(
    matchProvidersForBlueprint({
      markets: ["SG"],
      capabilities: [],
      rails: ["paynow"],
    }),
    [],
  );
});
