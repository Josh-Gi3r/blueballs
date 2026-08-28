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

const rows = [
  { k: "Reference", v: "trf_6dW1XpQm9Kf" },
  { k: "Method", v: "SEPA Instant" },
  { k: "Timestamp", v: "07 Aug 2026 · 14:22:09 CET" },
  { k: "From", v: "EUR main · DE89 3704 •••• 4417" },
  { k: "To", v: "Rina's savings · •••• 4823" },
];

export default function PayoutReceipt() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 999,
          background: "#E7F3EC",
          border: "1px solid #BEE3CE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "26px 0 14px",
          fontSize: 24,
          color: "#2E7D53",
          fontWeight: 600,
        }}
      >
        ✓
      </div>

      <div style={label}>SENT</div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          marginTop: 4,
        }}
      >
        €1,250<span style={{ color: "#8A91A2" }}>.00</span>
      </div>

      <div style={{ padding: "18px 20px 0", width: "100%" }}>
        <div style={{ ...white, borderRadius: 16, padding: "4px 16px" }}>
          {rows.map((r) => (
            <div
              key={r.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                ...rowB,
              }}
            >
              <div style={{ fontSize: 12.5, color: "#7A8296" }}>{r.k}</div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  textAlign: "right",
                  fontFamily: r.k === "Reference" ? MONO : undefined,
                }}
              >
                {r.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "auto",
          width: "100%",
          padding: "16px 20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            ...white,
            borderRadius: 12,
            padding: 14,
            textAlign: "center",
            fontSize: 13.5,
            fontWeight: 500,
            color: "#454B5C",
          }}
        >
          Download receipt
        </div>
        <div
          style={{
            background: "#07144F",
            color: "#FFFFFF",
            borderRadius: 12,
            padding: 15,
            textAlign: "center",
            fontSize: 14.5,
            fontWeight: 500,
          }}
        >
          Done
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "payout-receipt",
  journey: "payout",
  title: "Payout receipt",
  blurb: "Renders a settled sandbox transfer and its leg statuses.",
  endpoint: "GET /v2/transfers/:id",
  code: 'fetch("/v2/transfers/trf_6dW1XpQm9Kf", {\n  headers: { "x-api-key": key }\n}).then((response) => response.json());',
};
