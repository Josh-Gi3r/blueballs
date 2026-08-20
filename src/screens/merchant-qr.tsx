import type { CSSProperties } from "react";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296" };

export const meta = {
  id: "merchant-qr",
  journey: "product" as const,
  title: "Merchant QR payment",
  blurb: "Generate a merchant-presented QR payload for a fixed amount, then decode and validate it before accepting the payment flow.",
  endpoint: "POST /v2/qr/generate",
  code: `fetch("/v2/qr/generate", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": key
  },
  body: JSON.stringify({
    merchant: {
      name: "Coffee Corner",
      city: "Singapore",
      country: "SG"
    },
    currency: "SGD",
    amount: "23.75"
  })
});`,
};

function FakeQr() {
  const cells = [
    "1111111001011111111","1000001011010000001","1011101010010111011","1011101001110111011","1011101010010111011","1000001011010000001","1111111010101111111","0000000011100000000","1011011110111011011","0110100011010010110","1101111010111110011","0010010111100101100","1011111010111011110","0000000011001001010","1111111010111010101","1000001001001001110","1011101011111110011","1000001010010010100","1111111011011011111",
  ];
  return <div style={{ width: 184, height: 184, padding: 12, background: "#FFFFFF", borderRadius: 16, border: "1px solid #DDE1E8", display: "grid", gridTemplateColumns: "repeat(19, 1fr)", gap: 0 }}>
    {cells.join("").split("").map((cell, index) => <span key={index} style={{ background: cell === "1" ? "#07144F" : "transparent" }} />)}
  </div>;
}

export default function MerchantQr() {
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px 20px", boxSizing: "border-box" }}>
    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Receive payment</div>
    <div style={{ fontSize: 13, color: "#7A8296", marginTop: 3 }}>Coffee Corner</div>

    <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}><FakeQr /></div>

    <div style={{ textAlign: "center", marginTop: 18 }}>
      <div style={label}>AMOUNT</div>
      <div style={{ fontSize: 31, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 5 }}>S$23.75</div>
      <div style={{ fontSize: 12.5, color: "#5B6376", marginTop: 5 }}>Scan to pay</div>
    </div>

    <div style={{ marginTop: 24, background: "#FFFFFF", border: "1px solid #E3E6EE", borderRadius: 15, padding: "14px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={label}>TYPE</span><b style={{ fontSize: 12.5 }}>DYNAMIC QR</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={label}>STANDARD</span><b style={{ fontSize: 12.5 }}>EMVCo MPM</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={label}>STATUS</span><b style={{ fontSize: 12.5, color: "#2E7D53" }}>VALID</b></div>
    </div>

    <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
      <div style={{ flex: 1, border: "1px solid #D7DBE4", background: "#FFFFFF", borderRadius: 11, padding: "12px 10px", textAlign: "center", fontSize: 13, fontWeight: 500 }}>Share link</div>
      <div style={{ flex: 1, background: "#07144F", color: "#FFFFFF", borderRadius: 11, padding: "12px 10px", textAlign: "center", fontSize: 13, fontWeight: 500 }}>New QR</div>
    </div>
  </div>;
}
