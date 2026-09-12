import { useEffect, useState, type ReactNode } from "react";
import { BrandLockup } from "./Brand";
import { usePath } from "./router";
import "./canonical-header.css";

export const CANONICAL_PUBLIC_NAV = [
  ["Home", "/home"],
  ["Products", "/products"],
  ["Stablecoin FX", "/fx"],
  ["Developers", "/developers"],
  ["Cards", "/cards"],
  ["Providers", "/ecosystem"],
  ["Blueprints", "/blueprint"],
  ["Proof", "/proof"],
  ["Build with us", "/contact"],
] as const;

export const FULL_PUBLIC_HEADER_PATHS = new Set([
  "/home",
  "/products",
  "/fx",
  "/developers",
  "/cards",
  "/ecosystem",
  "/proof",
  "/contact",
]);

export default function CanonicalHeader({ children }: { children: ReactNode }) {
  const [path, navigate] = usePath();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showHeader = FULL_PUBLIC_HEADER_PATHS.has(path);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const go = (destination: string) => {
    setMobileOpen(false);
    navigate(destination);
  };

  const routeClass = path === "/contact" ? " bb-canonical-frame--contact" : "";

  return (
    <div
      className={`bb-canonical-frame${showHeader ? " bb-canonical-frame--full" : ""}${routeClass}`}
    >
      {showHeader && (
        <div className="bb-canonical-header-wrap">
          <header
            className="bb-canonical-header"
            aria-label="Blueballs primary navigation"
          >
            <button
              className="bb-canonical-brand"
              type="button"
              onClick={() => go("/home")}
              aria-label="Blueballs home"
            >
              <BrandLockup linked={false} />
              <span>OPEN SOURCE</span>
            </button>

            <nav className="bb-canonical-nav" aria-label="Primary navigation">
              {CANONICAL_PUBLIC_NAV.map(([label, destination]) => (
                <button
                  key={destination}
                  type="button"
                  aria-current={path === destination ? "page" : undefined}
                  onClick={() => go(destination)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button
              className="bb-canonical-cta"
              type="button"
              onClick={() => go("/sandbox")}
            >
              Try the sandbox
            </button>

            <button
              className="bb-canonical-menu-button"
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="bb-canonical-mobile-nav"
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            {mobileOpen && (
              <nav
                id="bb-canonical-mobile-nav"
                className="bb-canonical-mobile-nav"
                aria-label="Mobile primary navigation"
              >
                {CANONICAL_PUBLIC_NAV.map(([label, destination]) => (
                  <button
                    key={destination}
                    type="button"
                    aria-current={path === destination ? "page" : undefined}
                    onClick={() => go(destination)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="bb-canonical-mobile-cta"
                  type="button"
                  onClick={() => go("/sandbox")}
                >
                  Try the sandbox
                </button>
              </nav>
            )}
          </header>
        </div>
      )}

      <div className="bb-canonical-content">{children}</div>
    </div>
  );
}
