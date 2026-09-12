import { describe, expect, it } from "vitest";
import {
  decodeBlueprintShare,
  encodeBlueprintShare,
} from "../../src/blueprint/share";
import { BLUEPRINT_TEMPLATES } from "../../src/blueprint/templates";

const CAPABILITIES = new Set([
  "accounts",
  "onboarding",
  "transfers",
  "cards",
  "wallets",
  "fx",
  "savings",
  "business",
  "payment_links",
  "webhooks",
]);

const RAILS = new Set([
  "paynow",
  "faster_payments",
  "sepa_instant",
  "sepa",
  "ach",
  "wire",
]);

describe("Blueprint template library", () => {
  it("ships eight unique public product architectures", () => {
    expect(BLUEPRINT_TEMPLATES).toHaveLength(8);
    const ids = BLUEPRINT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses product capabilities and rails Builder already understands", () => {
    for (const template of BLUEPRINT_TEMPLATES) {
      expect(template.name.trim()).not.toBe("");
      expect(template.description.trim()).not.toBe("");
      expect(template.markets.length).toBeGreaterThan(0);
      expect(template.currencies.length).toBeGreaterThan(0);
      expect(template.capabilities.length).toBeGreaterThan(0);
      expect(template.capabilities.every((item) => CAPABILITIES.has(item))).toBe(
        true,
      );
      expect(template.rails.every((item) => RAILS.has(item))).toBe(true);
    }
  });

  it("round-trips every template through the public-safe share contract", () => {
    for (const template of BLUEPRINT_TEMPLATES) {
      const hash = encodeBlueprintShare(template);
      const decoded = decodeBlueprintShare(hash);

      expect(decoded).not.toBeNull();
      expect(decoded).toEqual({
        v: 1,
        name: template.name,
        markets: template.markets,
        currencies: template.currencies,
        capabilities: template.capabilities,
        rails: template.rails,
        accent: template.accent.toUpperCase(),
      });
      expect(Object.keys(decoded ?? {}).sort()).toEqual(
        [
          "accent",
          "capabilities",
          "currencies",
          "markets",
          "name",
          "rails",
          "v",
        ].sort(),
      );
    }
  });

  it("keeps provider selection outside template architecture", () => {
    for (const template of BLUEPRINT_TEMPLATES) {
      expect("providers" in template).toBe(false);
      expect("provider" in template).toBe(false);
      expect("relationship" in template).toBe(false);
    }
  });
});
