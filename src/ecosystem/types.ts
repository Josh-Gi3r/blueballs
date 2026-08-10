export type CategoryId = "sponsor" | "compliance" | "accounts" | "rails" | "stablecoins" | "custody" | "cards" | "fx" | "openbanking" | "operations";
export type ProviderKind = string;

export type EcosystemCategory = {
  id: CategoryId;
  label: string;
  eyebrow: string;
  description: string;
  blueballs: string[];
};

export type Provider = {
  id: string;
  name: string;
  url: string;
  kind: ProviderKind;
  summary: string;
  regions: string[];
  categories: CategoryId[];
  capabilities: string[];
  featured?: boolean;
};
