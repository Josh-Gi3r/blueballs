import PhoneScreen, { type Screen as LegacyScreen, type FxQuote } from "./PhoneScreen";
import { screenById } from "./screens/registry";

const MONO = "'IBM Plex Mono', monospace";

/** The 8 original screens live inside PhoneScreen and ship their own device frame.
 *  The 16 journey screens in src/screens/* are body-only and need one supplied.
 *  Device is the single place that knows the difference — render this, never either directly. */
const LEGACY = new Set<string>([
  "accounts", "cards", "transfers", "exchange", "vaults", "credit", "business", "ledger",
]);

export function isKnownScreen(id: string) {
  return LEGACY.has(id) || !!screenById(id);
}

export default function Device({
  id, fxQuote, fxErr,
}: { id: string; fxQuote?: FxQuote | null; fxErr?: boolean }) {
  // Fixed-size shell. PhoneScreen's root carries an INLINE height:100%, which beats any
  // stylesheet rule — so the only reliable way to size it is to give it a fixed parent.
  if (LEGACY.has(id)) {
    return (
      <div style={{ width: 348, height: 682, flex: "none" }}>
        <PhoneScreen screen={id as LegacyScreen} fxQuote={fxQuote} fxErr={fxErr} />
      </div>
    );
  }

  const entry = screenById(id);
  if (!entry) return null;
  const Body = entry.Component;

  return (
    <div style={{ width: 348, height: 682, flex: "none", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 328, height: 682, border: "1px solid #C9CEDA", borderRadius: 44, background: "#14161C", padding: 10, boxShadow: "0 18px 40px rgba(20,22,28,0.16)", boxSizing: "border-box" }}>
        <div style={{ background: "#F4F5F8", borderRadius: 35, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2, fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", padding: "3px 8px", borderRadius: 999, background: "#F0F1F5", color: "#7A8296", border: "1px solid #DDE1E8" }}>ILLUSTRATIVE · SAMPLE</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 24px 4px", fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em" }}>
            <span>9:41</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center", fontFamily: MONO, fontSize: 10 }}>
              <span>▮▮▮</span><span>ᯤ</span><span>▰</span>
            </div>
          </div>
          <Body />
        </div>
      </div>
    </div>
  );
}
