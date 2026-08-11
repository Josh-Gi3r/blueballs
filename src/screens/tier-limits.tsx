import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Onboarding · step 5 — GET /v2/customers/:id/capabilities.
   Real per-rail data from kernel.js RAILS — once a customer's application
   decision is "approved" every rail returns status "active" at its own max,
   with an empty `requirements` array (nothing outstanding). */

const MONO = "'IBM Plex Mono', monospace";
const SANS = "Archivo, system-ui, sans-serif";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const rowB: CSSProperties = { padding: "11px 0", borderBottom: "1px solid #F0F1F5" };

const rails = [
  { name: "SEPA Instant", cur: "EUR", limit: "100,000.00", speed: "Arrives in seconds" },
  { name: "SEPA", cur: "EUR", limit: "999,999.00", speed: "Next business day" },
  { name: "Faster Payments", cur: "GBP", limit: "1,000,000.00", speed: "Arrives in seconds" },
  { name: "ACH", cur: "USD", limit: "25,000.00", speed: "1–2 business days" },
  { name: "Wire", cur: "USD", limit: "1,000,000.00", speed: "Same day" },
  { name: "PayNow", cur: "SGD", limit: "200,000.00", speed: "Arrives in seconds" },
];

export default function TierLimitsScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: SANS }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Limits</div>
      </div>
      <div style={{ padding: "0 20px 14px" }}>
        <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 18, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8B93A6" }}>REFERENCE TIER 3</div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Configured sandbox limits for the reference product.</div>
        </div>
      </div>
      <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0", overflow: "hidden" }}>
        <div style={{ ...label, marginBottom: 6 }}>CONFIGURED CAPABILITIES</div>
        {rails.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, ...(i === rails.length - 1 ? { padding: "11px 0" } : rowB) }}>
            <div style={{ width: 7, height: 7, borderRadius: 999, background: "#2E7D53", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#7A8296" }}>{r.cur} · {r.speed}</div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.cur} {r.limit}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 20px 22px" }}>
        <div style={{ background: "#5A6DB8", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>
          Limit changes are illustrative
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "tier-limits",
  journey: "onboarding",
  title: "Verification tier",
  blurb: "Shows configured rail limits after the sandbox records approval.",
  endpoint: "GET /v2/customers/:id/capabilities",
  code: `fetch("/v2/customers/cus_9f2k3ah7/capabilities", {
  headers: { "x-api-key": key }
}).then((response) => response.json());`,
};
