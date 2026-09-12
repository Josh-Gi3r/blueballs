import type { Provider } from "../ecosystem/types";

export type ImplementationBlueprint = {
  name: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
};

export type ImplementationBrief = {
  product: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  providers: Provider[];
  workstreams: string[];
  surfaces: string[];
};

type Rule = {
  capabilities: string[];
  workstream: string;
  surfaces: string[];
};

const RULES: Rule[] = [
  {
    capabilities: ["onboarding"],
    workstream: "Identity, onboarding and compliance policy",
    surfaces: ["Onboarding, identity or compliance"],
  },
  {
    capabilities: ["accounts", "business", "savings"],
    workstream: "Account, balance and financial-product configuration",
    surfaces: ["Banking API and ledger"],
  },
  {
    capabilities: ["transfers", "payment_links"],
    workstream: "Payment rails, destinations and money-movement workflows",
    surfaces: ["Payments, accounts or cards"],
  },
  {
    capabilities: ["cards"],
    workstream: "Card programme architecture and provider adapter",
    surfaces: ["Payments, accounts or cards"],
  },
  {
    capabilities: ["fx"],
    workstream: "FX pricing, liquidity, treasury and settlement",
    surfaces: ["Stablecoin FX and treasury", "Settlement contracts"],
  },
  {
    capabilities: ["wallets"],
    workstream: "Wallet, custody and digital-asset operating model",
    surfaces: ["Wallets or custody", "Provider adapters and orchestration"],
  },
  {
    capabilities: ["webhooks"],
    workstream: "Events, webhooks, reconciliation and operational controls",
    surfaces: ["Deployment, operations or hardening"],
  },
];

function unique(values: string[]) {
  return [...new Set(values)];
}

function matchesRule(capabilities: Set<string>, rule: Rule) {
  return rule.capabilities.some((capability) => capabilities.has(capability));
}

export function buildImplementationBrief(
  blueprint: ImplementationBlueprint,
  providers: Provider[],
): ImplementationBrief {
  const capabilities = new Set(blueprint.capabilities);
  const matched = RULES.filter((rule) => matchesRule(capabilities, rule));
  const providerWorkstream = providers.length
    ? "Provider due diligence, commercial coordination and adapter implementation"
    : "Provider discovery, due diligence and adapter selection";

  return {
    product: blueprint.name,
    markets: unique(blueprint.markets),
    currencies: unique(blueprint.currencies),
    capabilities: unique(blueprint.capabilities),
    rails: unique(blueprint.rails),
    providers,
    workstreams: unique([
      ...matched.map((rule) => rule.workstream),
      providerWorkstream,
      "Sandbox-to-production architecture, deployment and operating handover",
    ]),
    surfaces: unique([
      ...matched.flatMap((rule) => rule.surfaces),
      "Provider adapters and orchestration",
      "Sandbox and product experience",
      "Deployment, operations or hardening",
    ]),
  };
}

function bulletList(items: string[], empty = "Not specified") {
  return items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : `- ${empty}`;
}

export function implementationBriefMarkdown(
  brief: ImplementationBrief,
  blueprintUrl = "",
) {
  const providerLines = brief.providers.map(
    (provider) => `${provider.name} — ${provider.kind}`,
  );
  return [
    `# Blueballs Implementation Brief — ${brief.product}`,
    "",
    "## Product architecture",
    `**Markets:** ${brief.markets.join(", ") || "Not specified"}`,
    `**Currencies:** ${brief.currencies.join(", ") || "Not specified"}`,
    `**Capabilities:** ${brief.capabilities.join(", ") || "Not specified"}`,
    `**Rails:** ${brief.rails.join(", ") || "Not specified"}`,
    blueprintUrl ? `**Shared Blueprint:** ${blueprintUrl}` : "",
    "",
    "## Shortlisted infrastructure",
    bulletList(providerLines, "No provider shortlist yet"),
    "",
    "Provider shortlist reflects user-selected infrastructure from the Blueballs directory. Inclusion is not a recommendation, partnership claim or production-integration claim.",
    "",
    "## Proposed implementation workstreams",
    bulletList(brief.workstreams),
    "",
    "## Relevant Blueballs surfaces",
    bulletList(brief.surfaces),
    "",
    "## Implementation note",
    "This brief contains public-safe product architecture only. Production scope still depends on jurisdiction, regulated-provider availability, commercial terms, security requirements and the institution's operating model.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .trim();
}
