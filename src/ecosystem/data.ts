export type { CategoryId, EcosystemCategory, Provider, ProviderKind } from "./types";
export { CATEGORIES } from "./categories";
export { PROVIDERS } from "./providers";
import { CATEGORIES } from "./categories";
import type { CategoryId, EcosystemCategory } from "./types";
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<CategoryId, EcosystemCategory>;
