import { Label } from "./Primitives";
import { source } from "./model";
export function Packages() {
  const packages = [
    ["fx-node", "Self-hosted FX runtime", "apps/fx-node"],
    ["fx-policy", "Participants and authorisations", "packages/fx-policy"],
    ["fx-market", "Private signed liquidity", "packages/fx-market"],
    ["fx-pricing", "Market and principal pricing", "packages/fx-pricing"],
    ["fx-liquidity", "Cross-source routing", "packages/fx-liquidity"],
    ["fx-fiat", "Fiat settlement and finality", "packages/fx-fiat"],
    ["fx-contracts", "Atomic settlement contracts", "packages/fx-contracts"],
    ["fx-sdk", "Typed JavaScript client", "packages/fx-sdk"],
    ["fx-simulator", "FX stress-test simulator", "packages/fx-simulator"],
  ];
  return (
    <section className="fxp-section fxp-take">
      <div>
        <Label>MIT LICENSED · SELF-HOSTABLE</Label>
        <h2>Run, read and change the FX stack.</h2>
        <p>
          The runtime, policy engine, private market, pricing, liquidity
          routing, fiat settlement, contracts, SDK and simulator are all in the
          repository.
        </p>
      </div>
      <div className="fxp-package-grid">
        {packages.map(([name, description, path]) => (
          <a key={name} href={source(path)} target="_blank" rel="noreferrer">
            <strong>{name}</strong>
            <span>{description}</span>
            <b>source private</b>
          </a>
        ))}
      </div>
      <div className="fxp-run">
        <span>LOCAL RELEASE</span>
        <code>
          Source is private until the reference release passes its publication
          gate.{"\n"}The hosted sandbox remains available now.
        </code>
      </div>
    </section>
  );
}
