import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Account home right after a deposit lands — balance up, quick actions, and a
   transaction list where the newest entry is the inbound credit with its rail.
   Response shape matches GET /v2/accounts/:id in apps/api/src/server.js:
   { balance: { amount, currency }, currency, … }. Money is always a decimal
   string with an explicit currency. Visual language copied from PhoneScreen.tsx. */

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };
const rowB: CSSProperties = { padding: "10px 0", borderBottom: "1px solid #F0F1F5" };

const txns = [
  { name: "Deposit · SEPA Instant", when: "Just now", amount: "+ €5,000.00", color: "#4E5FA6", inbound: true },
  { name: "Monoprix", when: "Today · 08:12", amount: "− €24.80", color: "#14161C", inbound: false },
  { name: "Deutsche Bahn", when: "Yesterday · 19:40", amount: "− €89.00", color: "#14161C", inbound: false },
  { name: "Refund · Uniqlo", when: "Yesterday · 12:03", amount: "+ €42.00", color: "#4E5FA6", inbound: false },
];

export default function FundedHome() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: "#5A6DB8", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>AL</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ada</div>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid #DDE1E8", background: "#FFFFFF" }} />
      </div>

      <div style={{ padding: "20px 20px 14px" }}>
        <div style={label}>EUR ACCOUNT · BALANCE</div>
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6 }}>€23,402<span style={{ color: "#8A91A2" }}>.10</span></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: "#EEF1FA", color: "#4E5FA6", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 500 }}>
          <span>↓</span><span>+ €5,000.00 just credited</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 20px 16px" }}>
        {["Add", "Send", "Convert", "More"].map((a) => (
          <div key={a} style={{ ...white, borderRadius: 12, padding: "13px 4px", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "#454B5C" }}>{a}</div>
        ))}
      </div>

      <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", borderRadius: "22px 22px 0 0", padding: "16px 20px 0", overflow: "auto" }}>
        <div style={{ ...label, marginBottom: 8 }}>ACTIVITY</div>
        {txns.map((t) => (
          <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, ...rowB }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              background: t.inbound ? "#EEF1FA" : "#F0F2F7", color: t.inbound ? "#4E5FA6" : "#454B5C", fontSize: 13,
            }}>{t.inbound ? "↓" : "↑"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "#7A8296" }}>{t.when}</div>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.color }}>{t.amount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "funded-home",
  journey: "funding",
  title: "Funded",
  blurb: "Same account, moments later — balance updated and the deposit sitting at the top of activity with its rail attached.",
  endpoint: "GET /v2/accounts/:id",
  code:
    'await bb.accounts.retrieve("acc_92f");\n\n// → { balance: { amount: "23402.10",\n//       currency: "EUR" } }',
};
