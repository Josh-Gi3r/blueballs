export type GrowthEventName =
  | "provider_directory_view"
  | "provider_filter"
  | "provider_search"
  | "provider_shortlist"
  | "provider_unshortlist"
  | "provider_compare"
  | "provider_outbound"
  | "provider_claim_start"
  | "provider_partnership_start"
  | "blueprint_provider_matches_view"
  | "blueprint_share"
  | "blueprint_public_view"
  | "blueprint_fork_start"
  | "blueprint_template_open"
  | "blueprint_template_fork"
  | "implementation_brief_view"
  | "implementation_brief_copy"
  | "implementation_intake_start"
  | "proof_page_view"
  | "proof_source_open"
  | "builder_start"
  | "commercial_cta"
  | "commercial_contact_view";

type EventValue = string | number | boolean | null;
type EventProperties = Record<string, EventValue>;

const SESSION_KEY = "blueballs_growth_session";
const FIRST_TOUCH_KEY = "blueballs_growth_first_touch";

function sessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "unavailable";
  }
}

function attribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const current = {
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
  };
  try {
    const existing = window.sessionStorage.getItem(FIRST_TOUCH_KEY);
    if (existing) return JSON.parse(existing) as typeof current;
    if (current.source || current.medium || current.campaign) {
      window.sessionStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));
    }
  } catch {
    // Attribution must never interfere with the product experience.
  }
  return current;
}

export function trackGrowthEvent(
  name: GrowthEventName,
  properties: EventProperties = {},
) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    name,
    path: window.location.pathname,
    session_id: sessionId(),
    attribution: attribution(),
    properties,
  });

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        "/api/events",
        new Blob([payload], { type: "application/json" }),
      );
      if (queued) return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Growth measurement is deliberately best-effort and cannot block a user.
  }
}
