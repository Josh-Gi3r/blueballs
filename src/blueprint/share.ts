export type SharedBlueprint = {
  v: 1;
  name: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  accent?: string;
};

type ShareableBlueprintInput = {
  name: string;
  markets: string[];
  currencies: string[];
  capabilities: string[];
  rails: string[];
  brand?: { accent?: string };
};

export const BLUEPRINT_FORK_KEY = "blueballs_blueprint_fork";
const MAX_HASH_LENGTH = 5000;
const MAX_NAME_LENGTH = 80;
const MAX_ITEMS = 16;
const MAX_ITEM_LENGTH = 40;

function cleanString(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().slice(0, max).replace(/[\u0000-\u001f\u007f]/g, "")
    : "";
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.map((item) => cleanString(item, MAX_ITEM_LENGTH)).filter(Boolean))].slice(
    0,
    MAX_ITEMS,
  );
}

function cleanAccent(value: unknown) {
  const accent = cleanString(value, 7);
  return /^#[0-9a-fA-F]{6}$/.test(accent) ? accent.toUpperCase() : undefined;
}

export function sanitizeSharedBlueprint(
  input: ShareableBlueprintInput | Record<string, unknown>,
): SharedBlueprint | null {
  const name = cleanString(input.name, MAX_NAME_LENGTH);
  const markets = cleanArray(input.markets);
  const currencies = cleanArray(input.currencies);
  const capabilities = cleanArray(input.capabilities);
  const rails = cleanArray(input.rails);
  const brand =
    input.brand && typeof input.brand === "object" && !Array.isArray(input.brand)
      ? (input.brand as Record<string, unknown>)
      : null;
  const accent = cleanAccent(brand?.accent);

  if (!name || capabilities.length === 0) return null;

  return {
    v: 1,
    name,
    markets,
    currencies,
    capabilities,
    rails,
    ...(accent ? { accent } : {}),
  };
}

export function encodeBlueprintShare(input: ShareableBlueprintInput) {
  const safe = sanitizeSharedBlueprint(input);
  if (!safe) return "";
  return `#blueprint=${encodeURIComponent(JSON.stringify(safe))}`;
}

export function decodeBlueprintShare(hash: string): SharedBlueprint | null {
  if (!hash || hash.length > MAX_HASH_LENGTH) return null;
  const prefix = "#blueprint=";
  if (!hash.startsWith(prefix)) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(hash.slice(prefix.length))) as Record<
      string,
      unknown
    >;
    if (parsed.v !== 1) return null;
    return sanitizeSharedBlueprint(parsed);
  } catch {
    return null;
  }
}

export function createBlueprintShareUrl(input: ShareableBlueprintInput) {
  const hash = encodeBlueprintShare(input);
  if (!hash || typeof window === "undefined") return "";
  return `${window.location.origin}/blueprint${hash}`;
}

export function stashBlueprintFork(blueprint: SharedBlueprint) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(BLUEPRINT_FORK_KEY, JSON.stringify(blueprint));
    return true;
  } catch {
    return false;
  }
}

export function consumeBlueprintFork() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BLUEPRINT_FORK_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(BLUEPRINT_FORK_KEY);
    return sanitizeSharedBlueprint(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}
