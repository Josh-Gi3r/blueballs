import { useState, type ReactNode } from "react";
import { BrandLockup } from "./Brand";

export type Navigate = (path: string) => void;

const MONO = "'IBM Plex Mono', monospace";

export const PRIMARY_NAV = [
  ["Home", "/home"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Developers", "/developers"],
  ["Cards", "/cards"],
  ["Providers", "/ecosystem"],
] as const;

export function PrimaryHeader({
  path,
  navigate,
}: {
  path: string;
  navigate: Navigate;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (next: string) => {
    setMobileOpen(false);
    navigate(next);
  };

  return (
    <header
      className="bb-site-header"
      data-pad
      style={{
        width: "100%",
        maxWidth: 1200,
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
        padding: "12px 24px",
        background: "#fff",
        border: "1px solid #D7DBE4",
        borderRadius: 14,
      }}
    >
      <button
        className="bb-site-brand"
        type="button"
        onClick={() => go("/home")}
        aria-label="Blueballs home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          marginRight: "auto",
          border: 0,
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: "#07144F",
        }}
      >
        <BrandLockup linked={false} />
        <span
          className="bb-site-brand-tag"
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: ".14em",
            color: "#7A8296",
            borderLeft: "1px solid #D7DBE4",
            paddingLeft: 11,
          }}
        >
          OPEN SOURCE
        </span>
      </button>

      <nav
        className="bb-site-nav bb-site-nav-desktop"
        aria-label="Primary navigation"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        {PRIMARY_NAV.map(([label, href]) => {
          const active = path === href;
          return (
            <button
              key={href}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => go(href)}
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                padding: "9px 14px",
                cursor: "pointer",
                border: "none",
                borderRadius: 8,
                background: active ? "#F0F2F7" : "transparent",
                color: active ? "#07144F" : "#5B6376",
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <button
        className="bb-site-cta"
        type="button"
        onClick={() => go("/sandbox")}
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          padding: "10px 18px",
          cursor: "pointer",
          border: "1px solid #07144F",
          borderRadius: 10,
          background: "#07144F",
          color: "#fff",
        }}
      >
        Launch sandbox
      </button>

      <button
        className="bb-mobile-menu-button"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="bb-mobile-primary-nav"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMobileOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      {mobileOpen && (
        <nav
          id="bb-mobile-primary-nav"
          className="bb-mobile-nav"
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV.map(([label, href]) => (
            <button
              key={href}
              type="button"
              aria-current={path === href ? "page" : undefined}
              onClick={() => go(href)}
            >
              {label}
            </button>
          ))}
          <button
            className="bb-mobile-nav-primary"
            type="button"
            onClick={() => go("/sandbox")}
          >
            Launch sandbox
          </button>
        </nav>
      )}
    </header>
  );
}

export function SiteTicker({ items }: { items: string[] }) {
  const ticker = items.length ? items : ["BLUEBALLS · OPEN-SOURCE FINANCIAL INFRASTRUCTURE"];
  return (
    <div
      className="bb-ticker"
      aria-label={ticker.join(" · ")}
      style={{
        width: "100%",
        border: "1px solid #D7DBE4",
        borderRadius: 12,
        overflow: "hidden",
        padding: "9px 0",
        background: "#fff",
      }}
    >
      <div
        className="bb-ticker-track"
        aria-hidden="true"
        style={{
          display: "flex",
          width: "max-content",
          animation: "gb-marquee 52s linear infinite",
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: ".12em",
          color: "#5B6376",
        }}
      >
        {[0, 1].map((copy) => (
          <div
            className="bb-ticker-copy"
            key={copy}
            style={{ display: "flex", gap: 34, paddingRight: 34 }}
          >
            {ticker.map((item) => (
              <span key={`${copy}-${item}`}>{item}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FooterLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="eco-shell-link">
      {children}
    </button>
  );
}

export function SiteFooter({ navigate }: { navigate: Navigate }) {
  return (
    <footer
      data-pad
      className="eco-shell-footer"
      style={{
        background: "#07144F",
        color: "#fff",
        borderRadius: 18,
        padding: 26,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <BrandLockup compact inverse linked={false} />
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "#C5CAD7",
            maxWidth: "42ch",
          }}
        >
          The open-source operating system for modern financial institutions.
          Banking, provider orchestration and policy-aware FX in one institution-owned stack.
        </p>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8F98AC" }}>
          © 2026 · MIT LICENSE
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: ".16em",
            color: "#8F98AC",
            marginBottom: 10,
          }}
        >
          PLATFORM
        </div>
        <FooterLink onClick={() => navigate("/products")}>Products</FooterLink>
        <FooterLink onClick={() => navigate("/fx")}>Stablecoin FX</FooterLink>
        <FooterLink onClick={() => navigate("/cards")}>Cards</FooterLink>
        <FooterLink onClick={() => navigate("/ecosystem")}>Providers</FooterLink>
      </div>
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: ".16em",
            color: "#8F98AC",
            marginBottom: 10,
          }}
        >
          DEVELOPERS
        </div>
        <FooterLink onClick={() => navigate("/developers")}>Documentation</FooterLink>
        <FooterLink onClick={() => navigate("/sandbox")}>Sandbox</FooterLink>
        <a
          href="https://github.com/Josh-Gi3r/blueballs"
          className="eco-shell-link"
        >
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
