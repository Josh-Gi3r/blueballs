export type { CategoryId, EcosystemCategory, Provider, ProviderKind } from "./types";
export { CATEGORIES } from "./categories";
import { PROVIDERS as P1 } from "./providers-01";
import { PROVIDERS as P2 } from "./providers-02";
import { PROVIDERS as P3 } from "./providers-03";
import { PROVIDERS as P4 } from "./providers-04";
import { PROVIDERS as P5 } from "./providers-05";
import { PROVIDERS as P6 } from "./providers-06";
import { PROVIDERS as P7 } from "./providers-07";
import { PROVIDERS as P8 } from "./providers-08";
import { PROVIDERS as P9 } from "./providers-09";

export const PROVIDERS = [...P1, ...P2, ...P3, ...P4, ...P5, ...P6, ...P7, ...P8, ...P9];
import { CATEGORIES } from "./categories";
import type { CategoryId, EcosystemCategory } from "./types";
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<CategoryId, EcosystemCategory>;
