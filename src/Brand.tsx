import type { CSSProperties } from "react";

export function BrandMark({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  return (
    <img
      src="/blueballs-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size * 2}
      style={{ display: "block", width: size, height: size * 2, flex: "none", ...style }}
    />
  );
}

export function BrandLockup({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="bb-brand-lockup">
      <BrandMark size={compact ? 12 : 14} />
      <span style={{ fontSize: compact ? 15 : 16, fontWeight: 650, letterSpacing: "-0.025em", color: inverse ? "#FFFFFF" : "#07144F" }}>
        Blueballs
      </span>
    </span>
  );
}
