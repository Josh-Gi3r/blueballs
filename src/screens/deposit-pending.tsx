import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Inbound payment mid-flight. Status vocabulary matches the transfer lifecycle
   in apps/api/src/server.js: created → funds_received → submitted → confirming
   (slower rails) or settled (instant rails). The reference shown here is the
   transfer id issued at submission — real, but not proof of settlement, which
   is the same "hash at submission is preliminary" rule the transfers contract
   holds elsewhere. Visual language copied from PhoneScreen.tsx. */

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };

const steps = [
  { name: "Funds received", done: true },
  { name: "Submitted", done: true },
  { name: "Confirming", done: true, current: true },
  { name: "Settled", done: false },
];

export default function DepositPending() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Incoming payment</div>
      </div>

      <div style={{ padding: "6px 20px 14px", textAlign: "center" }}>
        <div style={label}>AMOUNT ARRIVING</div>
        <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6, color: "#4E5FA6" }}>+ $12,000<span style={{ color: "#8A91A2" }}>.00</span></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "#FBF3E4", color: "#8A6A1F", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#C99A2E" }} />
          <span>Confirming</span>
        </div>
      </div>

      <div style={{ padding: "0 20px 12px" }}>
        <div style={{ ...white, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <div style={label}>FROM</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Kessler Ltd</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #F0F1F5" }}>
            <div style={label}>RAIL</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>ACH</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #F0F1F5" }}>
            <div style={label}>REFERENCE</div>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>trf_9k2ncQ81pR</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px 12px", display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            <div style={{
              width: 9, height: 9, borderRadius: 999,
              background: s.current ? "#C99A2E" : s.done ? "#4E5FA6" : "#DDE1E8",
              boxShadow: s.current ? "0 0 0 3px #FBF3E4" : "none",
            }} />
            <div style={{ fontSize: 12.5, fontWeight: 500, color: s.done ? "#14161C" : "#B4B9C6" }}>{s.name}</div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: "#F0F1F5" }} />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", padding: "14px 20px 22px", background: "#FFFFFF", borderTop: "1px solid #E3E6EE", fontSize: 11.5, lineHeight: 1.55, color: "#7A8296" }}>
        <span style={{ fontFamily: MONO, color: "#14161C" }}>trf_9k2ncQ81pR</span> was issued the moment this payment was submitted. It is a real reference, not proof of settlement — the balance updates only once the rail confirms.
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "deposit-pending",
  journey: "funding",
  title: "Deposit pending",
  blurb: "A transfer's status is derived from its legs, never guessed — this one is still confirming on ACH.",
  endpoint: "GET /v2/transfers/:id",
  code:
    'await bb.transfers.retrieve("trf_9k2ncQ81pR");\n\n// → { status: "confirming",\n//     rail: "ach",\n//     amount: { amount: "12000.00", currency: "USD" } }',
};
