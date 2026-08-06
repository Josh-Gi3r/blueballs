import { useEffect, useState, type CSSProperties } from "react";
import { call, signup, ping, getKey, clearKey, sampleBody, API_BASE } from "./api";

const MONO = "'IBM Plex Mono', monospace";
const VERB_COLOR: Record<string, string> = {
  GET: "#2E7D53", POST: "#4E5FA6", PATCH: "#B0761E", PUT: "#B0761E", DELETE: "#B4453C",
};

/** Live status pill — proves the API is actually reachable from the page. */
export function ApiStatus() {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => ping().then((v) => alive && setUp(v));
    check();
    const t = setInterval(check, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const tone = up === null ? "#7A8296" : up ? "#2E7D53" : "#B4453C";
  const label = up === null ? "CHECKING" : up ? "API LIVE" : "API OFFLINE";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10,
      letterSpacing: "0.12em", color: tone, border: `1px solid ${tone}33`,
      background: `${tone}12`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
      {label}
      {up && <span style={{ color: "#7A8296" }}>· {API_BASE.replace("http://", "")}</span>}
    </span>
  );
}

/** Self-serve key issuer. Calls the real endpoint; shows the real key. */
export function KeyIssuer() {
  const [email, setEmail] = useState("");
  const [key, setKeyState] = useState<string | null>(getKey());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr(null);
    const r = await signup(email.trim());
    setBusy(false);
    if (r.error) return setErr(r.error);
    const k = (r.body as any)?.key;
    if (k) setKeyState(k);
    else setErr((r.body as any)?.detail ?? "Signup failed");
  };

  if (key) {
    return (
      <div style={{ background: "#EEF1FA", border: "1px solid #DADFF2", borderRadius: 12, padding: "13px 15px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "#4E5FA6", marginBottom: 7 }}>
          YOUR SANDBOX KEY · UNMETERED · NEVER EXPIRES
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, wordBreak: "break-all", color: "#14161C" }}>{key}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
          <button onClick={() => { navigator.clipboard?.writeText(key); }}
            style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "#4E5FA6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            COPY
          </button>
          <button onClick={() => { clearKey(); setKeyState(null); }}
            style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "#7A8296", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            FORGET
          </button>
          <span style={{ fontSize: 12, color: "#5B6376" }}>Every “Run” below now uses it.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="you@example.com"
        style={{ flex: "1 1 220px", minWidth: 0, border: "1px solid #DDE1E8", borderRadius: 10, background: "#F7F8FB", padding: "11px 14px", fontSize: 14.5, outline: "none" }} />
      <button onClick={go} disabled={busy}
        style={{ fontSize: 13.5, fontWeight: 500, padding: "11px 20px", cursor: busy ? "wait" : "pointer", border: "1px solid #14161C", borderRadius: 10, background: "#14161C", color: "#fff" }}>
        {busy ? "Issuing…" : "Get a sandbox key"}
      </button>
      {err && <div style={{ fontSize: 13, color: "#B4453C", flexBasis: "100%" }}>{err}</div>}
    </div>
  );
}

/** Per-endpoint runner. Fires the real request and shows the real response. */
export function TryIt({ verb, path }: { verb: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [pathInput, setPathInput] = useState(path);
  const [bodyInput, setBodyInput] = useState(() => {
    const s = sampleBody(verb, path);
    return s === undefined ? "" : JSON.stringify(s, null, 2);
  });
  const [res, setRes] = useState<Awaited<ReturnType<typeof call>> | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    let parsed: unknown = undefined;
    if (bodyInput.trim()) {
      try { parsed = JSON.parse(bodyInput); }
      catch { setBusy(false); setRes({ ok: false, status: 0, ms: 0, body: null, error: "Request body is not valid JSON" }); return; }
    }
    const r = await call(verb, pathInput, parsed);
    setRes(r); setBusy(false);
  };

  const statusColor = !res ? "#7A8296"
    : res.status === 0 ? "#B4453C"
    : res.status < 300 ? "#2E7D53"
    : res.status < 500 ? "#B0761E" : "#B4453C";

  const btn: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer",
    border: `1px solid ${open ? "#5A6DB8" : "#DDE1E8"}`, borderRadius: 7,
    background: open ? "#5A6DB8" : "#fff", color: open ? "#fff" : "#4E5FA6",
    padding: "4px 10px", whiteSpace: "nowrap", transition: "all .12s ease",
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} style={btn} aria-expanded={open}
        title={open ? "Hide the console" : "Run this endpoint against the live API"}>
        <span style={{ fontSize: 8, transform: open ? "rotate(90deg)" : "none", transition: "transform .12s ease", display: "inline-block" }}>▶</span>
        {open ? "HIDE" : "TRY"}
      </button>
      {open && (
        <div style={{ gridColumn: "1 / -1", marginTop: 10, marginBottom: 6, background: "#F7F8FB", border: "1px solid #E7EAF0", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: VERB_COLOR[verb], minWidth: 46 }}>{verb}</span>
            <input value={pathInput} onChange={(e) => setPathInput(e.target.value)}
              style={{ flex: "1 1 260px", minWidth: 0, fontFamily: MONO, fontSize: 12.5, border: "1px solid #DDE1E8", borderRadius: 8, padding: "8px 10px", background: "#fff", outline: "none" }} />
            <button onClick={run} disabled={busy}
              style={{ fontSize: 12.5, fontWeight: 500, padding: "8px 18px", cursor: busy ? "wait" : "pointer", border: "1px solid #14161C", borderRadius: 8, background: "#14161C", color: "#fff" }}>
              {busy ? "Running…" : "Run"}
            </button>
          </div>

          {bodyInput !== "" && (
            <textarea value={bodyInput} onChange={(e) => setBodyInput(e.target.value)} rows={Math.min(8, bodyInput.split("\n").length + 1)}
              spellCheck={false}
              style={{ width: "100%", fontFamily: MONO, fontSize: 12, border: "1px solid #DDE1E8", borderRadius: 8, padding: 10, background: "#fff", outline: "none", resize: "vertical", marginBottom: 10 }} />
          )}

          {res && (
            <div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", marginBottom: 6 }}>
                <span style={{ color: "#7A8296" }}>RESPONSE</span>
                <span style={{ color: statusColor }}>
                  {res.status === 0 ? "NO RESPONSE" : `HTTP ${res.status}`}
                </span>
                <span style={{ color: "#7A8296" }}>{res.ms} MS</span>
              </div>
              <pre style={{ margin: 0, background: "#14161C", color: "#E4E7EE", borderRadius: 10, padding: "14px 16px", fontFamily: MONO, fontSize: 12, lineHeight: 1.7, overflowX: "auto", maxHeight: 320 }}>
{res.error ? res.error : JSON.stringify(res.body, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </>
  );
}
