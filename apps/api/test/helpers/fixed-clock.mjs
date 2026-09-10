/** Optional child-process clock used only by tests that need deterministic
 * business-day behavior. Production code never imports this module. */
const raw = process.env.BLUEBALLS_TEST_NOW;
if (raw) {
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error("BLUEBALLS_TEST_NOW must be an RFC 3339 timestamp");
  }
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [timestamp]));
    }
    static now() {
      return timestamp;
    }
  }
  globalThis.Date = FixedDate;
}
