import { describe, expect, it, vi } from "vitest";
import { BUILDER_MODEL, runBuilderTurn } from "../site/neobank-builder.js";

describe("Neobank Builder Agent", () => {
  it("grounds the model in both API contracts and normalizes its blueprint", async () => {
    const run = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "Start with SGD accounts, PayNow transfers and cards for Singapore players.",
            ready: true,
            draft: {
              name: "Guild Bank",
              brief: "A gaming-community account and card product.",
              audience: "Gaming communities",
              markets: ["SG", "MARS"],
              currencies: ["SGD", "BTC"],
              capabilities: ["accounts", "cards", "magic_loans"],
              rails: ["paynow", "teleport"],
              brand: { accent: "#123ABC", personality: "direct and energetic" },
            },
          }),
        },
      }],
    }));

    const result = await runBuilderTurn({ run }, [], "Build a neobank for my gaming community");

    expect(run).toHaveBeenCalledOnce();
    const [model, input] = run.mock.calls[0];
    expect(model).toBe(BUILDER_MODEL);
    expect(input.messages[0].content).toContain("POST /v2/builder/projects");
    expect(input.messages[0].content).toContain("POST /v2/fx/reference/trades");
    expect(result.draft).toMatchObject({
      markets: ["SG"],
      currencies: ["SGD"],
      capabilities: ["accounts", "cards"],
      rails: ["paynow"],
    });
  });

  it("keeps only the latest twenty conversation messages", async () => {
    const previous = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `message ${index}`,
    }));
    const run = vi.fn(async () => ({
      response: JSON.stringify({
        reply: "What market should we launch in first?",
        ready: false,
        draft: {},
      }),
    }));

    const result = await runBuilderTurn({ run }, previous, "one more message");

    expect(result.messages).toHaveLength(20);
    expect(result.messages.at(-1)).toEqual({ role: "assistant", content: "What market should we launch in first?" });
  });
});
