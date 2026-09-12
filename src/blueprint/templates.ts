export type BlueprintTemplate = {
  id: string;
  category: string;
  name: string;
  description: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  accent: string;
};

export const BLUEPRINT_TEMPLATES: BlueprintTemplate[] = [
  {
    id: "creator-bank-sg",
    category: "CREATOR FINANCE",
    name: "Creator Bank Singapore",
    description:
      "Accounts, cards, payment links and cross-border FX for independent creators and small studios.",
    markets: ["SG"],
    currencies: ["SGD", "USD", "USDC"],
    capabilities: [
      "accounts",
      "onboarding",
      "transfers",
      "cards",
      "fx",
      "payment_links",
      "webhooks",
    ],
    rails: ["paynow", "wire"],
    accent: "#0868FF",
  },
  {
    id: "freelancer-uk",
    category: "BUSINESS BANKING",
    name: "Freelancer Current Account",
    description:
      "Business accounts, cards, savings and bookkeeping-ready events for UK freelancers and sole traders.",
    markets: ["GB"],
    currencies: ["GBP", "EUR", "USD"],
    capabilities: [
      "accounts",
      "onboarding",
      "business",
      "transfers",
      "cards",
      "savings",
      "webhooks",
    ],
    rails: ["faster_payments", "sepa"],
    accent: "#6C4DFF",
  },
  {
    id: "stablecoin-treasury",
    category: "TREASURY",
    name: "Stablecoin Treasury",
    description:
      "Multi-currency treasury, wallet balances, conversion and settlement controls for an international operating company.",
    markets: ["GLOBAL"],
    currencies: ["USD", "EUR", "USDC", "EURC"],
    capabilities: [
      "accounts",
      "business",
      "wallets",
      "transfers",
      "fx",
      "webhooks",
    ],
    rails: ["wire", "sepa"],
    accent: "#008E78",
  },
  {
    id: "sea-remittance",
    category: "CROSS-BORDER",
    name: "SEA Remittance Network",
    description:
      "Singapore–Malaysia money movement with onboarding, local collection, stablecoin inventory and FX orchestration.",
    markets: ["SG", "MY"],
    currencies: ["SGD", "MYR", "USD", "USDC"],
    capabilities: [
      "onboarding",
      "accounts",
      "wallets",
      "transfers",
      "fx",
      "webhooks",
    ],
    rails: ["paynow", "wire"],
    accent: "#F05B3D",
  },
  {
    id: "stablecoin-card",
    category: "CARDS",
    name: "Stablecoin Card Programme",
    description:
      "Wallet-funded card spending with onboarding, conversion, transfer controls and operational event handling.",
    markets: ["GLOBAL"],
    currencies: ["USD", "EUR", "USDC"],
    capabilities: [
      "onboarding",
      "wallets",
      "cards",
      "transfers",
      "fx",
      "webhooks",
    ],
    rails: ["wire", "sepa"],
    accent: "#D84F9B",
  },
  {
    id: "merchant-settlement",
    category: "MERCHANTS",
    name: "Merchant Settlement Network",
    description:
      "Merchant accounts, payment links, local collection and treasury conversion for regional commerce.",
    markets: ["SG", "MY"],
    currencies: ["SGD", "MYR", "USD"],
    capabilities: [
      "accounts",
      "onboarding",
      "business",
      "transfers",
      "payment_links",
      "fx",
      "webhooks",
    ],
    rails: ["paynow", "wire"],
    accent: "#E39216",
  },
  {
    id: "community-wallet",
    category: "COMMUNITIES",
    name: "Community Wallet",
    description:
      "Member accounts, wallet balances, merchant payments and payment links for a digital community or marketplace.",
    markets: ["GLOBAL"],
    currencies: ["USD", "EUR", "USDC"],
    capabilities: [
      "accounts",
      "onboarding",
      "wallets",
      "transfers",
      "payment_links",
    ],
    rails: ["wire", "sepa_instant"],
    accent: "#30A15F",
  },
  {
    id: "institution-fx-desk",
    category: "INSTITUTIONAL FX",
    name: "Institution-Owned FX Desk",
    description:
      "A policy-controlled FX product combining accounts, treasury inventory, wallets, transfers and operational evidence.",
    markets: ["GLOBAL"],
    currencies: ["USD", "EUR", "GBP", "USDC", "EURC"],
    capabilities: [
      "accounts",
      "business",
      "wallets",
      "transfers",
      "fx",
      "webhooks",
    ],
    rails: ["wire", "sepa"],
    accent: "#143A8B",
  },
];
