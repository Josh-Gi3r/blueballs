import { PROVIDERS } from "./providers";
import type { CategoryId, Provider } from "./types";

export type BlueprintMatchInput = {
  markets: string[];
  capabilities: string[];
  rails: string[];
};

export type ProviderMatch = {
  provider: Provider;
  score: number;
  matchedCategories: CategoryId[];
  matchedRegions: string[];
  matchedRails: string[];
  reasons: string[];
};

type WeightedCategory = { id: CategoryId; weight: number };

const CAPABILITY_CATEGORIES: Record<string, WeightedCategory[]> = {
  accounts: [
    { id: "accounts", weight: 6 },
    { id: "sponsor", weight: 3 },
  ],
  onboarding: [
    { id: "compliance", weight: 6 },
    { id: "sponsor", weight: 1 },
  ],
  transfers: [
    { id: "rails", weight: 6 },
    { id: "accounts", weight: 1 },
  ],
  cards: [
    { id: "cards", weight: 6 },
    { id: "sponsor", weight: 1 },
  ],
  wallets: [
    { id: "custody", weight: 6 },
    { id: "stablecoins", weight: 4 },
  ],
  fx: [
    { id: "fx", weight: 6 },
    { id: "stablecoins", weight: 2 },
    { id: "accounts", weight: 1 },
  ],
  savings: [
    { id: "sponsor", weight: 5 },
    { id: "accounts", weight: 3 },
  ],
  business: [
    { id: "sponsor", weight: 4 },
    { id: "accounts", weight: 3 },
    { id: "compliance", weight: 2 },
  ],
  payment_links: [{ id: "rails", weight: 6 }],
  webhooks: [{ id: "operations", weight: 6 }],
};

const MARKET_REGIONS: Record<string, string[]> = {
  GLOBAL: ["Global"],
  US: ["US", "Global"],
  GB: ["UK", "Europe", "Global"],
  EU: ["Europe", "Global"],
  SG: ["APAC", "Global"],
  MY: ["APAC", "Global"],
};

const RAIL_TERMS: Record<string, string[]> = {
  ACH: ["ach"],
  SEPA: ["sepa"],
  SWIFT: ["swift", "cross-border"],
  FAST: ["fast", "singapore"],
  "Faster Payments": ["faster payments", "uk"],
  PayNow: ["paynow", "singapore"],
  DuitNow: ["duitnow", "malaysia"],
  Cards: ["card", "cards"],
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function providerText(provider: Provider) {
  return [
    provider.name,
    provider.kind,
    provider.provides,
    ...provider.capabilities,
    ...provider.modules,
    ...provider.regions,
  ]
    .join(" ")
    .toLowerCase();
}

function desiredRegions(markets: string[]) {
  const requested = markets.length > 0 ? markets : ["GLOBAL"];
  return unique(requested.flatMap((market) => MARKET_REGIONS[market] ?? []));
}

function scoreProvider(
  provider: Provider,
  input: BlueprintMatchInput,
): ProviderMatch | null {
  const categoryWeights = new Map<CategoryId, number>();
  for (const capability of input.capabilities) {
    for (const category of CAPABILITY_CATEGORIES[capability] ?? []) {
      categoryWeights.set(
        category.id,
        Math.max(categoryWeights.get(category.id) ?? 0, category.weight),
      );
    }
  }

  const matchedCategories = provider.categories.filter((category) =>
    categoryWeights.has(category),
  );
  if (matchedCategories.length === 0) return null;

  let score = matchedCategories.reduce(
    (total, category) => total + (categoryWeights.get(category) ?? 0),
    0,
  );
  const regions = desiredRegions(input.markets);
  const matchedRegions = provider.regions.filter((region) =>
    regions.some((desired) => normalize(desired) === normalize(region)),
  );

  if (matchedRegions.some((region) => normalize(region) !== "global")) {
    score += 4;
  } else if (matchedRegions.some((region) => normalize(region) === "global")) {
    score += 2;
  }

  const text = providerText(provider);
  const matchedRails = input.rails.filter((rail) =>
    (RAIL_TERMS[rail] ?? [normalize(rail)]).some((term) =>
      text.includes(normalize(term)),
    ),
  );
  score += Math.min(matchedRails.length * 2, 4);

  if (provider.sandbox === "Available") score += 1;
  if (provider.technicalStatus === "Included descriptor") score += 1;

  const reasons = [
    `${matchedCategories.length} capability ${matchedCategories.length === 1 ? "layer" : "layers"} matched`,
    matchedRegions.length > 0
      ? `Region fit: ${matchedRegions.join(" · ")}`
      : "Region availability needs verification",
  ];
  if (matchedRails.length > 0) {
    reasons.push(`Rail signals: ${matchedRails.join(" · ")}`);
  }
  if (provider.sandbox === "Available") reasons.push("Sandbox available");

  return {
    provider,
    score,
    matchedCategories,
    matchedRegions,
    matchedRails,
    reasons,
  };
}

export function matchProvidersForBlueprint(
  input: BlueprintMatchInput,
  limit = 6,
): ProviderMatch[] {
  return PROVIDERS.map((provider) => scoreProvider(provider, input))
    .filter((match): match is ProviderMatch => match !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.provider.name.localeCompare(right.provider.name),
    )
    .slice(0, Math.max(0, limit));
}
