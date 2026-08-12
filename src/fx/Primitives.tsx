import type { ReactNode } from "react";
import type { PublicTrade } from "./model";

export function Label({ children }: { children: ReactNode }) {
  return <div className="fxp-label">{children}</div>;
}

export function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "red" | "grey" }) {
  return <span className={`fxp-pill ${tone}`}>{children}</span>;
}

export function LiveBadge({ connected, loading, mode }: {
  connected: boolean;
  loading: boolean;
  mode: "node" | "demo";
}) {
  const copy = loading
    ? mode === "demo" ? "loading website demo" : "contacting FX node"
    : connected
      ? mode === "demo" ? "interactive website demo" : "reference FX node connected"
      : "FX runtime offline";
  return <div className={`fxp-live ${connected ? "on" : "off"} ${mode}`}><span />{copy}</div>;
}

export function ArtworkSection({ image, label, title, copy, children, reverse = false }: {
  image: string;
  label: string;
  title: string;
  copy: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return <section className={`fxp-section fxp-artwork ${reverse ? "reverse" : ""}`}>
    <div className="fxp-art-copy"><Label>{label}</Label><h2>{title}</h2><p>{copy}</p>{children}</div>
    <div className="fxp-art-image"><img src={image} alt="" /></div>
  </section>;
}

export function SettlementRoute({ trade }: { trade: PublicTrade | null }) {
  return <div className="fxp-settlement-route">{(trade?.settlement.edges ?? []).map((edge, index) => <div className="fxp-settlement-leg" key={edge.edgeId}>
    <div className="fxp-leg-index">{String(index + 1).padStart(2, "0")}</div>
    <div><b>{edge.fromAsset} → {edge.toAsset}</b><span>{edge.edgeType.replaceAll("_", " ").toLowerCase()}</span></div>
    <Pill tone={edge.finalityClass === "ATOMIC" ? "green" : "grey"}>{edge.finalityClass.replaceAll("_", " ")}</Pill>
  </div>)}</div>;
}
