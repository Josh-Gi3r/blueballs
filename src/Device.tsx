import type { ReactNode } from "react";
import PhoneScreen, {
  type Screen as LegacyScreen,
  type FxQuote,
} from "./PhoneScreen";
import { screenById } from "./screens/registry";

const MONO = "'IBM Plex Mono', monospace";
const DEVICE_WIDTH = 348;
const DEVICE_HEIGHT = 682;
const LEGACY = new Set<string>([
  "accounts",
  "cards",
  "transfers",
  "exchange",
  "vaults",
  "credit",
  "business",
  "ledger",
]);

export function isKnownScreen(id: string) {
  return LEGACY.has(id) || !!screenById(id);
}

export function DeviceShell({
  children,
  badge = "EXAMPLE UI",
  scale = 1,
}: {
  children: ReactNode;
  badge?: string;
  scale?: number;
}) {
  const safeScale = Math.max(0.5, Math.min(1.25, scale));
  return (
    <div
      style={{
        width: DEVICE_WIDTH * safeScale,
        height: DEVICE_HEIGHT * safeScale,
        flex: "none",
        position: "relative",
      }}
    >
      <div
        style={{
          width: DEVICE_WIDTH,
          height: DEVICE_HEIGHT,
          transform: `scale(${safeScale})`,
          transformOrigin: "top left",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 328,
            height: 682,
            border: "1px solid #C9CEDA",
            borderRadius: 44,
            background: "#07144F",
            padding: 10,
            boxShadow: "0 18px 40px rgba(20,22,28,0.16)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#F4F5F8",
              borderRadius: 35,
              overflow: "hidden",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 2,
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.12em",
                padding: "3px 8px",
                borderRadius: 999,
                background: "#F0F1F5",
                color: "#7A8296",
                border: "1px solid #DDE1E8",
              }}
            >
              {badge}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "13px 24px 4px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              <span>9:41</span>
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                  fontFamily: MONO,
                  fontSize: 10,
                }}
              >
                <span>▮▮▮</span>
                <span>ᯤ</span>
                <span>▰</span>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Device({
  id,
  fxQuote,
  fxErr,
}: {
  id: string;
  fxQuote?: FxQuote | null;
  fxErr?: boolean;
}) {
  if (LEGACY.has(id)) {
    return (
      <div style={{ width: 348, height: 682, flex: "none" }}>
        <PhoneScreen
          screen={id as LegacyScreen}
          fxQuote={fxQuote}
          fxErr={fxErr}
        />
      </div>
    );
  }

  const entry = screenById(id);
  if (!entry) {
    return (
      <DeviceShell badge="UNKNOWN SCREEN">
        <div style={{ padding: 24, color: "#7A8296", fontFamily: MONO }}>
          {id}
        </div>
      </DeviceShell>
    );
  }

  const Body = entry.Component;
  return (
    <DeviceShell>
      <Body />
    </DeviceShell>
  );
}
