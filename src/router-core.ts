import type { GrowthEventName } from "./growth/events";

type EventValue = string | number | boolean | null;
type EventProperties = Record<string, EventValue>;

export type NavigationRuntime = {
  pathname: string;
  pushState: (path: string) => void;
  broadcastLocationChange: () => void;
  scrollToTop: () => void;
  track: (name: GrowthEventName, properties?: EventProperties) => void;
};

export type NavigationResult = {
  changed: boolean;
  sourcePath: string;
  destination: string;
  growthEvent: GrowthEventName | null;
};

export function navigatePath(
  destination: string,
  runtime: NavigationRuntime,
): NavigationResult {
  const sourcePath = runtime.pathname;

  if (destination === sourcePath) {
    runtime.scrollToTop();
    return {
      changed: false,
      sourcePath,
      destination,
      growthEvent: null,
    };
  }

  let growthEvent: GrowthEventName | null = null;
  if (destination === "/sandbox") {
    growthEvent = "builder_start";
  } else if (destination === "/contact") {
    growthEvent = "commercial_contact_view";
  }

  if (growthEvent) runtime.track(growthEvent, { source_path: sourcePath });

  runtime.pushState(destination);
  runtime.broadcastLocationChange();
  runtime.scrollToTop();

  return {
    changed: true,
    sourcePath,
    destination,
    growthEvent,
  };
}
