/** Remove storage-only metadata before data crosses an API/event boundary.
 * Keep this module pure: lib.js uses it while the storage layer is booting. */
const INTERNAL_FIELDS = new Set(["owner"]);

export function publicShape(value) {
  if (Array.isArray(value)) return value.map(publicShape);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !INTERNAL_FIELDS.has(key))
      .map(([key, child]) => [key, publicShape(child)]),
  );
}
