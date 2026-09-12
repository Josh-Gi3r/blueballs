import { PROVIDERS } from "./providers";
import type { Provider } from "./types";

export const PROVIDER_SHORTLIST_KEY = "blueballs_provider_shortlist";
export const PROVIDER_SHORTLIST_LIMIT = 3;
export const PROVIDER_SHORTLIST_EVENT = "blueballs:provider-shortlist";

const PROVIDER_IDS = new Set(PROVIDERS.map((provider) => provider.id));

export function sanitizeProviderShortlist(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && PROVIDER_IDS.has(item),
      ),
    ),
  ].slice(0, PROVIDER_SHORTLIST_LIMIT);
}

export function readProviderShortlist() {
  if (typeof window === "undefined") return [] as string[];
  try {
    return sanitizeProviderShortlist(
      JSON.parse(window.localStorage.getItem(PROVIDER_SHORTLIST_KEY) || "[]"),
    );
  } catch {
    return [] as string[];
  }
}

export function writeProviderShortlist(ids: string[]) {
  const safe = sanitizeProviderShortlist(ids);
  if (typeof window === "undefined") return safe;
  try {
    window.localStorage.setItem(PROVIDER_SHORTLIST_KEY, JSON.stringify(safe));
  } catch {
    // Shortlisting still works in memory when persistent storage is blocked.
  }
  window.dispatchEvent(
    new CustomEvent(PROVIDER_SHORTLIST_EVENT, { detail: { ids: safe } }),
  );
  return safe;
}

export function providersForShortlist(ids: string[]): Provider[] {
  const safe = sanitizeProviderShortlist(ids);
  return safe.flatMap((id) => {
    const provider = PROVIDERS.find((candidate) => candidate.id === id);
    return provider ? [provider] : [];
  });
}
