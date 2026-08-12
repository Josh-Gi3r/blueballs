import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };

export default function CardDeclined() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", alignItems: "center" }}>
      <div style={{ padding: "22px 20px 4px", textAlign: "center" }}>
        <div style={label}>DECLINED AT</div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>Kessler Café</div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6, color: "#8A91A2", textDecoration: "line-through", textDecorationColor: "#C7CBD6" }}>€24<span>.80</span></div>
      </div>

      <div style={{
        width: 64, height: 64, borderRadius: 999, background: "#FBEAE8", border: "1px solid #F0C7C2",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "16px 0 12px",
        fontSize: 26, color: "#B4453C", fontWeight: 600,
      }}>✕</div>

      <div style={{ padding: "0 20px", width: "100%" }}>
        <div style={{ ...white, borderRadius: 14, padding: "14px 16px" }}>
          <div style={label}>REASON</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 5, color: "#14161C" }}>Card is frozen</div>
          <div style={{ fontSize: 12.5, color: "#5B6376", marginTop: 5, lineHeight: 1.5 }}>
            You froze this card on 3 Aug. Nothing can be charged to it until it's unfrozen — even if the transaction would otherwise be within limits.
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 20px 0", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7A8296", padding: "6px 4px" }}>
          <span>Decline reason</span><span style={{ fontFamily: MONO, color: "#14161C" }}>card_frozen</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7A8296", padding: "6px 4px" }}>
          <span>Network response</span><span style={{ fontFamily: MONO, color: "#14161C" }}>05</span>
        </div>
      </div>

      <div style={{ marginTop: "auto", width: "100%", padding: "16px 20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>Unfreeze card</div>
        <div style={{ ...white, borderRadius: 12, padding: 14, textAlign: "center", fontSize: 13.5, fontWeight: 500, color: "#454B5C" }}>View card</div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "card-declined",
  journey: "spending",
  title: "Card declined",
  blurb: "Shows a sandbox decline with an explicit reason code.",
  endpoint: "POST /v2/authorisations/:id/decline",
  code: 'fetch("/v2/authorisations/aut_7kD4Nq…/decline", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ reason: "card_frozen" })\n});',
};
