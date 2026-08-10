import { useMemo, useState } from "react";
import { FX_NODE_BASE } from "../api";
import { Label, Pill } from "./Primitives";
import { source, type DevView, type PublicTrade } from "./model";

export function DeveloperInspector({ trade, amount }: { trade: PublicTrade | null; amount: string }) {
  const [view, setView] = useState<DevView>("request");
  const data = useMemo(() => {
    if (view === "request") return `await fx.previewReferenceTrade({\n  inputAmount: "${amount}",\n  from: "BRL",\n  to: "EUR"\n});`;
    if (view === "response") return JSON.stringify(trade, null, 2);
    if (view === "events") return JSON.stringify({ tradeId: trade?.id ?? null, quoteId: trade?.quoteId ?? null, routeId: trade?.routeId ?? null, state: trade?.state ?? "PREVIEW", submissionRef: trade?.submissionRef ?? null, eventId: trade?.eventId ?? null, finality: trade?.settlement.guarantee.class ?? null }, null, 2);
    return ["apps/fx-node/src/reference-trade-coordinator.js", "apps/fx-node/src/public-reference-runtime.js", "apps/fx-node/src/integrated-quote-coordinator.js", "packages/fx-policy/src/policy-engine.js", "packages/fx-liquidity/src/optimizer.js", "packages/fx-contracts/src/AtomicRouter.sol", "apps/fx-node/test/public-reference-runtime.test.js"].join("\n");
  }, [amount, trade, view]);

  return <section id="fx-developer" className="fxp-section fxp-developer"><div className="fxp-section-head"><div><Label>OPEN THE SAME TRADE</Label><h2>Screen, route, code and evidence stay connected.</h2><p>The IDs and numbers below come from the same FX node response driving the phone.</p></div><a href={`${FX_NODE_BASE || "http://localhost:8788"}/openapi.yaml`} target="_blank" rel="noreferrer"><Pill>OpenAPI ↗</Pill></a></div><div className="fxp-dev-tabs">{(["request", "response", "events", "source"] as DevView[]).map((item) => <button type="button" key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</div><div className="fxp-code-window"><div className="fxp-code-window-top"><span>{view === "source" ? "IMPLEMENTATION MAP" : "LIVE NODE"}</span><b>{trade?.quoteId ?? "unreserved preview"}</b></div><pre>{data}</pre></div><div className="fxp-proof-links"><a href={source("apps/fx-node/test/public-reference-runtime.test.js")} target="_blank" rel="noreferrer">Integration test ↗</a><a href={source("packages/fx-contracts/script/ControlledProof.s.sol")} target="_blank" rel="noreferrer">Controlled EVM proof ↗</a><a href={source("spec/fx/PUBLIC-REFERENCE.md")} target="_blank" rel="noreferrer">Public reference contract ↗</a></div></section>;
}
