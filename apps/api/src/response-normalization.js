/** Transport-level normalization for pre-1.0 handlers whose internal return
 * shape predates the production HTTP contract. Keep this small and delete an
 * entry when the owning family is migrated directly. */
export function normalizePublicOperationResponse(method, pattern, result) {
  if (
    method === "GET" &&
    pattern === "/v2/rates" &&
    result &&
    result.object !== "list"
  ) {
    return {
      object: "list",
      data: [result],
      has_more: false,
      next_cursor: null,
    };
  }
  return result;
}
