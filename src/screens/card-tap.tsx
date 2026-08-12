import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };

export default function CardTap() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", alignItems: "center" }}>
      <div style={{ padding: "22px 20px 4px", textAlign: "center" }}>
        <div style={label}>PAYING</div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>Kessler Café</div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6 }}>€24<span style={{ color: "#8A91A2" }}>.80</span></div>
      </div>

      <div style={{ position: "relative", width: 148, height: 148, display: "flex", alignItems: "center", justifyContent: "center", margin: "18px 0 10px" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "1px solid #DADFF2" }} />
        <div style={{ position: "absolute", inset: 20, borderRadius: 999, border: "1px solid #C3CAEB" }} />
        <div style={{
          width: 78, height: 50, borderRadius: 8, background: "#14161C", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "8px 9px", boxShadow: "0 10px 22px rgba(20,22,28,0.22)",
        }}>
          <div style={{ width: 14, height: 10, borderRadius: 2, background: "#454B5C" }} />
          <div style={{ fontFamily: MONO, fontSize: 6.5, letterSpacing: "0.1em", color: "#B9BFCC" }}>•••• 4417</div>
        </div>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 500, color: "#454B5C" }}>Hold near reader</div>
      <div style={{ fontSize: 11.5, color: "#7A8296", marginTop: 3 }}>Don't lift until you feel the buzz</div>

      <div style={{ marginTop: "auto", width: "100%", padding: "16px 20px 22px" }}>
        <div style={{
          background: "#E7F3EC", border: "1px solid #BEE3CE", borderRadius: 14, padding: "13px 15px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2E7D53" }}>Approved</div>
            <div style={{ fontSize: 11.5, color: "#4C8468" }}>Sample authorisation approved</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#2E7D53" }}>00</div>
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "card-tap",
  journey: "spending",
  title: "Paying in person",
  blurb: "Illustrates a sandbox card-authorisation decision. No card network is connected.",
  endpoint: "POST /v2/authorisations/:id/approve",
  code: 'fetch("/v2/authorisations/aut_7kD4Nq…/approve", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: "{}"\n});',
};
