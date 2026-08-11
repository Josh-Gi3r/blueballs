export type CategoryId = "sponsor" | "compliance" | "accounts" | "rails" | "stablecoins" | "custody" | "cards" | "fx" | "openbanking" | "operations";
export type ProviderKind = string;
export type ProviderAccess = "Self-serve" | "Self-serve → partner" | "Commercial partner" | "Institutional";
export type ProviderSandbox = "Available" | "Gated" | "Not listed" | "Not offered";

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
  docsUrl: string;
  kind: ProviderKind;
  provides: string;
  regions: string[];
  categories: CategoryId[];
  capabilities: string[];
  modules: string[];
  access: ProviderAccess;
  sandbox: ProviderSandbox;
  status: "Not connected";
};
