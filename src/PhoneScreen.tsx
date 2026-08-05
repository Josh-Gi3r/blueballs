import type { CSSProperties } from "react";

/* Faithful port of `PhoneScreen.dc.html`.
   One prop: screen — accounts | cards | transfers | exchange | vaults | credit | business | ledger */

export type Screen =
  | "accounts" | "cards" | "transfers" | "exchange"
  | "vaults" | "credit" | "business" | "ledger";

const MONO = "'IBM Plex Mono', monospace";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };
const rowB: CSSProperties = { padding: "10px 0", borderBottom: "1px solid #F0F1F5" };

const toggle = (on: boolean): CSSProperties => ({
  width: 40, height: 24, borderRadius: 999, position: "relative", background: on ? "#5A6DB8" : "#DDE1E8",
});
const knob = (on: boolean): CSSProperties => ({
  position: "absolute", top: 2.5, ...(on ? { right: 2.5 } : { left: 2.5 }),
  width: 19, height: 19, borderRadius: 999, background: "#FFFFFF",
});

const BARS = [38, 44, 41, 52, 48, 55, 50, 46, 58, 61, 54, 49, 57, 63, 60, 55, 66, 70, 64, 59, 68, 74, 71, 78];

const accounts = [
  { sym: "€", name: "EUR main", sub: "DE89 3704 •••• 4417", amount: "€18,402.10" },
  { sym: "£", name: "GBP account", sub: "04-00-72 •••• 8823", amount: "£3,109.55" },
  { sym: "$", name: "USD account", sub: "ROUTING •••• 1902", amount: "$2,671.75" },
];
const txns = [
  { name: "Monoprix", when: "Today · 08:12", amount: "− €24.80", color: "#14161C" },
  { name: "Deutsche Bahn", when: "Yesterday · 19:40", amount: "− €89.00", color: "#14161C" },
  { name: "Refund · Uniqlo", when: "Yesterday · 12:03", amount: "+ €42.00", color: "#4E5FA6" },
  { name: "Spotify", when: "2 Aug · 06:00", amount: "− €11.99", color: "#14161C" },
];
const rails = [
  { name: "SEPA Instant", sub: "Arrives in seconds", fee: "Free", sel: true },
  { name: "SWIFT", sub: "1–2 business days", fee: "€6.00", sel: false },
  { name: "USDC · Base", sub: "Arrives in ~20 seconds", fee: "€0.40", sel: false },
];
const quoteRows = [
  { k: "Rate", v: "1 EUR = 0.85216 GBP" },
  { k: "Spread (4 bps)", v: "€4.00" },
  { k: "Arrives", v: "Instantly" },
];
const vaultRules = [
  { title: "Round up spare change", sub: "To the nearest €1", on: true },
  { title: "Weekly deposit", sub: "€120 every Monday", on: true },
  { title: "Lock until target", sub: "Withdrawals need approval", on: false },
];
const collateral = [
  { sym: "₿", name: "Bitcoin", sub: "0.42 BTC · 62% LTV", value: "€38,412" },
  { sym: "Ξ", name: "Ethereum", sub: "2.10 ETH · 62% LTV", value: "€6,940" },
];
const team = [
  { initials: "MK", name: "Marie Kessler", role: "Owner", spend: "€2,410", limit: "NO LIMIT" },
  { initials: "JD", name: "Jonas Dahl", role: "Admin · Ops", spend: "€860", limit: "€2,000/MO" },
  { initials: "RA", name: "Rina Aoki", role: "Member · Design", spend: "€312", limit: "€500/MO" },
  { initials: "PT", name: "Paul Tremblay", role: "Member · Sales", spend: "€1,204", limit: "€1,500/MO" },
];
const entries = [
  { date: "31/07", name: "Payroll · outgoing", acct: "DR 6000 / CR 1001", amount: "− €4,120.00", color: "#14161C" },
  { date: "28/07", name: "Client invoice 204", acct: "DR 1001 / CR 4000", amount: "+ €6,800.00", color: "#4E5FA6" },
  { date: "24/07", name: "FX EUR → GBP", acct: "DR 1002 / CR 1001", amount: "− €2,000.00", color: "#14161C" },
  { date: "19/07", name: "Vault interest", acct: "DR 1003 / CR 7100", amount: "+ €11.42", color: "#4E5FA6" },
  { date: "14/07", name: "Card settlement", acct: "DR 6100 / CR 1001", amount: "− €321.28", color: "#14161C" },
];

