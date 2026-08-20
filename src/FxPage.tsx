import FinalFxPage from "./fx/FinalFxPage";
import "./fx/final-fx-layout-fixes.css";
import "./fx/final-fx-device.css";
import "./fx/final-fx-inspector.css";

/**
 * Blueballs FX website experience.
 *
 * This route is a deterministic product simulation. It intentionally does not
 * call the hosted FX node, reserve liquidity, submit settlement or move money.
 * The repository remains the implementation source; the website explains it.
 */
export default function FxPage() {
  return <FinalFxPage />;
}
