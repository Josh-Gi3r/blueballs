import { BrandLockup } from "./Brand";

const MONO = "'IBM Plex Mono', monospace";
const REPO = "https://github.com/Josh-Gi3r/blueballs";
const ISSUE = `${REPO}/issues/new?template=`;

type ContactPageProps = { onNavigate: (path: string) => void };

const paths = [
  {
    eyebrow: "DESIGN PARTNER",
    title: "Design a financial product with Blueballs.",
    body: "For founders, institutions and product teams defining a new bank, stablecoin product, money-movement experience or institution-owned FX market.",
    action: "Start a design-partner brief",
    href: `${ISSUE}design_partner.yml`,
  },
  {
    eyebrow: "IMPLEMENTATION",
    title: "Turn the open-source stack into your stack.",
    body: "For teams that want help with architecture, provider adapters, ledger integration, deployment, operating design or production hardening.",
    action: "Discuss an implementation",
    href: `${ISSUE}implementation.yml`,
  },
  {
    eyebrow: "PROVIDERS",
    title: "Connect infrastructure to Blueballs.",
    body: "For banks, issuers, card platforms, KYC providers, custodians, payment rails, stablecoin infrastructure, liquidity venues and other financial providers.",
    action: "Open a provider brief",
    href: `${ISSUE}provider.yml`,
  },
  {
    eyebrow: "OPEN SOURCE",
    title: "Fork it. Extend it. Ship something new.",
    body: "Blueballs is MIT licensed. You do not need permission to use the code. Contributions, product ideas, adapters and new financial primitives are welcome.",
    action: "Build on GitHub",
    href: REPO,
  },
] as const;

export default function ContactPage({ onNavigate }: ContactPageProps) {
  const nav = [
    ["Home", "/home"],
    ["Products", "/products"],
    ["Stablecoin FX", "/fx"],
    ["Cards", "/cards"],
    ["Providers", "/ecosystem"],
    ["Developers", "/developers"],
  ] as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#E8EAEF",
        color: "#07144F",
        fontFamily: "Archivo, system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 20px",
            background: "#fff",
            border: "1px solid #D7DBE4",
            borderRadius: 14,
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate("/home")}
            style={{
              border: 0,
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              color: "#07144F",
              marginRight: "auto",
            }}
          >
            <BrandLockup linked={false} />
          </button>
          <nav style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {nav.map(([label, path]) => (
              <button
                key={path}
                type="button"
                onClick={() => onNavigate(path)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#5B6376",
                  padding: "9px 11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => onNavigate("/sandbox")}
            style={{
              border: "1px solid #07144F",
              borderRadius: 10,
              background: "#07144F",
              color: "#fff",
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try the sandbox
          </button>
        </header>

        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section
            style={{
              background: "#07144F",
              color: "#fff",
              borderRadius: 22,
              padding: "clamp(34px, 6vw, 76px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: ".18em",
                color: "#92A9FF",
                marginBottom: 18,
              }}
            >
              BUILD WITH BLUEBALLS
            </div>
            <h1
              style={{
                margin: 0,
                maxWidth: "12ch",
                fontSize: "clamp(42px, 7vw, 84px)",
                lineHeight: .98,
                letterSpacing: "-.055em",
                fontWeight: 600,
              }}
            >
              Take Blueballs from open source to your market.
            </h1>
            <p
              style={{
                maxWidth: "64ch",
                margin: "26px 0 0",
                fontSize: "clamp(17px, 2vw, 21px)",
                lineHeight: 1.6,
                color: "#C9D0E4",
              }}
            >
              Blueballs is free to use. If you want the project involved in
              designing, integrating, deploying or operating it, start here.
              Bring the market, the product and the regulated relationships you
              need. Blueballs brings the financial core and the architecture to
              build on.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 30,
              }}
            >
              <a
                href={`${ISSUE}design_partner.yml`}
                style={{
                  textDecoration: "none",
                  background: "#fff",
                  color: "#07144F",
                  borderRadius: 10,
                  padding: "12px 18px",
                  fontWeight: 600,
                }}
              >
                Become a design partner →
              </a>
              <button
                type="button"
                onClick={() => onNavigate("/developers")}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid #66729B",
                  borderRadius: 10,
                  padding: "12px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inspect the API
              </button>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {paths.map((item) => (
              <article
                key={item.eyebrow}
                style={{
                  minHeight: 280,
                  background: "#fff",
                  border: "1px solid #D7DBE4",
                  borderRadius: 18,
                  padding: 26,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: ".16em",
                    color: "#0647E8",
                  }}
                >
                  {item.eyebrow}
                </div>
                <h2
                  style={{
                    margin: "15px 0 12px",
                    fontSize: 24,
                    lineHeight: 1.12,
                    letterSpacing: "-.035em",
                  }}
                >
                  {item.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#5B6376",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
                <a
                  href={item.href}
                  style={{
                    marginTop: "auto",
                    paddingTop: 24,
                    color: "#0647E8",
                    textDecoration: "none",
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {item.action} →
                </a>
              </article>
            ))}
          </section>

          <section
            style={{
              background: "#fff",
              border: "1px solid #D7DBE4",
              borderRadius: 18,
              padding: "30px clamp(24px, 5vw, 52px)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 28,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: ".16em",
                  color: "#7A8296",
                }}
              >
                OPEN SOURCE FIRST
              </div>
              <h2 style={{ margin: "12px 0 8px", fontSize: 28 }}>
                You never need permission to fork Blueballs.
              </h2>
              <p style={{ margin: 0, color: "#5B6376", lineHeight: 1.65 }}>
                The commercial path is for teams that want Blueballs involved
                in product design, integration, deployment, provider composition
                or operating architecture. The MIT-licensed core stays open.
              </p>
            </div>
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: ".16em",
                  color: "#7A8296",
                }}
              >
                PUBLIC INTAKE
              </div>
              <h2 style={{ margin: "12px 0 8px", fontSize: 28 }}>
                Start in public. Move sensitive work off the issue.
              </h2>
              <p style={{ margin: 0, color: "#5B6376", lineHeight: 1.65 }}>
                The GitHub forms are for a non-confidential first brief. Never
                post credentials, customer data, security details or private
                commercial terms in a public issue.
              </p>
            </div>
          </section>
        </main>

        <footer
          style={{
            background: "#07144F",
            color: "#fff",
            borderRadius: 18,
            padding: 26,
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <BrandLockup compact inverse />
            <div
              style={{
                marginTop: 10,
                maxWidth: "46ch",
                color: "#C5CAD7",
                fontSize: 13.5,
                lineHeight: 1.6,
              }}
            >
              MIT-licensed open financial infrastructure for teams that want to
              own the product, the money logic and the provider composition.
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => onNavigate("/sandbox")}
              style={{
                border: 0,
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Sandbox
            </button>
            <a href={REPO} style={{ color: "#fff", textDecoration: "none" }}>
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