export default function PhoneScreen({ screen = "accounts" }: { screen?: Screen }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 328, border: "1px solid #C9CEDA", borderRadius: 44, background: "#14161C", padding: 10, boxShadow: "0 18px 40px rgba(20,22,28,0.16)" }}>
        <div style={{ background: "#F4F5F8", borderRadius: 35, overflow: "hidden", height: 660, display: "flex", flexDirection: "column", position: "relative" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 24px 4px", fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em" }}>
            <span>9:41</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center", fontFamily: MONO, fontSize: 10 }}><span>▮▮▮</span><span>ᯤ</span><span>▰</span></div>
          </div>

          {/* ---------- ACCOUNTS ---------- */}
          {screen === "accounts" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "#5A6DB8", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>AL</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Ada</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid #DDE1E8", background: "#FFFFFF" }} />
              </div>
              <div style={{ padding: "20px 20px 14px" }}>
                <div style={label}>TOTAL BALANCE · EUR</div>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6 }}>€24,183<span style={{ color: "#8A91A2" }}>.40</span></div>
                <div style={{ fontSize: 12.5, color: "#4E5FA6", marginTop: 4 }}>+ €412.10 this month</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 20px 16px" }}>
                {["Add", "Send", "Convert", "More"].map((a) => (
                  <div key={a} style={{ ...white, borderRadius: 12, padding: "13px 4px", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "#454B5C" }}>{a}</div>
                ))}
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", borderRadius: "22px 22px 0 0", padding: "16px 20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Accounts</div><div style={{ fontSize: 12.5, color: "#5A6DB8" }}>Manage</div>
                </div>
                {accounts.map((ac) => (
                  <div key={ac.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #F0F1F5" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: "#F0F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12, color: "#454B5C" }}>{ac.sym}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ac.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>{ac.sub}</div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ac.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- CARDS ---------- */}
          {screen === "cards" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Cards</div>
                <div style={{ fontSize: 13, color: "#5A6DB8", fontWeight: 500 }}>+ New</div>
              </div>
              <div style={{ padding: "12px 20px 8px" }}>
                <div style={{ borderRadius: 18, background: "#14161C", color: "#FFFFFF", padding: 20, height: 186, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: "#8B93A6" }}>VIRTUAL · EUR</div>
                    <div style={{ width: 30, height: 20, borderRadius: 4, background: "#5A6DB8" }} />
                  </div>
                  <div style={{ width: 40, height: 28, borderRadius: 5, background: "#333949", border: "1px solid #454B5C" }} />
                  <div style={{ fontFamily: MONO, fontSize: 15.5, letterSpacing: "0.14em" }}>•••• •••• •••• 4417</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: "#B9BFCC" }}><span>A. LOVELACE</span><span>09/29</span></div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "6px 20px 14px" }}>
                {["Freeze", "Limits", "Details"].map((c) => (
                  <div key={c} style={{ ...white, borderRadius: 12, padding: "12px 4px", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "#454B5C" }}>{c}</div>
                ))}
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0" }}>
                <div style={{ ...label, marginBottom: 8 }}>RECENT AUTHORISATIONS</div>
                {txns.map((t) => (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, ...rowB }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: "#F0F2F7" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#7A8296" }}>{t.when}</div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: t.color }}>{t.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- TRANSFERS ---------- */}
          {screen === "transfers" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Send money</div>
              </div>
              <div style={{ padding: "0 20px 12px" }}>
                <div style={{ ...white, borderRadius: 16, padding: 18 }}>
                  <div style={label}>AMOUNT</div>
                  <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 6 }}>€2,400.00</div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #F0F1F5", paddingTop: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: "#EEF1FA", color: "#4E5FA6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>MK</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>Marie Kessler</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296" }}>FR76 3000 •••• 2210</div>
                    </div>
                    <span style={{ color: "#7A8296" }}>›</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 20px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={label}>RAIL</div>
                {rails.map((r) => (
                  <div key={r.name} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderRadius: 14,
                    border: `1px solid ${r.sel ? "#5A6DB8" : "#E3E6EE"}`, background: r.sel ? "#EEF1FA" : "#FFFFFF",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: "#7A8296" }}>{r.sub}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: r.sel ? "#4E5FA6" : "#454B5C" }}>{r.fee}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "auto", padding: "14px 20px 22px", background: "#FFFFFF", borderTop: "1px solid #E3E6EE" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#7A8296", marginBottom: 12 }}><span>Arrives</span><span style={{ color: "#14161C" }}>In about 4 seconds</span></div>
                <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>Slide to send €2,400.00</div>
              </div>
            </div>
          )}

          {/* ---------- EXCHANGE ---------- */}
          {screen === "exchange" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 8px", fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Exchange</div>
              <div style={{ padding: "4px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ ...white, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296" }}><span>FROM</span><span>BAL €18,402.10</span></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>10,000</div>
                    <div style={{ border: "1px solid #DDE1E8", borderRadius: 999, padding: "7px 13px", fontFamily: MONO, fontSize: 12 }}>EUR ▾</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", margin: "-18px 0", position: "relative", zIndex: 1 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: "#FFFFFF", border: "1px solid #DDE1E8", display: "flex", alignItems: "center", justifyContent: "center", color: "#5A6DB8" }}>⇅</div>
                </div>
                <div style={{ ...white, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "#7A8296" }}><span>TO</span><span>MID + 4 BPS</span></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: "#4E5FA6" }}>8,521.63</div>
                    <div style={{ border: "1px solid #DDE1E8", borderRadius: 999, padding: "7px 13px", fontFamily: MONO, fontSize: 12 }}>GBP ▾</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: "12px 20px 4px", display: "flex", flexDirection: "column", gap: 7 }}>
                {quoteRows.map((q) => (
                  <div key={q.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#7A8296" }}><span>{q.k}</span><span style={{ color: "#14161C" }}>{q.v}</span></div>
                ))}
              </div>
              <div style={{ margin: "10px 20px 0", ...white, borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ ...label, letterSpacing: "0.14em", marginBottom: 10 }}>EUR / GBP · 30 DAYS</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
                  {BARS.map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, background: i > 19 ? "#5A6DB8" : "#DDE3F2" }} />
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "auto", padding: "14px 20px 22px" }}>
                <div style={{ background: "#5A6DB8", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>Convert · rate holds 30s</div>
              </div>
            </div>
          )}

          {/* ---------- VAULTS ---------- */}
          {screen === "vaults" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>House deposit</div>
              </div>
              <div style={{ padding: "0 20px 14px" }}>
                <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 18, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#8B93A6" }}>VAULT BALANCE · 4.82% AER</div>
                  <div style={{ fontSize: 33, fontWeight: 600, letterSpacing: "-0.04em" }}>€12,480<span style={{ color: "#8B93A6" }}>.00</span></div>
                  <div style={{ height: 7, borderRadius: 999, background: "#2A2E3A", overflow: "hidden" }}><div style={{ width: "62%", height: "100%", background: "#5A6DB8" }} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#B9BFCC" }}><span>62% of €20,000</span><span>Paid daily</span></div>
                </div>
              </div>
              <div style={{ padding: "0 20px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Add money", "Withdraw"].map((x) => (
                  <div key={x} style={{ ...white, borderRadius: 12, padding: 13, textAlign: "center", fontSize: 13.5, fontWeight: 500 }}>{x}</div>
                ))}
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0" }}>
                <div style={{ ...label, marginBottom: 6 }}>RULES</div>
                {vaultRules.map((r) => (
                  <div key={r.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #F0F1F5" }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
                      <div style={{ fontSize: 11.5, color: "#7A8296" }}>{r.sub}</div>
                    </div>
                    <div style={toggle(r.on)}><div style={knob(r.on)} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- CREDIT ---------- */}
          {screen === "credit" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 17, color: "#7A8296" }}>←</span>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Credit line</div>
              </div>
              <div style={{ padding: "0 20px 14px" }}>
                <div style={{ ...white, borderRadius: 18, padding: 20 }}>
                  <div style={label}>AVAILABLE TO DRAW</div>
                  <div style={{ fontSize: 33, fontWeight: 600, letterSpacing: "-0.04em", margin: "6px 0 14px" }}>€13,000<span style={{ color: "#8A91A2" }}>.00</span></div>
                  <div style={{ height: 7, borderRadius: 999, background: "#EDEFF4", overflow: "hidden" }}><div style={{ width: "48%", height: "100%", background: "#5A6DB8" }} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7A8296", marginTop: 8 }}><span>€12,000 drawn</span><span>Limit €25,000</span></div>
                </div>
              </div>
              <div style={{ padding: "0 20px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={label}>COLLATERAL</div>
                {collateral.map((c) => (
                  <div key={c.name} style={{ ...white, borderRadius: 14, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: "#F0F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11 }}>{c.sym}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "#7A8296" }}>{c.sub}</div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ margin: "0 20px", background: "#EEF1FA", border: "1px solid #DADFF2", borderRadius: 14, padding: "13px 15px", fontSize: 12.5, lineHeight: 1.5, color: "#3E4A78" }}>
                Liquidation at 78% LTV. You are notified 24 hours before any margin call.
              </div>
              <div style={{ marginTop: "auto", padding: "14px 20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ ...white, borderRadius: 12, padding: 14, textAlign: "center", fontSize: 13.5, fontWeight: 500 }}>Repay</div>
                <div style={{ background: "#14161C", color: "#FFFFFF", borderRadius: 12, padding: 14, textAlign: "center", fontSize: 13.5, fontWeight: 500 }}>Draw funds</div>
              </div>
            </div>
          )}

          {/* ---------- BUSINESS ---------- */}
          {screen === "business" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Kessler Ltd</div>
                <div style={{ fontSize: 12.5, color: "#5A6DB8" }}>Team</div>
              </div>
              <div style={{ padding: "4px 20px 14px" }}>
                <div style={{ ...white, borderRadius: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={label}>AWAITING APPROVAL</div>
                    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 4 }}>3 payments</div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 999, background: "#EEF1FA", color: "#4E5FA6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600 }}>3</div>
                </div>
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "15px 20px 0" }}>
                <div style={{ ...label, marginBottom: 6 }}>TEAM CARDS</div>
                {team.map((m) => (
                  <div key={m.initials} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F0F1F5" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: "#F0F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, color: "#454B5C" }}>{m.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: "#7A8296" }}>{m.role}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.spend}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: "#7A8296" }}>{m.limit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- LEDGER ---------- */}
          {screen === "ledger" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>Statement</div>
                <div style={{ fontSize: 12.5, color: "#5A6DB8" }}>Export</div>
              </div>
              <div style={{ padding: "4px 20px 12px", display: "flex", gap: 7 }}>
                {[{ label: "July", sel: true }, { label: "June", sel: false }, { label: "Q2", sel: false }].map((p) => (
                  <div key={p.label} style={{
                    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 500,
                    border: `1px solid ${p.sel ? "#5A6DB8" : "#E3E6EE"}`,
                    background: p.sel ? "#EEF1FA" : "#FFFFFF", color: p.sel ? "#4E5FA6" : "#454B5C",
                  }}>{p.label}</div>
                ))}
              </div>
              <div style={{ padding: "0 20px 12px" }}>
                <div style={{ ...white, borderRadius: 16, padding: 16, display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontFamily: MONO, fontSize: 10, color: "#7A8296", letterSpacing: "0.14em" }}>IN</div><div style={{ fontSize: 19, fontWeight: 600, color: "#4E5FA6" }}>€8,120.00</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontSize: 10, color: "#7A8296", letterSpacing: "0.14em" }}>OUT</div><div style={{ fontSize: 19, fontWeight: 600 }}>€6,441.28</div></div>
                </div>
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderTop: "1px solid #E3E6EE", padding: "14px 20px 0" }}>
                <div style={{ ...label, marginBottom: 6 }}>ENTRIES · DOUBLE-ENTRY</div>
                {entries.map((e) => (
                  <div key={e.date} style={{ display: "flex", alignItems: "center", gap: 10, ...rowB }}>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#7A8296", width: 44 }}>{e.date}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: "#7A8296" }}>{e.acct}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: e.color }}>{e.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
