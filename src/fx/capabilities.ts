import { source } from "./model";

export type CapabilityStatus = "BUILT" | "REFERENCE" | "ADAPTER_READY" | "NOT_CONNECTED";
export type FxCapability = {
  id: string;
  title: string;
  status: CapabilityStatus;
  summary: string;
  api?: string[];
  sourcePath: string;
  testPath?: string;
};

export const FX_CAPABILITIES: FxCapability[] = [
  { id:"market", title:"Private FX market", status:"BUILT", summary:"Signed maker orders, aggregate depth, partial fills, reservations and cancellation.", api:["POST /v2/fx/orders","GET /v2/fx/depth","POST /v2/fx/orders/:orderHash/cancel"], sourcePath:"packages/fx-market", testPath:"packages/fx-market/test" },
  { id:"routing", title:"Cross-source routing", status:"BUILT", summary:"Compares policy-approved executable slices and reserves the selected combination.", api:["POST /v2/fx/quotes","GET /v2/fx/routes/:routeId"], sourcePath:"packages/fx-liquidity", testPath:"packages/fx-liquidity/test" },
  { id:"policy", title:"Participation policy", status:"BUILT", summary:"Controls which participants, accounts, assets and ticket sizes can enter a route.", sourcePath:"packages/fx-policy", testPath:"packages/fx-policy/test" },
  { id:"pricing", title:"Pricing and principal risk", status:"BUILT", summary:"Reference pricing, spread components and balance-sheet risk capacity.", sourcePath:"packages/fx-pricing", testPath:"packages/fx-pricing/test" },
  { id:"settlement", title:"Atomic token settlement", status:"BUILT", summary:"Maker-signed fills, taker bounds and atomic multi-maker settlement contracts.", sourcePath:"packages/fx-contracts", testPath:"packages/fx-contracts/test" },
  { id:"fiat", title:"Fiat intent and evidence model", status:"REFERENCE", summary:"Fiat intents, attestations, settlement graphs and finality are implemented; commercial bank/ramp adapters are not bundled.", api:["POST /v2/fx/fiat/intents","POST /v2/fx/fiat/attestations"], sourcePath:"packages/fx-fiat", testPath:"packages/fx-fiat/test" },
  { id:"providers", title:"Institution / issuer adapter boundary", status:"ADAPTER_READY", summary:"The node can normalize private market, principal and reference provider liquidity. Real commercial issuer/LP/bank adapters remain deployment integrations.", sourcePath:"apps/fx-node/src/source-adapters.js", testPath:"apps/fx-node/test" },
  { id:"peer", title:"Verified P2P fiat edge", status:"NOT_CONNECTED", summary:"Peer/ZKP2P belongs at the fiat edge. A Blueballs adapter is not connected in this repository yet.", sourcePath:"spec/fx/ADAPTERS.md" },
  { id:"external", title:"External venue adapter", status:"NOT_CONNECTED", summary:"External venues can be another executable route. A generic LI.FI-style adapter is not connected in Blueballs yet.", sourcePath:"spec/fx/ADAPTERS.md" },
  { id:"execution", title:"Production execution adapter", status:"NOT_CONNECTED", summary:"The execution boundary is defined, but production provider credentials and live execution adapters are deployment-specific.", sourcePath:"apps/fx-node/src/integrated-quote-coordinator.js", testPath:"apps/fx-node/test" },
];

export const capabilitySource = (capability: FxCapability) => source(capability.sourcePath);
export const capabilityTest = (capability: FxCapability) => capability.testPath ? source(capability.testPath) : null;
