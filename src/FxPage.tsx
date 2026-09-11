import FinalFxPage from "./fx/FinalFxPage";
import "./fx/final-fx-layout-fixes.css";
import "./fx/final-fx-device.css";
import "./fx/final-fx-inspector.css";

/**
 * Public Blueballs FX product surface.
 *
 * The interactive market lab uses deterministic inputs so policy, pricing,
 * liquidity selection and settlement state remain inspectable in the browser.
 * The canonical FX runtime, production adapter contract and atomic settlement
 * kernel live in the same repository behind this product surface.
 */
export default function FxPage() {
  return <FinalFxPage />;
}
