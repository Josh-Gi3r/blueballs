import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.16em",
  color: "#7A8296",
};
const white: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E3E6EE",
};
const rowB: CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #F0F1F5",
};

const toggle = (on: boolean): CSSProperties => ({
  width: 40,
  height: 24,
  borderRadius: 999,
  position: "relative",
  background: on ? "#0868FF" : "#DDE1E8",
  flexShrink: 0,
});
const knob = (on: boolean): CSSProperties => ({
  position: "absolute",
  top: 2.5,
  ...(on ? { right: 2.5 } : { left: 2.5 }),
  width: 19,
  height: 19,
  borderRadius: 999,
  background: "#FFFFFF",
});

const categories = [
  { name: "Groceries", mcc: "5411", on: true },
  { name: "Restaurants", mcc: "5812", on: true },
  { name: "Travel", mcc: "4511", on: true },
  { name: "Betting & gambling", mcc: "7995", on: false },
];

export default function CardControls() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px 10px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div
          style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          Spend controls
        </div>
      </div>

      <div style={{ padding: "0 20px 10px" }}>
        <div
          style={{
            ...white,
            borderRadius: 16,
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={label}>PER TRANSACTION</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                marginTop: 4,
              }}
            >
              €150<span style={{ color: "#8A91A2" }}>.00</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#0868FF", fontWeight: 500 }}>
            Edit
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px 12px" }}>
        <div style={{ ...white, borderRadius: 16, padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={label}>MONTHLY LIMIT</div>
            <div style={{ fontSize: 13, color: "#0868FF", fontWeight: 500 }}>
              Edit
            </div>
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: "4px 0 12px",
            }}
          >
            €3,000<span style={{ color: "#8A91A2" }}>.00</span>
          </div>
          <div
            style={{
              height: 7,
              borderRadius: 999,
              background: "#EDEFF4",
              overflow: "hidden",
            }}
          >
            <div
              style={{ width: "38%", height: "100%", background: "#0868FF" }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#7A8296",
              marginTop: 8,
            }}
          >
            <span>€1,140.00 spent this month</span>
            <span>38%</span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          borderTop: "1px solid #E3E6EE",
          padding: "15px 20px 0",
        }}
      >
        <div style={{ ...label, marginBottom: 6 }}>MERCHANT CATEGORIES</div>
        {categories.map((c) => (
          <div
            key={c.mcc}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              ...rowB,
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
              <div
                style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}
              >
                MCC {c.mcc}
              </div>
            </div>
            <div style={toggle(c.on)}>
              <div style={knob(c.on)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "card-controls",
  journey: "spending",
  title: "Spend controls",
  blurb:
    "Shows limits and merchant-category blocks checked by the sandbox authorisation handler.",
  endpoint: "PATCH /v2/cards/:id/controls",
  code: 'fetch("/v2/cards/crd_2mFq8Xp…/controls", {\n  method: "PATCH",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ spend_limits: { monthly: { amount: "3000.00", currency: "EUR" } }, merchant_categories: { blocked: ["7995"] } })\n});',
};
