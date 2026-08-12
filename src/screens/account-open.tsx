import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Onboarding · step 4 — POST /v2/accounts.
   The response's `details` object is the account's real receiving instrument,
   issued in the same call — an IBAN + BIC for EUR, per server.js `detailsFor`. */

const MONO = "'IBM Plex Mono', monospace";
const SANS = "Archivo, system-ui, sans-serif";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };

export default function AccountOpenScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: SANS }}>
      <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: "#5A6DB8", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>AL</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ada</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: "#2E7D53", background: "#E7F3EC", border: "1px solid #BEE3CE", borderRadius: 999, padding: "4px 9px" }}>NEW</div>
      </div>
      <div style={{ padding: "20px 20px 14px" }}>
        <div style={label}>BALANCE · EUR</div>
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6 }}>€0<span style={{ color: "#8A91A2" }}>.00</span></div>
        <div style={{ fontSize: 12.5, color: "#7A8296", marginTop: 4 }}>Account opened moments ago</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 20px 16px" }}>
        {["Add", "Send", "Convert", "More"].map((a) => (
          <div key={a} style={{ ...white, borderRadius: 12, padding: "13px 4px", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "#454B5C" }}>{a}</div>
        ))}
      </div>
      <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", borderRadius: "22px 22px 0 0", padding: "16px 20px 0" }}>
        <div style={{ ...label, marginBottom: 10 }}>RECEIVING DETAILS</div>
        <div style={{ ...white, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#7A8296", letterSpacing: "0.12em" }}>IBAN</div>
            <div style={{ fontFamily: MONO, fontSize: 14, marginTop: 2 }}>DE89 3704 0044 0532 0130 00</div>
          </div>
          <div style={{ borderTop: "1px solid #F0F1F5", paddingTop: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#7A8296", letterSpacing: "0.12em" }}>BIC</div>
            <div style={{ fontFamily: MONO, fontSize: 14, marginTop: 2 }}>BLBLDEB2</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#7A8296", lineHeight: 1.5 }}>
          Sample identifiers generated with this sandbox account. They cannot receive real payments.
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "account-open",
  journey: "onboarding",
  title: "Account open",
  blurb: "Shows sample receiving details returned with a new sandbox account.",
  endpoint: "POST /v2/accounts",
  code: `fetch("/v2/accounts", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key },
  body: JSON.stringify({ customer: "cus_9f2k3ah7", currency: "EUR" })
});`,
};
