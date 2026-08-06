import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };

const fields = [
  { k: "NICKNAME", v: "Rina's savings" },
  { k: "ROUTING NUMBER", v: "021000021" },
  { k: "ACCOUNT NUMBER", v: "•••• •••• 4823" },
  { k: "CONFIRM ACCOUNT NUMBER", v: "•••• •••• 4823" },
];

export default function LinkExternal() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Link a bank account</div>
      </div>

      <div style={{ padding: "0 20px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {fields.map((f) => (
          <div key={f.k} style={{ ...white, borderRadius: 14, padding: "10px 15px" }}>
            <div style={label}>{f.k}</div>
            <div style={{ fontFamily: MONO, fontSize: 14.5, marginTop: 4 }}>{f.v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "4px 20px 0" }}>
        <div style={{
          borderRadius: 14, padding: "13px 15px", background: "#F4F1E9", border: "1px solid #E7DFC7",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, background: "#FFFFFF", border: "1px solid #E7DFC7",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#8A6D2F", flexShrink: 0,
          }}>≈</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8A6D2F" }}>Name check: no match</div>
            <div style={{ fontSize: 11.5, color: "#7A6B45", marginTop: 2, lineHeight: 1.45 }}>
              You entered "Rina Aoki" — the bank holds "R. Aoki Design Ltd" on this account. Not an error: confirm the details and link anyway, or fix the name.
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "16px 20px 22px" }}>
        <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>Link account</div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "link-external",
  journey: "payout",
  title: "Link a bank account",
  blurb: "A Confirmation-of-Payee style name check runs before anything is trusted — a no-match is a normal outcome, not an error.",
  endpoint: "POST /v2/destinations/:id/verify",
  code: 'await bb.destinations.verify("dst_9mQ2Lx…", {\n  name: "Rina Aoki"\n});\n\n// → { result: "no_match",\n//     held_name: "R. Aoki Design Ltd",\n//     checked_name: "Rina Aoki" }',
};
