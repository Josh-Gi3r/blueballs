/**
 * Public edge runtime ownership contract.
 *
 * These are path prefixes owned by the canonical FX node. Everything else under
 * /v2 is owned by the banking runtime unless explicitly handled by the Site
 * Worker (builder-agent and health endpoints).
 *
 * Keep this file machine-readable: scripts/check-runtime-ownership.mjs proves
 * the Site Worker routing table and the FX node implementation agree with it.
 */
export const FX_NODE_PATH_PREFIXES = Object.freeze([
  "/v2/fx/depth",
  "/v2/fx/reference",
  "/v2/fx/orders",
  "/v2/fx/quotes",
  "/v2/fx/routes",
  "/v2/fx/fiat",
]);

export const SITE_INTERNAL_PATHS = Object.freeze([
  "/v2/builder-agent/chat",
  "/api/health",
  "/fx-health",
]);

export function runtimeForPath(pathname) {
  if (pathname === "/fx-health") return "fx";
  if (SITE_INTERNAL_PATHS.includes(pathname)) return "site";
  if (
    FX_NODE_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "fx";
  }
  if (pathname === "/v2" || pathname.startsWith("/v2/")) return "banking";
  return "site";
}
