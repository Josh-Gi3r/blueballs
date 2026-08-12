import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Onboarding · step 2 — POST /v2/applications/:id/submit.
   `status` moves through pending → submitted → compliance_review → completed;
   `decision` stays null until EDD resolves it — that split is why the step list
   below can show "submitted" without ever implying approved or declined. */

const MONO = "'IBM Plex Mono', monospace";
const SANS = "Archivo, system-ui, sans-serif";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const rowB: CSSProperties = { padding: "12px 0", borderBottom: "1px solid #F0F1F5" };

type StepStatus = "completed" | "pending";

const steps: { title: string; sub: string; status: StepStatus }[] = [
  { title: "Provisioning account", sub: "Customer record created", status: "completed" },
  { title: "Compliance state", sub: "Sandbox check recorded", status: "completed" },
  { title: "Identity verification", sub: "Document review in progress", status: "pending" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <div style={{ width: 22, height: 22, borderRadius: 999, background: "#2E7D53", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
        ✓
      </div>
    );
  }
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 999, flexShrink: 0,
      border: "2.5px solid #DDE1E8", borderTopColor: "#0868FF",
      animation: "bb-kyc-spin 0.8s linear infinite",
    }} />
  );
}

export default function KycProcessingScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: SANS }}>
      <style>{`@keyframes bb-kyc-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ padding: "14px 20px 2px" }}>
        <div style={label}>APPLICATION · APP_7H2MRES</div>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 4 }}>Verifying your identity</div>
      </div>
      <div style={{ padding: "14px 20px 10px" }}>
        <div style={{ background: "#07144F", color: "#FFFFFF", borderRadius: 18, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8B93A6" }}>STATUS · SUBMITTED</div>
          <div style={{ height: 7, borderRadius: 999, background: "#2A2E3A", overflow: "hidden" }}>
            <div style={{ width: "66%", height: "100%", background: "#0868FF" }} />
          </div>
          <div style={{ fontSize: 12, color: "#B9BFCC" }}>2 of 3 sandbox steps complete</div>
        </div>
      </div>
      <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0", overflow: "hidden" }}>
        {steps.map((s, i) => (
          <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 12, ...(i === steps.length - 1 ? { padding: "12px 0" } : rowB) }}>
            <StepIcon status={s.status} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 11.5, color: "#7A8296" }}>{s.sub}</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: s.status === "completed" ? "#2E7D53" : "#0868FF" }}>
              {s.status === "completed" ? "DONE" : "PENDING"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 20px 22px", fontSize: 11, lineHeight: 1.5, color: "#7A8296", textAlign: "center" }}>
        Lifecycle status only — the decision is set separately once review finishes.
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "kyc-processing",
  journey: "onboarding",
  title: "KYC in progress",
  blurb: "Shows a submitted application while its decision remains unset.",
  endpoint: "POST /v2/applications/:id/submit",
  code: `fetch("/v2/applications/app_7h2mres/submit", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key },
  body: "{}"
});`,
};
