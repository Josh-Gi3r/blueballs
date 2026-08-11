import { CATEGORIES, PROVIDERS, type CategoryId } from "./data";

export type FilterId = "all" | CategoryId;

export default function CategoryMap({ active, setActive }: { active: FilterId; setActive: (id: FilterId) => void }) {
  return <div className="eco-map">
    <div className="eco-map-core"><span>BLUEBALLS</span><strong>Reference APIs, ledger, product flows and FX node</strong><small>Open source · self-hostable</small></div>
    <div className="eco-map-grid">{CATEGORIES.map((category, index) => <button key={category.id} type="button" className={active === category.id ? "active" : ""} onClick={() => setActive(category.id)}>
      <span>{String(index + 1).padStart(2, "0")}</span><b>{category.label}</b><small>{PROVIDERS.filter((provider) => provider.categories.includes(category.id)).length} options</small>
    </button>)}</div>
    <div className="eco-map-note"><span>DIRECTORY ONLY</span><strong>No verified integrations yet.</strong><small>Choose and test the services your deployment needs.</small></div>
  </div>;
}
