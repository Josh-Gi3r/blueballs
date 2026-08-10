import { Label } from "./Primitives";
import { source } from "./model";

export function Packages() {
  const packages = [
    ["fx-node", "Self-hosted runtime", "apps/fx-node"],
    ["fx-policy", "Participants and authorisations", "packages/fx-policy"],
    ["fx-market", "Private signed liquidity", "packages/fx-market"],
    ["fx-pricing", "Reference and principal pricing", "packages/fx-pricing"],
    ["fx-liquidity", "Cross-source routing", "packages/fx-liquidity"],
    ["fx-fiat", "Fiat intents and finality", "packages/fx-fiat"],
    ["fx-contracts", "Atomic settlement kernel", "packages/fx-contracts"],
    ["fx-sdk", "Typed JavaScript client", "packages/fx-sdk"],
    ["fx-simulator", "Economic failure lab", "packages/fx-simulator"],
  ];
  return <section className="fxp-section fxp-take"><div><Label>MIT LICENSED · SELF-HOSTABLE</Label><h2>Take the whole FX stack.</h2><p>The page, node, policy engine, liquidity market, contracts, SDK, simulator and evidence live in the same repository.</p></div><div className="fxp-package-grid">{packages.map(([name, description, path]) => <a key={name} href={source(path)} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{description}</span><b>open source ↗</b></a>)}</div><div className="fxp-run"><span>RUN THE COMPLETE REFERENCE</span><code>git clone … &amp;&amp; pnpm install &amp;&amp; pnpm dev</code></div></section>;
}
