import type { CSSProperties } from "react";

const MONO = "'IBM Plex Mono', monospace";
const ink = "#07144F";
const blue = "#0868FF";
const muted = "#7A8296";
const line = "#E3E6EE";
const white: CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${line}`,
};

const balances = [
  { code: "EUR", amount: "€18,402.10", accent: "€" },
  { code: "GBP", amount: "£3,109.55", accent: "£" },
  { code: "USD", amount: "$2,671.75", accent: "$" },
  { code: "USDC", amount: "$2,400.00", accent: "U" },
];

const activity = [
  {
    icon: "M",
    name: "Monoprix",
    meta: "Today · Card",
    amount: "− €24.80",
    positive: false,
  },
  {
    icon: "S",
    name: "Salary",
    meta: "Today · Transfer",
    amount: "+ €4,850.00",
    positive: true,
  },
  {
    icon: "N",
    name: "Netflix",
    meta: "Yesterday · Card",
    amount: "− €11.99",
    positive: false,
  },
];

function Action({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        ...white,
        borderRadius: 13,
        padding: "11px 9px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          background: "#EAF4FF",
          border: "1px solid #CCE6FF",
          color: blue,
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ink }}>
        {label}
      </span>
    </div>
  );
}

export const meta = {
  id: "wallet-product",
  journey: "product" as const,
  title: "Wallet",
  blurb:
    "A customer money hub for balances, transfers, receiving and exchange.",
  endpoint: "GET /v2/wallets/:id",
  code: 'fetch("/v2/wallets/wal_7a2", {\n  headers: { "x-api-key": key }\n});',
  live: false,
};

export default function WalletProduct() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "14px 16px 12px",
        color: ink,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.15em",
              color: muted,
              marginBottom: 3,
            }}
          >
            YOUR MONEY
          </div>
          <div
            style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.035em" }}
          >
            Wallet
          </div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: ink,
            color: "#FFFFFF",
            display: "grid",
            placeItems: "center",
            fontSize: 11.5,
            fontWeight: 650,
          }}
        >
          AL
        </div>
      </div>

      <div
        style={{
          borderRadius: 18,
          padding: "17px 17px 15px",
          background: blue,
          color: "#FFFFFF",
          boxShadow: "0 10px 24px rgba(8,104,255,.15)",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.14em",
            opacity: 0.72,
          }}
        >
          TOTAL AVAILABLE
        </div>
        <div
          style={{
            fontSize: 31,
            fontWeight: 650,
            letterSpacing: "-0.045em",
            marginTop: 5,
          }}
        >
          €24,183<span style={{ opacity: 0.72 }}>.40</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
            fontSize: 11.5,
            opacity: 0.85,
          }}
        >
          <span>Across 4 balances</span>
          <span>≈ EUR</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 10,
        }}
      >
        <Action icon="+" label="Add money" />
        <Action icon="↗" label="Send" />
        <Action icon="↓" label="Receive" />
        <Action icon="⇄" label="Exchange" />
      </div>

      <div style={{ marginTop: 13 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 650 }}>Balances</div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8.5,
              letterSpacing: "0.1em",
              color: muted,
            }}
          >
            4 ACTIVE
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}
        >
          {balances.map((item) => (
            <div
              key={item.code}
              style={{
                ...white,
                borderRadius: 12,
                padding: "9px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 8,
                  background: "#F0F2F7",
                  display: "grid",
                  placeItems: "center",
                  color: ink,
                  fontSize: 11.5,
                  fontWeight: 650,
                }}
              >
                {item.accent}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 8.5,
                    letterSpacing: "0.08em",
                    color: muted,
                  }}
                >
                  {item.code}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 650,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.amount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 13, minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 5,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 650 }}>Recent activity</div>
          <div style={{ fontSize: 10.5, color: blue, fontWeight: 600 }}>
            View all
          </div>
        </div>
        <div style={{ ...white, borderRadius: 13, padding: "0 11px" }}>
          {activity.map((item, index) => (
            <div
              key={item.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 0",
                borderBottom:
                  index === activity.length - 1 ? "none" : "1px solid #EEF0F4",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: "#F0F2F7",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10.5,
                  fontWeight: 650,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 9.5, color: muted, marginTop: 1 }}>
                  {item.meta}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  color: item.positive ? blue : ink,
                  whiteSpace: "nowrap",
                }}
              >
                {item.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
