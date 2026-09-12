import { describe, expect, it } from "vitest";
import { PROVIDERS } from "../../src/ecosystem/providers";
import {
  providersForShortlist,
  sanitizeProviderShortlist,
} from "../../src/ecosystem/shortlist";
import {
  buildImplementationBrief,
  implementationBriefMarkdown,
} from "../../src/implementation/brief";

describe("implementation brief generation", () => {
  it("derives concrete workstreams from Blueprint capabilities", () => {
    const bridge = PROVIDERS.find((provider) => provider.id === "bridge");
    expect(bridge).toBeDefined();

    const brief = buildImplementationBrief(
      {
        name: "Global Card Stack",
        markets: ["SG", "MY"],
        currencies: ["SGD", "MYR", "USDC"],
        capabilities: ["accounts", "cards", "fx", "webhooks"],
        rails: ["paynow", "wire"],
      },
      bridge ? [bridge] : [],
    );

    expect(brief.workstreams).toContain(
      "Account, balance and financial-product configuration",
    );
    expect(brief.workstreams).toContain(
      "Card programme architecture and provider adapter",
    );
    expect(brief.workstreams).toContain(
      "FX pricing, liquidity, treasury and settlement",
    );
    expect(brief.providers.map((provider) => provider.id)).toEqual(["bridge"]);
    expect(brief.surfaces).toContain("Stablecoin FX and treasury");
  });

  it("produces a public-safe Markdown handoff for the existing intake", () => {
    const brief = buildImplementationBrief(
      {
        name: "Regional Wallet",
        markets: ["SG"],
        currencies: ["SGD", "USDC"],
        capabilities: ["wallets", "transfers"],
        rails: ["paynow"],
      },
      [],
    );
    const markdown = implementationBriefMarkdown(
      brief,
      "https://blueballs.tech/blueprint#blueprint=test",
    );

    expect(markdown).toContain("# Blueballs Implementation Brief — Regional Wallet");
    expect(markdown).toContain("Provider discovery, due diligence and adapter selection");
    expect(markdown).toContain("Shared Blueprint");
    expect(markdown).not.toContain("customer data");
  });
});

describe("provider shortlist contract", () => {
  it("deduplicates, validates and bounds provider IDs", () => {
    const valid = PROVIDERS.slice(0, 4).map((provider) => provider.id);
    const safe = sanitizeProviderShortlist([
      valid[0],
      valid[0],
      "not-a-provider",
      valid[1],
      valid[2],
      valid[3],
    ]);

    expect(safe).toEqual(valid.slice(0, 3));
    expect(providersForShortlist(safe).map((provider) => provider.id)).toEqual(
      valid.slice(0, 3),
    );
  });
});
