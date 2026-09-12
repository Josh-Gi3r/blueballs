import { describe, expect, it } from "vitest";
import {
  decodeBlueprintShare,
  encodeBlueprintShare,
  sanitizeSharedBlueprint,
} from "../../src/blueprint/share";

describe("shareable Blueprints", () => {
  it("round-trips only the public-safe architecture fields", () => {
    const hash = encodeBlueprintShare({
      name: "Global Card Stack",
      markets: ["SG", "MY"],
      currencies: ["SGD", "MYR", "USDC"],
      capabilities: ["accounts", "cards", "fx"],
      rails: ["paynow", "wire"],
      brand: { accent: "#0868ff" },
      brief: "private free-text brief",
      audience: "private free-text audience",
      customers: [{ email: "private@example.com" }],
    } as never);

    const decoded = decodeBlueprintShare(hash);
    expect(decoded).toEqual({
      v: 1,
      name: "Global Card Stack",
      markets: ["SG", "MY"],
      currencies: ["SGD", "MYR", "USDC"],
      capabilities: ["accounts", "cards", "fx"],
      rails: ["paynow", "wire"],
      accent: "#0868FF",
    });
    expect(decodeURIComponent(hash)).not.toContain("private free-text brief");
    expect(decodeURIComponent(hash)).not.toContain("private@example.com");
  });

  it("bounds and deduplicates shared arrays", () => {
    const safe = sanitizeSharedBlueprint({
      name: "  Builder Test  ",
      markets: ["SG", "SG", "MY"],
      currencies: ["USD", "USD"],
      capabilities: Array.from({ length: 30 }, (_, index) => `cap-${index}`),
      rails: ["wire", "wire"],
      brand: { accent: "not-a-colour" },
    });

    expect(safe?.name).toBe("Builder Test");
    expect(safe?.markets).toEqual(["SG", "MY"]);
    expect(safe?.currencies).toEqual(["USD"]);
    expect(safe?.capabilities).toHaveLength(16);
    expect(safe?.rails).toEqual(["wire"]);
    expect(safe?.accent).toBeUndefined();
  });

  it("rejects malformed, oversized and unusable shares", () => {
    expect(decodeBlueprintShare("#something-else")).toBeNull();
    expect(decodeBlueprintShare(`#blueprint=${"x".repeat(6000)}`)).toBeNull();
    expect(decodeBlueprintShare("#blueprint=%7Bbroken")).toBeNull();
    expect(
      sanitizeSharedBlueprint({
        name: "No capabilities",
        markets: [],
        currencies: [],
        capabilities: [],
        rails: [],
      }),
    ).toBeNull();
  });
});
