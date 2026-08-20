import type { CSSProperties } from "react";
import type { ScreenMeta } from "./registry";

/* Onboarding · step 1 — POST /v2/customers.
   Visual language copied from PhoneScreen.tsx: same MONO/label/white constants,
   328px-frame content padding, 10px uppercase mono section labels. */

const MONO = "'IBM Plex Mono', monospace";
const SANS = "Archivo, system-ui, sans-serif";
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "#7A8296" };
const white: CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E6EE" };

function Field({ tag, value, flex = 1 }: { tag: string; value: string; flex?: number }) {
  return (
    <div style={{ ...white, flex, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: "#7A8296" }}>{tag}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 3, color: "#07144F" }}>{value}</div>
    </div>
  );
}

export default function SignupScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: SANS }}>
      <div style={{ padding: "14px 20px 2px" }}>
        <div style={label}>STEP 1 OF 3 · INDIVIDUAL</div>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 4 }}>Create your account</div>
      </div>
      <div style={{ flex: 1, padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field tag="FIRST NAME" value="Ada" />
          <Field tag="LAST NAME" value="Lovelace" />
        </div>
        <Field tag="EMAIL" value="ada@lovelace.dev" />
        <Field tag="DATE OF BIRTH" value="10 Dec 1985" />
        <Field tag="ADDRESS" value="12 Rue de Rivoli" />
        <div style={{ display: "flex", gap: 8 }}>
          <Field tag="CITY" value="Paris" flex={1.4} />
          <Field tag="COUNTRY" value="France" />
        </div>
      </div>
      <div style={{ padding: "14px 20px 22px" }}>
        <div style={{ background: "#0868FF", color: "#FFFFFF", borderRadius: 12, padding: 15, textAlign: "center", fontSize: 14.5, fontWeight: 500 }}>
          Create account
        </div>
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: "#7A8296", textAlign: "center" }}>
          Calls <span style={{ fontFamily: MONO, color: "#5B6376" }}>POST /v2/customers</span> — your sandbox key already exists from signup.
        </div>
      </div>
    </div>
  );
}

export const meta: ScreenMeta = {
  id: "signup",
  journey: "onboarding",
  title: "Sign up",
  blurb: "Create the customer record used by the later sandbox requests.",
  endpoint: "POST /v2/customers",
  code: `fetch("/v2/customers", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key },
  body: JSON.stringify({ type: "individual", name: "Ada Lovelace", email: "ada@lovelace.dev" })
});`,
};
