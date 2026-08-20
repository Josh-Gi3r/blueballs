import { useEffect, useState } from "react";

/** Minimal history-API router. Real URLs so every screen is linkable,
 *  refreshable and back-button friendly — no framework needed. */
export function usePath(): [string, (p: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (p: string) => {
    if (p === window.location.pathname) return;
    window.history.pushState({}, "", p);
    setPath(p);
    window.scrollTo(0, 0);
  };

  return [path, go];
}
