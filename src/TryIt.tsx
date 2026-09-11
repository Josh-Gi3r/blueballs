import { useEffect, useState, type CSSProperties } from "react";
import {
  API_BASE,
  call,
  clearKey,
  getKey,
  ping,
  sampleBody,
  signup,
} from "./api";

const MONO = "'IBM Plex Mono', monospace";
const VERB_COLOR: Record<string, string> = {
  GET: "#2E7D53",
  POST: "#0647E8",
  PATCH: "#B0761E",
  PUT: "#B0761E",
  DELETE: "#B4453C",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #DDE1E8",
  borderRadius: 10,
  background: "#F7F8FB",
  padding: "10px 12px",
  fontFamily: MONO,
  fontSize: 11.5,
  outline: "none",
  boxSizing: "border-box",
};

export function ApiStatus() {
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () => ping().then((value) => alive && setUp(value));
    check();
    const timer = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const tone = up === null ? "#7A8296" : up ? "#2E7D53" : "#B4453C";
  const label = up === null ? "CHECKING" : up ? "API ONLINE" : "API OFFLINE";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: ".12em",
        color: tone,
        border: `1px solid ${tone}33`,
        background: `${tone}12`,
        borderRadius: 999,
        padding: "5px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
      {label}
      {up && (
        <span style={{ color: "#7A8296" }}>
          · {(API_BASE || "same-origin").replace("http://", "").replace("https://", "")}
        </span>
      )}
    </span>
  );
}

export function KeyIssuer() {
  const [email, setEmail] = useState("");
  const [key, setKeyState] = useState<string | null>(getKey());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await signup(email.trim());
    setBusy(false);
    const next = (result.body as any)?.key;
    if (result.ok && next) {
      setKeyState(next);
      return;
    }
    setError(
      result.error ||
        (result.body as any)?.detail ||
        `Key issuance failed with HTTP ${result.status}`,
    );
  };

  if (key) {
    const masked = `${key.slice(0, 12)}${"•".repeat(12)}${key.slice(-4)}`;
    return (
      <div
        style={{
          background: "#EAF4FF",
          border: "1px solid #CCE6FF",
          borderRadius: 12,
          padding: "13px 15px",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: ".14em",
            color: "#0647E8",
            marginBottom: 7,
          }}
        >
          SANDBOX KEY · TAB-SCOPED SESSION
        </div>
        <div
          aria-label={revealed ? "Sandbox key revealed" : "Sandbox key masked"}
          style={{
            fontFamily: MONO,
            fontSize: 12.5,
            wordBreak: "break-all",
            color: "#07144F",
          }}
        >
          {revealed ? key : masked}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            style={linkButton}
          >
            {revealed ? "HIDE" : "REVEAL"}
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(key)}
            style={linkButton}
          >
            COPY
          </button>
          <button
            type="button"
            onClick={() => {
              clearKey();
              setKeyState(null);
              setRevealed(false);
            }}
            style={{ ...linkButton, color: "#7A8296" }}
          >
            REMOVE
          </button>
          <span style={{ fontSize: 12, color: "#5B6376" }}>
            Stored in sessionStorage and cleared when this tab session ends.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && issue()}
        placeholder="you@example.com"
        aria-label="Email for sandbox key"
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          border: "1px solid #DDE1E8",
          borderRadius: 10,
          background: "#F7F8FB",
          padding: "11px 14px",
          fontSize: 14.5,
          outline: "none",
        }}
      />
      <button
        type="button"
        onClick={issue}
        disabled={busy || !email.trim()}
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          padding: "11px 20px",
          cursor: busy ? "wait" : "pointer",
          border: "1px solid #07144F",
          borderRadius: 10,
          background: "#07144F",
          color: "#fff",
          opacity: busy || !email.trim() ? .6 : 1,
        }}
      >
        {busy ? "Issuing…" : "Issue sandbox key"}
      </button>
      {error && (
        <div role="alert" style={{ fontSize: 13, color: "#B4453C", flexBasis: "100%" }}>
          {error}
        </div>
      )}
    </div>
  );
}

const linkButton: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10.5,
  letterSpacing: ".08em",
  color: "#0647E8",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

export function TryIt({ verb, path }: { verb: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [pathInput, setPathInput] = useState(path);
  const [bodyInput, setBodyInput] = useState(() => {
    const sample = sampleBody(verb, path);
    return sample === undefined ? "" : JSON.stringify(sample, null, 2);
  });
  const [result, setResult] = useState<Awaited<ReturnType<typeof call>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPathInput(path);
    const sample = sampleBody(verb, path);
    setBodyInput(sample === undefined ? "" : JSON.stringify(sample, null, 2));
    setResult(null);
  }, [verb, path]);

  const run = async () => {
    if (busy) return;
    let body: unknown = undefined;
    if (bodyInput.trim()) {
      try {
        body = JSON.parse(bodyInput);
      } catch {
        setResult({
          ok: false,
          status: 0,
          ms: 0,
          body: null,
          error: "Request body is not valid JSON.",
        });
        return;
      }
    }

    setBusy(true);
    const response = await call(verb, pathInput.trim(), body);
    setBusy(false);
    setResult(response);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          border: "1px solid #D7DBE4",
          borderRadius: 9,
          background: "#fff",
          color: "#0647E8",
          padding: "8px 11px",
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: ".08em",
          cursor: "pointer",
        }}
      >
        TRY REQUEST
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)", gap: 8 }}>
        <div
          style={{
            ...inputStyle,
            color: VERB_COLOR[verb] ?? "#07144F",
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
          }}
        >
          {verb}
        </div>
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          aria-label="Request path"
          style={inputStyle}
        />
      </div>

      {bodyInput !== "" && (
        <textarea
          value={bodyInput}
          onChange={(event) => setBodyInput(event.target.value)}
          aria-label="JSON request body"
          spellCheck={false}
          rows={7}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
        />
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          style={{
            border: "1px solid #07144F",
            borderRadius: 9,
            background: "#07144F",
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={linkButton}>
          CLOSE
        </button>
        {!getKey() && (
          <span style={{ fontSize: 11.5, color: "#7A8296" }}>
            Authenticated operations require a sandbox key above.
          </span>
        )}
      </div>

      {result && (
        <div
          style={{
            borderRadius: 11,
            padding: 13,
            background: "#07144F",
            color: "#E7EAF1",
            fontFamily: MONO,
            fontSize: 11,
            overflowX: "auto",
          }}
        >
          <div style={{ display: "flex", gap: 12, marginBottom: 9, color: result.ok ? "#86E0AA" : "#FF9B91" }}>
            <strong>HTTP {result.status || "—"}</strong>
            <span>{result.ms} ms</span>
          </div>
          {result.error && <div style={{ marginBottom: 8 }}>{result.error}</div>}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {typeof result.body === "string"
              ? result.body
              : JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
