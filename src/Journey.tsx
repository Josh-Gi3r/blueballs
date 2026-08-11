import { useState, type CSSProperties } from "react";
import { JOURNEYS, byJourney, SCREENS } from "./screens/registry";

const MONO = "'IBM Plex Mono', monospace";

/** The journey walkthrough: pick a journey, step through its screens, and see the
 *  exact API call behind each one. This is the thing the site is actually selling —
 *  a screen on its own proves nothing. */
export default function Journey() {
  const [journey, setJourney] = useState(JOURNEYS[0].id);
  const [step, setStep] = useState(0);

  const screens = byJourney(journey);
  const current = screens[Math.min(step, screens.length - 1)];
  const meta = current?.meta;
  const Body = current?.Component;

  const pick = (j: typeof journey) => { setJourney(j); setStep(0); };

  const chip = (on: boolean): CSSProperties => ({
    cursor: "pointer", fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 999,
    border: `1px solid ${on ? "#5A6DB8" : "#D7DBE4"}`, background: on ? "#5A6DB8" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#454B5C", whiteSpace: "nowrap",
  });

  return (
    <div data-pad style={{ background: "#FFFFFF", border: "1px solid #D7DBE4", borderRadius: 18, padding: "34px 34px 30px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", color: "#7A8296" }}>EXAMPLE PRODUCT FLOWS</div>
          <h2 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>
            {SCREENS.length} screens paired with API requests.
          </h2>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#7A8296" }}>
          {JOURNEYS.length} JOURNEYS
        </div>
      </div>
      <p style={{ margin: "12px 0 18px", fontSize: 15.5, lineHeight: 1.6, maxWidth: "72ch", color: "#454B5C" }}>
        Each screen illustrates how a sandbox response could appear in a product. The request beside it shows the matching reference API call.
      </p>

      {/* journey picker */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
        {JOURNEYS.filter((j) => byJourney(j.id).length > 0).map((j) => (
          <button key={j.id} onClick={() => pick(j.id)} style={chip(j.id === journey)}>
            {j.label}
            <span style={{ fontFamily: MONO, fontSize: 10, marginLeft: 7, opacity: 0.75 }}>
              {byJourney(j.id).length}
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13.5, color: "#5B6376", marginBottom: 18 }}>
        {JOURNEYS.find((j) => j.id === journey)?.blurb}
      </div>

      {/* step rail */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {screens.map((s, i) => {
          const on = i === step;
          return (
            <button key={s.meta.id} onClick={() => setStep(i)}
              style={{
                cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "6px 11px", borderRadius: 8,
                border: `1px solid ${on ? "#14161C" : "#E7EAF0"}`,
                background: on ? "#14161C" : "#F7F8FB", color: on ? "#FFFFFF" : "#5B6376",
              }}>
              <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.7, marginRight: 6 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.meta.title}
            </button>
          );
        })}
      </div>

      {/* screen + the call behind it */}
      {meta && Body && (
        <div data-col style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start" }}>
          {/* phone */}
          <div style={{ background: "#EDEFF4", border: "1px solid #D7DBE4", borderRadius: 18, padding: "22px 20px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: 328, border: "1px solid #C9CEDA", borderRadius: 44, background: "#14161C", padding: 10, boxShadow: "0 18px 40px rgba(20,22,28,0.16)" }}>
              <div style={{ background: "#F4F5F8", borderRadius: 35, overflow: "hidden", height: 660, display: "flex", flexDirection: "column", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 24px 4px", fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  <span>9:41</span>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", fontFamily: MONO, fontSize: 10 }}><span>▮▮▮</span><span>ᯤ</span><span>▰</span></div>
                </div>
                <Body />
              </div>
            </div>
          </div>

          {/* the call */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em" }}>{meta.title}</h3>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: meta.live ? "#2E7D53" : "#7A8296", background: meta.live ? "#E3F1E9" : "#ECEEF2", border: `1px solid ${meta.live ? "#BFE0CD" : "#D7DBE4"}`, borderRadius: 999, padding: "3px 9px" }}>
                  {meta.live ? "LIVE SANDBOX DATA" : "ILLUSTRATIVE · SAMPLE DATA"}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#454B5C", maxWidth: "60ch" }}>{meta.blurb}</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: "#7A8296" }}>MATCHING API REQUEST</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#4E5FA6", border: "1px solid #DADFF2", background: "#EEF1FA", borderRadius: 999, padding: "5px 12px" }}>{meta.endpoint}</div>
            </div>
            <div style={{ background: "#14161C", color: "#E4E7EE", borderRadius: 14, padding: "20px 22px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 420 }}>{meta.code}</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                style={{ fontSize: 13, fontWeight: 500, padding: "10px 16px", borderRadius: 10, border: "1px solid #D7DBE4", background: "#FFFFFF", color: step === 0 ? "#B4BAC8" : "#14161C", cursor: step === 0 ? "default" : "pointer" }}>
                ← Back
              </button>
              <button onClick={() => setStep(Math.min(screens.length - 1, step + 1))} disabled={step >= screens.length - 1}
                style={{ fontSize: 13, fontWeight: 500, padding: "10px 18px", borderRadius: 10, border: "1px solid #14161C", background: step >= screens.length - 1 ? "#FFFFFF" : "#14161C", color: step >= screens.length - 1 ? "#B4BAC8" : "#FFFFFF", cursor: step >= screens.length - 1 ? "default" : "pointer" }}>
                Next step →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
