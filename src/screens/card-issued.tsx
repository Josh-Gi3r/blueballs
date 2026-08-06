import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Local copies of PhoneScreen's visual constants — screens don't import from
   PhoneScreen.tsx, they match it. */
const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };
const rowB: CSSProperties = { padding: "10px 0", borderBottom: "1px solid #F0F1F5" };

const details = [
  { k: "Status", v: "Active" },
  { k: "Per-transaction limit", v: "€500.00" },
  { k: "Daily limit", v: "€2,000.00" },
  { k: "Monthly limit", v: "€10,000.00" },
];

export default function CardIssued() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Your card</div>
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", padding: "3px 8px", borderRadius: 999,
          background: "#E7F3EC", color: "#2E7D53", border: "1px solid #BEE3CE",
        }}>JUST ISSUED</div>
      </div>

      <div style={{ padding: "12px 20px 8px" }}>
        <div style={{ borderRadius: 18, background: "#14161C", color: "#FFFFFF", padding: 20, height: 186, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#8B93A6" }}>VIRTUAL · EUR</div>
            <div style={{ width: 30, height: 20, borderRadius: 4, background: "#5A6DB8" }} />
          </div>
          <div style={{ width: 40, height: 28, borderRadius: 5, background: "#333949", border: "1px solid #454B5C" }} />
          <div style={{ fontFamily: MONO, fontSize: 15.5, letterSpacing: "0.14em" }}>•••• •••• •••• 4417</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: "#B9BFCC" }}>
            <span>A. LOVELACE</span><span>EXP 09/29</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "6px 20px 10px" }}>
        {["Card activity", "Controls", "Freeze"].map((c) => (
          <div key={c} style={{ ...white, borderRadius: 12, padding: "12px 4px", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "#454B5C" }}>{c}</div>
        ))}
      </div>

      <div style={{ padding: "0 20px 14px" }}>
        <div style={{ ...white, borderRadius: 14, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#14161C" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Add to Apple Wallet</div>
            <div style={{ fontSize: 11.5, color: "#7A8296" }}>Tap to pay wherever contactless is accepted</div>
          </div>
          <span style={{ color: "#7A8296" }}>›</span>
        </div>
      </div>

      <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0" }}>
        <div style={{ ...label, marginBottom: 8 }}>CARD DETAILS</div>
        {details.map((d) => (
          <div key={d.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...rowB }}>
            <div style={{ fontSize: 13, color: "#5B6376" }}>{d.k}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "card-issued",
  journey: "spending",
  title: "Card issued",
  blurb: "A virtual card, ready to spend the instant it's created — no plastic to wait on.",
  endpoint: "POST /v2/cards",
  code: 'await bb.cards.issue({\n  customer: "cus_9f2k",\n  account: "acc_92f8",\n  type: "virtual"\n});\n\n// → { id: "crd_2mFq8Xp…", last4: "4417",\n//     status: "active", spend_limits: {…} }',
};
