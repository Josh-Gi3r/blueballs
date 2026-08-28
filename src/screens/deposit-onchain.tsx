import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* On-chain deposit: network selector, wallet address with copy affordance, and a
   deterministic QR block grid (no QR library — hand-drawn finder patterns plus a
   hash-derived fill, same "no dependency" spirit as the CRC-16 QR codec in
   apps/api/src/routes/payments.js). Networks and USDC support match NETWORKS in
   apps/api/src/routes/platform.js; wallet shape matches POST /v2/wallets in
   apps/api/src/routes/business.js. Visual language copied from PhoneScreen.tsx. */

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

// Matches NETWORKS in apps/api/src/routes/platform.js — all support USDC.
const networks = [
  { id: "base", name: "Base", sel: true },
  { id: "ethereum", name: "Ethereum", sel: false },
  { id: "polygon", name: "Polygon", sel: false },
  { id: "arbitrum", name: "Arbitrum One", sel: false },
];

// Matches the address shape POST /v2/wallets returns: "0x" + 40 hex chars.
const ADDRESS = "0x8f2c1a9b3e77d0f6c4a25b91de3f80c1a9e2cd40";
const ADDRESS_SHORT = "0x8f2c…cd40";

const GRID = 15;
const CELL = 9;

function finderCell(r: number, c: number): boolean {
  if (r === 0 || r === 4 || c === 0 || c === 4) return true;
  return r === 2 && c === 2;
}

/** Deterministic fill — same string in, same grid out, every render. */
function dataCell(row: number, col: number): boolean {
  const idx = row * GRID + col;
  const ch = ADDRESS.charCodeAt(idx % ADDRESS.length);
  return (ch + row * 7 + col * 13) % 5 < 2;
}

function moduleOn(row: number, col: number): boolean {
  const inCorner = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 5 && col >= c0 && col < c0 + 5;
  if (inCorner(0, 0)) return finderCell(row, col);
  if (inCorner(0, GRID - 5)) return finderCell(row, col - (GRID - 5));
  if (inCorner(GRID - 5, 0)) return finderCell(row - (GRID - 5), col);
  return dataCell(row, col);
}

function QrBlock() {
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < GRID; row++)
    for (let col = 0; col < GRID; col++)
      if (moduleOn(row, col)) cells.push({ row, col });
  return (
    <div
      style={{
        width: GRID * CELL,
        height: GRID * CELL,
        position: "relative",
        background: "#FFFFFF",
      }}
    >
      {cells.map(({ row, col }) => (
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            top: row * CELL,
            left: col * CELL,
            width: CELL,
            height: CELL,
            background: "#07144F",
          }}
        />
      ))}
    </div>
  );
}

export default function DepositOnchain() {
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
          Deposit USDC
        </div>
      </div>

      <div
        style={{
          padding: "0 20px 10px",
          display: "flex",
          gap: 7,
          overflow: "auto",
        }}
      >
        {networks.map((n) => (
          <div
            key={n.id}
            style={{
              borderRadius: 999,
              padding: "7px 13px",
              fontSize: 12.5,
              fontWeight: 500,
              whiteSpace: "nowrap",
              border: `1px solid ${n.sel ? "#0868FF" : "#E3E6EE"}`,
              background: n.sel ? "#EAF4FF" : "#FFFFFF",
              color: n.sel ? "#0647E8" : "#454B5C",
            }}
          >
            {n.name}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "4px 20px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ ...white, borderRadius: 16, padding: 14 }}>
          <QrBlock />
        </div>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <div
          style={{
            ...white,
            borderRadius: 14,
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div style={label}>WALLET ADDRESS · BASE</div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 13.5,
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              {ADDRESS_SHORT}
            </div>
          </div>
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #DDE1E8",
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "#454B5C",
            }}
          >
            Copy
          </div>
        </div>
      </div>

      <div
        style={{
          margin: "12px 20px 0",
          background: "#FBEFEC",
          border: "1px solid #F0D3CC",
          borderRadius: 14,
          padding: "13px 15px",
          fontSize: 12,
          lineHeight: 1.55,
          color: "#8A4636",
        }}
      >
        Only send USDC on Base to this address. Any other asset or network sent
        here cannot be recovered.
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "14px 20px 22px",
          background: "#FFFFFF",
          borderTop: "1px solid #E3E6EE",
          fontSize: 11.5,
          color: "#7A8296",
          textAlign: "center",
        }}
      >
        Balance updates once the transaction confirms on-chain.
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "deposit-onchain",
  journey: "funding",
  title: "On-chain deposit",
  blurb:
    "Illustrates a deposit-address screen for a sandbox wallet. No live chain transfer occurs.",
  endpoint: "POST /v2/wallets",
  code: 'fetch("/v2/wallets", {\n  method: "POST",\n  headers: { "content-type": "application/json", "x-api-key": key },\n  body: JSON.stringify({ customer: "cus_41c", currency: "USDC", network: "base" })\n});',
};
