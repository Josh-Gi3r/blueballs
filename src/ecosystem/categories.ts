import type { EcosystemCategory } from "./types";

export const CATEGORIES: EcosystemCategory[] = [
  {
    id: "sponsor",
    label: "Sponsor & safeguarding",
    eyebrow: "Regulated foundations",
    description:
      "Licensed banks, EMIs and programme platforms that can hold or safeguard fiat and support regulated account programmes.",
    blueballs: ["Accounts", "Applications", "Ledger", "Policy"],
  },
  {
    id: "compliance",
    label: "KYC, KYB, AML & fraud",
    eyebrow: "Identity and financial crime",
    description:
      "Identity verification, business verification, sanctions, transaction monitoring, wallet intelligence and fraud decisioning.",
    blueballs: ["Customers", "Applications", "Policy", "Sandbox"],
  },
  {
    id: "accounts",
    label: "Accounts & virtual accounts",
    eyebrow: "Account infrastructure",
    description:
      "Named accounts, FBO structures, IBANs, routing details, virtual accounts, balances and statements.",
    blueballs: ["Accounts", "Ledger", "Statements", "Webhooks"],
  },
  {
    id: "rails",
    label: "Fiat pay-ins & payouts",
    eyebrow: "Money movement",
    description:
      "Local and cross-border payment rails for receiving and sending fiat across markets.",
    blueballs: ["Transfers", "Rails registry", "Beneficiaries", "Webhooks"],
  },
  {
    id: "stablecoins",
    label: "Stablecoins & on/off ramps",
    eyebrow: "Tokenised money",
    description:
      "Minting, redemption, stablecoin payments and conversion between bank money and tokenised money.",
    blueballs: ["Wallets", "Transfers", "FX", "Fiat intents"],
  },
  {
    id: "custody",
    label: "Wallets & custody",
    eyebrow: "Keys and assets",
    description:
      "Embedded wallets, institutional custody, MPC, signing policy, treasury wallets and recovery.",
    blueballs: ["Wallets", "Approvals", "Policies", "Audit events"],
  },
  {
    id: "cards",
    label: "Card issuing",
    eyebrow: "Spend infrastructure",
    description:
      "BIN sponsorship, issuing processors, authorisation, tokenisation, physical cards and card operations.",
    blueballs: ["Cards", "Authorisations", "Controls", "Webhooks"],
  },
  {
    id: "fx",
    label: "FX liquidity, data & treasury",
    eyebrow: "Pricing and liquidity",
    description:
      "Fiat and stablecoin liquidity, institutional execution, reference prices, market data and treasury access.",
    blueballs: ["FX node", "Liquidity adapters", "Treasury", "Settlement"],
  },
  {
    id: "openbanking",
    label: "Open banking & account verification",
    eyebrow: "Connected bank data",
    description:
      "Account linking, ownership verification, balances, transaction data and pay-by-bank initiation.",
    blueballs: ["Accounts", "Beneficiaries", "Transfers", "Applications"],
  },
  {
    id: "operations",
    label: "Reconciliation, operations & security",
    eyebrow: "Operations and controls",
    description:
      "Payment operations, reconciliation, ledger infrastructure, compliance operations and sensitive-data security.",
    blueballs: ["Ledger", "Statements", "Webhooks", "Operations"],
  },
];
