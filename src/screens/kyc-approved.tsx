import type { ScreenMeta } from "./registry";

/* Onboarding · step 3 — GET /v2/applications/:id.
   `status: "completed"` and `decision: "approved"` are deliberately separate
   fields on the real application object — shown here as two distinct badges,
   never merged into one "approved" state. */

const MONO = "'IBM Plex Mono', monospace";
const SANS = "Archivo, system-ui, sans-serif";

function Badge({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: "#2E7D53",
      background: "#E7F3EC", border: "1px solid #BEE3CE", borderRadius: 999, padding: "5px 10px",
    }}>
      {text}
    </div>
  );
}

export default function KycApprovedScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: SANS }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center", gap: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: "#E7F3EC", color: "#2E7D53",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
        }}>
          ✓
        </div>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}>Sandbox approval recorded</div>
        <div style={{ fontSize: 14, color: "#5B6376", lineHeight: 1.5 }}>
          The application is complete and its sample decision is approved.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
          <Badge text="STATUS · COMPLETED" />
          <Badge text="DECISION · APPROVED" />
        </div>
      </div>
      <div style={{ padding: "14px 20px 22px" }}>
        <div style={{ background: "#07144F", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>
          View configured capabilities
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "kyc-approved",
  journey: "onboarding",
  title: "Approved",
  blurb: "Shows an application after the sandbox records an approved decision.",
  endpoint: "GET /v2/applications/:id",
  code: `fetch("/v2/applications/app_7h2mres", {
  headers: { "x-api-key": key }
}).then((response) => response.json());`,
};
