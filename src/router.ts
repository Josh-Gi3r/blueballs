import { useCallback, useEffect, useState } from "react";
import { trackGrowthEvent } from "./growth/events";
import { navigatePath } from "./router-core";

/** Minimal history-API router. Real URLs so every screen is linkable,
 * refreshable and back-button friendly — no framework needed.
 *
 * Navigation is broadcast through popstate after pushState so every mounted
 * route boundary observes the same location change. Blueballs has a top-level
 * SiteRoot router plus page-level consumers of usePath(); keeping those routers
 * in sync is required for cross-shell routes such as /cards and /ecosystem.
 */
export function usePath(): [string, (p: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((p: string) => {
    navigatePath(p, {
      pathname: window.location.pathname,
      pushState: (destination) => window.history.pushState({}, "", destination),
      broadcastLocationChange: () =>
        window.dispatchEvent(new PopStateEvent("popstate")),
      scrollToTop: () => window.scrollTo(0, 0),
      track: trackGrowthEvent,
    });
  }, []);

  return [path, go];
}
