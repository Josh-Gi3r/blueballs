/** Coalesce concurrent calls and clear the cached promise after it settles. */
export function createSingleFlight(task) {
  let pending = null;
  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(task)
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
}
