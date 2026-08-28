import { describe, expect, it, vi } from "vitest";
import { env, evictDurableObject } from "cloudflare:test";
import {
  BUILDER_MODEL,
  DEFAULT_MAX_COMPLETION_TOKENS,
  nextDailyQuota,
  readBoundedJson,
  runBuilderTurn,
} from "../site/neobank-builder.js";
import {
  DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT,
  nextGlobalQuota,
} from "../site/builder-budget.js";

describe("Neobank Builder Agent", () => {
  it("grounds the model in both API contracts and normalizes its blueprint", async () => {
    const run = vi.fn(async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply:
                "Start with SGD accounts, PayNow transfers and cards for Singapore players.",
              ready: true,
              draft: {
                name: "Guild Bank",
                brief: "A gaming-community account and card product.",
                audience: "Gaming communities",
                markets: ["SG", "MARS"],
                currencies: ["SGD", "BTC"],
                capabilities: ["accounts", "cards", "magic_loans"],
                rails: ["paynow", "teleport"],
                brand: {
                  accent: "#123ABC",
                  personality: "direct and energetic",
                },
              },
            }),
          },
        },
      ],
    }));

    const result = await runBuilderTurn(
      { run },
      [],
      "Build a neobank for my gaming community",
    );

    expect(run).toHaveBeenCalledOnce();
    const [model, input] = run.mock.calls[0];
    expect(model).toBe(BUILDER_MODEL);
    expect(input.messages[0].content).toContain("POST /v2/builder/projects");
    expect(input.messages[0].content).toContain("POST /v2/fx/reference/trades");
    expect(input.max_completion_tokens).toBe(DEFAULT_MAX_COMPLETION_TOKENS);
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
    expect(result.messages.at(-1)).toEqual({
      role: "assistant",
      content: "What market should we launch in first?",
    });
  });

  it("enforces a persistent per-day request ceiling", () => {
    const now = new Date("2026-08-24T09:00:00.000Z");
    expect(nextDailyQuota(null, now, 2)).toMatchObject({
      allowed: true,
      quota: { used: 1 },
      remaining: 1,
    });
    expect(
      nextDailyQuota({ day: "2026-08-24", used: 1 }, now, 2),
    ).toMatchObject({ allowed: true, quota: { used: 2 }, remaining: 0 });
    expect(
      nextDailyQuota({ day: "2026-08-24", used: 2 }, now, 2),
    ).toMatchObject({ allowed: false, remaining: 0 });
    expect(
      nextDailyQuota({ day: "2026-08-23", used: 99 }, now, 2),
    ).toMatchObject({ allowed: true, quota: { day: "2026-08-24", used: 1 } });
  });

  it("enforces one paid-model ceiling across all tenants", () => {
    const now = new Date("2026-08-24T09:00:00.000Z");
    expect(DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT).toBe(300);
    expect(nextGlobalQuota(null, now, 2)).toMatchObject({
      allowed: true,
      quota: { used: 1 },
      remaining: 1,
    });
    expect(
      nextGlobalQuota({ day: "2026-08-24", used: 2 }, now, 2),
    ).toMatchObject({ allowed: false, remaining: 0 });
    expect(
      nextGlobalQuota({ day: "2026-08-23", used: 99 }, now, 2),
    ).toMatchObject({ allowed: true, quota: { used: 1 } });
  });

  it("persists the account-wide ceiling across Durable Object restarts", async () => {
    const budget = env.BUILDER_BUDGET.getByName("global-budget-restart");
    await expect(
      budget.reserve("2026-08-24T09:00:00.000Z", 2),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await evictDurableObject(budget);
    const restarted = env.BUILDER_BUDGET.getByName("global-budget-restart");
    await expect(
      restarted.reserve("2026-08-24T10:00:00.000Z", 2),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(
      restarted.reserve("2026-08-24T11:00:00.000Z", 2),
    ).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("rejects oversized request bodies before parsing them", async () => {
    const request = new Request(
      "https://blueballs.tech/v2/builder-agent/chat",
      {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(128) }),
      },
    );
    await expect(readBoundedJson(request, 32)).rejects.toMatchObject({
      status: 413,
    });
  });
});
