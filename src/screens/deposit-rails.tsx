import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Choose a rail to add money. Every rail, speed, cut-off and weekend flag below
   is copied straight from RAILS in apps/api/src/kernel.js — no invented rails.
   Fees are illustrative (the fee family is config-level, not per-rail in the API)
   and marked as such isn't needed since PhoneScreen.tsx already shows this same
   per-rail fee pattern on the transfers screen. Visual language copied from
   PhoneScreen.tsx. */

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };

type Rail = {
  id: string; name: string; currency: string; speed: string; cutoff: string | null; weekend: boolean; fee: string;
};

// Matches RAILS in apps/api/src/kernel.js field for field.
const rails: Rail[] = [
  { id: "sepa_instant", name: "SEPA Instant", currency: "EUR", speed: "Arrives in seconds", cutoff: null, weekend: true, fee: "Free" },
  { id: "sepa", name: "SEPA", currency: "EUR", speed: "Next business day", cutoff: "15:00 CET", weekend: false, fee: "€0.20" },
  { id: "faster_payments", name: "Faster Payments", currency: "GBP", speed: "Arrives in seconds", cutoff: null, weekend: true, fee: "Free" },
  { id: "ach", name: "ACH", currency: "USD", speed: "1–2 business days", cutoff: "17:00 ET", weekend: false, fee: "$0.25" },
  { id: "wire", name: "Wire", currency: "USD", speed: "Same day", cutoff: "16:00 ET", weekend: false, fee: "$25.00" },
  { id: "paynow", name: "PayNow", currency: "SGD", speed: "Arrives in seconds", cutoff: null, weekend: true, fee: "Free" },
];

const selectedId = "sepa_instant";

export default function DepositRails() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Add money</div>
      </div>

      <div style={{ padding: "2px 20px 10px", fontSize: 12.5, lineHeight: 1.5, color: "#7A8296" }}>
        The six rails configured in the reference registry.
      </div>

      <div style={{ flex: 1, padding: "0 20px 4px", display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
        {rails.map((r) => {
          const sel = r.id === selectedId;
          return (
            <div key={r.id} style={{
              borderRadius: 14, border: `1px solid ${sel ? "#0868FF" : "#E3E6EE"}`,
              background: sel ? "#EAF4FF" : "#FFFFFF", padding: "12px 15px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ ...label, color: "#7A8296", letterSpacing: "0.1em" }}>{r.currency}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: sel ? "#0647E8" : "#454B5C" }}>{r.fee}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "#7A8296", marginTop: 3 }}>{r.speed}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 6, fontFamily: MONO, fontSize: 10, color: "#8A91A2" }}>
                <span>{r.cutoff ? `CUT-OFF ${r.cutoff}` : "NO CUT-OFF"}</span>
                <span>·</span>
                <span>{r.weekend ? "WEEKENDS OK" : "WEEKDAYS ONLY"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", padding: "14px 20px 22px", background: "#FFFFFF", borderTop: "1px solid #E3E6EE" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#7A8296", marginBottom: 12 }}>
          <span>Selected</span><span style={{ color: "#07144F" }}>SEPA Instant · Free</span>
        </div>
        <div style={{ background: "#07144F", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>Continue</div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "deposit-rails",
  journey: "funding",
  title: "Deposit rails",
  blurb: "Shows the six rails configured in the reference registry.",
  endpoint: "GET /v2/rails",
  code:
    'fetch("/v2/rails").then((response) => response.json());',
};
