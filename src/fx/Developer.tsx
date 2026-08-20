import { useMemo, useState } from "react";
import { FX_NODE_BASE, FX_RUNTIME_MODE } from "../api";
import { Label, Pill } from "./Primitives";
import { source, type DevView, type PublicTrade } from "./model";

export function DeveloperInspector({
  trade,
  amount,
}: {
  trade: PublicTrade | null;
  amount: string;
}) {
  const [view, setView] = useState<DevView>("request");
  const openApiHref =
    FX_RUNTIME_MODE === "node"
      ? `${FX_NODE_BASE}/openapi.yaml`
      : source("apps/fx-node/openapi.yaml");
  const data = useMemo(() => {
    if (view === "request")
      return `import { BlueballsFxClient } from "@blueballs/fx-sdk";

const fx = new BlueballsFxClient({
  baseUrl: "http://localhost:8788",
  apiKey: process.env.FX_API_KEY
});

const trade = await fx.previewReferenceTrade({
  inputAmount: "${amount}",
  from: "BRL",
  to: "EUR"
});`;
    if (view === "response") return JSON.stringify(trade, null, 2);
    if (view === "events")
      return JSON.stringify(
        {
          tradeId: trade?.id ?? null,
          quoteId: trade?.quoteId ?? null,
          routeId: trade?.routeId ?? null,
          state: trade?.state ?? "PREVIEW",
          submissionRef: trade?.submissionRef ?? null,
          eventId: trade?.eventId ?? null,
          finality: trade?.settlement.guarantee.class ?? null,
        },
        null,
        2,
      );
    return [
      "apps/fx-node/src/quote-coordinator.js",
      "apps/fx-node/src/source-adapters.js",
      "packages/fx-market/src/market-service.js",
      "packages/fx-policy/src/policy-engine.js",
      "packages/fx-liquidity/src/optimizer.js",
      "packages/fx-pricing/src/principal-pricing.js",
      "packages/fx-fiat/src/settlement-graph.js",
      "packages/fx-contracts/src/AtomicRouter.sol",
      "apps/fx-node/test/public-reference-runtime.test.js",
    ].join("\n");
  }, [amount, trade, view]);

  return (
    <section id="fx-developer" className="fxp-section fxp-developer">
      <div className="fxp-section-head">
        <div>
          <Label>API AND SOURCE</Label>
          <h2>Call the exchange and follow the result into the code</h2>
          <p>
            The request below produces the transaction used through this page.
            Inspect the returned sources and route state, then open the package
            and tests responsible for each part of the result.
          </p>
        </div>
        <a href={openApiHref} target="_blank" rel="noreferrer">
          <Pill>OpenAPI ↗</Pill>
        </a>
      </div>
      <div className="fxp-dev-tabs">
        {(["request", "response", "events", "source"] as DevView[]).map(
          (item) => (
            <button
              type="button"
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <div className="fxp-code-window">
        <div className="fxp-code-window-top">
          <span>{view === "source" ? "IMPLEMENTATION" : "FX NODE"}</span>
          <b>{trade?.quoteId ?? "preview"}</b>
        </div>
        <pre>{data}</pre>
      </div>
      <div className="fxp-proof-links">
        <a
          href={source("apps/fx-node/test/public-reference-runtime.test.js")}
          target="_blank"
          rel="noreferrer"
        >
          Integration test ↗
        </a>
        <a
          href={source("packages/fx-contracts/script/ControlledProof.s.sol")}
          target="_blank"
          rel="noreferrer"
        >
          Controlled EVM proof ↗
        </a>
        <a
          href={source("spec/fx/ARCHITECTURE.md")}
          target="_blank"
          rel="noreferrer"
        >
          FX architecture ↗
        </a>
      </div>
    </section>
  );
}
