import type { CSSProperties } from "react";

export function BrandMark({
  size = 28,
  style,
}: {
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <img
      src="/blueballs-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size * 2}
      style={{
        display: "block",
        width: size,
        height: size * 2,
        flex: "none",
        ...style,
      }}
    />
  );
}

export function BrandLockup({
  compact = false,
  inverse = false,
  linked = true,
}: {
  compact?: boolean;
  inverse?: boolean;
  linked?: boolean;
}) {
  const contents = (
    <>
      <BrandMark size={compact ? 12 : 14} />
      <span
        style={{
          fontSize: compact ? 15 : 16,
          fontWeight: 650,
          letterSpacing: "-0.025em",
          color: inverse ? "#FFFFFF" : "#07144F",
        }}
      >
        Blueballs
      </span>
    </>
  );

  if (!linked) {
    return <span className="bb-brand-lockup">{contents}</span>;
  }

  const home = (
    <a
      className="bb-brand-lockup"
      href="/home"
      aria-label="Blueballs home"
      style={{ color: "inherit", textDecoration: "none" }}
    >
      {contents}
    </a>
  );

  if (compact) return home;

  return (
    <span
      className="bb-brand-cluster"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 11,
        flexWrap: "wrap",
      }}
    >
      {home}
      <span
        aria-label="Blueballs product shortcuts"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 11,
          borderLeft: `1px solid ${inverse ? "#34416A" : "#D7DBE4"}`,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 8.5,
          letterSpacing: "0.07em",
          whiteSpace: "nowrap",
        }}
      >
        <a
          href="/blueprint"
          style={{
            color: inverse ? "#C5CAD7" : "#5B6376",
            textDecoration: "none",
          }}
        >
          BLUEPRINTS
        </a>
        <span aria-hidden="true" style={{ color: inverse ? "#66708A" : "#A7AEBB" }}>
          ·
        </span>
        <a
          href="/proof"
          style={{
            color: inverse ? "#C5CAD7" : "#5B6376",
            textDecoration: "none",
          }}
        >
          PROOF
        </a>
      </span>
    </span>
  );
}
