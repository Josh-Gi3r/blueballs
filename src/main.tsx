import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CanonicalHeader from "./CanonicalHeader";
import SiteRoot from "./SiteRoot";
import "./index.css";
import "./header-stability.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CanonicalHeader>
      <SiteRoot />
    </CanonicalHeader>
  </StrictMode>,
);
