import assert from "node:assert/strict";
import test from "node:test";
import { coverFrame } from "./frontCover.ts";

test("the cover holds its product panel during the opening scroll", () => {
  assert.equal(coverFrame(0).cardOpacity, 1);
  assert.equal(coverFrame(0.2).cardOpacity, 1);
});

test("the real homepage begins revealing while the cover exits", () => {
  const midpoint = coverFrame(0.7);
  assert.ok(midpoint.homeReveal > 0);
  assert.ok(midpoint.coverOpacity > 0);
});

test("cover progress is deterministic and clamped", () => {
  assert.deepEqual(coverFrame(-1), coverFrame(0));
  assert.deepEqual(coverFrame(2), coverFrame(1));
  assert.equal(coverFrame(1).coverOpacity, 0);
  assert.equal(coverFrame(1).homeReveal, 1);
});
