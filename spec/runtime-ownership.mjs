/**
 * Public edge runtime ownership contract.
 *
 * Canonical FX owns both builder-facing catalogue routes and a small set of
 * operator-only callback routes. Everything else under /v2 is owned by the
 * banking runtime unless explicitly handled by the Site Worker.
 *
 * Keep the public/private distinction machine-readable: public FX prefixes must
 * be represented in the 181-operation catalogue, while private prefixes are
 * routed to the FX node without being advertised as builder-facing operations.
 */
export const FX_NODE_PATH_PREFIXES = Object.freeze([
  "/v2/fx/depth",
  "/v2/fx/reference",
  "/v2/fx/orders",
  "/v2/fx/quotes",
  "/v2/fx/routes",
  "/v2/fx/fiat",
]);

export const FX_NODE_PRIVATE_PATH_PREFIXES = Object.freeze([
  "/v2/fx/ops",
]);

export const FX_NODE_ALL_PATH_PREFIXES = Object.freeze([
  ...FX_NODE_PATH_PREFIXES,
  ...FX_NODE_PRIVATE_PATH_PREFIXES,
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
    FX_NODE_ALL_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "fx";
  }
  if (pathname === "/v2" || pathname.startsWith("/v2/")) return "banking";
  return "site";
}
