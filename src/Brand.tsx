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

  return (
    <a
      className="bb-brand-lockup"
      href="/"
      aria-label="Blueballs home"
      style={{ color: "inherit", textDecoration: "none" }}
    >
      {contents}
    </a>
  );
}
