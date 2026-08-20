import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SiteRoot from "./SiteRoot";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteRoot />
  </StrictMode>
);
