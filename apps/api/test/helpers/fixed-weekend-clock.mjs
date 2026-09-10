// Test-only clock preload. Node's --import loads this before the banking server.
// Saturday 2026-09-12 keeps weekend-rail behaviour deterministic regardless of
// when the release suite runs.
const RealDate = Date;
const FIXED = RealDate.parse("2026-09-12T12:00:00.000Z");

class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [FIXED]));
  }

  static now() {
    return FIXED;
  }
}

Object.setPrototypeOf(FixedDate, RealDate);
globalThis.Date = FixedDate;
