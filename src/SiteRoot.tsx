import { lazy, Suspense, useEffect } from "react";
import App from "./App";
import CardsPage from "./CardsPage";
import EcosystemPage from "./EcosystemPage";
import { PrimaryHeader, SiteFooter, SiteTicker, type Navigate } from "./SiteChrome";
import { usePath } from "./router";
import SandboxPage from "./sandbox/SandboxPage";

const CityLanding = lazy(() => import("./city/CityLanding"));

const CARD_TICKER = [
  "CARD PROGRAMMES",
  "STABLECOIN FUNDING",
  "CUSTODY MODELS",
  "VISA",
  "MASTERCARD",
  "ISSUER + PROCESSOR",
  "REWARDS",
  "FX",
  "GEOGRAPHY",
  "SETTLEMENT",
];

const PROVIDER_TICKER = [
  "PROVIDER ORCHESTRATION",
  "ACCOUNTS",
  "IDENTITY + COMPLIANCE",
  "PAYMENT RAILS",
  "STABLECOINS",
  "WALLETS + CUSTODY",
  "CARD ISSUING",
  "FX + LIQUIDITY",
  "OPEN BANKING",
  "OPERATIONS",
];

function DirectoryShell({
  page,
  path,
  navigate,
}: {
  page: "cards" | "ecosystem";
  path: string;
  navigate: Navigate;
}) {
  return (
    <div
      className="bb-app-shell"
      style={{
        fontFamily: "Archivo, system-ui, sans-serif",
        color: "#07144F",
        background: "#E8EAEF",
        minHeight: "100vh",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <PrimaryHeader path={path} navigate={navigate} />
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <SiteTicker items={page === "cards" ? CARD_TICKER : PROVIDER_TICKER} />
        {page === "cards" ? (
          <CardsPage onNavigate={navigate} />
        ) : (
          <EcosystemPage onNavigate={navigate} />
        )}
        <SiteFooter navigate={navigate} />
      </div>
    </div>
  );
}

export default function SiteRoot() {
  const [path, navigate] = usePath();

  useEffect(() => {
    if (path === "/bulletin") navigate("/developers");
  }, [path, navigate]);

  if (path === "/") {
    return (
      <Suspense
        fallback={
          <div
            style={{ width: "100%", minHeight: "100vh", background: "#07144F" }}
          />
        }
      >
        <CityLanding />
      </Suspense>
    );
  }

  if (path === "/cards") {
    return (
      <DirectoryShell page="cards" path={path} navigate={navigate} />
    );
  }

  if (path === "/ecosystem") {
    return (
      <DirectoryShell page="ecosystem" path={path} navigate={navigate} />
    );
  }

  if (path === "/sandbox") return <SandboxPage />;

  return <App path={path} navigate={navigate} />;
}
