import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Own receiving details — the account's IBAN/BIC and account/routing number,
   so someone else can pay this account. Field shapes match `detailsFor()` in
   apps/api/src/server.js: EUR → { type: "iban", iban, bic }, USD → { type: "aba",
   account_number, routing_number }. Visual language copied from PhoneScreen.tsx. */

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };
const rowB: CSSProperties = { padding: "10px 0", borderBottom: "1px solid #F0F1F5" };

const actions = ["Copy", "Share", "Statement"];

function DetailRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...(last ? { padding: "10px 0" } : rowB) }}>
      <div style={label}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>{v}</div>
    </div>
  );
}

function InstrumentCard({
  currency, symbol, headline, rows,
}: {
  currency: string; symbol: string; headline: string; rows: { k: string; v: string }[];
}) {
  return (
    <div style={{ ...white, borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: "#F0F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12, color: "#454B5C" }}>{symbol}</div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{headline}</div>
        </div>
        <div style={{ ...label, color: "#454B5C" }}>{currency}</div>
      </div>
      {rows.map((r, i) => (
        <DetailRow key={r.k} k={r.k} v={r.v} last={i === rows.length - 1} />
      ))}
    </div>
  );
}

export default function ReceivingDetails() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Receiving details</div>
      </div>

      <div style={{ padding: "2px 20px 12px", fontSize: 12.5, lineHeight: 1.5, color: "#7A8296" }}>
        Share these so someone can pay this account directly on their own bank's rail.
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
        <InstrumentCard
          currency="EUR" symbol="€" headline="EUR · IBAN"
          rows={[
            { k: "ACCOUNT HOLDER", v: "Ada Lovelace" },
            { k: "IBAN", v: "DE89 3704 4417 0532 0012 34" },
            { k: "BIC", v: "BLBLDEB2" },
          ]}
        />
        <InstrumentCard
          currency="USD" symbol="$" headline="USD · ABA"
          rows={[
            { k: "ACCOUNT HOLDER", v: "Ada Lovelace" },
            { k: "ACCOUNT NUMBER", v: "4417053200" },
            { k: "ROUTING NUMBER", v: "050000885" },
          ]}
        />
      </div>

      <div style={{ marginTop: "auto", padding: "14px 20px 22px", background: "#FFFFFF", borderTop: "1px solid #E3E6EE" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {actions.map((a, i) => (
            <div key={a} style={{
              borderRadius: 12, padding: "13px 4px", textAlign: "center", fontSize: 12.5, fontWeight: 500,
              ...(i === 0 ? { background: "#14161C", color: "#FFFFFF" } : { ...white, color: "#454B5C" }),
            }}>{a}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "receiving-details",
  journey: "funding",
  title: "Receiving details",
  blurb: "The account's own IBAN and ABA details, issued per rail, ready to hand to a payer.",
  endpoint: "GET /v2/accounts/:id/details",
  code:
    'await bb.accounts.details("acc_92f");\n\n// → [\n//     { type: "iban", iban: "DE89…", bic: "BLBLDEB2" },\n//     { type: "aba", account_number: "4417053200",\n//       routing_number: "050000885" }\n//   ]',
};
