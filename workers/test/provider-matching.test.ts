import { describe, expect, it } from "vitest";
import { matchProvidersForBlueprint } from "../../src/ecosystem/matching";

describe("Blueprint provider matching", () => {
  it("returns bounded capability-relevant results", () => {
    const matches = matchProvidersForBlueprint({
      markets: ["SG"],
      capabilities: ["cards"],
      rails: ["paynow"],
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(6);
    expect(
      matches.every((match) =>
        match.provider.categories.some((category) =>
          ["cards", "sponsor"].includes(category),
        ),
      ),
    ).toBe(true);
    expect(matches.some((match) => match.matchedRegions.length > 0)).toBe(true);
  });

  it("uses declared market and rail evidence", () => {
    const matches = matchProvidersForBlueprint(
      {
        markets: ["US"],
        capabilities: ["accounts"],
        rails: ["ach"],
      },
      20,
    );

    const column = matches.find((match) => match.provider.id === "column");
    expect(column).toBeDefined();
    expect(column?.matchedRegions).toContain("US");
    expect(column?.matchedRails).toContain("ach");
  });

  it("is deterministic and does not invent matches without a capability fit", () => {
    const input = {
      markets: ["GB"],
      capabilities: ["business", "cards", "webhooks"],
      rails: ["faster_payments"],
    };
    const first = matchProvidersForBlueprint(input).map(
      (match) => match.provider.id,
    );
    const second = matchProvidersForBlueprint(input).map(
      (match) => match.provider.id,
    );

    expect(first).toEqual(second);
    expect(
      matchProvidersForBlueprint({
        markets: ["SG"],
        capabilities: [],
        rails: ["paynow"],
      }),
    ).toEqual([]);
  });
});
